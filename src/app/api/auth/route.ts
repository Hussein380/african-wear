import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getDb } from '@/lib/mongodb'

// Simple hash function for PIN (not crypto-grade, but fine for a personal app)
function hashPin(pin: string): string {
  let hash = 0
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

// POST /api/auth — verify PIN
export async function POST(request: Request) {
  try {
    const { pin } = await request.json()

    if (!pin || typeof pin !== 'string' || pin.length < 4 || pin.length > 6) {
      return NextResponse.json({ error: 'Invalid PIN format' }, { status: 400 })
    }

    // Check against env variable first (simple setup)
    const envPin = process.env.APP_PIN || '1234'
    
    if (pin === envPin) {
      // Set session cookie
      const cookieStore = await cookies()
      const sessionToken = hashPin(pin + Date.now().toString())
      
      cookieStore.set('maw-session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })

      // Also store token in DB for validation
      const db = await getDb()
      await db.collection('sessions').updateOne(
        { type: 'active-session' },
        { $set: { token: sessionToken, createdAt: new Date() } },
        { upsert: true }
      )

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE /api/auth — logout
export async function DELETE() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete('maw-session')
    
    const db = await getDb()
    await db.collection('sessions').deleteMany({ type: 'active-session' })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// GET /api/auth — check session
export async function GET() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('maw-session')

    if (!session?.value) {
      return NextResponse.json({ authenticated: false })
    }

    const db = await getDb()
    const activeSession = await db.collection('sessions').findOne({ 
      type: 'active-session',
      token: session.value 
    })

    return NextResponse.json({ authenticated: !!activeSession })
  } catch {
    return NextResponse.json({ authenticated: false })
  }
}
