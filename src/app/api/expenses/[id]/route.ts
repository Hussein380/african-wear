import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid expense ID' }, { status: 400 })
    }

    const db = await getDb()
    const result = await db.collection('expenses').deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Expense deleted successfully' })
  } catch (error) {
    console.error('Error deleting expense:', error)
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid expense ID' }, { status: 400 })
    }

    const body = await request.json()
    const updateFields: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    }

    if (body.title !== undefined) updateFields.title = String(body.title).trim()
    if (body.amount !== undefined) updateFields.amount = Number(body.amount)
    if (body.category !== undefined) updateFields.category = body.category
    if (body.paymentMethod !== undefined) updateFields.paymentMethod = body.paymentMethod
    if (body.notes !== undefined) updateFields.notes = String(body.notes).trim()
    if (body.date !== undefined) updateFields.date = new Date(body.date).toISOString()

    const db = await getDb()
    const result = await db.collection('expenses').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Expense updated successfully' })
  } catch (error) {
    console.error('Error updating expense:', error)
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 })
  }
}
