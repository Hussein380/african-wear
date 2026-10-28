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
 * @param maxAgeMs default 15 minutes (with SWR background refresh)
 */
export function getCached<T>(key: string, maxAgeMs = 15 * 60_000): T | null {
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

/** Invalidate all design code list caches when stock is sold or modified */
export function bustAllDesignCodesCache(): void {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith('dc_')) {
        keysToRemove.push(k)
      }
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k))
  } catch {
    // Ignore
  }
}

/**
 * Prefetches colorways and preloads the hero image in the background
 * so that tapping into a design code opens with ZERO delay.
 */
export async function prefetchColorways(designCodeId: string): Promise<void> {
  const cacheKey = CacheKeys.colorways(designCodeId)
  if (getCached(cacheKey)) return
  try {
    const res = await fetch(`/api/colorways?designCodeId=${designCodeId}`)
    if (res.ok) {
      const data = await res.json()
      setCached(cacheKey, data)
      // Pre-warm the hero image into browser cache immediately
      if (Array.isArray(data) && data[0]?.photos?.[0]?.url) {
        const img = new Image()
        img.src = data[0].photos[0].url.replace(
          /\/image\/upload\/(?:(?!v\d+)[a-zA-Z0-9_,:]+\/)?/,
          '/image/upload/f_auto,q_auto,w_520,c_fill/'
        )
      }
    }
  } catch {
    // Ignore background prefetch errors
  }
}
