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
    const db = await getDb()

    // 1. Check for exact colorway match (case-insensitive)
    const colorwayMatch = await db.collection('colorways').findOne({ 
      fullCode: { $regex: new RegExp(`^${term}$`, 'i') } 
    })

    if (colorwayMatch) {
      return NextResponse.json({
        found: true,
        type: 'colorway',
        url: `/classify/${colorwayMatch.designCodeId}?search=${encodeURIComponent(colorwayMatch.fullCode)}`
      })
    }

    // 2. Check for exact design code match (case-insensitive)
    const designCodeMatch = await db.collection('designCodes').findOne({ 
      code: { $regex: new RegExp(`^${term}$`, 'i') } 
    })

    if (designCodeMatch) {
      return NextResponse.json({
        found: true,
        type: 'designCode',
        url: `/classify/${designCodeMatch._id.toString()}`
      })
    }

    return NextResponse.json({ found: false })

  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ error: 'Internal Server Error', found: false }, { status: 500 })
  }
}
