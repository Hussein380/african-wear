import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Already signed in (30-day cookie)? Skip the landing/PIN screen entirely.
  if (pathname === '/' && request.cookies.get('maw-session')?.value) {
    return NextResponse.redirect(new URL('/classify', request.url))
  }

  // Public paths that don't need auth
  const publicPaths = ['/', '/api/auth']
  const isPublicPath = publicPaths.some(p => pathname === p)
  
  // Static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/mandera-logo') ||
    pathname.includes('.') ||
    isPublicPath
  ) {
    return NextResponse.next()
  }

  // Check for session cookie — if it exists, trust it.
  // The cookie is httpOnly, server-set, and has a 30-day expiry.
  // No DB round-trip needed here; that was causing unnecessary failures.
  const session = request.cookies.get('maw-session')

  if (!session?.value) {
    return NextResponse.redirect(new URL('/?auth=required', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
