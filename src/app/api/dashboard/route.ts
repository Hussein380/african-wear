import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = await getDb()

    // Total Designs
    const totalDesigns = await db.collection('designCodes').countDocuments()

    // Total Stock Volume (Sum of all quantityAvailable in colorways)
    const colorways = await db.collection('colorways').find({}).toArray()
    const totalStock = colorways.reduce((sum, cw) => sum + (cw.quantityAvailable || 0), 0)

    // Categories Active
    const uniqueCategories = await db.collection('designCodes').distinct('category')
    const activeCategoriesCount = uniqueCategories.length

    // Low Stock Items (< 5)
    const lowStockItems = await db.collection('colorways').aggregate([
      { $match: { quantityAvailable: { $lt: 5 } } },
      {
        $addFields: {
          designCodeIdObj: { $toObjectId: '$designCodeId' }
        }
      },
      {
        $lookup: {
          from: 'designCodes',
          localField: 'designCodeIdObj',
          foreignField: '_id',
          as: 'designCodeData'
        }
      },
      { $unwind: '$designCodeData' },
      {
        $project: {
          _id: { $toString: '$_id' },
          designCodeId: 1,
          fullCode: 1,
          quantityAvailable: 1,
          photos: 1,
          designCodeThumbnail: '$designCodeData.thumbnailUrl',
          designCodeName: '$designCodeData.code'
        }
      },
      { $sort: { quantityAvailable: 1 } },
      { $limit: 10 }
    ]).toArray()

    // Stock Distribution by Category
    const stockDistribution = await db.collection('colorways').aggregate([
      {
        $addFields: {
          designCodeIdObj: { $toObjectId: '$designCodeId' }
        }
      },
      {
        $lookup: {
          from: 'designCodes',
          localField: 'designCodeIdObj',
          foreignField: '_id',
          as: 'designCodeData'
        }
      },
      { $unwind: '$designCodeData' },
      {
        $group: {
          _id: '$designCodeData.category',
          totalQuantity: { $sum: '$quantityAvailable' }
        }
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          totalQuantity: 1
        }
      },
      { $sort: { totalQuantity: -1 } }
    ]).toArray()

    // Recent Activities Log
    const recentActivities = await db.collection('activities')
      .find({})
      .sort({ timestamp: -1 })
      .limit(15)
      .toArray()

    return NextResponse.json({
      totalDesigns,
      totalStock,
      activeCategoriesCount,
      lowStockItems,
      stockDistribution,
      recentActivities,
    })
  } catch (error) {
    console.error('Failed to fetch dashboard metrics:', error)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
