import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { deleteCloudinaryImage } from '@/lib/cloudinary'

// GET /api/design-codes/:id — get single design code
export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/design-codes/[id]'>
) {
  try {
    const { id } = await ctx.params
    const db = await getDb()
    const objectId = new ObjectId(id)

    const designCode = await db.collection('designCodes').findOne({ _id: objectId })
    if (!designCode) {
      return NextResponse.json({ error: 'Design code not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...designCode,
      _id: designCode._id.toString()
    })
  } catch (error) {
    console.error('Error fetching design code:', error)
    return NextResponse.json({ error: 'Failed to fetch design code' }, { status: 500 })
  }
}

// PUT /api/design-codes/:id — update design code
export async function PUT(
  request: Request,
  ctx: RouteContext<'/api/design-codes/[id]'>
) {
  try {
    const { id } = await ctx.params
    const body = await request.json()
    const { code, category, thumbnailUrl, thumbnailPublicId } = body

    const db = await getDb()
    const objectId = new ObjectId(id)

    // Get old record to clean up old thumbnail if replaced
    const oldRecord = await db.collection('designCodes').findOne({ _id: objectId })
    if (!oldRecord) {
      return NextResponse.json({ error: 'Design code not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (code !== undefined) updateData.code = code
    if (category !== undefined) updateData.category = category
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl
    if (thumbnailPublicId !== undefined) updateData.thumbnailPublicId = thumbnailPublicId

    // If replacing thumbnail, delete old one from Cloudinary
    if (thumbnailPublicId && oldRecord.thumbnailPublicId && thumbnailPublicId !== oldRecord.thumbnailPublicId) {
      try {
        await deleteCloudinaryImage(oldRecord.thumbnailPublicId)
      } catch (e) {
        console.error('Failed to delete old thumbnail:', e)
      }
    }

    await db.collection('designCodes').updateOne(
      { _id: objectId },
      { $set: updateData }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating design code:', error)
    return NextResponse.json({ error: 'Failed to update design code' }, { status: 500 })
  }
}

// DELETE /api/design-codes/:id — delete design code + cascade delete colorways
export async function DELETE(
  _request: Request,
  ctx: RouteContext<'/api/design-codes/[id]'>
) {
  try {
    const { id } = await ctx.params
    const db = await getDb()
    const objectId = new ObjectId(id)

    // Get the design code
    const designCode = await db.collection('designCodes').findOne({ _id: objectId })
    if (!designCode) {
      return NextResponse.json({ error: 'Design code not found' }, { status: 404 })
    }

    // Delete thumbnail from Cloudinary
    if (designCode.thumbnailPublicId) {
      try {
        await deleteCloudinaryImage(designCode.thumbnailPublicId)
      } catch (e) {
        console.error('Failed to delete thumbnail:', e)
      }
    }

    // Get all colorways for this design code and delete their images
    const colorways = await db.collection('colorways').find({ designCodeId: id }).toArray()
    for (const cw of colorways) {
      if (cw.photos && Array.isArray(cw.photos)) {
        for (const photo of cw.photos) {
          if (photo.publicId) {
            try {
              await deleteCloudinaryImage(photo.publicId)
            } catch (e) {
              console.error('Failed to delete colorway photo:', e)
            }
          }
        }
      }
    }

    // Cascade delete colorways
    await db.collection('colorways').deleteMany({ designCodeId: id })

    // Delete the design code
    await db.collection('designCodes').deleteOne({ _id: objectId })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting design code:', error)
    return NextResponse.json({ error: 'Failed to delete design code' }, { status: 500 })
  }
}
