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
    const existingCats = data.map(d => d.category)
    return ['All', ...Array.from(new Set(['PrintedC', 'PrintedP', 'PrintTC', ...existingCats]))]
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
      {/* Responsive List / Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Cat.</th>
              <th 
                onClick={() => handleSort('fullCode')}
                style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Item {sortField === 'fullCode' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Details</th>
              <th 
                onClick={() => handleSort('quantityAvailable')}
                style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Stock {sortField === 'quantityAvailable' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedData.map(item => (
              <tr key={item._id}>
                <td>
                  <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', background: '#f1f5f9', flexShrink: 0 }}>
                    {item.photos?.[0]?.url ? (
                      <img src={item.photos[0].url} alt={item.fullCode} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt={item.designCodeName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : null}
                  </div>
                </td>
                
                <td>
                  <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.category}</div>
                  <div className="text-muted">{item.designCodeName}</div>
                </td>
                
                <td>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.fullCode}</span>
                </td>
                
                <td>
                  {item.breakdown && item.breakdown.length > 0 ? (
                    <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {item.breakdown.map(b => (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', width: '100px' }}>
                          <span style={{ color: '#64748b' }}>{b.label}: </span>
                          <strong style={{ color: 'var(--color-text-primary)' }}>{b.quantity}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                
                <td>
                  <span style={{ 
                    fontWeight: 600, 
                    color: item.quantityAvailable <= 5 ? '#991b1b' : 'var(--color-text-primary)',
                    background: item.quantityAvailable <= 5 ? '#fee2e2' : 'transparent',
                    padding: item.quantityAvailable <= 5 ? '4px 8px' : '0',
                    borderRadius: '6px',
                    display: 'inline-block'
                  }}>
                    {item.quantityAvailable}
                  </span>
                </td>
                
                <td>
                  <button 
                    onClick={() => router.push(`/classify/${item.designCodeId}`)}
                    className="btn btn--secondary btn--sm"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Edit Item
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredAndSortedData.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            No items match your search.
          </div>
        )}
      </div>
    </div>
  )
}
