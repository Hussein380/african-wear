'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

interface BreakdownItem {
  id: string
  label: string
  quantity: number
}

interface InventoryItem {
  _id: string
  fullCode: string
  quantityAvailable: number
  breakdown?: BreakdownItem[]
  photos?: { url: string }[]
  category: string
  designCodeName: string
  designCodeId: string
  thumbnailUrl?: string
}

interface Props {
  data: InventoryItem[]
}

export default function InventoryTable({ data }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [sortField, setSortField] = useState<'quantityAvailable' | 'fullCode'>('quantityAvailable')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(data.map(d => d.category)))]
  }, [data])

  const filteredAndSortedData = useMemo(() => {
    let result = data

    // Category Filter
    if (categoryFilter !== 'All') {
      result = result.filter(item => item.category === categoryFilter)
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(item => 
        item.fullCode.toLowerCase().includes(q) ||
        item.designCodeName.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      )
    }

    // Sort
    result = [...result].sort((a, b) => {
      let valA = a[sortField]
      let valB = b[sortField]
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA
      }
      return 0
    })

    return result
  }, [data, search, categoryFilter, sortField, sortOrder])

  const handleSort = (field: 'quantityAvailable' | 'fullCode') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc') // default descending when switching
    }
  }

  return (
    <div style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)' }}>
      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-md)', overflowX: 'auto', paddingBottom: '4px' }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              background: categoryFilter === cat ? 'var(--color-primary)' : 'var(--color-bg)',
              color: categoryFilter === cat ? 'white' : 'var(--color-text)',
              cursor: 'pointer',
              fontWeight: categoryFilter === cat ? 600 : 400,
              whiteSpace: 'nowrap'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <input 
          type="text" 
          placeholder="Search by Code, Category, or Design..." 
          className="form-group__input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: '400px' }}
        />
      </div>

      {/* Responsive List / Table */}
      <div className="inventory-list">
        {/* Desktop Header */}
        <div className="inventory-header">
          <div className="inventory-col inventory-col--image">Item</div>
          <div className="inventory-col inventory-col--category">Category</div>
          <div 
            className="inventory-col inventory-col--code" 
            onClick={() => handleSort('fullCode')}
            style={{ cursor: 'pointer' }}
          >
            Colorway {sortField === 'fullCode' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
          <div className="inventory-col inventory-col--breakdown">Breakdown</div>
          <div 
            className="inventory-col inventory-col--stock"
            onClick={() => handleSort('quantityAvailable')}
            style={{ cursor: 'pointer' }}
          >
            Stock {sortField === 'quantityAvailable' && (sortOrder === 'asc' ? '↑' : '↓')}
          </div>
          <div className="inventory-col inventory-col--action">Action</div>
        </div>

        {/* Rows */}
        <div className="inventory-body">
          {filteredAndSortedData.map(item => (
            <div key={item._id} className="inventory-row">
              <div className="inventory-col inventory-col--image">
                <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', background: 'var(--color-bg)', flexShrink: 0 }}>
                  {item.photos?.[0]?.url ? (
                    <img src={item.photos[0].url} alt={item.fullCode} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt={item.designCodeName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </div>
              </div>
              
              <div className="inventory-col inventory-col--category">
                <span className="inventory-mobile-label">Category:</span>
                <div>
                  <div style={{ fontWeight: 500 }}>{item.category}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{item.designCodeName}</div>
                </div>
              </div>
              
              <div className="inventory-col inventory-col--code">
                <span className="inventory-mobile-label">Colorway:</span>
                <span style={{ fontWeight: 600 }}>{item.fullCode}</span>
              </div>
              
              <div className="inventory-col inventory-col--breakdown">
                <span className="inventory-mobile-label">Breakdown:</span>
                {item.breakdown && item.breakdown.length > 0 ? (
                  <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {item.breakdown.map(b => (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '120px' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{b.label}: </span>
                        <strong>{b.quantity}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>-</span>
                )}
              </div>
              
              <div className="inventory-col inventory-col--stock">
                <span className="inventory-mobile-label">Total Stock:</span>
                <span style={{ 
                  fontWeight: 600, 
                  color: item.quantityAvailable <= 5 ? 'var(--color-danger)' : 'inherit',
                  background: item.quantityAvailable <= 5 ? 'var(--color-danger-bg)' : 'var(--color-bg)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  display: 'inline-block'
                }}>
                  {item.quantityAvailable}
                </span>
              </div>
              
              <div className="inventory-col inventory-col--action">
                <button 
                  onClick={() => router.push(`/classify/${item.designCodeId}`)}
                  className="btn btn--secondary btn--sm"
                  style={{ width: '100%' }}
                >
                  Edit Item
                </button>
              </div>
            </div>
          ))}

          {filteredAndSortedData.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              No items match your search.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
