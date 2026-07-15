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

  // Prefetch data on hover so pages feel instant when clicked
  const handleHover = (cat: typeof categories[0]) => {
    if (cat.route) router.prefetch(cat.route)

    const cacheKey = `prefetch_${cat.key}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      try {
        const { ts } = JSON.parse(cached)
        if (Date.now() - ts < 30_000) return // skip if fresh
      } catch { /* ignore */ }
    }

    let url = ''
    if (cat.key === 'History') {
      const today = new Date()
      const start = new Date()
      start.setDate(today.getDate() - 7)
      url = `/api/activities?page=1&limit=20&startDate=${start.toISOString().split('T')[0]}&endDate=${today.toISOString().split('T')[0]}`
    } else if (cat.key === 'Dashboard') {
      url = '/api/dashboard'
    } else {
      // PrintedC, PrintedP, PrintTC
      url = `/api/design-codes?category=${cat.key}`
    }

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
                  if (cat.key === 'History') {
                    router.push('/history')
                  } else if (cat.key === 'Dashboard') {
                    if (pathname === '/classify') {
                      onCategoryChange('Dashboard')
                    } else {
                      router.push('/classify?category=Dashboard')
                    }
                  } else {
                    if (pathname === '/classify') {
                      onCategoryChange(cat.key)
                    } else {
                      router.push(`/classify?category=${cat.key}`)
                    }
                  }
                  if (onClose) onClose()
                }}
                onMouseEnter={() => handleHover(cat)}
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
