import type { Db } from 'mongodb'
import { shopDateString } from './stockRules'

/**
 * Next receipt number, INV-YYYYMMDD-NNN, counted per shop-local day.
 * The counter only ever goes up, so deleting a receipt never frees its number for reuse.
 */
export async function nextReceiptNumber(db: Db, now: Date = new Date()): Promise<string> {
  const dateStr = shopDateString(now).replace(/-/g, '')
  const counter = await db.collection<{ _id: string; seq: number }>('counters').findOneAndUpdate(
    { _id: `inv-${dateStr}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  )
  return `INV-${dateStr}-${String(counter?.seq ?? 1).padStart(3, '0')}`
}
