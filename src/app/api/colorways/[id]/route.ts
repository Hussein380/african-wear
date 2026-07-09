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
    const { fullCode, photos, quantityAvailable, breakdown } = body

    const db = await getDb()
    const objectId = new ObjectId(id)

    const existing = await db.collection('colorways').findOne({ _id: objectId })
    if (!existing) {
      return NextResponse.json({ error: 'Colorway not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (fullCode !== undefined) updateData.fullCode = fullCode
    if (photos !== undefined) updateData.photos = photos
    if (quantityAvailable !== undefined) updateData.quantityAvailable = quantityAvailable
    if (breakdown !== undefined) updateData.breakdown = breakdown

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

    await db.collection('colorways').updateOne(
      { _id: objectId },
      { $set: updateData }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating colorway:', error)
    return NextResponse.json({ error: 'Failed to update colorway' }, { status: 500 })
  }
}

// PATCH /api/colorways/:id — quick update quantity only
export async function PATCH(
  request: Request,
  ctx: RouteContext<'/api/colorways/[id]'>
) {
  try {
    const { id } = await ctx.params
    const { quantityAvailable } = await request.json()

    if (quantityAvailable === undefined || typeof quantityAvailable !== 'number') {
      return NextResponse.json({ error: 'quantityAvailable is required' }, { status: 400 })
    }

    const db = await getDb()
    const objectId = new ObjectId(id)

    const existing = await db.collection('colorways').findOne({ _id: objectId })
    if (!existing) {
      return NextResponse.json({ error: 'Colorway not found' }, { status: 404 })
    }

    const previousQuantity = existing.quantityAvailable

    await db.collection('colorways').updateOne(
      { _id: objectId },
      { $set: { quantityAvailable, updatedAt: new Date() } }
    )

    if (quantityAvailable !== previousQuantity) {
      const quantityChange = quantityAvailable - previousQuantity
      await db.collection('activities').insertOne({
        type: quantityChange > 0 ? 'IN' : 'OUT',
        quantityChange: Math.abs(quantityChange),
        colorwayId: existing._id.toString(),
        designCodeId: existing.designCodeId,
        fullCode: existing.fullCode,
        previousQuantity,
        newQuantity: quantityAvailable,
        timestamp: new Date().toISOString()
      })
    }



    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating quantity:', error)
    return NextResponse.json({ error: 'Failed to update quantity' }, { status: 500 })
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

    await db.collection('colorways').deleteOne({ _id: objectId })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting colorway:', error)
    return NextResponse.json({ error: 'Failed to delete colorway' }, { status: 500 })
  }
}
