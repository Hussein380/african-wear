'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Category } from '@/types'
import StaffGuideModal from '@/components/StaffGuideModal'
import { historyPresetRange } from '@/lib/stockRules'

export type ViewState = Category | 'Dashboard' | 'Inventory' | 'History' | 'Receipts'

interface SidebarProps {
  activeCategory: ViewState
  isOpen?: boolean
  onClose?: () => void
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
        <path d="M4 6h16"/>
        <path d="M4 12h16"/>
        <path d="M4 18h16"/>
        <rect x="3" y="3" width="18" height="18" rx="3"/>
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
    key: 'Receipts',
    label: 'Sales & Receipts',
    isSpecial: true,
    route: '/receipts',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>
        <line x1="8" y1="8" x2="16" y2="8"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
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
]

export default function Sidebar({ activeCategory, isOpen, onClose }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isGuideOpen, setIsGuideOpen] = useState(false)

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

    let url: string
    if (cat.key === 'History') {
      // Same range as the History page's default "This week" preset, so the prefetch is reused
      const { start, end } = historyPresetRange('this_week')
      url = `/api/activities?page=1&limit=20&startDate=${start}&endDate=${end}`
    } else if (cat.key === 'Dashboard') {
      url = '/api/dashboard'
    } else {
      return
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
            } else if (cat.key === 'Receipts') {
              isActive = pathname.startsWith('/receipts')
            } else if (cat.key === 'History') {
              isActive = pathname.startsWith('/history')
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
                  } else if (cat.key === 'Receipts') {
                    router.push('/receipts')
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

          <li
            className="sidebar__item"
            style={{
              marginTop: '16px',
              borderTop: '1px solid var(--color-border-light)',
              paddingTop: '12px',
            }}
            onClick={() => {
              setIsGuideOpen(true)
              if (onClose) onClose()
            }}
            role="button"
            tabIndex={0}
          >
            <span className="sidebar__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
            </span>
            <span className="sidebar__item-label">Staff Guide (Tour)</span>
          </li>
        </ul>
      </aside>

      <StaffGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </>
  )
}
