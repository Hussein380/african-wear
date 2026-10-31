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
