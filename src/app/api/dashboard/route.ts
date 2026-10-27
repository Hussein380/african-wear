import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import {
  LOW_STOCK_THRESHOLD,
  NOT_SELLING_DAYS,
  effectiveKind,
  shopDaysAgo,
  startOfShopDay,
} from '@/lib/stockRules'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = await getDb()

    // Total Designs
    const totalDesigns = await db.collection('designCodes').countDocuments()

    // Colorways that currently have stock (light projection, no photos)
    const stocked = await db.collection('colorways')
      .find({ quantityAvailable: { $gt: 0 } })
      .project({ designCodeId: 1, fullCode: 1, quantityAvailable: 1, createdAt: 1 })
      .toArray()
    const totalStock = stocked.reduce((sum, cw) => sum + (cw.quantityAvailable || 0), 0)

    // Categories Active
    const uniqueCategories = await db.collection('designCodes').distinct('category')
    const activeCategoriesCount = uniqueCategories.length

    // Low Stock Items
    const lowStockItems = await db.collection('colorways').aggregate([
      { $match: { quantityAvailable: { $lt: LOW_STOCK_THRESHOLD } } },
      {
        $addFields: {
          designCodeIdObj: {
            $convert: { input: '$designCodeId', to: 'objectId', onError: null, onNull: null }
          }
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
      { $unwind: { path: '$designCodeData', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: { $toString: '$_id' },
          designCodeId: 1,
          fullCode: 1,
          quantityAvailable: 1,
          photos: 1,
          designCodeThumbnail: '$designCodeData.thumbnailUrl',
          designCodeName: { $ifNull: ['$designCodeData.code', '$fullCode'] }
        }
      },
      { $sort: { quantityAvailable: 1 } },
      { $limit: 10 }
    ]).toArray()

    // Stock Distribution by Category
    const stockDistribution = await db.collection('colorways').aggregate([
      {
        $addFields: {
          designCodeIdObj: {
            $convert: { input: '$designCodeId', to: 'objectId', onError: null, onNull: null }
          }
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
      { $unwind: { path: '$designCodeData', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$designCodeData.category', 'Uncategorized'] },
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

    // ---- Sales & movement insights (pieces only, no money) ----
    const monthStart = shopDaysAgo(29)
    const weekStart = shopDaysAgo(6)
    const todayStart = startOfShopDay()
    const notSellingStart = shopDaysAgo(NOT_SELLING_DAYS)

    const rows = await db.collection('activities')
      .find({ timestamp: { $gte: notSellingStart.toISOString() } })
      .project({ type: 1, kind: 1, quantityChange: 1, timestamp: 1, colorwayId: 1, fullCode: 1 })
      .toArray()

    const totals = {
      sold: { today: 0, week: 0, month: 0 },
      arrived: { today: 0, week: 0, month: 0 },
      returned: { month: 0 },
      ownUse: { month: 0 },
      countMissing: { month: 0 }, // pieces the shelf count found missing
      countExtra: { month: 0 },   // pieces the shelf count found extra
    }
    const soldByCode = new Map<string, number>()
    const soldColorwayIds = new Set<string>()

    for (const r of rows) {
      const kind = effectiveKind(r as { type: string; kind?: string })
      const qty: number = r.quantityChange || 0
      const t = new Date(r.timestamp)
      const inMonth = t >= monthStart
      const inWeek = t >= weekStart
      const inToday = t >= todayStart

      if (kind === 'sold') {
        soldColorwayIds.add(r.colorwayId)
        if (inMonth) {
          totals.sold.month += qty
          soldByCode.set(r.fullCode, (soldByCode.get(r.fullCode) || 0) + qty)
        }
        if (inWeek) totals.sold.week += qty
        if (inToday) totals.sold.today += qty
      } else if (kind === 'arrived' || kind === 'new') {
        if (inMonth) totals.arrived.month += qty
        if (inWeek) totals.arrived.week += qty
        if (inToday) totals.arrived.today += qty
      } else if (kind === 'returned') {
        if (inMonth) totals.returned.month += qty
      } else if (kind === 'own_use') {
        if (inMonth) totals.ownUse.month += qty
      } else if (kind === 'count_diff' && inMonth) {
        if (r.type === 'OUT') totals.countMissing.month += qty
        else totals.countExtra.month += qty
      }
    }

    const bestSellers = [...soldByCode.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([fullCode, sold]) => ({ fullCode, sold }))

    // Has stock, older than the window, and nothing sold in the window
    const notSelling = stocked
      .filter(cw =>
        !soldColorwayIds.has(cw._id.toString()) &&
        (!cw.createdAt || new Date(cw.createdAt) < notSellingStart)
      )
      .sort((a, b) => b.quantityAvailable - a.quantityAvailable)
      .slice(0, 10)
      .map(cw => ({
        _id: cw._id.toString(),
        designCodeId: cw.designCodeId,
        fullCode: cw.fullCode,
        quantityAvailable: cw.quantityAvailable,
      }))

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
      insights: { totals, bestSellers, notSelling, notSellingDays: NOT_SELLING_DAYS },
    })
  } catch (error) {
    console.error('Failed to fetch dashboard metrics:', error)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
