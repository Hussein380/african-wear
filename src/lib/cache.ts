/**
 * sessionStorage-based SWR cache utility.
 *
 * Rules:
 *  - getCached returns data only if it is within maxAgeMs.
 *  - setCached writes data with a timestamp.
 *  - bustCache removes a specific key so the next fetch is always fresh.
 *  - All operations are wrapped in try/catch — sessionStorage can be
 *    unavailable in private browsing or when storage is full.
 */

export const CacheKeys = {
  /** List of design codes for a category (e.g. PrintedC) */
  designCodes: (category: string) => `dc_${category}`,
  /** Colorways for a specific design code */
  colorways: (designCodeId: string) => `cw_${designCodeId}`,
}

interface CacheEntry<T> {
  data: T
  ts: number
}

/**
 * Read from cache. Returns null if missing, expired, or malformed.
 * @param maxAgeMs default 60 seconds
 */
export function getCached<T>(key: string, maxAgeMs = 60_000): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() - entry.ts > maxAgeMs) return null
    return entry.data
  } catch {
    return null
  }
}

/**
 * Returns the age of a cache entry in milliseconds, or Infinity if not present.
 */
export function getCacheAge(key: string): number {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return Infinity
    const entry: CacheEntry<unknown> = JSON.parse(raw)
    return Date.now() - entry.ts
  } catch {
    return Infinity
  }
}

/** Write data to cache with current timestamp. */
export function setCached(key: string, data: unknown): void {
  try {
    const entry: CacheEntry<unknown> = { data, ts: Date.now() }
    sessionStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // Storage full or unavailable — silently skip
  }
}

/** Remove a cache entry so the next read is always a fresh network fetch. */
export function bustCache(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // Ignore
  }
}
