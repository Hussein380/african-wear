'use client'

import { useState, useEffect, useMemo } from 'react'

interface BreakdownItem {
  id: string
  label: string
  quantity: number
}

interface ColorwayItem {
  _id: string
  fullCode: string
  quantityAvailable: number
  breakdown?: BreakdownItem[]
  category: string
  designCodeName: string
  designCodeId: string
  location?: string
}

interface AuditEntry {
  colorwayId: string
  subVariantId?: string
  label: string
  systemQty: number
  counted?: string
}

interface StocktakeModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function StocktakeModal({ isOpen, onClose }: StocktakeModalProps) {
  const [items, setItems] = useState<ColorwayItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [auditMap, setAuditMap] = useState<Map<string, string>>(new Map())
  const [isApplying, setIsApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setApplied(false)
    setAuditMap(new Map())
    setSearch('')
    setCategoryFilter('All')
    const fetchAll = async () => {
      setIsLoading(true)
      try {
        const res = await fetch('/api/inventory?t=' + Date.now(), { cache: 'no-store' })
        if (res.ok) {
          const data: ColorwayItem[] = await res.json()
          setItems(data)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
    fetchAll()
  }, [isOpen])

  const auditEntries = useMemo<AuditEntry[]>(() => {
    const entries: AuditEntry[] = []
    items.forEach(cw => {
      if (cw.breakdown && cw.breakdown.length > 0) {
        cw.breakdown.forEach(b => {
          entries.push({ colorwayId: cw._id, subVariantId: b.id, label: `${cw.fullCode} — ${b.label}`, systemQty: b.quantity })
        })
      } else {
        entries.push({ colorwayId: cw._id, label: cw.fullCode, systemQty: cw.quantityAvailable })
      }
    })
    return entries
  }, [items])

  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map(i => i.category)))], [items])

  const filteredEntries = useMemo(() => {
    let result = auditEntries
    if (categoryFilter !== 'All') {
      const matchIds = new Set(items.filter(i => i.category === categoryFilter).map(i => i._id))
      result = result.filter(e => matchIds.has(e.colorwayId))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(e => e.label.toLowerCase().includes(q))
    }
    return result
  }, [auditEntries, categoryFilter, search, items])

  const getKey = (e: AuditEntry) => e.subVariantId ? `${e.colorwayId}_${e.subVariantId}` : e.colorwayId

  const setCount = (key: string, val: string) => {
    setAuditMap(prev => { const next = new Map(prev); next.set(key, val); return next })
  }

  const discrepancies = useMemo(() =>
    filteredEntries.filter(e => {
      const counted = auditMap.get(getKey(e))
      if (counted === undefined || counted === '') return false
      return parseInt(counted) !== e.systemQty
    }), [filteredEntries, auditMap])

  const handleApply = async () => {
    if (discrepancies.length === 0) return
    setIsApplying(true)
    try {
      for (const e of discrepancies) {
        const counted = parseInt(auditMap.get(getKey(e)) || '0')
        const delta = counted - e.systemQty
        await fetch('/api/stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ colorwayId: e.colorwayId, change: delta, subVariantId: e.subVariantId, note: 'stocktake_adjustment' }),
        })
      }
      setApplied(true)
    } catch (err) {
      console.error(err)
      alert('Some adjustments failed. Please retry.')
    } finally {
      setIsApplying(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: '5vh', overflowY: 'auto' }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal__header" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <h3 className="modal__title" style={{ margin: 0 }}>Physical Stocktake Audit</h3>
          </div>
          <button className="modal__close-btn" onClick={onClose} type="button">&#x2715;</button>
        </div>

        <div style={{ padding: '8px 20px', background: 'var(--color-bg-hover)', borderBottom: '1px solid var(--color-border)', fontSize: '13px', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
          Enter physical counts from your shelves. Mismatches are highlighted. Apply to sync system stock.
        </div>

        <div style={{ padding: '12px 20px', display: 'flex', gap: '10px', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <input type="text" className="form-group__input" placeholder="Search code..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '140px', maxWidth: '220px', fontSize: '13px' }} />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <button key={cat} type="button" onClick={() => setCategoryFilter(cat)} style={{
                padding: '5px 12px', borderRadius: 'var(--radius-full)',
                border: '1px solid ' + (categoryFilter === cat ? 'var(--color-primary)' : 'var(--color-border)'),
                background: categoryFilter === cat ? 'var(--color-primary)' : 'transparent',
                color: categoryFilter === cat ? '#fff' : 'var(--color-text-primary)',
                cursor: 'pointer', fontSize: '12px', fontWeight: categoryFilter === cat ? 600 : 400,
              }}>{cat}</button>
            ))}
          </div>
        </div>

        <div className="modal__body" style={{ overflowY: 'auto', flex: 1, padding: '0' }}>
          {isLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading stock data...</div>
          ) : applied ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px' }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/>
              </svg>
              <h3 style={{ color: 'var(--color-text-primary)', marginBottom: '8px' }}>Adjustments Applied!</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>System stock is now in sync.</p>
              <button className="btn btn--primary" onClick={onClose} style={{ marginTop: '20px' }}>Done</button>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '14px' }}>No items found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-hover)', borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Code / Variant</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>System</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Physical Count</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map(e => {
                  const key = getKey(e)
                  const counted = auditMap.get(key)
                  const countedNum = counted !== undefined && counted !== '' ? parseInt(counted) : null
                  const diff = countedNum !== null ? countedNum - e.systemQty : null
                  const isMissing = diff !== null && diff < 0
                  const isExtra = diff !== null && diff > 0
                  const isMatch = diff === 0
                  return (
                    <tr key={key} style={{ borderBottom: '1px solid var(--color-border)', background: isMissing ? '#fff1f2' : isExtra ? '#f0fdf4' : 'transparent', transition: 'background 0.2s' }}>
                      <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{e.label}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{e.systemQty}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <input type="number" min="0" value={counted ?? ''} onChange={ev => setCount(key, ev.target.value)} placeholder={String(e.systemQty)}
                          style={{ width: '72px', textAlign: 'center', padding: '6px 8px', borderRadius: '6px',
                            border: '1.5px solid ' + (isMissing ? '#fca5a5' : isExtra ? '#86efac' : isMatch ? '#6ee7b7' : 'var(--color-border)'),
                            background: 'var(--color-bg-card)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {diff === null ? <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>&#x2013;</span>
                          : isMatch ? <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700 }}>&#x2713; Match</span>
                          : isMissing ? <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 700 }}>{diff} bale{Math.abs(diff) !== 1 ? 's' : ''}</span>
                          : <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700 }}>+{diff} bale{diff !== 1 ? 's' : ''}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {!applied && (
          <div className="modal__footer" style={{ flexShrink: 0, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              {discrepancies.length > 0
                ? <span style={{ color: '#dc2626', fontWeight: 600 }}>{discrepancies.length} discrepanc{discrepancies.length === 1 ? 'y' : 'ies'} found</span>
                : <span>Fill in physical counts to detect discrepancies</span>}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn--secondary" onClick={onClose} type="button">Cancel</button>
              <button className="btn btn--primary" onClick={handleApply} disabled={isApplying || discrepancies.length === 0} type="button"
                style={{ opacity: discrepancies.length === 0 ? 0.5 : 1 }}>
                {isApplying ? 'Applying...' : `Apply ${discrepancies.length} Adjustment${discrepancies.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
