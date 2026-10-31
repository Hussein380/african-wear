'use client'

import { useEffect, useRef } from 'react'

/** How often open stock pages fetch the latest numbers. */
export const AUTO_REFRESH_MS = 20_000

/** True while staff are in the middle of something a refresh must not disturb. */
function isBusy(): boolean {
  if (document.querySelector('.modal-overlay')) return true // a form, count or receipt is open
  const el = document.activeElement
  return !!el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

/**
 * Keeps a page's numbers current without the user touching anything:
 * runs `refresh` every 20 seconds while the app is on screen, and straight away when the
 * app comes back on screen (unlocking the phone, switching back from WhatsApp).
 * Skipped while the app is hidden or while someone is typing or has a form open.
 */
export function useAutoRefresh(refresh: () => void, enabled = true) {
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  })

  useEffect(() => {
    if (!enabled) return

    const run = () => {
      if (document.visibilityState !== 'visible' || isBusy()) return
      refreshRef.current()
    }

    const timer = window.setInterval(run, AUTO_REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled])
}
