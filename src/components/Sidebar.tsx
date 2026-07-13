'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Category } from '@/types'

export type ViewState = Category | 'Dashboard' | 'History'

interface SidebarProps {
  activeCategory: ViewState
  onCategoryChange: (category: ViewState) => void
  isOpen?: boolean
  onClose?: () => void
}

const categories: { key: ViewState; label: string; isSpecial?: boolean; route?: string }[] = [
  { key: 'PrintedC', label: 'PrintedC' },
  { key: 'PrintedP', label: 'PrintedP' },
  { key: 'PrintTC', label: 'PrintTC' },
  { key: 'Dashboard', label: 'Dashboard', isSpecial: true, route: '/classify' },
  { key: 'History', label: 'Transaction History', isSpecial: true, route: '/history' },
]

export default function Sidebar({ activeCategory, onCategoryChange, isOpen, onClose }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  // Prefetch history data on hover so it's cached by the time user clicks
  const handleHistoryHover = () => {
    router.prefetch('/history')
    // Pre-warm the API data into sessionStorage
    const cacheKey = 'history_cache_7days'
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      const { ts } = JSON.parse(cached)
      // Don't re-fetch if cached within last 30 seconds
      if (Date.now() - ts < 30_000) return
    }
    const today = new Date()
    const start = new Date()
    start.setDate(today.getDate() - 7)
    const url = `/api/activities?page=1&limit=20&startDate=${start.toISOString().split('T')[0]}&endDate=${today.toISOString().split('T')[0]}`
    fetch(url, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) sessionStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }))
      })
      .catch(() => {})
  }

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <ul className="sidebar__list">
          {categories.map(cat => {
            // Determine if active based on pathname if it's a route-based link
            const isActive = cat.route && cat.key !== 'Dashboard' 
              ? pathname.startsWith(cat.route) 
              : activeCategory === cat.key;

            return (
              <li
                key={cat.key}
                className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''} ${cat.isSpecial ? 'sidebar__item--special' : ''}`}
                onClick={() => {
                  if (cat.route && cat.key === 'History') {
                    router.push(cat.route)
                  } else if (cat.key === 'Dashboard') {
                    router.push('/classify')
                  } else if (!pathname.startsWith('/classify')) {
                    // If we're on History, Inventory, etc., navigate to classify with category
                    router.push(`/classify?category=${cat.key}`)
                  } else {
                    onCategoryChange(cat.key)
                  }
                  if (onClose) onClose()
                }}
                onMouseEnter={cat.key === 'History' ? handleHistoryHover : undefined}
                role="button"
                tabIndex={0}
              >
                {cat.label}
              </li>
            )
          })}
        </ul>
      </aside>
    </>
  )
}
