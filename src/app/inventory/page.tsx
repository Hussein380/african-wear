'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import InventoryTable from '@/components/InventoryTable'
import Sidebar from '@/components/Sidebar'
import { ExpandingSearchDock } from '@/components/ui/expanding-search-dock-shadcnui'
import SaleBasketFloating from '@/components/SaleBasketFloating'
import StocktakeModal from '@/components/StocktakeModal'
import { generateStockSnapshotPdf, buildWhatsAppStockSummary } from '@/lib/stockReportPdf'

export default function InventoryPage() {
  const router = useRouter()
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [globalSearchTerm, setGlobalSearchTerm] = useState('')
  const [showStocktake, setShowStocktake] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

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

  const handleExportPdf = async () => {
    if (data.length === 0) return
    setIsExporting(true)
    try {
      await generateStockSnapshotPdf({ items: data })
    } finally {
      setIsExporting(false)
    }
  }

  const handleShareWhatsApp = () => {
    if (data.length === 0) return
    const msg = buildWhatsAppStockSummary({ items: data })
    const encoded = encodeURIComponent(msg)
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
  }

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
        <div className="appbar__right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ExpandingSearchDock onSearch={(val) => setGlobalSearchTerm(val)} placeholder="Search master stock..." />

          {/* Stocktake Audit */}
          <button
            className="appbar__action-btn"
            onClick={() => setShowStocktake(true)}
            type="button"
            title="Physical Stocktake Audit"
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <span className="desktop-only">Stocktake</span>
          </button>

          {/* Export PDF */}
          <button
            className="appbar__action-btn"
            onClick={handleExportPdf}
            type="button"
            title="Export Stock Snapshot PDF"
            disabled={isExporting}
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span className="desktop-only">{isExporting ? 'Exporting...' : 'Export PDF'}</span>
          </button>

          {/* Share on WhatsApp */}
          <button
            className="appbar__action-btn"
            onClick={handleShareWhatsApp}
            type="button"
            title="Share Stock Summary on WhatsApp"
            style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#25D366' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span className="desktop-only">WhatsApp</span>
          </button>
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

      {/* Stocktake Audit Modal */}
      <StocktakeModal isOpen={showStocktake} onClose={() => setShowStocktake(false)} />
    </>
  )
}
