import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { InvoiceItem } from '@/types'
import { nextReceiptNumber } from '@/lib/receiptNumber'

export const dynamic = 'force-dynamic'

function readPrice(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * POST /api/receipts — make a receipt for sales that already happened.
 * Stock was taken when the sale was recorded, so nothing is deducted here.
 * Body: { activityIds: string[], prices: { [activityId]: number }, customerName?, customerPhone? }
 */
export async function POST(request: Request) {
  try {
    const { activityIds, prices = {}, customerName, customerPhone } = await request.json()

    if (!Array.isArray(activityIds) || activityIds.length === 0 || !activityIds.every(id => ObjectId.isValid(id))) {
      return NextResponse.json({ error: 'Choose at least one sale' }, { status: 400 })
    }

    const db = await getDb()
    const activitiesColl = db.collection('activities')
    const ids = [...new Set(activityIds as string[])].map(id => new ObjectId(id))
    const sales = await activitiesColl
      .find({ _id: { $in: ids }, type: 'OUT', $or: [{ kind: 'sold' }, { kind: { $exists: false } }] })
      .sort({ timestamp: 1 })
      .toArray()

    if (sales.length !== ids.length) {
      return NextResponse.json({ error: 'Some of these sales no longer exist. Refresh the page.' }, { status: 404 })
    }
    const alreadyLinked = sales.find(a => a.invoiceId)
    if (alreadyLinked) {
      return NextResponse.json(
        { error: `${alreadyLinked.fullCode} already has a receipt. Open that receipt to resend it.` },
        { status: 409 }
      )
    }

    const items: InvoiceItem[] = sales.map(a => {
      const unitPrice = readPrice(prices[a._id.toString()])
      return {
        activityId: a._id.toString(),
        colorwayId: String(a.colorwayId),
        designCodeId: a.designCodeId,
        fullCode: a.fullCode,
        subVariantLabel: a.subVariantLabel,
        quantity: a.quantityChange,
        unitPrice,
        subtotal: unitPrice * a.quantityChange,
      }
    })

    const now = new Date()
    const invoiceDoc = {
      invoiceNumber: await nextReceiptNumber(db, now),
      customerName: customerName?.trim() || undefined,
      customerPhone: customerPhone?.trim() || undefined,
      items,
      totalAmount: items.reduce((sum, i) => sum + (i.subtotal || 0), 0),
      source: 'sales' as const,
      status: 'completed' as const,
      createdAt: now.toISOString(),
    }

    const { insertedId } = await db.collection('invoices').insertOne(invoiceDoc)
    const invoiceId = insertedId.toString()
    const linked = await activitiesColl.updateMany(
      { _id: { $in: ids }, invoiceId: { $exists: false } },
      { $set: { invoiceId } }
    )
    if (linked.modifiedCount !== ids.length) {
      // Another phone made a receipt for one of these sales at the same moment: undo ours
      await activitiesColl.updateMany({ invoiceId }, { $unset: { invoiceId: '' } })
      await db.collection('invoices').deleteOne({ _id: insertedId })
      return NextResponse.json({ error: 'One of these sales just got a receipt. Refresh the page.' }, { status: 409 })
    }

    return NextResponse.json({ ...invoiceDoc, _id: invoiceId }, { status: 201 })
  } catch (error) {
    console.error('Error creating receipt:', error)
    return NextResponse.json({ error: 'Failed to create receipt' }, { status: 500 })
  }
}
