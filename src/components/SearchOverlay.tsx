'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { SearchSuggestion } from '@/app/api/search/route'

interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
  onSearch?: (term: string) => void
}

type FilterTab = 'all' | 'fabrics' | 'designs' | 'transactions'

export default function SearchOverlay({ isOpen, onClose, onSearch }: SearchOverlayProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  // Reset & focus
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSuggestions([])
      setActiveTab('all')
      setSelectedIndex(-1)
      try {
        const saved = localStorage.getItem('search_history')
        if (saved) setHistory(JSON.parse(saved))
      } catch {
        setHistory([])
      }
      setTimeout(() => inputRef.current?.focus(), 70)
    }
  }, [isOpen])

  // Save term to search history
  const saveHistory = (term: string) => {
    if (!term.trim()) return
    const current = [...history]
    const filtered = current.filter(t => t.toLowerCase() !== term.toLowerCase())
    const next = [term.trim(), ...filtered].slice(0, 8)
    setHistory(next)
    try {
      localStorage.setItem('search_history', JSON.stringify(next))
    } catch {
      // ignore
    }
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
        setSelectedIndex(-1)
      } else {
        setSuggestions([])
      }
    } catch (err) {
      console.error('Search error:', err)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleInputChange = (val: string) => {
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

  const handleSelectSuggestion = (item: SearchSuggestion) => {
    saveHistory(item.title)
    onClose()
    router.push(item.url)
  }

  const handleQuickPillClick = (term: string) => {
    setQuery(term)
    performSearch(term)
  }

  const clearHistory = () => {
    setHistory([])
    try {
      localStorage.removeItem('search_history')
    } catch {
      // ignore
    }
  }

  const removeHistoryItem = (e: React.MouseEvent, term: string) => {
    e.stopPropagation()
    const next = history.filter(t => t !== term)
    setHistory(next)
    try {
      localStorage.setItem('search_history', JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  // Filter results by selected tab
  const filteredSuggestions = suggestions.filter(item => {
    if (activeTab === 'all') return true
    if (activeTab === 'fabrics') return item.type === 'colorway'
    if (activeTab === 'designs') return item.type === 'designCode'
    if (activeTab === 'transactions') return item.type === 'activity'
    return true
  })

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && filteredSuggestions[selectedIndex]) {
        handleSelectSuggestion(filteredSuggestions[selectedIndex])
      } else if (filteredSuggestions.length > 0) {
        handleSelectSuggestion(filteredSuggestions[0])
      } else if (query.trim()) {
        saveHistory(query.trim())
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="search-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Universal Shop Search"
    >
      <div
        className="search-modal-card"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Input Bar */}
        <div className="search-modal__bar">
          <div className="search-modal__icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>

          <input
            ref={inputRef}
            type="search"
            className="search-modal__input"
            placeholder="Search fabrics, codes, transactions, dates, categories..."
            value={query}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck="false"
          />

          {isLoading && (
            <div className="search-modal__spinner" title="Searching store database..." />
          )}

          {query && !isLoading && (
            <button
              type="button"
              className="search-modal__clear-btn"
              onClick={() => {
                setQuery('')
                setSuggestions([])
                if (onSearch) onSearch('')
                inputRef.current?.focus()
              }}
              aria-label="Clear query"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}

          <button
            type="button"
            className="search-modal__close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ESC
          </button>
        </div>

        {/* Filter Pills (Tabs) */}
        {query.trim().length > 0 && (
          <div className="search-modal__tabs">
            <button
              type="button"
              className={`search-modal__tab ${activeTab === 'all' ? 'search-modal__tab--active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All Results ({suggestions.length})
            </button>
            <button
              type="button"
              className={`search-modal__tab ${activeTab === 'fabrics' ? 'search-modal__tab--active' : ''}`}
              onClick={() => setActiveTab('fabrics')}
            >
              👗 Fabric Colorways ({suggestions.filter(s => s.type === 'colorway').length})
            </button>
            <button
              type="button"
              className={`search-modal__tab ${activeTab === 'designs' ? 'search-modal__tab--active' : ''}`}
              onClick={() => setActiveTab('designs')}
            >
              📁 Collections ({suggestions.filter(s => s.type === 'designCode').length})
            </button>
            <button
              type="button"
              className={`search-modal__tab ${activeTab === 'transactions' ? 'search-modal__tab--active' : ''}`}
              onClick={() => setActiveTab('transactions')}
            >
              📈 History & Dates ({suggestions.filter(s => s.type === 'activity').length})
            </button>
          </div>
        )}

        {/* Results List */}
        <div className="search-modal__body">
          {query.trim().length > 0 ? (
            <div className="search-modal__results">
              {filteredSuggestions.length > 0 ? (
                <div className="search-modal__list" role="listbox">
                  {filteredSuggestions.map((item, idx) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      role="option"
                      aria-selected={idx === selectedIndex}
                      className={`search-result-row ${idx === selectedIndex ? 'search-result-row--selected' : ''}`}
                      onClick={() => handleSelectSuggestion(item)}
                    >
                      {/* Left Thumbnail or Icon */}
                      <div className="search-result-row__thumb">
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt={item.title} loading="lazy" />
                        ) : (
                          <div className={`search-result-row__avatar avatar--${item.type}`}>
                            {item.type === 'colorway' ? '👗' : item.type === 'designCode' ? '📁' : '📋'}
                          </div>
                        )}
                      </div>

                      {/* Main Details */}
                      <div className="search-result-row__details">
                        <div className="search-result-row__title-wrap">
                          <strong className="search-result-row__title">{item.title}</strong>
                          {item.badgeText && (
                            <span className={`search-tag search-tag--${item.badgeTone || 'purple'}`}>
                              {item.badgeText}
                            </span>
                          )}
                        </div>
                        <div className="search-result-row__subtitle">
                          {item.subtitle}
                        </div>
                      </div>

                      {/* Right Direct Action */}
                      <div className="search-result-row__action">
                        <span className="search-result-row__action-text">
                          {item.type === 'activity' ? 'View Log' : 'View Stock'}
                        </span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !isLoading ? (
                <div className="search-modal__empty">
                  <div className="search-modal__empty-icon">🔍</div>
                  <h4>No results found for &quot;{query}&quot;</h4>
                  <p>You can search by:
                    <br />• <strong>Fabric full code</strong> (e.g. <code>ANW2405</code>, <code>ANK260</code>)
                    <br />• <strong>Category</strong> (e.g. <code>PrintedC</code>, <code>PrintedP</code>, <code>PrintTC</code>)
                    <br />• <strong>Transaction actions or dates</strong> (e.g. <code>Sold</code>, <code>Arrived</code>, <code>Oct 26</code>, <code>Return</code>)
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            /* Idle Screen: Quick Suggestions & Search History */
            <div className="search-modal__idle">
              {/* Quick Categories */}
              <div className="search-modal__section">
                <div className="search-modal__section-title">Jump to Fabric Section</div>
                <div className="search-modal__pills">
                  <button type="button" className="search-pill search-pill--cat" onClick={() => handleQuickPillClick('PrintedC')}>
                    <span>👗 PrintedC</span>
                    <small>High Volume</small>
                  </button>
                  <button type="button" className="search-pill search-pill--cat" onClick={() => handleQuickPillClick('PrintedP')}>
                    <span>✨ PrintedP</span>
                    <small>Premium</small>
                  </button>
                  <button type="button" className="search-pill search-pill--cat" onClick={() => handleQuickPillClick('PrintTC')}>
                    <span>🧣 PrintTC</span>
                    <small>Textured Cotton</small>
                  </button>
                  <button type="button" className="search-pill" onClick={() => handleQuickPillClick('Sold')}>
                    <span>🛍️ Recent Sales</span>
                  </button>
                  <button type="button" className="search-pill" onClick={() => handleQuickPillClick('Arrived')}>
                    <span>📦 Deliveries</span>
                  </button>
                </div>
              </div>

              {/* History */}
              <div className="search-modal__section" style={{ marginTop: '20px' }}>
                <div className="search-modal__section-header">
                  <div className="search-modal__section-title">Recent Searches</div>
                  {history.length > 0 && (
                    <button className="search-modal__clean-btn" onClick={clearHistory} type="button">
                      Clear History
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <p className="search-modal__hint-text">
                    No recent searches. Type any code, category, or date above.
                  </p>
                ) : (
                  <div className="search-history-chips">
                    {history.map((term, i) => (
                      <div
                        key={i}
                        className="search-history-chip"
                        onClick={() => handleQuickPillClick(term)}
                      >
                        <span className="search-history-chip__icon">🕒</span>
                        <span className="search-history-chip__text">{term}</span>
                        <button
                          type="button"
                          className="search-history-chip__delete"
                          onClick={(e) => removeHistoryItem(e, term)}
                          aria-label={`Remove ${term}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="search-modal__footer">
          <div className="search-modal__footer-left">
            <span className="search-key-hint"><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span>
            <span className="search-key-hint"><kbd>↵</kbd> Select</span>
            <span className="search-key-hint"><kbd>esc</kbd> Close</span>
          </div>
          <div className="search-modal__footer-right">
            Mandera African Wear Universal Search
          </div>
        </div>
      </div>
    </div>
  )
}
