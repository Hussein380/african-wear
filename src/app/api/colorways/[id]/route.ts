import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { deleteCloudinaryImage } from '@/lib/cloudinary'

// PUT /api/colorways/:id — update colorway
export async function PUT(
  request: Request,
  ctx: RouteContext<'/api/colorways/[id]'>
) {
  try {
    const { id } = await ctx.params
    const body = await request.json()
    const { fullCode, photos, quantityAvailable, breakdown, buyingPrice, sellingPrice } = body

    const db = await getDb()
    const objectId = new ObjectId(id)

    const existing = await db.collection('colorways').findOne({ _id: objectId })
    if (!existing) {
      return NextResponse.json({ error: 'Colorway not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    const unsetData: Record<string, string> = {}

    if (fullCode !== undefined) updateData.fullCode = fullCode
    if (photos !== undefined) updateData.photos = photos
    if (quantityAvailable !== undefined) updateData.quantityAvailable = quantityAvailable
    if (breakdown !== undefined) updateData.breakdown = breakdown

    if (buyingPrice !== undefined) {
      if (buyingPrice === null || buyingPrice === '' || isNaN(Number(buyingPrice))) {
        unsetData.buyingPrice = ''
      } else {
        updateData.buyingPrice = Number(buyingPrice)
      }
    }

    if (sellingPrice !== undefined) {
      if (sellingPrice === null || sellingPrice === '' || isNaN(Number(sellingPrice))) {
        unsetData.sellingPrice = ''
      } else {
        updateData.sellingPrice = Number(sellingPrice)
      }
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

    // Log activity if quantity changed
    let loggedBreakdown = false;
    
    if (breakdown !== undefined && (breakdown.length > 0 || (existing.breakdown && existing.breakdown.length > 0))) {
      loggedBreakdown = true;
      const oldBreakdown = existing.breakdown || [];
      const newBreakdown = breakdown;

      for (const newItem of newBreakdown) {
        const oldItem = oldBreakdown.find((i: any) => i.id === newItem.id);
        const oldQty = oldItem ? oldItem.quantity : 0;
        if (newItem.quantity !== oldQty) {
          const quantityChange = newItem.quantity - oldQty;
          await db.collection('activities').insertOne({
            type: quantityChange > 0 ? 'IN' : 'OUT',
            quantityChange: Math.abs(quantityChange),
            colorwayId: existing._id.toString(),
            designCodeId: existing.designCodeId,
            fullCode: existing.fullCode,
            previousQuantity: oldQty,
            newQuantity: newItem.quantity,
            subVariantLabel: newItem.label,
            timestamp: new Date().toISOString()
          });
        }
      }

      for (const oldItem of oldBreakdown) {
        if (!newBreakdown.find((i: any) => i.id === oldItem.id)) {
          if (oldItem.quantity > 0) {
            await db.collection('activities').insertOne({
              type: 'OUT',
              quantityChange: oldItem.quantity,
              colorwayId: existing._id.toString(),
              designCodeId: existing.designCodeId,
              fullCode: existing.fullCode,
              previousQuantity: oldItem.quantity,
              newQuantity: 0,
              subVariantLabel: oldItem.label,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }

    if (!loggedBreakdown && quantityAvailable !== undefined && quantityAvailable !== existing.quantityAvailable) {
      const quantityChange = quantityAvailable - existing.quantityAvailable
      await db.collection('activities').insertOne({
        type: quantityChange > 0 ? 'IN' : 'OUT',
        quantityChange: Math.abs(quantityChange),
        colorwayId: existing._id.toString(),
        designCodeId: existing.designCodeId,
        fullCode: existing.fullCode,
        previousQuantity: existing.quantityAvailable,
        newQuantity: quantityAvailable,
        timestamp: new Date().toISOString()
      })
    }

    const updateOp: Record<string, unknown> = { $set: updateData }
    if (Object.keys(unsetData).length > 0) {
      updateOp.$unset = unsetData
    }

    await db.collection('colorways').updateOne(
      { _id: objectId },
      updateOp
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating colorway:', error)
    return NextResponse.json({ error: 'Failed to update colorway' }, { status: 500 })
  }
}

// PATCH /api/colorways/:id — quick update quantity or price
export async function PATCH(
  request: Request,
  ctx: RouteContext<'/api/colorways/[id]'>
) {
  try {
    const { id } = await ctx.params
    const body = await request.json()
    const { quantityAvailable, buyingPrice, sellingPrice } = body

    const db = await getDb()
    const objectId = new ObjectId(id)

    const existing = await db.collection('colorways').findOne({ _id: objectId })
    if (!existing) {
      return NextResponse.json({ error: 'Colorway not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    const unsetData: Record<string, string> = {}

    if (quantityAvailable !== undefined && typeof quantityAvailable === 'number') {
      updateData.quantityAvailable = quantityAvailable
    }

    if (buyingPrice !== undefined) {
      if (buyingPrice === null || buyingPrice === '' || isNaN(Number(buyingPrice))) {
        unsetData.buyingPrice = ''
      } else {
        updateData.buyingPrice = Number(buyingPrice)
      }
    }

    if (sellingPrice !== undefined) {
      if (sellingPrice === null || sellingPrice === '' || isNaN(Number(sellingPrice))) {
        unsetData.sellingPrice = ''
      } else {
        updateData.sellingPrice = Number(sellingPrice)
      }
    }

    const updateOp: Record<string, unknown> = { $set: updateData }
    if (Object.keys(unsetData).length > 0) {
      updateOp.$unset = unsetData
    }

    await db.collection('colorways').updateOne(
      { _id: objectId },
      updateOp
    )

    if (quantityAvailable !== undefined && typeof quantityAvailable === 'number' && quantityAvailable !== existing.quantityAvailable) {
      const quantityChange = quantityAvailable - existing.quantityAvailable
      await db.collection('activities').insertOne({
        type: quantityChange > 0 ? 'IN' : 'OUT',
        quantityChange: Math.abs(quantityChange),
        colorwayId: existing._id.toString(),
        designCodeId: existing.designCodeId,
        fullCode: existing.fullCode,
        previousQuantity: existing.quantityAvailable,
        newQuantity: quantityAvailable,
        timestamp: new Date().toISOString()
      })
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
