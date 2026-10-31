import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

// GET /api/colorways?designCodeId=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const designCodeId = searchParams.get('designCodeId')

    if (!designCodeId) {
      return NextResponse.json({ error: 'designCodeId is required' }, { status: 400 })
    }

    const db = await getDb()
    const query = ObjectId.isValid(designCodeId)
      ? { $or: [{ designCodeId }, { designCodeId: new ObjectId(designCodeId) }] }
      : { designCodeId }

    const colorways = await db.collection('colorways')
      .find(query)
      .sort({ fullCode: 1 })
      .toArray()

    const result = colorways.map(cw => ({
      ...cw,
      _id: cw._id.toString(),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching colorways:', error)
    return NextResponse.json({ error: 'Failed to fetch colorways' }, { status: 500 })
  }
}

// POST /api/colorways — create new colorway
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { designCodeId, fullCode, photos, quantityAvailable, breakdown, location } = body

    if (!designCodeId || !fullCode) {
      return NextResponse.json({ error: 'designCodeId and fullCode are required' }, { status: 400 })
    }

    const trimmedCode = fullCode.trim()
    const db = await getDb()

    // Prevent duplicate fabric codes
    const existingCode = await db.collection('colorways').findOne({ fullCode: trimmedCode })
    if (existingCode) {
      return NextResponse.json({ error: `A fabric with code "${trimmedCode}" already exists` }, { status: 409 })
    }

    const now = new Date()

    const newDoc: Record<string, unknown> = {
      designCodeId,
      fullCode: trimmedCode,
      photos: photos || [],
      quantityAvailable: quantityAvailable || 0,
      breakdown: breakdown || [],
      createdAt: now,
      updatedAt: now,
    }

    if (location && typeof location === 'string') {
      newDoc.location = location.trim()
    }

    const result = await db.collection('colorways').insertOne(newDoc)

    if (quantityAvailable > 0) {
      if (breakdown && breakdown.length > 0) {
        for (const item of breakdown) {
          if (item.quantity > 0) {
            await db.collection('activities').insertOne({
              type: 'NEW',
              quantityChange: item.quantity,
              colorwayId: result.insertedId.toString(),
              designCodeId,
              fullCode,
              previousQuantity: 0,
              newQuantity: item.quantity,
              subVariantLabel: item.label,
              timestamp: now.toISOString()
            })
          }
        }
      } else {
        await db.collection('activities').insertOne({
          type: 'NEW',
          quantityChange: quantityAvailable,
          colorwayId: result.insertedId.toString(),
          designCodeId,
          fullCode,
          previousQuantity: 0,
          newQuantity: quantityAvailable,
          timestamp: now.toISOString()
        })
      }
    }

    return NextResponse.json({
      _id: result.insertedId.toString(),
      designCodeId,
      fullCode,
      photos: photos || [],
      quantityAvailable: quantityAvailable || 0,
      breakdown: breakdown || [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating colorway:', error)
    return NextResponse.json({ error: 'Failed to create colorway' }, { status: 500 })
  }
}
