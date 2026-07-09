import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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

  // Check for session cookie
  const session = request.cookies.get('maw-session')

  if (!session?.value) {
    // Redirect to home page for PIN entry
    return NextResponse.redirect(new URL('/?auth=required', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
