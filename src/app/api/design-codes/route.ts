import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'

// GET /api/design-codes?category=PrintedC
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || 'PrintedC'

    const db = await getDb()
    
    // Get design codes with colorway count aggregation
    const designCodes = await db.collection('designCodes').aggregate([
      { $match: { category } },
      {
        $addFields: {
          _idStr: { $toString: '$_id' },
        },
      },
      {
        $lookup: {
          from: 'colorways',
          localField: '_idStr',
          foreignField: 'designCodeId',
          as: 'colorways',
        },
      },
      {
        $addFields: {
          colorwayCount: { $size: '$colorways' },
        },
      },
      {
        $project: {
          colorways: 0,
          _idStr: 0,
        },
      },
      { $sort: { code: 1 } },
    ]).toArray()

    // Convert ObjectId to string
    const result = designCodes.map(dc => ({
      ...dc,
      _id: dc._id.toString(),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching design codes:', error)
    return NextResponse.json({ error: 'Failed to fetch design codes' }, { status: 500 })
  }
}

// POST /api/design-codes — create new design code
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { code, category, thumbnailUrl, thumbnailPublicId } = body

    if (!code || !category) {
      return NextResponse.json({ error: 'Code and category are required' }, { status: 400 })
    }

    const db = await getDb()

    // Check for duplicate code in same category
    const existing = await db.collection('designCodes').findOne({ code, category })
    if (existing) {
      return NextResponse.json({ error: 'Design code already exists in this category' }, { status: 409 })
    }

    const now = new Date()
    const result = await db.collection('designCodes').insertOne({
      code,
      category,
      thumbnailUrl: thumbnailUrl || '',
      thumbnailPublicId: thumbnailPublicId || '',
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({
      _id: result.insertedId.toString(),
      code,
      category,
      thumbnailUrl: thumbnailUrl || '',
      thumbnailPublicId: thumbnailPublicId || '',
      colorwayCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating design code:', error)
    return NextResponse.json({ error: 'Failed to create design code' }, { status: 500 })
  }
}
