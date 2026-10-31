'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const DEPTH_KEY = 'maw-nav-depth'

function readDepth(): number {
  try {
    return Number(sessionStorage.getItem(DEPTH_KEY)) || 0
  } catch {
    return 0
  }
}

/**
 * Counts in-app page views for this tab, so Back knows whether there is an app
 * page to return to. Mounted once in the root layout.
 */
export function NavigationTracker() {
  const pathname = usePathname()

  useEffect(() => {
    try {
      sessionStorage.setItem(DEPTH_KEY, String(readDepth() + 1))
    } catch {
      // storage unavailable: Back falls back to the dashboard
    }
  }, [pathname])

  return null
}

/**
 * Back button behaviour: return to the page the user came from inside the app.
 * If the page was opened directly (new tab, bookmark, PWA launch) there is nothing
 * to go back to, so go to the dashboard instead of leaving the app.
 */
export function useGoBack(fallback = '/classify') {
  const router = useRouter()

  return () => {
    const depth = readDepth()
    if (depth > 1) {
      // The page we return to will count itself again, so step back two.
      try {
        sessionStorage.setItem(DEPTH_KEY, String(depth - 2))
      } catch {}
      router.back()
    } else {
      router.push(fallback)
    }
  }
}
