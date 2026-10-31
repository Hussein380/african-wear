import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { InvoiceItem } from '@/types'
import { nextReceiptNumber } from '@/lib/receiptNumber'

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

type BreakdownEntry = { id: string; label: string; quantity: number }

// POST /api/invoices — create a receipt and atomically deduct stock
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { customerName, customerPhone, items, notes } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Receipt must have at least one item' }, { status: 400 })
    }

    const db = await getDb()
    const colorwaysColl = db.collection('colorways')
    const activitiesColl = db.collection('activities')
    const invoicesColl = db.collection('invoices')

    // 1. Merge repeated lines (same colour + same bale) so stock is checked against the combined quantity
    const merged = new Map<string, { colorwayId: string; fullCode?: string; subVariantLabel?: string; quantity: number }>()
    for (const item of items) {
      const quantity = Number(item.quantity)
      if (!item.colorwayId || !Number.isInteger(quantity) || quantity <= 0) {
        return NextResponse.json({ error: 'Invalid item quantity or colour' }, { status: 400 })
      }
      const key = `${item.colorwayId}::${item.subVariantLabel || ''}`
      const existing = merged.get(key)
      if (existing) {
        existing.quantity += quantity
      } else {
        merged.set(key, {
          colorwayId: String(item.colorwayId),
          fullCode: item.fullCode,
          subVariantLabel: item.subVariantLabel || undefined,
          quantity,
        })
      }
    }

    // 2. Deduct each line atomically; on any failure put back what was already taken
    const now = new Date()
    const deducted: { cw: Record<string, unknown> & { _id: ObjectId }; item: InvoiceItem; newQty: number }[] = []

    const rollback = async () => {
      for (const d of deducted) {
        const inc: Record<string, number> = { quantityAvailable: d.item.quantity }
        const filter: Record<string, unknown> = { _id: d.cw._id }
        if (d.item.subVariantLabel) {
          filter['breakdown.label'] = d.item.subVariantLabel
          inc['breakdown.$.quantity'] = d.item.quantity
        }
        await colorwaysColl.updateOne(filter, { $inc: inc })
      }
    }

    for (const line of merged.values()) {
      let cw = null
      if (ObjectId.isValid(line.colorwayId)) {
        cw = await colorwaysColl.findOne({ _id: new ObjectId(line.colorwayId) })
      }
      if (!cw && line.fullCode) {
        cw = await colorwaysColl.findOne({ fullCode: line.fullCode })
      }
      if (!cw) {
        await rollback()
        return NextResponse.json({ error: `Item ${line.fullCode || line.colorwayId} not found` }, { status: 404 })
      }

      const filter: Record<string, unknown> = { _id: cw._id, quantityAvailable: { $gte: line.quantity } }
      const inc: Record<string, number> = { quantityAvailable: -line.quantity }

      const cwBreakdown: BreakdownEntry[] = Array.isArray(cw.breakdown) ? cw.breakdown : []
      if (!line.subVariantLabel && cwBreakdown.length > 0) {
        // Selling without naming the colour would lower the total but not the colour, so the two disagree
        await rollback()
        return NextResponse.json(
          { error: `Choose which colour of ${cw.fullCode} was sold. Remove it from the sale and add it again.` },
          { status: 400 }
        )
      }

      if (line.subVariantLabel) {
        const breakdown = cwBreakdown
        if (!breakdown.some(b => b.label === line.subVariantLabel)) {
          await rollback()
          return NextResponse.json(
            { error: `${cw.fullCode} has no bale called "${line.subVariantLabel}"` },
            { status: 400 }
          )
        }
        filter.breakdown = { $elemMatch: { label: line.subVariantLabel, quantity: { $gte: line.quantity } } }
        inc['breakdown.$.quantity'] = -line.quantity
      }

      const updated = await colorwaysColl.findOneAndUpdate(
        filter,
        { $inc: inc, $set: { updatedAt: now } },
        { returnDocument: 'after' }
      )

      if (!updated) {
        await rollback()
        const label = line.subVariantLabel ? ` (${line.subVariantLabel})` : ''
        return NextResponse.json(
          { error: `Not enough stock for ${cw.fullCode}${label}. Requested: ${line.quantity}` },
          { status: 409 }
        )
      }

      deducted.push({
        cw,
        // Same as the +/− taps: a colour's history row shows that colour's count
        newQty: line.subVariantLabel
          ? (updated.breakdown as BreakdownEntry[]).find(b => b.label === line.subVariantLabel)?.quantity ?? 0
          : updated.quantityAvailable ?? 0,
        item: {
          activityId: new ObjectId().toString(),
          colorwayId: cw._id.toString(),
          designCodeId: cw.designCodeId,
          fullCode: cw.fullCode || line.fullCode || '',
          subVariantLabel: line.subVariantLabel,
          quantity: line.quantity,
        },
      })
    }

    const invoiceNumber = await nextReceiptNumber(db, now)

    const processedItems = deducted.map(d => d.item)
    const invoiceDoc = {
      invoiceNumber,
      customerName: customerName?.trim() || undefined,
      customerPhone: customerPhone?.trim() || undefined,
      items: processedItems,
      notes: notes?.trim() || undefined,
      source: 'basket' as const,
      status: 'completed' as const,
      createdAt: now.toISOString(),
    }

    const insertResult = await invoicesColl.insertOne(invoiceDoc)
    const invoiceId = insertResult.insertedId.toString()

    // 4. Log each movement as sold, linked to the receipt
    await activitiesColl.insertMany(
      deducted.map(d => ({
        _id: new ObjectId(d.item.activityId),
        type: 'OUT',
        kind: 'sold',
        quantityChange: d.item.quantity,
        colorwayId: d.item.colorwayId,
        designCodeId: d.item.designCodeId,
        fullCode: d.item.fullCode,
        previousQuantity: d.newQty + d.item.quantity,
        newQuantity: d.newQty,
        subVariantLabel: d.item.subVariantLabel,
        invoiceId,
        timestamp: now.toISOString(),
      }))
    )

    return NextResponse.json({
      ...invoiceDoc,
      _id: invoiceId,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating invoice:', error)
    return NextResponse.json({ error: 'Failed to create receipt' }, { status: 500 })
  }
}
