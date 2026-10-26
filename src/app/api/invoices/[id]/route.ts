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

    // 1. Return stock for each item in the invoice
    if (Array.isArray(invoice.items)) {
      for (const item of invoice.items) {
        if (!item.colorwayId || !ObjectId.isValid(item.colorwayId)) continue
        const qtyToReturn = Number(item.quantity) || 1
        const cw = await colorwaysColl.findOne({ _id: new ObjectId(item.colorwayId) })
        if (cw) {
          const newQty = (cw.quantityAvailable || 0) + qtyToReturn
          const updateDoc: Record<string, unknown> = {
            quantityAvailable: newQty,
            updatedAt: new Date(),
          }

          if (item.subVariantLabel && Array.isArray(cw.breakdown)) {
            updateDoc.breakdown = cw.breakdown.map((b: { id: string; label: string; quantity: number }) => {
              if (b.label === item.subVariantLabel) {
                return { ...b, quantity: b.quantity + qtyToReturn }
              }
              return b
            })
          }

          await colorwaysColl.updateOne(
            { _id: cw._id },
            { $set: updateDoc }
          )
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
