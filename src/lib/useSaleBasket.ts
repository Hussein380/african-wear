'use client'

import { useState, useEffect } from 'react'

export interface BasketItem {
  colorwayId: string
  designCodeId?: string
  fullCode: string
  subVariantId?: string
  subVariantLabel?: string
  quantity: number
  unitPrice: number
  costPrice?: number
  available: number
}

const STORAGE_KEY = 'mandera_sale_basket'

export function getStoredBasket(): BasketItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveStoredBasket(items: BasketItem[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    window.dispatchEvent(new Event('basket_updated'))
  } catch {
    // ignore
  }
}

export function useSaleBasket() {
  const [items, setItems] = useState<BasketItem[]>([])

  useEffect(() => {
    setItems(getStoredBasket())

    const handleUpdate = () => {
      setItems(getStoredBasket())
    }

    window.addEventListener('basket_updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('basket_updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const addItem = (item: Omit<BasketItem, 'quantity'> & { quantity?: number }) => {
    const current = getStoredBasket()
    const matchIndex = current.findIndex(
      i => i.colorwayId === item.colorwayId && i.subVariantId === item.subVariantId
    )

    const addQty = item.quantity || 1

    if (matchIndex > -1) {
      const updated = [...current]
      const newQty = updated[matchIndex].quantity + addQty
      updated[matchIndex].quantity = Math.min(newQty, item.available)
      saveStoredBasket(updated)
    } else {
      const newItem: BasketItem = {
        ...item,
        quantity: Math.min(addQty, item.available),
      }
      saveStoredBasket([...current, newItem])
    }
  }

  const updateItem = (index: number, quantity: number, unitPrice?: number) => {
    const current = getStoredBasket()
    if (!current[index]) return
    const updated = [...current]
    updated[index].quantity = Math.max(1, Math.min(quantity, updated[index].available))
    if (unitPrice !== undefined) {
      updated[index].unitPrice = Math.max(0, unitPrice)
    }
    saveStoredBasket(updated)
  }

  const removeItem = (index: number) => {
    const current = getStoredBasket()
    const updated = [...current]
    updated.splice(index, 1)
    saveStoredBasket(updated)
  }

  const clearBasket = () => {
    saveStoredBasket([])
  }

  const totalPieces = items.reduce((acc, i) => acc + i.quantity, 0)
  const totalAmount = items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)

  return {
    items,
    addItem,
    updateItem,
    removeItem,
    clearBasket,
    totalPieces,
    totalAmount,
  }
}
