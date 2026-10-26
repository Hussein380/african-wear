import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

export interface SearchSuggestion {
  id: string
  title: string // Full code (e.g. ANK240913K) or Design Code (ANK240913) or Transaction
  subtitle: string // Category & Stock info or Transaction details
  category: string
  type: 'colorway' | 'designCode' | 'activity'
  url: string
  thumbnailUrl?: string
  quantityAvailable?: number
  badgeText?: string
  badgeTone?: 'green' | 'red' | 'purple' | 'blue' | 'amber'
  dateStr?: string
}

// GET /api/search?q=... — Universal omni-search across fabrics, designs, categories, dates, and transactions
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')

    if (!q || !q.trim()) {
      return NextResponse.json({ suggestions: [], found: false })
    }

    const term = q.trim()

    // Escape regex characters
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const escaped = escapeRegExp(term)
    const flexible = escaped.replace(/[\s-]/g, '').split('').join('[\\s-]*')
    const regex = new RegExp(flexible, 'i')
    const simpleRegex = new RegExp(escaped, 'i')

    const db = await getDb()

    // 1. Search colorways matching fullCode
    const matchedColorways = await db.collection('colorways')
      .find({ fullCode: { $regex: regex } })
      .limit(8)
      .project({ fullCode: 1, designCodeId: 1, quantityAvailable: 1, photos: 1 })
      .toArray()

    // 2. Search design codes matching code or category
    const matchedDesigns = await db.collection('designCodes')
      .find({
        $or: [
          { code: { $regex: regex } },
          { category: { $regex: regex } },
        ]
      })
      .limit(5)
      .project({ code: 1, category: 1, thumbnailUrl: 1 })
      .toArray()

    // 3. Search activity history / transactions matching fullCode, action kind, variant, or date
    // Check if query looks like a date (e.g. "2026-10", "Oct", "Friday", "26")
    const matchedActivities = await db.collection('activities')
      .find({
        $or: [
          { fullCode: { $regex: regex } },
          { kind: { $regex: simpleRegex } },
          { subVariantLabel: { $regex: simpleRegex } },
          { timestamp: { $regex: simpleRegex } },
        ]
      })
      .sort({ timestamp: -1 })
      .limit(6)
      .project({
        fullCode: 1,
        designCodeId: 1,
        type: 1,
        kind: 1,
        quantityChange: 1,
        previousQuantity: 1,
        newQuantity: 1,
        timestamp: 1,
        subVariantLabel: 1,
      })
      .toArray()

    // Gather design codes to fetch photos/category details for matched colorways
    const parentDesignIds = Array.from(new Set([
      ...matchedColorways.map(cw => cw.designCodeId),
      ...matchedActivities.map(a => a.designCodeId)
    ])).filter(Boolean)

    const parentObjectIds = parentDesignIds.map(id => {
      try {
        return new ObjectId(id)
      } catch {
        return null
      }
    }).filter(Boolean)

    const parentDesigns = parentObjectIds.length > 0
      ? await db.collection('designCodes')
          .find({ _id: { $in: parentObjectIds as ObjectId[] } })
          .project({ code: 1, category: 1, thumbnailUrl: 1 })
          .toArray()
      : []

    const designMap = new Map<string, { code: string; category: string; thumbnailUrl?: string }>()
    for (const d of parentDesigns) {
      designMap.set(d._id.toString(), { code: d.code, category: d.category, thumbnailUrl: d.thumbnailUrl })
    }

    const suggestions: SearchSuggestion[] = []

    // Map matched colorways (highest priority)
    for (const cw of matchedColorways) {
      const parent = designMap.get(cw.designCodeId)
      const photo = cw.photos?.[0]?.url || parent?.thumbnailUrl
      const qty = cw.quantityAvailable ?? 0
      suggestions.push({
        id: cw._id.toString(),
        title: cw.fullCode,
        subtitle: `${parent?.category || 'Fabric'} · ${qty} in stock`,
        category: parent?.category || '',
        type: 'colorway',
        url: `/classify/${cw.designCodeId}?search=${encodeURIComponent(cw.fullCode)}`,
        thumbnailUrl: photo,
        quantityAvailable: qty,
        badgeText: qty > 0 ? `${qty} in stock` : 'Out of stock',
        badgeTone: qty > 0 ? 'green' : 'red',
      })
    }

    // Map matched design codes
    for (const d of matchedDesigns) {
      if (!suggestions.some(s => s.title.toLowerCase() === d.code.toLowerCase())) {
        suggestions.push({
          id: d._id.toString(),
          title: d.code,
          subtitle: `Category: ${d.category} (Design Family)`,
          category: d.category,
          type: 'designCode',
          url: `/classify/${d._id.toString()}`,
          thumbnailUrl: d.thumbnailUrl,
          badgeText: d.category,
          badgeTone: 'purple',
        })
      }
    }

    // Map matched activities / transaction records
    for (const act of matchedActivities) {
      const parent = designMap.get(act.designCodeId)
      const dateObj = new Date(act.timestamp)
      const formattedDate = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : act.timestamp

      const actionLabel = act.kind === 'sold'
        ? '🛍️ Sold'
        : act.kind === 'own_use'
        ? '👤 Own Use'
        : act.kind === 'arrived'
        ? '📦 Arrived'
        : act.kind === 'returned'
        ? '↩️ Return'
        : act.type === 'IN'
        ? '+ Added'
        : '- Removed'

      const badgeTone = act.type === 'IN' ? 'blue' : act.kind === 'sold' ? 'green' : 'amber'

      suggestions.push({
        id: act._id.toString(),
        title: `${actionLabel} ${act.quantityChange} pcs of ${act.fullCode}`,
        subtitle: `${formattedDate} · In store: ${act.newQuantity ?? '—'} (Stock Log)`,
        category: parent?.category || 'History',
        type: 'activity',
        url: act.designCodeId
          ? `/classify/${act.designCodeId}?search=${encodeURIComponent(act.fullCode)}`
          : `/history?search=${encodeURIComponent(act.fullCode)}`,
        badgeText: actionLabel,
        badgeTone,
        dateStr: formattedDate,
      })
    }

    return NextResponse.json({
      suggestions: suggestions.slice(0, 12),
      found: suggestions.length > 0,
      totalMatches: suggestions.length,
    })
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ suggestions: [], found: false, error: 'Search failed' }, { status: 500 })
  }
}
