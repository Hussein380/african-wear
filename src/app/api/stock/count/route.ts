import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

/**
 * POST /api/stock/count — stock check. Staff confirm or correct the real number on the shelf.
 * body: { colorwayId, counted, subVariantId? }
 * Any difference is stored as a "count_diff" history row so missing/extra stock is visible.
 */
export async function POST(request: Request) {
  try {
    const { colorwayId, counted, subVariantId } = await request.json()

    if (
      typeof colorwayId !== 'string' ||
      !ObjectId.isValid(colorwayId) ||
      !Number.isInteger(counted) ||
      counted < 0
    ) {
      return NextResponse.json({ error: 'Invalid count' }, { status: 400 })
    }

    const db = await getDb()
    const colorways = db.collection('colorways')
    const objectId = new ObjectId(colorwayId)

    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await colorways.findOne({ _id: objectId })
      if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

      let variantLabel: string | undefined
      let current: number
      if (subVariantId) {
        const v = existing.breakdown?.find((b: { id: string }) => b.id === subVariantId)
        if (!v) return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
        variantLabel = v.label
        current = v.quantity
      } else {
        if (existing.breakdown?.length) {
          return NextResponse.json({ error: 'Count each variant' }, { status: 400 })
        }
        current = existing.quantityAvailable
      }

      const diff = counted - current
      if (diff === 0) return NextResponse.json({ quantityAvailable: existing.quantityAvailable, breakdown: existing.breakdown ?? [], diff: 0 })

      // Only apply if nobody changed the stock since we read it; otherwise re-read and retry.
      const filter = subVariantId
        ? { _id: objectId, breakdown: { $elemMatch: { id: subVariantId, quantity: current } } }
        : { _id: objectId, quantityAvailable: current }
      const update = subVariantId
        ? { $inc: { 'breakdown.$[v].quantity': diff, quantityAvailable: diff }, $set: { updatedAt: new Date() } }
        : { $inc: { quantityAvailable: diff }, $set: { updatedAt: new Date() } }

      const after = await colorways.findOneAndUpdate(filter, update, {
        returnDocument: 'after',
        ...(subVariantId ? { arrayFilters: [{ 'v.id': subVariantId }] } : {}),
      })
      if (!after) continue

      await db.collection('activities').insertOne({
        type: diff > 0 ? 'IN' : 'OUT',
        kind: 'count_diff',
        quantityChange: Math.abs(diff),
        colorwayId,
        designCodeId: existing.designCodeId,
        fullCode: existing.fullCode,
        previousQuantity: current,
        newQuantity: counted,
        ...(variantLabel ? { subVariantLabel: variantLabel } : {}),
        timestamp: new Date().toISOString(),
      })
      return NextResponse.json({ quantityAvailable: after.quantityAvailable, breakdown: after.breakdown ?? [], diff })
    }

    return NextResponse.json({ error: 'Stock changed while counting. Try again.' }, { status: 409 })
  } catch (error) {
    console.error('Error saving count:', error)
    return NextResponse.json({ error: 'Could not save count' }, { status: 500 })
  }
}
