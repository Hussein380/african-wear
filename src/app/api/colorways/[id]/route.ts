import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { deleteCloudinaryImage } from '@/lib/cloudinary'
import { validateStock, sameStock, Bale } from '@/lib/breakdown'

// PUT /api/colorways/:id — update colorway
//
// Stock numbers are only written when staff actually changed them in the form, and only if
// nobody else changed the stock since the form was opened (`stockBase` = what the form showed).
// Otherwise a sale made on another phone could be silently overwritten by an old number.
export async function PUT(
  request: Request,
  ctx: RouteContext<'/api/colorways/[id]'>
) {
  try {
    const { id } = await ctx.params
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid item' }, { status: 400 })
    }
    const body = await request.json()
    const { fullCode, photos, quantityAvailable, breakdown, location, stockBase } = body

    const db = await getDb()
    const objectId = new ObjectId(id)

    const existing = await db.collection('colorways').findOne({ _id: objectId })
    if (!existing) {
      return NextResponse.json({ error: 'Colorway not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    const unsetData: Record<string, string> = {}

    if (fullCode !== undefined) {
      const trimmedCode = fullCode.trim()
      if (trimmedCode !== existing.fullCode) {
        const duplicate = await db.collection('colorways').findOne({ fullCode: trimmedCode, _id: { $ne: objectId } })
        if (duplicate) {
          return NextResponse.json({ error: `A fabric with code "${trimmedCode}" already exists` }, { status: 409 })
        }
      }
      updateData.fullCode = trimmedCode
    }
    if (photos !== undefined) updateData.photos = photos
    if (location !== undefined) {
      if (!location || !location.trim()) {
        unsetData.location = ''
      } else {
        updateData.location = location.trim()
      }
    }

    // ---- Stock ----
    const current = { quantityAvailable: existing.quantityAvailable ?? 0, breakdown: (existing.breakdown || []) as Bale[] }
    const adjustments: Record<string, unknown>[] = []

    if (quantityAvailable !== undefined || breakdown !== undefined) {
      const checked = validateStock(breakdown ?? existing.breakdown, quantityAvailable ?? existing.quantityAvailable)
      if ('error' in checked) {
        return NextResponse.json({ error: checked.error }, { status: 400 })
      }
      const wanted = { quantityAvailable: checked.total, breakdown: checked.breakdown }
      const base = stockBase && typeof stockBase === 'object'
        ? { quantityAvailable: Number(stockBase.quantityAvailable) || 0, breakdown: (stockBase.breakdown || []) as Bale[] }
        : current
      const stockEdited = !sameStock(wanted, base)

      if (stockEdited) {
        if (!sameStock(current, base)) {
          return NextResponse.json(
            { error: 'The stock for this item changed on another phone since you opened it. Close this and open it again to see the latest numbers.' },
            { status: 409 }
          )
        }
        updateData.quantityAvailable = wanted.quantityAvailable
        updateData.breakdown = wanted.breakdown

        // A typed correction is an adjustment, not a sale or a delivery
        const now = new Date().toISOString()
        const record = (change: number, before: number, after: number, label?: string) => adjustments.push({
          type: change > 0 ? 'IN' : 'OUT',
          kind: 'count_diff',
          quantityChange: Math.abs(change),
          colorwayId: existing._id.toString(),
          designCodeId: existing.designCodeId,
          fullCode: updateData.fullCode ?? existing.fullCode,
          previousQuantity: before,
          newQuantity: after,
          ...(label ? { subVariantLabel: label } : {}),
          timestamp: now,
        })
        if (wanted.breakdown.length > 0 || current.breakdown.length > 0) {
          for (const b of wanted.breakdown) {
            const before = current.breakdown.find(o => o.id === b.id)?.quantity ?? 0
            if (b.quantity !== before) record(b.quantity - before, before, b.quantity, b.label)
          }
          for (const o of current.breakdown) {
            if (!wanted.breakdown.some(b => b.id === o.id) && o.quantity > 0) record(-o.quantity, o.quantity, 0, o.label)
          }
          // Item switched from a plain number to colours (or back): record the plain part too
          if (current.breakdown.length === 0 && current.quantityAvailable > 0) {
            record(-current.quantityAvailable, current.quantityAvailable, 0)
          }
          if (wanted.breakdown.length === 0 && wanted.quantityAvailable > 0) {
            record(wanted.quantityAvailable, 0, wanted.quantityAvailable)
          }
        } else {
          record(wanted.quantityAvailable - current.quantityAvailable, current.quantityAvailable, wanted.quantityAvailable)
        }
      } else if (wanted.breakdown.length > 0) {
        // Quantities untouched: keep the live numbers and only take renamed colours
        updateData.breakdown = current.breakdown.map(o => ({
          ...o,
          label: wanted.breakdown.find(b => b.id === o.id)?.label ?? o.label,
        }))
      }
    }

    // Write only if the item was not changed since we read it (every stock change sets updatedAt)
    const updateOp: Record<string, unknown> = { $set: updateData }
    if (Object.keys(unsetData).length > 0) {
      updateOp.$unset = unsetData
    }
    const result = await db.collection('colorways').updateOne(
      { _id: objectId, updatedAt: existing.updatedAt ?? null },
      updateOp
    )
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'This item changed while saving. Please try again.' },
        { status: 409 }
      )
    }
    if (adjustments.length > 0) {
      await db.collection('activities').insertMany(adjustments)
    }

    // If photos are being replaced, delete old photos from Cloudinary that aren't in the new set
    if (photos !== undefined && existing.photos) {
      const newPublicIds = new Set(photos.map((p: { publicId: string }) => p.publicId))
      for (const oldPhoto of existing.photos) {
        if (oldPhoto.publicId && !newPublicIds.has(oldPhoto.publicId)) {
          try {
            await deleteCloudinaryImage(oldPhoto.publicId)
          } catch (e) {
            console.error('Failed to delete old photo:', e)
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating colorway:', error)
    return NextResponse.json({ error: 'Failed to update colorway' }, { status: 500 })
  }
}

// DELETE /api/colorways/:id — delete colorway
export async function DELETE(
  _request: Request,
  ctx: RouteContext<'/api/colorways/[id]'>
) {
  try {
    const { id } = await ctx.params
    const db = await getDb()
    const objectId = new ObjectId(id)

    const colorway = await db.collection('colorways').findOne({ _id: objectId })
    if (!colorway) {
      return NextResponse.json({ error: 'Colorway not found' }, { status: 404 })
    }

    // Delete photos from Cloudinary
    if (colorway.photos && Array.isArray(colorway.photos)) {
      for (const photo of colorway.photos) {
        if (photo.publicId) {
          try {
            await deleteCloudinaryImage(photo.publicId)
          } catch (e) {
            console.error('Failed to delete photo:', e)
          }
        }
      }
    }

    // Keep the history honest: stock that disappears with the item is recorded as removed
    if (colorway.quantityAvailable > 0) {
      await db.collection('activities').insertOne({
        type: 'OUT',
        kind: 'deleted',
        quantityChange: colorway.quantityAvailable,
        colorwayId: colorway._id.toString(),
        designCodeId: colorway.designCodeId,
        fullCode: colorway.fullCode,
        previousQuantity: colorway.quantityAvailable,
        newQuantity: 0,
        timestamp: new Date().toISOString(),
      })
    }

    await db.collection('colorways').deleteOne({ _id: objectId })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting colorway:', error)
    return NextResponse.json({ error: 'Failed to delete colorway' }, { status: 500 })
  }
}
