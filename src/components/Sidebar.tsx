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
  { key: 'Dashboard', label: 'Dashboard', isSpecial: true, route: '/classify' },
  { key: 'History', label: 'Transaction History', isSpecial: true, route: '/history' },
]

export default function Sidebar({ activeCategory, onCategoryChange, isOpen, onClose }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

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
                  } else if (cat.route && cat.key === 'Dashboard' && !pathname.startsWith('/classify')) {
                    router.push(cat.route)
                  } else {
                    onCategoryChange(cat.key)
                  }
                  if (onClose) onClose()
                }}
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
