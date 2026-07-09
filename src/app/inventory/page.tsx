'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import InventoryTable from '@/components/InventoryTable'

export default function InventoryPage() {
  const router = useRouter()
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)

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
            onClick={() => router.push('/classify')}
            type="button"
          >
            ←
          </button>
          <div>
            <h1 className="appbar__title">Full Inventory Ledger</h1>
            <p className="appbar__subtitle">Complete breakdown of all stock</p>
          </div>
        </div>
      </header>
      
      <main className="main-content" style={{ marginLeft: 0, padding: 'var(--space-xl)' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <p>Loading Master Ledger...</p>
          </div>
        ) : (
          <InventoryTable data={data} />
        )}
      </main>
    </>
  )
}
