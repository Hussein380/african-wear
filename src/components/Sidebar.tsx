'use client'

import { Category } from '@/types'

export type ViewState = Category | 'Dashboard'

interface SidebarProps {
  activeCategory: ViewState
  onCategoryChange: (category: ViewState) => void
  isOpen?: boolean
  onClose?: () => void
}

const categories: { key: ViewState; label: string; isSpecial?: boolean }[] = [
  { key: 'PrintedC', label: 'PrintedC' },
  { key: 'PrintedP', label: 'PrintedP' },
  { key: 'Dashboard', label: 'Dashboard', isSpecial: true },
]

export default function Sidebar({ activeCategory, onCategoryChange, isOpen, onClose }: SidebarProps) {
  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <ul className="sidebar__list">
          {categories.map(cat => (
            <li
              key={cat.key}
              className={`sidebar__item ${
                activeCategory === cat.key ? 'sidebar__item--active' : ''
              } ${cat.isSpecial ? 'sidebar__item--special' : ''}`}
              onClick={() => {
                onCategoryChange(cat.key)
                if (onClose) onClose()
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onCategoryChange(cat.key)
                  if (onClose) onClose()
                }
              }}
            >
              {cat.label}
            </li>
          ))}
        </ul>
      </aside>
    </>
  )
}
