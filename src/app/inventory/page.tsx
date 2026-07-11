'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import InventoryTable from '@/components/InventoryTable'
import SearchOverlay from '@/components/SearchOverlay'

export default function InventoryPage() {
  const router = useRouter()
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [globalSearchTerm, setGlobalSearchTerm] = useState('')

  useEffect(() => {
    async function fetchInventory() {
      try {
        const res = await fetch('/api/inventory?t=' + new Date().getTime(), {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        })
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (error) {
        console.error('Failed to fetch inventory:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchInventory()
  }, [])

  return (
    <>
      <header className="appbar">
        <div className="appbar__left">
          <button
            className="appbar__back-btn"
            onClick={() => router.back()}
            type="button"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            Back
          </button>
          <div>
            <h1 className="appbar__title">Current Inventory</h1>
            <p className="appbar__subtitle">Complete breakdown of all stock</p>
          </div>
        </div>
        <div className="appbar__right">
          <button className="appbar__action-btn" onClick={() => setIsSearchOpen(true)} type="button" aria-label="Search">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
        </div>
      </header>
      
      <main className="main-content" style={{ marginLeft: 0, padding: 'var(--space-xl)' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <p>Loading Master Ledger...</p>
          </div>
        ) : (
          <Suspense fallback={<div>Loading Search...</div>}>
            <InventoryTable data={data} externalSearchTerm={globalSearchTerm} />
          </Suspense>
        )}
      </main>

      <SearchOverlay 
        isOpen={isSearchOpen} 
        onClose={() => { setIsSearchOpen(false); setGlobalSearchTerm('') }} 
        onSearch={(term) => setGlobalSearchTerm(term)}
      />
    </>
  )
}
