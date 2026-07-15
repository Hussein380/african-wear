import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')

    if (!q) {
      return NextResponse.json({ found: false })
    }

    const term = q.trim()
    // Create a flexible regex: replace spaces/hyphens with optional space/hyphen matching
    const flexibleTerm = term.replace(/[\s-]/g, '').split('').join('[\\s-]*')
    const regex = new RegExp(flexibleTerm, 'i')

    const db = await getDb()

    // 1. Search colorways for partial match
    const colorways = await db.collection('colorways').find({ 
      fullCode: { $regex: regex } 
    }).toArray()

    if (colorways.length > 0) {
      // Check if all matched colorways belong to the SAME design code
      const uniqueDesignCodeIds = [...new Set(colorways.map(cw => cw.designCodeId))]
      
      if (uniqueDesignCodeIds.length === 1) {
        // If they all belong to one design code, take the user directly there!
        // We'll pass the exact search term so the detail page filters it down.
        return NextResponse.json({
          found: true,
          type: 'colorway',
          url: `/classify/${uniqueDesignCodeIds[0]}?search=${encodeURIComponent(term)}`
        })
      }
    }

    // 2. Search design codes for partial match
    const designCodes = await db.collection('designCodes').find({ 
      code: { $regex: regex } 
    }).toArray()

    if (designCodes.length === 1) {
      return NextResponse.json({
        found: true,
        type: 'designCode',
        url: `/classify/${designCodes[0]._id.toString()}`
      })
    }

    // 3. If multiple distinct design codes matched, or zero matched, we can't auto-redirect.
    return NextResponse.json({ found: false })

  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ error: 'Internal Server Error', found: false }, { status: 500 })
  }
}
