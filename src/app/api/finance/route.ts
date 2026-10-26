import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'month'
    const customStart = searchParams.get('startDate')
    const customEnd = searchParams.get('endDate')

    const now = new Date()
    let startDate: Date

    if (customStart) {
      startDate = new Date(customStart)
    } else if (range === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (range === 'week') {
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 7)
    } else if (range === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1)
    } else if (range === 'all') {
      startDate = new Date(2020, 0, 1)
    } else {
      // Default: this month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const endDate = customEnd ? new Date(customEnd) : now
    // Set endDate to end of day
    endDate.setHours(23, 59, 59, 999)

    const db = await getDb()
    const activitiesColl = db.collection('activities')
    const colorwaysColl = db.collection('colorways')
    const invoicesColl = db.collection('invoices')

    // Find sales in date window
    const salesActivities = await activitiesColl
      .find({
        type: 'OUT',
        kind: { $in: ['sold', null] },
        timestamp: {
          $gte: startDate.toISOString(),
          $lte: endDate.toISOString(),
        },
      })
      .sort({ timestamp: -1 })
      .toArray()

    let totalRevenue = 0
    let totalCost = 0
    let estimatedProfit = 0
    let totalPiecesSold = 0
    let pricedPiecesSold = 0
    let unpricedPiecesSold = 0

    const recentSales = []

    for (const act of salesActivities) {
      const qty = act.quantityChange || 0
      totalPiecesSold += qty

      const soldPrice = act.soldPrice !== undefined ? Number(act.soldPrice) : undefined
      const costPrice = act.costPrice !== undefined ? Number(act.costPrice) : undefined

      if (soldPrice !== undefined && !isNaN(soldPrice)) {
        pricedPiecesSold += qty
        const itemRevenue = soldPrice * qty
        totalRevenue += itemRevenue

        let itemProfit: number | undefined = undefined
        if (costPrice !== undefined && !isNaN(costPrice)) {
          const itemCost = costPrice * qty
          totalCost += itemCost
          itemProfit = (soldPrice - costPrice) * qty
          estimatedProfit += itemProfit
        }

        recentSales.push({
          id: act._id.toString(),
          fullCode: act.fullCode,
          subVariantLabel: act.subVariantLabel,
          quantity: qty,
          soldPrice,
          costPrice,
          totalRevenue: itemRevenue,
          itemProfit,
          isLoss: costPrice !== undefined && soldPrice < costPrice,
          timestamp: act.timestamp,
        })
      } else {
        unpricedPiecesSold += qty
        recentSales.push({
          id: act._id.toString(),
          fullCode: act.fullCode,
          subVariantLabel: act.subVariantLabel,
          quantity: qty,
          soldPrice: undefined,
          costPrice: undefined,
          totalRevenue: undefined,
          itemProfit: undefined,
          isLoss: false,
          timestamp: act.timestamp,
        })
      }
    }

    // Invoices count in range
    const invoicesCount = await invoicesColl.countDocuments({
      createdAt: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString(),
      },
    })

    // Pricing Coverage in total inventory
    const totalColorways = await colorwaysColl.countDocuments({})
    const pricedColorways = await colorwaysColl.countDocuments({
      sellingPrice: { $exists: true, $ne: null },
    })

    return NextResponse.json({
      period: {
        range,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: {
        totalRevenue,
        totalCost,
        estimatedProfit,
        totalPiecesSold,
        pricedPiecesSold,
        unpricedPiecesSold,
        invoicesCount,
      },
      coverage: {
        totalColorways,
        pricedColorways,
        coveragePercent: totalColorways > 0 ? Math.round((pricedColorways / totalColorways) * 100) : 0,
      },
      recentSales: recentSales.slice(0, 30),
    })
  } catch (error) {
    console.error('Error fetching finance summary:', error)
    return NextResponse.json({ error: 'Failed to fetch finance summary' }, { status: 500 })
  }
}
