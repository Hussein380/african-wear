export type Bale = { id: string; label: string; quantity: number }

/**
 * Cleans and checks an item's colour list (breakdown) and quantity sent from a form.
 * Returns the clean breakdown and the total, which is always the sum of the colours
 * when there are colours, or an error message for staff.
 */
export function validateStock(
  breakdown: unknown,
  quantityAvailable: unknown
): { breakdown: Bale[]; total: number } | { error: string } {
  const list = Array.isArray(breakdown) ? breakdown : []
  const clean: Bale[] = []
  const seen = new Set<string>()

  for (const raw of list) {
    const label = String(raw?.label ?? '').trim()
    const quantity = Number(raw?.quantity ?? 0)
    if (!Number.isInteger(quantity) || quantity < 0) {
      return { error: `"${label || 'A colour'}" must be a whole number of 0 or more.` }
    }
    // An unnamed colour with nothing in it is just an empty form row
    if (!label) {
      if (quantity === 0) continue
      return { error: 'Every colour that has stock needs a name.' }
    }
    const key = label.toLowerCase()
    if (seen.has(key)) return { error: `The colour "${label}" is listed twice.` }
    seen.add(key)
    clean.push({ id: String(raw?.id || `${Date.now()}-${clean.length}`), label, quantity })
  }

  if (clean.length > 0) {
    return { breakdown: clean, total: clean.reduce((sum, b) => sum + b.quantity, 0) }
  }

  const total = Number(quantityAvailable ?? 0)
  if (!Number.isInteger(total) || total < 0) {
    return { error: 'Quantity must be a whole number of 0 or more.' }
  }
  return { breakdown: [], total }
}

/** True when two colour lists hold the same quantities under the same ids. */
export function sameStock(
  a: { quantityAvailable: number; breakdown?: Bale[] },
  b: { quantityAvailable: number; breakdown?: Bale[] }
): boolean {
  if (a.quantityAvailable !== b.quantityAvailable) return false
  const qa = new Map((a.breakdown || []).map(x => [x.id, x.quantity]))
  const qb = new Map((b.breakdown || []).map(x => [x.id, x.quantity]))
  if (qa.size !== qb.size) return false
  for (const [id, q] of qa) if (qb.get(id) !== q) return false
  return true
}
