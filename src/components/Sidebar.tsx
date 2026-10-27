'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Category } from '@/types'

export type ViewState = Category | 'Dashboard' | 'Inventory' | 'History' | 'Finance'

interface SidebarProps {
  activeCategory: ViewState
  onCategoryChange: (category: ViewState) => void
  isOpen?: boolean
  onClose?: () => void
  onOpenSearch?: () => void
}

interface NavItem {
  key: ViewState
  label: string
  isSpecial?: boolean
  route?: string
  icon: React.ReactNode
}

const categories: NavItem[] = [
  {
    key: 'PrintedC',
    label: 'Printed C',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"/>
        <path d="M9 3v18"/>
        <path d="M15 3v18"/>
      </svg>
    ),
  },
  {
    key: 'PrintedP',
    label: 'Printed P',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"/>
        <path d="M3 9h18"/>
        <path d="M3 15h18"/>
      </svg>
    ),
  },
  {
    key: 'PrintTC',
    label: 'Print TC',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2"/>
        <path d="m9 9 6 6"/>
        <path d="m15 9-6 6"/>
      </svg>
    ),
  },
  {
    key: 'Dashboard',
    label: 'Overview',
    isSpecial: true,
    route: '/classify',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="7" height="9" x="3" y="3" rx="1"/>
        <rect width="7" height="5" x="14" y="3" rx="1"/>
        <rect width="7" height="9" x="14" y="12" rx="1"/>
        <rect width="7" height="5" x="3" y="16" rx="1"/>
      </svg>
    ),
  },
  {
    key: 'Inventory',
    label: 'Master Stock',
    isSpecial: true,
    route: '/inventory',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m7.5 4.27 9 5.15"/>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
        <path d="m3.3 7 8.7 5 8.7-5"/>
        <path d="M12 22V12"/>
      </svg>
    ),
  },
  {
    key: 'History',
    label: 'Activity Log',
    isSpecial: true,
    route: '/history',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    key: 'Finance',
    label: 'Finance & Sales',
    isSpecial: true,
    route: '/finance',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" x2="12" y1="2" y2="22"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
]

export default function Sidebar({ activeCategory, onCategoryChange, isOpen, onClose }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  // Prefetch data on hover so pages feel instant when clicked
  const handleHover = (cat: NavItem) => {
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
    } else if (cat.key === 'Finance') {
      url = '/api/finance?range=month'
    } else if (cat.key === 'Inventory') {
      url = '/api/inventory'
    } else {
      url = `/api/design-codes?category=${cat.key}`
    }

    fetch(url, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
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
            let isActive = false
            if (cat.key === 'Inventory') {
              isActive = pathname.startsWith('/inventory')
            } else if (cat.key === 'History') {
              isActive = pathname.startsWith('/history')
            } else if (cat.key === 'Finance') {
              isActive = pathname.startsWith('/finance')
            } else if (cat.key === 'Dashboard') {
              isActive = pathname === '/classify' && (activeCategory === 'Dashboard' || !activeCategory)
            } else {
              isActive = pathname.startsWith('/classify') && activeCategory === cat.key
            }

            return (
              <li
                key={cat.key}
                className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''} ${cat.isSpecial ? 'sidebar__item--special' : ''}`}
                onClick={() => {
                  if (cat.key === 'History') {
                    router.push('/history')
                  } else if (cat.key === 'Finance') {
                    router.push('/finance')
                  } else if (cat.key === 'Inventory') {
                    router.push('/inventory')
                  } else {
                    router.push(`/classify?category=${cat.key}`)
                  }
                  if (onClose) onClose()
                }}
                onMouseEnter={() => handleHover(cat)}
                role="button"
                tabIndex={0}
              >
                <span className="sidebar__item-icon">{cat.icon}</span>
                <span className="sidebar__item-label">{cat.label}</span>
              </li>
            )
          })}
        </ul>
      </aside>
    </>
  )
}
