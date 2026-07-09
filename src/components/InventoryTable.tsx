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

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>Item</th>
              <th style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>Category</th>
              <th 
                style={{ padding: '12px 16px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
                onClick={() => handleSort('fullCode')}
              >
                Colorway {sortField === 'fullCode' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>Breakdown</th>
              <th 
                style={{ padding: '12px 16px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
                onClick={() => handleSort('quantityAvailable')}
              >
                Total Stock {sortField === 'quantityAvailable' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedData.map(item => (
              <tr key={item._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', background: 'var(--color-bg)' }}>
                    {item.photos?.[0]?.url ? (
                      <img src={item.photos[0].url} alt={item.fullCode} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt={item.designCodeName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : null}
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 500 }}>{item.category}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{item.designCodeName}</div>
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.fullCode}</td>
                <td style={{ padding: '12px 16px' }}>
                  {item.breakdown && item.breakdown.length > 0 ? (
                    <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {item.breakdown.map(b => (
                        <div key={b.id}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>{b.label}: </span>
                          <strong>{b.quantity}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>-</span>
                  )}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ 
                    fontWeight: 600, 
                    color: item.quantityAvailable <= 5 ? 'var(--color-danger)' : 'inherit',
                    background: item.quantityAvailable <= 5 ? 'var(--color-danger-bg)' : 'var(--color-bg)',
                    padding: '4px 8px',
                    borderRadius: '4px'
                  }}>
                    {item.quantityAvailable}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button 
                    onClick={() => router.push(`/classify/${item.designCodeId}`)}
                    className="btn btn--secondary btn--sm"
                    style={{ padding: '6px 12px' }}
                  >
                    View / Edit
                  </button>
                </td>
              </tr>
            ))}
            {filteredAndSortedData.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  No items match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
