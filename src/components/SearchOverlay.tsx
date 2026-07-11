'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
  onSearch: (term: string) => void
}

export default function SearchOverlay({ isOpen, onClose, onSearch }: SearchOverlayProps) {
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      // Load history
      const saved = localStorage.getItem('search_history')
      if (saved) {
        setHistory(JSON.parse(saved))
      }
      // Focus input
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const saveHistory = (term: string) => {
    if (!term.trim()) return
    const current = [...history]
    const filtered = current.filter(t => t.toLowerCase() !== term.toLowerCase())
    const next = [term, ...filtered].slice(0, 10) // Keep top 10
    setHistory(next)
    localStorage.setItem('search_history', JSON.stringify(next))
  }

  const handleSearch = (term: string) => {
    if (!term.trim()) return
    saveHistory(term)
    onClose()
    onSearch(term)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(query)
    }
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem('search_history')
  }

  const removeHistoryItem = (e: React.MouseEvent, term: string) => {
    e.stopPropagation()
    const next = history.filter(t => t !== term)
    setHistory(next)
    localStorage.setItem('search_history', JSON.stringify(next))
  }

  if (!isOpen) return null

  return (
    <div className="search-overlay">
      <div className="search-overlay__header">
        <button className="search-overlay__back" onClick={onClose}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </button>
        <div 
          className="search-overlay__input-container"
          style={{ display: 'flex', width: '100%' }}
        >
          <svg className="search-overlay__icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            ref={inputRef}
            type="search"
            className="search-overlay__input"
            placeholder="Search"
            value={query}
            onChange={e => {
              const val = e.target.value
              setQuery(val)
              onSearch(val)
            }}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button type="button" className="search-overlay__clear" onClick={() => {
              setQuery('')
              onSearch('')
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      <div className="search-overlay__content">
        <div className="search-history-header">
          <span className="search-history-title">Search History</span>
          {history.length > 0 && (
            <button className="search-history-clean" onClick={clearHistory}>Clean All</button>
          )}
        </div>

        <div className="search-history-list">
          {history.map((term, i) => (
            <div key={i} className="search-history-item" onClick={() => handleSearch(term)}>
              <span className="search-history-term">{term}</span>
              <div className="search-history-actions">
                <svg className="search-history-search-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <button className="search-history-remove" onClick={(e) => removeHistoryItem(e, term)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
