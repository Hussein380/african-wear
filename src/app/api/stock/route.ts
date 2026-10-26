import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { CORRECTION_WINDOW_MS, BULK_THRESHOLD } from '@/lib/stockRules'

export const dynamic = 'force-dynamic'

/**
 * POST /api/stock — apply a stock CHANGE (not a "set to").
 *
 * body: { colorwayId, change: +5 | -3, subVariantId?, undoOf?: activityId }
 *
 * - The change is applied atomically, so two phones can never overwrite each other.
 * - Stock can never go below 0.
 * - A change in the OPPOSITE direction right after the last one on the same item is a
 *   correction (a wrong tap): the earlier history row is shrunk/removed instead of
 *   recording a fake sale + fake delivery. Bulk entries are never auto-corrected.
 * - The history row is written with the real before/after numbers.
 */
export async function POST(request: Request) {
  try {
    const { colorwayId, change, subVariantId, undoOf, soldPrice, costPrice, kind: requestedKind } = await request.json()

    if (
      typeof colorwayId !== 'string' ||
      !ObjectId.isValid(colorwayId) ||
      !Number.isInteger(change) ||
      change === 0 ||
      Math.abs(change) > 100000
    ) {
      return NextResponse.json({ error: 'Invalid stock change' }, { status: 400 })
    }

    const db = await getDb()
    const colorways = db.collection('colorways')
    const activities = db.collection('activities')
    const objectId = new ObjectId(colorwayId)

    const existing = await colorways.findOne({ _id: objectId })
    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const hasBreakdown = Array.isArray(existing.breakdown) && existing.breakdown.length > 0
    let variantLabel: string | undefined
    if (subVariantId) {
      const v = existing.breakdown?.find((b: { id: string }) => b.id === subVariantId)
      if (!v) return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
      variantLabel = v.label
    } else if (hasBreakdown) {
      return NextResponse.json({ error: 'Choose which variant to change' }, { status: 400 })
    }

    // ---- 1. Atomic stock change (never below zero) ----
    const needed = change < 0 ? -change : 0
    const filter = subVariantId
      ? { _id: objectId, breakdown: { $elemMatch: { id: subVariantId, quantity: { $gte: needed } } } }
      : { _id: objectId, quantityAvailable: { $gte: needed } }
    const update = subVariantId
      ? { $inc: { 'breakdown.$[v].quantity': change, quantityAvailable: change }, $set: { updatedAt: new Date() } }
      : { $inc: { quantityAvailable: change }, $set: { updatedAt: new Date() } }

    const after = await colorways.findOneAndUpdate(filter, update, {
      returnDocument: 'after',
      ...(subVariantId ? { arrayFilters: [{ 'v.id': subVariantId }] } : {}),
    })

    if (!after) {
      const fresh = await colorways.findOne({ _id: objectId })
      const available = subVariantId
        ? fresh?.breakdown?.find((b: { id: string }) => b.id === subVariantId)?.quantity ?? 0
        : fresh?.quantityAvailable ?? 0
      return NextResponse.json(
        { error: `Only ${available} in stock`, available },
        { status: 409 }
      )
    }

    const newQuantity: number = subVariantId
      ? after.breakdown.find((b: { id: string }) => b.id === subVariantId).quantity
      : after.quantityAvailable
    const stockBefore = newQuantity - change
    const type: 'IN' | 'OUT' = change > 0 ? 'IN' : 'OUT'
    const now = new Date()

    const respond = (extra: Record<string, unknown>) =>
      NextResponse.json({
        quantityAvailable: after.quantityAvailable,
        breakdown: after.breakdown ?? [],
        ...extra,
      })

    try {
      // ---- 2. Is this a correction of the previous entry? ----
      let prev = null
      if (typeof undoOf === 'string' && ObjectId.isValid(undoOf)) {
        prev = await activities.findOne({ _id: new ObjectId(undoOf), colorwayId })
      } else {
        prev = await activities.findOne({ colorwayId }, { sort: { timestamp: -1 } })
        if (
          prev &&
          (now.getTime() - Date.parse(prev.timestamp) > CORRECTION_WINDOW_MS ||
            prev.quantityChange >= BULK_THRESHOLD)
        ) {
          prev = null
        }
      }

      const canNet =
        prev &&
        (prev.type === 'IN' || prev.type === 'OUT') &&
        prev.type !== type &&
        (prev.subVariantLabel || undefined) === variantLabel

      let cancelled = 0
      let prevSign = 0
      if (canNet && prev) {
        cancelled = Math.min(prev.quantityChange, Math.abs(change))
        prevSign = prev.type === 'IN' ? 1 : -1
        const left = prev.quantityChange - cancelled
        if (left === 0) {
          await activities.deleteOne({ _id: prev._id })
        } else {
          await activities.updateOne(
            { _id: prev._id },
            { $set: { quantityChange: left, newQuantity: prev.previousQuantity + prevSign * left, edited: true } }
          )
        }
      }

      const remaining = Math.abs(change) - cancelled
      if (cancelled > 0 && remaining === 0) {
        return respond({ corrected: true })
      }

      // Determine final soldPrice and costPrice snapshots
      let finalSoldPrice: number | undefined = undefined
      let finalCostPrice: number | undefined = undefined

      const effectiveKind = requestedKind || (type === 'OUT' ? 'sold' : 'arrived')

      if (type === 'OUT' && effectiveKind === 'sold') {
        if (soldPrice !== undefined && soldPrice !== null && soldPrice !== '' && !isNaN(Number(soldPrice))) {
          finalSoldPrice = Number(soldPrice)
        } else if (existing.sellingPrice !== undefined) {
          finalSoldPrice = existing.sellingPrice
        }

        if (costPrice !== undefined && costPrice !== null && costPrice !== '' && !isNaN(Number(costPrice))) {
          finalCostPrice = Number(costPrice)
        } else if (existing.buyingPrice !== undefined) {
          finalCostPrice = existing.buyingPrice
        }
      }

      // ---- 3. Record the movement ----
      const doc = {
        type,
        kind: effectiveKind,
        quantityChange: remaining,
        colorwayId,
        designCodeId: existing.designCodeId,
        fullCode: existing.fullCode,
        previousQuantity: cancelled > 0 ? stockBefore - prevSign * cancelled : stockBefore,
        newQuantity,
        ...(variantLabel ? { subVariantLabel: variantLabel } : {}),
        ...(cancelled > 0 ? { edited: true } : {}),
        ...(finalSoldPrice !== undefined ? { soldPrice: finalSoldPrice } : {}),
        ...(finalCostPrice !== undefined ? { costPrice: finalCostPrice } : {}),
        timestamp: now.toISOString(),
      }
      const inserted = await activities.insertOne(doc)
      return respond({ 
        corrected: false, 
        activityId: inserted.insertedId.toString(), 
        type, 
        kind: doc.kind,
        soldPrice: finalSoldPrice,
        costPrice: finalCostPrice,
      })
    } catch (logError) {
      // History could not be written: undo the stock change so the two never disagree.
      console.error('Stock history failed, rolling back:', logError)
      await colorways.updateOne(
        { _id: objectId },
        subVariantId
          ? { $inc: { 'breakdown.$[v].quantity': -change, quantityAvailable: -change } }
          : { $inc: { quantityAvailable: -change } },
        subVariantId ? { arrayFilters: [{ 'v.id': subVariantId }] } : {}
      )
      return NextResponse.json({ error: 'Could not save. Nothing was changed.' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error changing stock:', error)
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }
}
