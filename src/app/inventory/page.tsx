'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import InventoryTable from '@/components/InventoryTable'
import Sidebar from '@/components/Sidebar'
import { ExpandingSearchDock } from '@/components/ui/expanding-search-dock-shadcnui'
import SaleBasketFloating from '@/components/SaleBasketFloating'

export default function InventoryPage() {
  const router = useRouter()
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [globalSearchTerm, setGlobalSearchTerm] = useState('')

  useEffect(() => {
    async function fetchInventory() {
      try {
        const res = await fetch('/api/inventory?t=' + new Date().getTime(), {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
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
            className="mobile-menu-btn"
            onClick={() => setIsSidebarOpen(prev => !prev)}
            aria-label="Toggle menu"
            type="button"
          >
            ☰
          </button>
          <button
            className="appbar__back-btn"
            onClick={() => router.push('/classify')}
            type="button"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            <span>Back</span>
          </button>
          <div>
            <h1 className="appbar__title">Master Stock Ledger</h1>
            <p className="appbar__subtitle">Real-time inventory breakdown across all fabric lines</p>
          </div>
        </div>
        <div className="appbar__right">
          <ExpandingSearchDock onSearch={(val) => setGlobalSearchTerm(val)} placeholder="Search master stock..." />
        </div>
      </header>

      <Sidebar
        activeCategory="Inventory"
        onCategoryChange={(cat) => router.push(cat === 'Inventory' ? '/inventory' : `/classify?category=${cat}`)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="main-content" style={{ padding: 'var(--space-lg)' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px' }}>
            <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
            <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '14px' }}>Loading Master Stock Ledger...</p>
          </div>
        ) : (
          <Suspense fallback={<div style={{ padding: '20px' }}>Loading...</div>}>
            <InventoryTable data={data} externalSearchTerm={globalSearchTerm} />
          </Suspense>
        )}
      </main>
      <SaleBasketFloating />
    </>
  )
}
