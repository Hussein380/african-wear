// Business rules for stock movements. Change the numbers here to tune behaviour.

/** A "wrong tap" fix (opposite direction on the same item) within this time cancels the earlier entry. */
export const CORRECTION_WINDOW_MS = 2 * 60 * 1000

/** Entries this big or bigger are treated as real bulk arrivals/removals and are never auto-cancelled. */
export const BULK_THRESHOLD = 20

/** Colorways with fewer pieces than this are "running low". */
export const LOW_STOCK_THRESHOLD = 5

/** An item with stock but no sale for this many days is "not selling". */
export const NOT_SELLING_DAYS = 60

/** The shop is in East Africa Time (UTC+3, no daylight saving). */
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000

export type ActivityKind =
  | 'sold' // removed (default for a "−")
  | 'own_use' // removed but not sold
  | 'arrived' // new stock (default for a "+")
  | 'returned' // customer returned stock
  | 'count_diff' // difference found during a stock count
  | 'deleted' // item deleted while it still had stock
  | 'new' // item first created with stock

/** Kinds staff may switch between with one tap, per direction. */
export const TAG_OPTIONS: Record<'IN' | 'OUT', ActivityKind[]> = {
  OUT: ['sold', 'own_use'],
  IN: ['arrived', 'returned'],
}

/** Older history rows have no `kind` – derive it so past data keeps its meaning. */
export function effectiveKind(a: { type: string; kind?: string }): ActivityKind {
  if (a.kind) return a.kind as ActivityKind
  if (a.type === 'OUT') return 'sold'
  if (a.type === 'IN') return 'arrived'
  return 'new'
}

/** Start (00:00) of the shop-local day containing `d`, as a real Date. */
export function startOfShopDay(d: Date = new Date()): Date {
  const local = new Date(d.getTime() + EAT_OFFSET_MS)
  local.setUTCHours(0, 0, 0, 0)
  return new Date(local.getTime() - EAT_OFFSET_MS)
}

/** Start of the shop-local day `days` days ago. */
export function shopDaysAgo(days: number): Date {
  return new Date(startOfShopDay().getTime() - days * 24 * 60 * 60 * 1000)
}

/** Parse a yyyy-mm-dd string as a shop-local day boundary. */
export function shopDayBoundary(dateStr: string, end: boolean): Date {
  return new Date(`${dateStr}T${end ? '23:59:59.999' : '00:00:00.000'}+03:00`)
}

/** The shop-local calendar date of `d` as yyyy-mm-dd (e.g. for date inputs and receipt numbers). */
export function shopDateString(d: Date = new Date()): string {
  return new Date(d.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10)
}

export type HistoryPreset = 'this_week' | '7days' | 'this_month' | 'last_month' | 'this_year'

/** yyyy-mm-dd start/end of a History date preset, in shop-local calendar days. */
export function historyPresetRange(preset: HistoryPreset, now: Date = new Date()): { start: string; end: string } {
  // Work on the shop-local calendar date using UTC fields so the device time zone never matters.
  const today = new Date(`${shopDateString(now)}T00:00:00Z`)
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  let start = today
  let end = today

  if (preset === 'this_week') {
    const day = today.getUTCDay() // 0 = Sunday; weeks start on Monday
    start = new Date(Date.UTC(y, m, today.getUTCDate() - (day === 0 ? 6 : day - 1)))
  } else if (preset === '7days') {
    start = new Date(Date.UTC(y, m, today.getUTCDate() - 7))
  } else if (preset === 'this_month') {
    start = new Date(Date.UTC(y, m, 1))
  } else if (preset === 'last_month') {
    start = new Date(Date.UTC(y, m - 1, 1))
    end = new Date(Date.UTC(y, m, 0))
  } else if (preset === 'this_year') {
    start = new Date(Date.UTC(y, 0, 1))
  }
  return { start: fmt(start), end: fmt(end) }
}
