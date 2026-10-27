import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { Invoice, InvoiceItem } from '@/types'

export const dynamic = 'force-dynamic'

// GET /api/invoices — list invoices
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)

    const db = await getDb()
    const invoices = await db
      .collection('invoices')
      .find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()

    const totalCount = await db.collection('invoices').countDocuments({})

    const mapped = invoices.map(inv => ({
      ...inv,
      _id: inv._id.toString(),
    }))

    return NextResponse.json({
      invoices: mapped,
      totalCount,
      page,
      limit,
    })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

// POST /api/invoices — create new invoice and atomically deduct stock
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      customerName,
      customerPhone,
      paymentMethod = 'cash',
      items,
      notes,
    } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invoice must have at least one item' }, { status: 400 })
    }

    const db = await getDb()
    const colorwaysColl = db.collection('colorways')
    const activitiesColl = db.collection('activities')
    const invoicesColl = db.collection('invoices')

    const now = new Date()

    // 1. Validate stock availability for each item (unless already deducted in recent sale)
    for (const item of items) {
      if (!item.colorwayId || !item.quantity || item.quantity <= 0) {
        return NextResponse.json({ error: 'Invalid item quantity or colorway' }, { status: 400 })
      }
      if (item.skipDeduction) {
        // Item was already deducted from shelf when recorded as recent sale
        continue
      }
      let cw = null
      if (ObjectId.isValid(item.colorwayId)) {
        cw = await colorwaysColl.findOne({ _id: new ObjectId(item.colorwayId) })
      }
      if (!cw && item.fullCode) {
        cw = await colorwaysColl.findOne({ fullCode: item.fullCode })
      }
      if (!cw) {
        return NextResponse.json({ error: `Item ${item.fullCode || item.colorwayId} not found` }, { status: 404 })
      }

      if (item.subVariantLabel && Array.isArray(cw.breakdown)) {
        const sub = cw.breakdown.find((b: { id: string; label: string; quantity: number }) => b.label === item.subVariantLabel)
        if (sub && sub.quantity < item.quantity) {
          return NextResponse.json(
            { error: `Insufficient stock for ${cw.fullCode} (${item.subVariantLabel}). Available: ${sub.quantity}, Requested: ${item.quantity}` },
            { status: 409 }
          )
        }
      }

      if (cw.quantityAvailable < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${cw.fullCode}. Available: ${cw.quantityAvailable}, Requested: ${item.quantity}` },
          { status: 409 }
        )
      }
    }

    // Generate Invoice Number: INV-YYYYMMDD-XXXX
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const countToday = await invoicesColl.countDocuments({
      createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString() },
    })
    const invoiceNumber = `INV-${dateStr}-${String(countToday + 1).padStart(3, '0')}`

    let totalAmount = 0
    let totalCost = 0
    let hasCostData = false

    const processedItems: InvoiceItem[] = []

    for (const item of items) {
      let cw = null
      try {
        cw = await colorwaysColl.findOne({ _id: new ObjectId(item.colorwayId) })
      } catch {
        // If colorwayId was invalid ObjectId, attempt search by fullCode
        if (item.fullCode) {
          cw = await colorwaysColl.findOne({ fullCode: item.fullCode })
        }
      }

      const unitPrice = Number(item.unitPrice) || 0
      const costPrice = item.costPrice !== undefined ? Number(item.costPrice) : cw?.buyingPrice
      const subtotal = unitPrice * item.quantity

      totalAmount += subtotal
      if (costPrice !== undefined) {
        totalCost += costPrice * item.quantity
        hasCostData = true
      }

      processedItems.push({
        colorwayId: cw ? cw._id.toString() : item.colorwayId,
        designCodeId: cw?.designCodeId,
        fullCode: cw?.fullCode || item.fullCode,
        subVariantLabel: item.subVariantLabel,
        quantity: item.quantity,
        unitPrice,
        costPrice,
        subtotal,
        skipDeduction: !!item.skipDeduction,
        recentSaleActivityId: item.recentSaleActivityId,
      })
    }

    const invoiceDoc = {
      invoiceNumber,
      customerName: customerName?.trim() || undefined,
      customerPhone: customerPhone?.trim() || undefined,
      paymentMethod,
      items: processedItems,
      totalAmount,
      totalCost: hasCostData ? totalCost : undefined,
      estimatedProfit: hasCostData ? totalAmount - totalCost : undefined,
      notes: notes?.trim() || undefined,
      status: 'completed' as const,
      createdAt: now.toISOString(),
    }

    const insertResult = await invoicesColl.insertOne(invoiceDoc)
    const invoiceId = insertResult.insertedId.toString()

    // Deduct stock and record activity logs (skip already deducted items)
    for (const item of processedItems) {
      if (item.skipDeduction) {
        // Stock was ALREADY deducted when minus (−) was tapped in the shop!
        // Link invoiceId and update recorded soldPrice on the existing activity
        if (item.recentSaleActivityId) {
          try {
            await activitiesColl.updateOne(
              { _id: new ObjectId(item.recentSaleActivityId) },
              { $set: { invoiceId, soldPrice: item.unitPrice } }
            )
          } catch (err) {
            console.error('Failed to link existing sale activity to invoice:', err)
          }
        }
        continue
      }

      let cw = null
      if (item.colorwayId && ObjectId.isValid(item.colorwayId)) {
        cw = await colorwaysColl.findOne({ _id: new ObjectId(item.colorwayId) })
      }
      if (!cw && item.fullCode) {
        cw = await colorwaysColl.findOne({ fullCode: item.fullCode })
      }

      if (cw) {
        const updateDoc: Record<string, unknown> = {
          $inc: { quantityAvailable: -item.quantity },
          $set: { updatedAt: now },
        }

        if (item.subVariantLabel && Array.isArray(cw.breakdown)) {
          const updatedBreakdown = cw.breakdown.map((b: { id: string; label: string; quantity: number }) => {
            if (b.label === item.subVariantLabel) {
              return { ...b, quantity: Math.max(0, b.quantity - item.quantity) }
            }
            return b
          })
          updateDoc.$set = { updatedAt: now, breakdown: updatedBreakdown }
        }

        await colorwaysColl.updateOne({ _id: cw._id }, updateDoc)

        // Fetch new balance
        const updatedCw = await colorwaysColl.findOne({ _id: cw._id })
        const newQty = updatedCw?.quantityAvailable ?? 0

        // Log movement as sold with price snapshot and invoice reference
        await activitiesColl.insertOne({
          type: 'OUT',
          kind: 'sold',
          quantityChange: item.quantity,
          colorwayId: cw._id.toString(),
          designCodeId: cw.designCodeId || item.designCodeId,
          fullCode: cw.fullCode || item.fullCode,
          previousQuantity: newQty + item.quantity,
          newQuantity: newQty,
          subVariantLabel: item.subVariantLabel,
          soldPrice: item.unitPrice,
          costPrice: item.costPrice,
          invoiceId,
          timestamp: now.toISOString(),
        })
      }
    }

    return NextResponse.json({
      ...invoiceDoc,
      _id: invoiceId,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating invoice:', error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
