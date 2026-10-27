import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = await getDb()
    
    // We need to join colorways with their parent design-codes to get the category and base code.
    const inventory = await db.collection('colorways').aggregate([
      {
        $addFields: {
          designCodeIdObj: {
            $convert: { input: "$designCodeId", to: "objectId", onError: null, onNull: null }
          }
        }
      },
      {
        $lookup: {
          from: "designCodes",
          localField: "designCodeIdObj",
          foreignField: "_id",
          as: "design"
        }
      },
      {
        $unwind: { path: "$design", preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          _id: 1,
          fullCode: 1,
          quantityAvailable: 1,
          breakdown: 1,
          photos: 1,
          designCodeId: 1,
          category: { $ifNull: ["$design.category", "Uncategorized"] },
          designCodeName: { $ifNull: ["$design.code", "$fullCode"] },
          thumbnailUrl: { $ifNull: ["$design.thumbnailUrl", ""] }
        }
      },
      {
        $sort: { quantityAvailable: -1 } // Default sort by highest quantity
      }
    ]).toArray()

    const result = inventory.map(item => ({
      ...item,
      _id: item._id.toString()
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 })
  }
}
