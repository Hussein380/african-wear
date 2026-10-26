'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, X, ArrowRight } from 'lucide-react'
import { SearchSuggestion } from '@/app/api/search/route'

interface ExpandingSearchDockProps {
  onSearch?: (query: string) => void
  placeholder?: string
}

export function ExpandingSearchDock({
  onSearch,
  placeholder = 'Search fabrics, codes, dates...',
}: ExpandingSearchDockProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  const handleExpand = () => {
    setIsExpanded(true)
    setTimeout(() => inputRef.current?.focus(), 80)
  }

  const handleCollapse = () => {
    setIsExpanded(false)
    setQuery('')
    setSuggestions([])
    if (onSearch) onSearch('')
  }

  // Live search fetch
  const performSearch = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.suggestions || [])
      } else {
        setSuggestions([])
      }
    } catch {
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleChange = (val: string) => {
    setQuery(val)
    if (onSearch) onSearch(val)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    debounceRef.current = setTimeout(() => {
      performSearch(val)
    }, 180)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (suggestions.length > 0) {
      handleSelect(suggestions[0])
    } else if (onSearch && query) {
      onSearch(query)
    }
  }

  const handleSelect = (item: SearchSuggestion) => {
    handleCollapse()
    router.push(item.url)
  }

  // Keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        handleCollapse()
      }
      if (e.key === '/' && !isExpanded && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        handleExpand()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded])

  return (
    <div className="search-dock-container">
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.button
            key="icon"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={handleExpand}
            className="search-dock-btn"
            title="Search fabrics & history (/)"
            type="button"
            aria-label="Expand search"
          >
            <Search className="h-5 w-5" />
          </motion.button>
        ) : (
          <motion.form
            key="input"
            initial={{ width: 42, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 42, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
            }}
            onSubmit={handleSubmit}
            className="search-dock-form"
          >
            <motion.div
              initial={{ backdropFilter: 'blur(0px)' }}
              animate={{ backdropFilter: 'blur(16px)' }}
              className="search-dock-wrapper"
            >
              <div className="search-dock-icon">
                <Search className="h-4 w-4" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleChange(e.target.value)}
                placeholder={placeholder}
                autoFocus
                className="search-dock-input"
                autoComplete="off"
                spellCheck="false"
              />
              <motion.button
                type="button"
                onClick={handleCollapse}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="search-dock-close"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </motion.div>

            {/* Smart Suggestions Floating Dropdown */}
            {query.trim().length > 0 && (
              <div className="search-dock-dropdown">
                {isLoading ? (
                  <div className="search-dock-dropdown__empty">Searching inventory & dates...</div>
                ) : suggestions.length > 0 ? (
                  <div className="search-dock-dropdown__list">
                    {suggestions.map((item) => (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="search-dock-item"
                        onClick={() => handleSelect(item)}
                      >
                        <div className="search-dock-item__thumb">
                          {item.thumbnailUrl ? (
                            <img src={item.thumbnailUrl} alt={item.title} loading="lazy" />
                          ) : (
                            <span>{item.type === 'colorway' ? '👗' : item.type === 'designCode' ? '📁' : '📋'}</span>
                          )}
                        </div>
                        <div className="search-dock-item__info">
                          <div className="search-dock-item__title">{item.title}</div>
                          <div className="search-dock-item__sub">{item.subtitle}</div>
                        </div>
                        {item.badgeText && (
                          <span className={`search-dock-item__badge search-dock-item__badge--${item.badgeTone || 'purple'}`}>
                            {item.badgeText}
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="search-dock-dropdown__empty">
                    No results for &quot;{query}&quot;
                  </div>
                )}
              </div>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
