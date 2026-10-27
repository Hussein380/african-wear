import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { startOfShopDay, shopDaysAgo } from '@/lib/stockRules'

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
      startDate = startOfShopDay(now)
    } else if (range === 'week') {
      startDate = shopDaysAgo(7)
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
          invoiceId: act.invoiceId ? String(act.invoiceId) : undefined,
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
          invoiceId: act.invoiceId ? String(act.invoiceId) : undefined,
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

    // Calculate payment breakdown from invoices and direct shop sales
    const startIso = startDate.toISOString()
    const endIso = endDate.toISOString()

    const invoicesInRange = await invoicesColl
      .find({
        $or: [
          { createdAt: { $gte: startIso, $lte: endIso } },
          { settledAt: { $gte: startIso, $lte: endIso } },
        ],
      })
      .toArray()

    let invoiceCashTotal = 0
    let invoiceMpesaTotal = 0
    let invoiceCreditTotal = 0
    let invoiceOtherTotal = 0
    const invoicedSaleIds = new Set<string>()

    // Direct items created with an invoice have act.invoiceId recorded
    for (const act of salesActivities) {
      if (act.invoiceId) {
        invoicedSaleIds.add(act._id.toString())
      }
    }

    for (const inv of invoicesInRange) {
      const amt = Number(inv.totalAmount) || 0

      // Case 1: Settled in this window (collected cash/mpesa today)
      if (inv.settledAt && inv.settledAt >= startIso && inv.settledAt <= endIso) {
        if (inv.settledMethod === 'mpesa') invoiceMpesaTotal += amt
        else invoiceCashTotal += amt
      }
      // Case 2: Created in this window (and not settled on a different day)
      else if (inv.createdAt >= startIso && inv.createdAt <= endIso) {
        const pm = inv.paymentMethod || 'cash'
        if (pm === 'cash') invoiceCashTotal += amt
        else if (pm === 'mpesa') invoiceMpesaTotal += amt
        else if (pm === 'credit') invoiceCreditTotal += amt
        else invoiceOtherTotal += amt
      }

      // Sales that were originally counter sales and later linked into an invoice
      if (Array.isArray(inv.items)) {
        for (const it of inv.items) {
          if (it.recentSaleActivityId) invoicedSaleIds.add(String(it.recentSaleActivityId))
        }
      }
    }

    // Direct shop sales not attached to an invoice are counted as direct cash drawer
    let directCashTotal = 0
    for (const sale of recentSales) {
      if (!sale.invoiceId && !invoicedSaleIds.has(sale.id) && sale.totalRevenue) {
        directCashTotal += sale.totalRevenue
      }
    }

    const drawerBreakdown = {
      cash: invoiceCashTotal + directCashTotal,
      mpesa: invoiceMpesaTotal,
      credit: invoiceCreditTotal,
      other: invoiceOtherTotal,
    }

    const invoicesCount = invoicesInRange.filter(inv => inv.createdAt >= startIso && inv.createdAt <= endIso).length

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
        drawerBreakdown,
      },
      drawerBreakdown,
      coverage: {
        totalColorways,
        pricedColorways,
        coveragePercent: totalColorways > 0 ? Math.round((pricedColorways / totalColorways) * 100) : 0,
      },
      recentSales: recentSales.slice(0, 50),
    })
  } catch (error) {
    console.error('Error fetching finance summary:', error)
    return NextResponse.json({ error: 'Failed to fetch finance summary' }, { status: 500 })
  }
}
