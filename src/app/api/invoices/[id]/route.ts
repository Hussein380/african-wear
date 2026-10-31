import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export const dynamic = 'force-dynamic'

// GET /api/invoices/:id — get single invoice
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 })
    }

    const db = await getDb()
    const invoice = await db.collection('invoices').findOne({ _id: new ObjectId(id) })
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...invoice,
      _id: invoice._id.toString(),
    })
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 })
  }
}

// DELETE /api/invoices/:id — void an invoice, return all items to inventory, and delete linked sales activities
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 })
    }

    const db = await getDb()
    const invoicesColl = db.collection('invoices')
    const colorwaysColl = db.collection('colorways')
    const activitiesColl = db.collection('activities')

    const invoice = await invoicesColl.findOne({ _id: new ObjectId(id) })
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // A receipt made later from sales never took stock, so just unlink it from those sales
    if (invoice.source === 'sales') {
      await activitiesColl.updateMany({ invoiceId: id }, { $unset: { invoiceId: '' } })
      await invoicesColl.deleteOne({ _id: invoice._id })
      return NextResponse.json({ success: true, message: `Receipt ${invoice.invoiceNumber} deleted.` })
    }

    // 1. Return stock for each item in the invoice
    if (Array.isArray(invoice.items)) {
      for (const item of invoice.items) {
        const qtyToReturn = Number(item.quantity) || 1
        let cw = null
        if (item.colorwayId && ObjectId.isValid(item.colorwayId)) {
          cw = await colorwaysColl.findOne({ _id: new ObjectId(item.colorwayId) })
        }
        if (!cw && item.fullCode) {
          cw = await colorwaysColl.findOne({ fullCode: item.fullCode })
        }
        if (cw) {
          const filter: Record<string, unknown> = { _id: cw._id }
          const inc: Record<string, number> = { quantityAvailable: qtyToReturn }
          if (item.subVariantLabel && Array.isArray(cw.breakdown) &&
              cw.breakdown.some((b: { label: string }) => b.label === item.subVariantLabel)) {
            filter['breakdown.label'] = item.subVariantLabel
            inc['breakdown.$.quantity'] = qtyToReturn
          }
          await colorwaysColl.updateOne(filter, { $inc: inc, $set: { updatedAt: new Date() } })
        }
      }
    }

    // 2. Delete all activities linked to this invoice
    await activitiesColl.deleteMany({
      $or: [
        { invoiceId: id },
        { invoiceId: new ObjectId(id) },
      ],
    })

    // 3. Delete the invoice itself
    await invoicesColl.deleteOne({ _id: new ObjectId(id) })

    return NextResponse.json({
      success: true,
      message: `Invoice ${invoice.invoiceNumber || id} voided. Stock returned to inventory.`,
    })
  } catch (error) {
    console.error('Error voiding invoice:', error)
    return NextResponse.json({ error: 'Failed to void invoice' }, { status: 500 })
  }
}

// PATCH /api/invoices/:id — edit customer details and selling prices before (re)sending
// Body: { customerName?, customerPhone?, notes?, prices?: number[] } (prices by item position)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 })
    }
    const { customerName, customerPhone, notes, prices } = await request.json()

    const db = await getDb()
    const invoice = await db.collection('invoices').findOne({ _id: new ObjectId(id) })
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const updateDoc: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (customerName !== undefined) updateDoc.customerName = String(customerName).trim() || null
    if (customerPhone !== undefined) updateDoc.customerPhone = String(customerPhone).trim() || null
    if (notes !== undefined) updateDoc.notes = notes

    if (Array.isArray(prices) && Array.isArray(invoice.items)) {
      const items = invoice.items.map((item: { quantity: number }, idx: number) => {
        const n = Number(prices[idx])
        const unitPrice = Number.isFinite(n) && n > 0 ? n : 0
        return { ...item, unitPrice, subtotal: unitPrice * item.quantity }
      })
      updateDoc.items = items
      updateDoc.totalAmount = items.reduce((sum: number, i: { subtotal: number }) => sum + i.subtotal, 0)
    }

    await db.collection('invoices').updateOne({ _id: invoice._id }, { $set: updateDoc })

    const updated = await db.collection('invoices').findOne({ _id: invoice._id })
    return NextResponse.json({ ...updated, _id: updated?._id.toString() })
  } catch (error) {
    console.error('Error updating invoice:', error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}
