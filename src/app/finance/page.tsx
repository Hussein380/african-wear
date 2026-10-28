'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Colorway, Invoice, Expense, ExpenseCategory } from '@/types'
import { ExpandingSearchDock } from '@/components/ui/expanding-search-dock-shadcnui'
import Sidebar from '@/components/Sidebar'
import {
  generateInvoicePdf,
  openWhatsAppInvoice,
  isValidKenyanPhone,
  formatKenyanPhoneDisplay,
  getWhatsAppInvoiceUrl,
  normalizeKenyanPhone,
} from '@/lib/pdfInvoice'

const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string; shortLabel: string }[] = [
  { key: 'rent', label: 'Shop Rent', shortLabel: 'Rent' },
  { key: 'utilities', label: 'Electricity & Water (KPLC)', shortLabel: 'Utilities' },
  { key: 'transport', label: 'Cargo & Transport', shortLabel: 'Transport' },
  { key: 'wages', label: 'Staff Wages & Allowances', shortLabel: 'Wages' },
  { key: 'packaging', label: 'Packaging & Bags', shortLabel: 'Packaging' },
  { key: 'food', label: 'Meals & Refreshments', shortLabel: 'Meals' },
  { key: 'maintenance', label: 'Repairs & Maintenance', shortLabel: 'Repairs' },
  { key: 'other', label: 'Other Operating Expenses', shortLabel: 'Other' },
]

interface FinanceSummary {
  period: {
    range: string
    startDate: string
    endDate: string
  }
  summary: {
    totalRevenue: number
    totalCost: number
    estimatedProfit: number
    totalExpenses?: number
    netProfit?: number
    cashExpenses?: number
    mpesaExpenses?: number
    expensesByCategory?: Record<string, number>
    totalPiecesSold: number
    pricedPiecesSold: number
    unpricedPiecesSold: number
    invoicesCount: number
  }
  drawerBreakdown?: {
    cash: number
    grossCash?: number
    cashExpenses?: number
    mpesa: number
    grossMpesa?: number
    mpesaExpenses?: number
    credit: number
    other: number
  }
  coverage: {
    totalColorways: number
    pricedColorways: number
    coveragePercent: number
  }
  recentSales: {
    id: string
    invoiceId?: string
    fullCode: string
    subVariantLabel?: string
    quantity: number
    soldPrice?: number
    costPrice?: number
    totalRevenue?: number
    itemProfit?: number
    isLoss: boolean
    timestamp: string
  }[]
}

interface InvoiceItemDraft {
  colorwayId: string
  fullCode: string
  quantity: number
  unitPrice: number
  costPrice?: number
  available: number
  subVariantLabel?: string
  skipDeduction?: boolean
  recentSaleActivityId?: string
}

function formatFriendlyTime(isoString: string): { label: string; isRecent: boolean } {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.max(0, Math.floor(diffMs / 1000))
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)

  if (diffSec < 90) return { label: 'Just now', isRecent: true }
  if (diffMin < 60) return { label: `${diffMin}m ago`, isRecent: true }
  if (diffHr < 24 && date.getDate() === now.getDate()) {
    return {
      label: `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      isRecent: false,
    }
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth()) {
    return {
      label: `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      isRecent: false,
    }
  }
  return {
    label: `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    isRecent: false,
  }
}

export default function FinancePage() {
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'invoice' | 'credit' | 'analytics' | 'expenses' | 'prices'>('invoice')

  // Analytics state
  const [financeData, setFinanceData] = useState<FinanceSummary | null>(null)
  const [selectedRange, setSelectedRange] = useState<string>('month')
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false)
  const [expenseTitle, setExpenseTitle] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('rent')
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<'cash' | 'mpesa' | 'other'>('cash')
  const [expenseNotes, setExpenseNotes] = useState('')
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0])
  const [isSavingExpense, setIsSavingExpense] = useState(false)
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null)
  const [expenseSuccessMsg, setExpenseSuccessMsg] = useState('')

  // Invoices state
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [isUpdatingPayment, setIsUpdatingPayment] = useState<string | null>(null)

  // New Invoice form state
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'credit' | 'other'>('cash')
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemDraft[]>([])
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false)
  const [invoiceSuccessMsg, setInvoiceSuccessMsg] = useState('')

  // Inventory / Price Manager state
  const [allColorways, setAllColorways] = useState<Colorway[]>([])
  const [searchFilter, setSearchFilter] = useState('')
  const [isLoadingInventory, setIsLoadingInventory] = useState(false)
  const [editingPriceCw, setEditingPriceCw] = useState<Colorway | null>(null)
  const [editBuyingPrice, setEditBuyingPrice] = useState('')
  const [editSellingPrice, setEditSellingPrice] = useState('')
  const [isSavingPrice, setIsSavingPrice] = useState(false)
  const [voidingSaleId, setVoidingSaleId] = useState<string | null>(null)
  const [isVoidingInvoice, setIsVoidingInvoice] = useState(false)
  const [rightPanelTab, setRightPanelTab] = useState<'stock' | 'recentSales'>('recentSales')
  const [modalPhone, setModalPhone] = useState('')
  const [lastWaUrl, setLastWaUrl] = useState<string | null>(null)

  // Load Finance Analytics
  const fetchFinanceAnalytics = useCallback(async (range: string) => {
    setIsLoadingAnalytics(true)
    try {
      const res = await fetch(`/api/finance?range=${range}`)
      if (res.ok) {
        const data = await res.json()
        setFinanceData(data)
      }
    } catch (err) {
      console.error('Failed to load finance analytics:', err)
    } finally {
      setIsLoadingAnalytics(false)
    }
  }, [])

  // Load Invoices
  const fetchInvoices = useCallback(async () => {
    setIsLoadingInvoices(true)
    try {
      const res = await fetch('/api/invoices')
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.invoices || [])
      }
    } catch (err) {
      console.error('Failed to load invoices:', err)
    } finally {
      setIsLoadingInvoices(false)
    }
  }, [])

  // Load all colorways for price management & invoice selection
  const fetchAllColorways = useCallback(async () => {
    setIsLoadingInventory(true)
    try {
      // Fetch design codes, then colorways
      const dcRes = await fetch('/api/design-codes')
      if (!dcRes.ok) return
      const designCodes = await dcRes.json()

      const colorwayPromises = designCodes.map(async (dc: { _id: string }) => {
        const cwRes = await fetch(`/api/colorways?designCodeId=${dc._id}`)
        if (cwRes.ok) return await cwRes.json()
        return []
      })

      const nested = await Promise.all(colorwayPromises)
      const flat = nested.flat()
      setAllColorways(flat)
    } catch (err) {
      console.error('Failed to load colorways for price management:', err)
    } finally {
      setIsLoadingInventory(false)
    }
  }, [])

  // Load Expenses
  const fetchExpenses = useCallback(async (range = 'month') => {
    setIsLoadingExpenses(true)
    try {
      const res = await fetch(`/api/expenses?range=${range}`)
      if (res.ok) {
        const data = await res.json()
        setExpenses(data.expenses || [])
      }
    } catch (err) {
      console.error('Failed to load expenses:', err)
    } finally {
      setIsLoadingExpenses(false)
    }
  }, [])

  useEffect(() => {
    fetchFinanceAnalytics(selectedRange)
    fetchInvoices()
    fetchAllColorways()
    fetchExpenses(selectedRange)
  }, [fetchFinanceAnalytics, fetchInvoices, fetchAllColorways, fetchExpenses, selectedRange])

  // Sorted recent sales (Strictly Newest to Oldest)
  const sortedRecentSales = useMemo(() => {
    if (!financeData?.recentSales) return []
    return [...financeData.recentSales].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }, [financeData?.recentSales])

  const latestSale = sortedRecentSales[0] || null

  // Customer Credit ("Deyn") calculations
  const creditInvoices = useMemo(() => {
    return invoices.filter(inv => inv.paymentMethod === 'credit')
  }, [invoices])

  const totalCreditBalance = useMemo(() => {
    return creditInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)
  }, [creditInvoices])

  const drawerBreakdown = useMemo(() => {
    return (
      financeData?.drawerBreakdown ||
      (financeData?.summary as any)?.drawerBreakdown || {
        cash: 0,
        grossCash: 0,
        cashExpenses: 0,
        mpesa: 0,
        grossMpesa: 0,
        mpesaExpenses: 0,
        credit: 0,
        other: 0,
      }
    )
  }, [financeData])

  // Total expenses computed
  const totalExpensesComputed = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0)
  }, [expenses])

  // Category breakdown
  const expensesByCategoryComputed = useMemo(() => {
    const map: Record<string, number> = {}
    for (const exp of expenses) {
      const cat = exp.category || 'other'
      map[cat] = (map[cat] || 0) + (Number(exp.amount) || 0)
    }
    return map
  }, [expenses])

  // Create an Expense
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expenseTitle.trim()) {
      alert('Please enter an expense description (e.g. Shop Rent).')
      return
    }
    const amt = Number(expenseAmount)
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount greater than 0.')
      return
    }

    setIsSavingExpense(true)
    setExpenseSuccessMsg('')

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: expenseTitle.trim(),
          amount: amt,
          category: expenseCategory,
          paymentMethod: expensePaymentMethod,
          notes: expenseNotes.trim(),
          date: expenseDate ? new Date(expenseDate).toISOString() : new Date().toISOString(),
        }),
      })

      if (res.ok) {
        setExpenseTitle('')
        setExpenseAmount('')
        setExpenseNotes('')
        setExpenseSuccessMsg(`✓ Recorded KES ${amt.toLocaleString()} successfully!`)
        setTimeout(() => setExpenseSuccessMsg(''), 4500)
        fetchExpenses(selectedRange)
        fetchFinanceAnalytics(selectedRange)
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to record expense')
      }
    } catch (err) {
      console.error('Error saving expense:', err)
      alert('Network error while saving expense.')
    } finally {
      setIsSavingExpense(false)
    }
  }

  // Delete an Expense
  const handleDeleteExpense = async (exp: Expense) => {
    if (!exp._id) return
    const confirmed = window.confirm(
      `Delete expense "${exp.title}" of KES ${Number(exp.amount).toLocaleString()}?\n\nThis will restore the amount back to your net profit.`
    )
    if (!confirmed) return

    setDeletingExpenseId(exp._id)
    try {
      const res = await fetch(`/api/expenses/${exp._id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchExpenses(selectedRange)
        fetchFinanceAnalytics(selectedRange)
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete expense')
      }
    } catch (err) {
      console.error('Error deleting expense:', err)
      alert('Network error while deleting expense.')
    } finally {
      setDeletingExpenseId(null)
    }
  }

  // Mark an invoice debt as paid (Cash or M-Pesa)
  const handleMarkInvoicePaid = async (invoiceId: string | undefined, newMethod: 'cash' | 'mpesa') => {
    if (!invoiceId) return
    setIsUpdatingPayment(invoiceId)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: newMethod }),
      })
      if (res.ok) {
        alert(`✓ Marked as Paid via ${newMethod === 'mpesa' ? 'M-Pesa' : 'Cash'}!`)
        if (selectedInvoice && selectedInvoice._id === invoiceId) {
          setSelectedInvoice({ ...selectedInvoice, paymentMethod: newMethod })
        }
        await fetchInvoices()
        await fetchFinanceAnalytics(selectedRange)
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to update payment status')
      }
    } catch (e) {
      console.error(e)
      alert('Network error updating payment status')
    } finally {
      setIsUpdatingPayment(null)
    }
  }

  // Send WhatsApp reminder for Customer Credit (Deyn)
  const handleSendCreditReminder = (inv: Invoice) => {
    let phone = inv.customerPhone?.trim() || ''
    if (!isValidKenyanPhone(phone)) {
      const entered = window.prompt(`Enter Kenyan WhatsApp number for ${inv.customerName || 'customer'} (e.g. 0712345678):`, '')
      if (!entered || !isValidKenyanPhone(entered)) {
        alert('A valid Kenyan phone number is required to send a reminder.')
        return
      }
      phone = entered
    }

    const normPhone = normalizeKenyanPhone(phone)
    const itemsSummary = inv.items.map(i => `${i.quantity}x ${i.fullCode}`).join(', ')
    const msg =
`Habari ${inv.customerName ? inv.customerName.trim() : 'valued customer'}, this is Mandera African Wear.

Friendly reminder regarding your outstanding balance of KES ${inv.totalAmount.toLocaleString()} for receipt #${inv.invoiceNumber} (${itemsSummary}).

Kindly settle when convenient. Thank you for your continued business.`

    const url = `https://wa.me/${normPhone}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  // Send Daily Register Close Summary to the Shop Owner via WhatsApp
  const handleSendDailyCloseWhatsApp = () => {
    const cash = drawerBreakdown.cash
    const mpesa = drawerBreakdown.mpesa
    const credit = drawerBreakdown.credit
    const total = financeData?.summary.totalRevenue || 0
    const expensesTotal = financeData?.summary.totalExpenses !== undefined ? financeData.summary.totalExpenses : totalExpensesComputed
    const netProfit = financeData?.summary.netProfit !== undefined ? financeData.summary.netProfit : ((financeData?.summary.estimatedProfit || 0) - expensesTotal)
    const pcs = financeData?.summary.totalPiecesSold || 0
    const invoicesCount = financeData?.summary.invoicesCount || 0
    const dateFormatted = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

    let ownerPhone = localStorage.getItem('mandera_owner_phone') || ''
    if (!ownerPhone || !isValidKenyanPhone(ownerPhone)) {
      const entered = window.prompt("Enter Owner's WhatsApp number to receive the Daily Close (e.g. 0725996394):", ownerPhone)
      if (!entered || !isValidKenyanPhone(entered)) {
        alert('Valid Kenyan phone number required.')
        return
      }
      ownerPhone = entered
      localStorage.setItem('mandera_owner_phone', entered)
    }

    const normOwner = normalizeKenyanPhone(ownerPhone)
    const msg =
`*MANDERA AFRICAN WEAR*
*Daily Register Close Summary (Z-Report)*
Date: ${dateFormatted}
------------------------------------------
• Net Cash in Drawer: KES ${cash.toLocaleString()}
• M-Pesa on Till: KES ${mpesa.toLocaleString()}
• Customer Credit (Deyn): KES ${credit.toLocaleString()}
------------------------------------------
• Total Sales Revenue: KES ${total.toLocaleString()}
• Shop Operating Expenses: KES ${expensesTotal.toLocaleString()}
• Estimated Net Take-Home: KES ${netProfit.toLocaleString()}
• Fabrics Sold: ${pcs} pieces
• Receipts Generated: ${invoicesCount}
------------------------------------------
Verified End-of-Day Store Closing Summary`

    const url = `https://wa.me/${normOwner}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  // Add a Recent Shop Sale (Already Deducted) into the Receipt/Bill draft
  const handleAddRecentSaleToDraft = (sale: FinanceSummary['recentSales'][0]) => {
    if (invoiceItems.some(i => i.recentSaleActivityId === sale.id)) return

    const matchingCw = allColorways.find(c => c.fullCode === sale.fullCode)
    setInvoiceItems(prev => [
      ...prev,
      {
        colorwayId: matchingCw?._id || sale.id,
        fullCode: sale.fullCode,
        subVariantLabel: sale.subVariantLabel,
        quantity: sale.quantity,
        unitPrice: sale.soldPrice ?? matchingCw?.sellingPrice ?? 0,
        costPrice: sale.costPrice ?? matchingCw?.buyingPrice,
        available: matchingCw?.quantityAvailable ?? sale.quantity,
        skipDeduction: true, // Already deducted when minus (-) was tapped in shop
        recentSaleActivityId: sale.id,
      },
    ])
  }

  // Add Item from Shelves to Invoice Draft (Deducts on confirm)
  const handleAddItemToInvoice = (cw: Colorway) => {
    const existingIndex = invoiceItems.findIndex(i => i.colorwayId === cw._id && !i.skipDeduction)
    if (existingIndex > -1) {
      const updated = [...invoiceItems]
      if (updated[existingIndex].quantity < cw.quantityAvailable) {
        updated[existingIndex].quantity += 1
        setInvoiceItems(updated)
      }
    } else {
      setInvoiceItems([
        ...invoiceItems,
        {
          colorwayId: cw._id,
          fullCode: cw.fullCode,
          quantity: 1,
          unitPrice: cw.sellingPrice || 0,
          costPrice: cw.buyingPrice,
          available: cw.quantityAvailable,
          skipDeduction: false, // Picked from shelves, will deduct on save
        },
      ])
    }
  }

  // Remove Item from Invoice Draft
  const handleRemoveItem = (index: number) => {
    const updated = [...invoiceItems]
    updated.splice(index, 1)
    setInvoiceItems(updated)
  }

  // Update Item Price or Quantity
  const handleUpdateItem = (index: number, field: 'quantity' | 'unitPrice', val: number) => {
    const updated = [...invoiceItems]
    if (field === 'quantity') {
      const max = updated[index].available
      updated[index].quantity = Math.max(1, Math.min(val, max))
    } else {
      updated[index].unitPrice = Math.max(0, val)
    }
    setInvoiceItems(updated)
  }

  // Submit Invoice
  const handleCreateInvoice = async () => {
    if (invoiceItems.length === 0) return
    setIsCreatingInvoice(true)
    setInvoiceSuccessMsg('')

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          paymentMethod,
          items: invoiceItems.map(i => ({
            colorwayId: i.colorwayId,
            fullCode: i.fullCode,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            costPrice: i.costPrice,
            subVariantLabel: i.subVariantLabel,
            skipDeduction: i.skipDeduction,
            recentSaleActivityId: i.recentSaleActivityId,
          })),
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setInvoiceSuccessMsg(`Receipt ${data.invoiceNumber} saved successfully!`)
        setInvoiceItems([])
        setCustomerName('')
        setCustomerPhone('')
        fetchInvoices()
        fetchFinanceAnalytics(selectedRange)
        fetchAllColorways()
        setSelectedInvoice(data)
      } else {
        alert(data.error || 'Failed to create invoice')
      }
    } catch (err) {
      console.error('Invoice creation error:', err)
      alert('Network error creating invoice')
    } finally {
      setIsCreatingInvoice(false)
    }
  }

  // Save or Clear Price for a Colorway (CRUD)
  const handleSavePrice = async () => {
    if (!editingPriceCw) return
    setIsSavingPrice(true)

    const bVal = editBuyingPrice.trim() !== '' ? Number(editBuyingPrice) : null
    const sVal = editSellingPrice.trim() !== '' ? Number(editSellingPrice) : null

    if (bVal !== null && (isNaN(bVal) || bVal < 0)) {
      alert('Buying price must be a valid positive number or left blank.')
      setIsSavingPrice(false)
      return
    }
    if (sVal !== null && (isNaN(sVal) || sVal < 0)) {
      alert('Selling price must be a valid positive number or left blank.')
      setIsSavingPrice(false)
      return
    }

    try {
      const res = await fetch(`/api/colorways/${editingPriceCw._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyingPrice: bVal,
          sellingPrice: sVal,
        }),
      })

      if (res.ok) {
        setAllColorways(prev =>
          prev.map(item =>
            item._id === editingPriceCw._id
              ? {
                  ...item,
                  buyingPrice: bVal !== null ? bVal : undefined,
                  sellingPrice: sVal !== null ? sVal : undefined,
                }
              : item
          )
        )
        setEditingPriceCw(null)
        fetchFinanceAnalytics(selectedRange)
      } else {
        alert('Failed to update price')
      }
    } catch (err) {
      console.error('Error updating price:', err)
      alert('Network error')
    } finally {
      setIsSavingPrice(false)
    }
  }

  // Void / Undo an individual sale from the sales ledger
  const handleVoidSale = async (sale: { id: string; fullCode: string; quantity: number; totalRevenue?: number }) => {
    const revenueText = sale.totalRevenue ? ` (KES ${sale.totalRevenue.toLocaleString()})` : ''
    const confirmed = window.confirm(
      `Undo / Void this accidental sale of ${sale.quantity} pc(s) of ${sale.fullCode}${revenueText}?\n\n• The item will be restored back to store inventory.\n• The sale revenue/profit will be completely erased from reports.`
    )
    if (!confirmed) return

    setVoidingSaleId(sale.id)
    try {
      const res = await fetch(`/api/activities/${sale.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        alert(`✓ Sale voided. ${sale.fullCode} restored back to inventory.`)
        fetchFinanceAnalytics(selectedRange)
        fetchAllColorways()
        fetchInvoices()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to void sale')
      }
    } catch (err) {
      console.error('Failed to void sale:', err)
      alert('Network error while voiding sale.')
    } finally {
      setVoidingSaleId(null)
    }
  }

  const handleSelectInvoice = (inv: Invoice | null) => {
    setSelectedInvoice(inv)
    setModalPhone(inv?.customerPhone || '')
    setLastWaUrl(null)
  }

  // Open receipt / invoice for any past counter sale without deducting stock again
  const handleOpenReceiptForSale = (sale: {
    id: string
    invoiceId?: string
    fullCode: string
    subVariantLabel?: string | null
    quantity: number
    soldPrice?: number
    costPrice?: number
    timestamp: string
  }) => {
    if (sale.invoiceId) {
      const existing = invoices.find(inv => inv._id === sale.invoiceId)
      if (existing) {
        handleSelectInvoice(existing)
        return
      }
    }

    const unitPrice = sale.soldPrice || 0
    const invoiceDraft: Invoice = {
      _id: sale.id,
      invoiceNumber: `REC-${new Date(sale.timestamp).toISOString().slice(0, 10).replace(/-/g, '')}-${sale.id.slice(-4).toUpperCase()}`,
      customerName: 'Walk-in Customer',
      customerPhone: '',
      paymentMethod: 'cash',
      items: [
        {
          colorwayId: '',
          designCodeId: '',
          fullCode: sale.fullCode,
          subVariantLabel: sale.subVariantLabel || undefined,
          quantity: sale.quantity,
          unitPrice,
          costPrice: sale.costPrice,
          subtotal: unitPrice * sale.quantity,
        },
      ],
      totalAmount: unitPrice * sale.quantity,
      status: 'completed',
      createdAt: sale.timestamp,
    }
    handleSelectInvoice(invoiceDraft)
  }

  const handleSendWhatsApp = () => {
    if (!selectedInvoice) return
    const targetPhone = modalPhone.trim() || selectedInvoice.customerPhone || ''
    if (!targetPhone) {
      alert('Please enter a Kenyan phone number (e.g. 0725996394) to open WhatsApp.')
      return
    }
    const url = getWhatsAppInvoiceUrl(targetPhone, selectedInvoice)
    setLastWaUrl(url)
    try {
      window.open(url, '_blank')
    } catch (e) {
      console.warn('Popup blocked, user can click direct link', e)
    }
  }

  // Void / Undo an invoice or counter receipt
  const handleVoidInvoice = async () => {
    if (!selectedInvoice) return
    const confirmed = window.confirm(
      `Void invoice / receipt ${selectedInvoice.invoiceNumber}?\n\n• The item(s) will be returned to store inventory.\n• The sale will be removed from financial records.`
    )
    if (!confirmed) return

    setIsVoidingInvoice(true)
    try {
      let res = await fetch(`/api/invoices/${selectedInvoice._id}`, {
        method: 'DELETE',
      })
      if (!res.ok && res.status === 404) {
        // Fallback for standalone counter sale activity
        res = await fetch(`/api/activities/${selectedInvoice._id}`, {
          method: 'DELETE',
        })
      }

      if (res.ok) {
        alert(`✓ Transaction ${selectedInvoice.invoiceNumber} voided and stock restored.`)
        setSelectedInvoice(null)
        fetchInvoices()
        fetchFinanceAnalytics(selectedRange)
        fetchAllColorways()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to void transaction')
      }
    } catch (err) {
      console.error('Failed to void transaction:', err)
      alert('Network error while voiding transaction.')
    } finally {
      setIsVoidingInvoice(false)
    }
  }

  // Invoice calculations
  const invoiceSubtotal = invoiceItems.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)
  const invoiceCostTotal = invoiceItems.reduce(
    (acc, i) => acc + (i.costPrice !== undefined ? i.costPrice * i.quantity : 0),
    0
  )
  const hasCostData = invoiceItems.some(i => i.costPrice !== undefined)

  // Filter colorways in Price Manager
  const filteredColorways = allColorways.filter(cw =>
    cw.fullCode.toLowerCase().includes(searchFilter.toLowerCase())
  )

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
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            Back
          </button>
          <div>
            <h1 className="appbar__title">Finance & Invoices</h1>
            <p className="appbar__subtitle">Mandera African Wear</p>
          </div>
        </div>

        <div className="appbar__right">
          <ExpandingSearchDock placeholder="Search fabrics, codes, invoices..." />
        </div>
      </header>

      <Sidebar
        activeCategory="Finance"
        onCategoryChange={(cat) => router.push(`/classify?category=${cat}`)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="main-content" style={{ padding: 'var(--space-md)' }}>
        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '4px 0 16px',
            marginBottom: '16px',
            borderBottom: '1px solid var(--color-border, #e5e7eb)',
            overflowX: 'auto',
          }}
        >
          <button
            onClick={() => setActiveTab('invoice')}
            className={`btn ${activeTab === 'invoice' ? 'btn--primary' : 'btn--secondary'}`}
            style={{ fontSize: '13px', padding: '8px 16px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            type="button"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>
              <path d="M16 8h-8"/>
              <path d="M16 12h-8"/>
              <path d="M11 16h-3"/>
            </svg>
            <span>Create Receipt / Bill</span>
          </button>
          <button
            onClick={() => setActiveTab('credit')}
            className={`btn ${activeTab === 'credit' ? 'btn--primary' : 'btn--secondary'}`}
            style={{ fontSize: '13px', padding: '8px 16px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            type="button"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="14" x="2" y="5" rx="2"/>
              <line x1="2" x2="22" y1="10" y2="10"/>
            </svg>
            <span>Customer Credit (Deyn)</span>
            {creditInvoices.length > 0 && (
              <span style={{
                background: activeTab === 'credit' ? '#ffffff' : '#ef4444',
                color: activeTab === 'credit' ? '#b91c1c' : '#ffffff',
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 800,
              }}>
                {creditInvoices.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`btn ${activeTab === 'analytics' ? 'btn--primary' : 'btn--secondary'}`}
            style={{ fontSize: '13px', padding: '8px 16px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            type="button"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" x2="18" y1="20" y2="10"/>
              <line x1="12" x2="12" y1="20" y2="4"/>
              <line x1="6" x2="6" y1="20" y2="14"/>
            </svg>
            <span>Sales & Register Close</span>
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`btn ${activeTab === 'expenses' ? 'btn--primary' : 'btn--secondary'}`}
            style={{ fontSize: '13px', padding: '8px 16px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            type="button"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
            </svg>
            <span>Shop Expenses & P&L</span>
            {expenses.length > 0 && (
              <span style={{
                background: activeTab === 'expenses' ? '#ffffff' : '#f59e0b',
                color: activeTab === 'expenses' ? '#92400e' : '#ffffff',
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 800,
              }}>
                {expenses.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('prices')}
            className={`btn ${activeTab === 'prices' ? 'btn--primary' : 'btn--secondary'}`}
            style={{ fontSize: '13px', padding: '8px 16px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            type="button"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/>
              <path d="M7 7h.01"/>
            </svg>
            <span>Fabric Prices</span>
          </button>
        </div>

        <div className="finance-container">
          {/* ========================================================================= */}
          {/* TAB 1: CREATE RECEIPT / BILL */}
          {/* ========================================================================= */}
          {activeTab === 'invoice' && (
            <div className="finance-grid-layout">
              {/* Left Column: Build Receipt */}
              <div className="finance-card">
                {/* Auto-Suggested Most Recent Sale Card */}
                {latestSale && (
                  <div
                    style={{
                      background: 'rgba(91, 26, 62, 0.03)',
                      border: '1.5px solid rgba(91, 26, 62, 0.2)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      marginBottom: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            background: 'var(--color-primary)',
                            color: '#ffffff',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          Just Sold in Shop
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                          {formatFriendlyTime(latestSale.timestamp).label}
                        </span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '4px' }}>
                        {latestSale.fullCode}
                        {latestSale.subVariantLabel ? ` (${latestSale.subVariantLabel})` : ''}
                        <span style={{ marginLeft: '8px', color: 'var(--color-success)', fontWeight: 700 }}>
                          {latestSale.soldPrice ? `KES ${latestSale.soldPrice.toLocaleString()}` : 'Price not recorded'}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: '6px' }}>
                          ({latestSale.quantity} pc{latestSale.quantity > 1 ? 's' : ''})
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-success)', marginTop: '2px', fontWeight: 500 }}>
                        ✓ Already deducted from shelves when you clicked minus (−)
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleAddRecentSaleToDraft(latestSale)}
                        disabled={invoiceItems.some(i => i.recentSaleActivityId === latestSale.id)}
                        className={`btn ${invoiceItems.some(i => i.recentSaleActivityId === latestSale.id) ? 'btn--secondary' : 'btn--primary'}`}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {invoiceItems.some(i => i.recentSaleActivityId === latestSale.id) ? '✓ In this Receipt' : '+ Add to Receipt'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenReceiptForSale(latestSale)}
                        className="btn btn--secondary"
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>Receipt</span>
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', color: '#334155', marginBottom: '14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <div>
                    <strong style={{ color: '#0f172a' }}>Tapped minus (−) on a fabric in the shop?</strong>
                    <div style={{ marginTop: '2px', color: '#64748b' }}>
                      That fabric was already deducted from your shelves. Tap <strong>&quot;+ Add to Receipt&quot;</strong> to bundle it into a customer receipt without deducting twice.
                    </div>
                  </div>
                </div>

                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 14px' }}>
                  Customer Details (Optional)
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                      Customer Name
                    </label>
                    <input
                      type="text"
                      className="form-group__input"
                      placeholder="e.g. Halima Ahmed"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                      Phone / WhatsApp
                    </label>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0 10px',
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', marginRight: '8px' }}>
                        +254
                      </span>
                      <input
                        type="tel"
                        placeholder="0725 996 394"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        style={{
                          border: 'none',
                          outline: 'none',
                          width: '100%',
                          padding: '9px 0',
                          fontSize: '13px',
                          color: 'var(--color-text-primary)',
                          background: 'transparent',
                        }}
                      />
                    </div>
                    {customerPhone.trim() && (
                      <div style={{ marginTop: '4px', fontSize: '11px' }}>
                        {isValidKenyanPhone(customerPhone) ? (
                          <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                            ✓ {formatKenyanPhoneDisplay(customerPhone)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-warning)' }}>
                            Type 9-10 digits (e.g. 0725996394)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>
                    Payment Method
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 90px), 1fr))', gap: '8px' }}>
                    {[
                      { key: 'cash', label: 'Cash' },
                      { key: 'mpesa', label: 'M-Pesa' },
                      { key: 'credit', label: 'Credit (Deyn)' },
                    ].map(pm => {
                      const isSelected = paymentMethod === pm.key
                      return (
                        <button
                          key={pm.key}
                          type="button"
                          onClick={() => setPaymentMethod(pm.key as 'cash' | 'mpesa' | 'credit')}
                          style={{
                            padding: '9px 8px',
                            borderRadius: 'var(--radius-md)',
                            border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                            background: isSelected ? 'rgba(91, 26, 62, 0.08)' : 'var(--color-bg-card)',
                            color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            fontWeight: isSelected ? 700 : 500,
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all var(--transition-fast)',
                          }}
                        >
                          {pm.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '20px 0 10px', borderTop: '1px solid #e5e7eb', paddingTop: '14px' }}>
                  Invoice Items ({invoiceItems.length})
                </h2>

                {invoiceItems.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '24px',
                      background: 'var(--color-bg-hover)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed var(--color-border)',
                      color: 'var(--color-text-muted)',
                      fontSize: '13px',
                    }}
                  >
                    Select fabrics from the available stock panel on the right to add them to this invoice.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    {invoiceItems.map((item, idx) => {
                      const isBelowCost = item.costPrice !== undefined && item.unitPrice < item.costPrice
                      return (
                        <div
                          key={item.colorwayId}
                          style={{
                            padding: '10px 12px',
                            background: 'var(--color-bg-hover)',
                            borderRadius: 'var(--radius-md)',
                            border: `1px solid ${isBelowCost ? 'var(--color-danger)' : 'var(--color-border)'}`,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{item.fullCode}</strong>
                              {item.skipDeduction ? (
                                <span style={{ fontSize: '10px', background: 'rgba(5, 150, 105, 0.1)', color: 'var(--color-success)', padding: '1px 6px', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}>
                                  ✓ Recent Shop Sale (Already Deducted)
                                </span>
                              ) : (
                                <span style={{ fontSize: '10px', background: 'rgba(91, 26, 62, 0.08)', color: 'var(--color-primary)', padding: '1px 6px', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}>
                                  Shelves Stock (Deducts on Save)
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                            >
                              Remove
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 110px), 1fr))', gap: '8px', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>Qty (Max {item.available})</span>
                              <input
                                type="number"
                                className="form-group__input"
                                min="1"
                                max={item.available}
                                value={item.quantity}
                                onChange={e => handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                              />
                            </div>
                            <div>
                              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>Agreed Price (KES)</span>
                              <input
                                type="number"
                                className="form-group__input"
                                min="0"
                                value={item.unitPrice}
                                onChange={e => handleUpdateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>Subtotal</span>
                              <strong style={{ fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
                                KES {(item.unitPrice * item.quantity).toLocaleString()}
                              </strong>
                            </div>
                          </div>

                          {isBelowCost && (
                            <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#b91c1c', fontWeight: 600 }}>
                              Below Cost: Buying price is KES {item.costPrice?.toLocaleString()}. Loss of KES {((item.costPrice! - item.unitPrice) * item.quantity).toLocaleString()}.
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Total Summary */}
                <div style={{ background: 'var(--color-bg-hover)', padding: '14px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600 }}>Total Amount:</span>
                    <strong style={{ fontSize: '18px', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      KES {invoiceSubtotal.toLocaleString()}
                    </strong>
                  </div>
                  {hasCostData && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      <span>Estimated Gross Profit:</span>
                      <strong style={{ color: invoiceSubtotal >= invoiceCostTotal ? 'var(--color-success)' : 'var(--color-danger)', fontVariantNumeric: 'tabular-nums' }}>
                        KES {(invoiceSubtotal - invoiceCostTotal).toLocaleString()}
                      </strong>
                    </div>
                  )}
                </div>

                {invoiceSuccessMsg && (
                  <div style={{ padding: '10px 14px', background: 'rgba(5, 150, 105, 0.08)', border: '1px solid rgba(5, 150, 105, 0.2)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: '12px', marginBottom: '14px', fontWeight: 600 }}>
                    ✓ {invoiceSuccessMsg}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCreateInvoice}
                  disabled={invoiceItems.length === 0 || isCreatingInvoice}
                  className="btn btn--primary"
                  style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700 }}
                >
                  {isCreatingInvoice ? 'Saving Receipt & Updating Stock...' : 'Save Receipt & Print Slip'}
                </button>
              </div>

              {/* Right Column: Quick Inventory Picker & Recent Invoices */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Stock Picker */}
                <div className="finance-card" style={{ maxHeight: '520px', display: 'flex', flexDirection: 'column' }}>
                  {/* Panel Mode Switcher */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setRightPanelTab('recentSales')}
                      className={`btn ${rightPanelTab === 'recentSales' ? 'btn--primary' : 'btn--secondary'}`}
                      style={{
                        flex: '1 1 auto',
                        padding: '7px 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      Recent Sales ({sortedRecentSales.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightPanelTab('stock')}
                      className={`btn ${rightPanelTab === 'stock' ? 'btn--primary' : 'btn--secondary'}`}
                      style={{
                        flex: '1 1 auto',
                        padding: '7px 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      From Shelves ({allColorways.filter(c => c.quantityAvailable > 0).length})
                    </button>
                  </div>

                  {rightPanelTab === 'recentSales' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
                      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
                        Already deducted in shop. Click <strong>+ Add</strong> to bundle into this receipt:
                      </p>
                      {sortedRecentSales.length === 0 ? (
                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '30px 10px' }}>
                          No recent shop sales recorded yet.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {sortedRecentSales.slice(0, 40).map((sale, idx) => {
                            const timeInfo = formatFriendlyTime(sale.timestamp)
                            const isAdded = invoiceItems.some(i => i.recentSaleActivityId === sale.id)
                            const alreadyInvoiced = !!sale.invoiceId || invoices.some(inv => inv.items?.some(it => it.recentSaleActivityId === sale.id))
                            return (
                              <div
                                key={sale.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '8px 10px',
                                  borderRadius: 'var(--radius-md)',
                                  background: idx === 0 ? 'rgba(91, 26, 62, 0.03)' : 'var(--color-bg)',
                                  fontSize: '12px',
                                  border: idx === 0 ? '1.5px solid rgba(91, 26, 62, 0.25)' : '1px solid var(--color-border-light)',
                                }}
                              >
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <strong>{sale.fullCode}</strong>
                                    {idx === 0 && (
                                      <span style={{ fontSize: '9px', fontWeight: 700, background: 'var(--color-primary)', color: '#ffffff', padding: '1px 5px', borderRadius: 'var(--radius-sm)' }}>
                                        Latest
                                      </span>
                                    )}
                                    <span style={{ fontSize: '10px', color: 'var(--color-success)', background: 'rgba(5, 150, 105, 0.1)', padding: '1px 5px', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                                      ✓ −{sale.quantity} pc
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                      {sale.soldPrice !== undefined ? `KES ${sale.soldPrice.toLocaleString()}` : 'Price unrecorded'}
                                    </span>{' '}
                                    • {timeInfo.label}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  {alreadyInvoiced ? (
                                    <span
                                      style={{
                                        background: 'rgba(5, 150, 105, 0.08)',
                                        color: 'var(--color-success)',
                                        border: '1px solid rgba(5, 150, 105, 0.2)',
                                        padding: '3px 6px',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      ✓ Invoiced
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleAddRecentSaleToDraft(sale)}
                                      disabled={isAdded}
                                      className={`btn ${isAdded ? 'btn--secondary' : 'btn--primary'}`}
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {isAdded ? '✓ Added' : '+ Add'}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReceiptForSale(sale)}
                                    className="btn btn--secondary"
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Receipt
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>Select Fabric Stock</h4>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Deducts stock on confirm</span>
                      </div>

                      <input
                        type="text"
                        className="form-group__input"
                        placeholder="Search fabric code..."
                        value={searchFilter}
                        onChange={e => setSearchFilter(e.target.value)}
                        style={{ marginBottom: '10px' }}
                      />

                      <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {isLoadingInventory ? (
                          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Loading stock...</p>
                        ) : (
                          filteredColorways
                            .filter(c => c.quantityAvailable > 0)
                            .slice(0, 50)
                            .map(cw => (
                              <div
                                key={cw._id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '8px 10px',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'var(--color-bg)',
                                  fontSize: '12px',
                                  border: '1px solid var(--color-border-light)',
                                }}
                              >
                                <div>
                                  <strong>{cw.fullCode}</strong>
                                  <span style={{ color: 'var(--color-text-muted)', marginLeft: '6px' }}>({cw.quantityAvailable} avail)</span>
                                  {cw.sellingPrice && (
                                    <span style={{ marginLeft: '6px', color: 'var(--color-success)', fontWeight: 600 }}>
                                      KES {cw.sellingPrice.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddItemToInvoice(cw)}
                                  className="btn btn--primary"
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                  }}
                                >
                                  + Add
                                </button>
                              </div>
                            ))
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Recent Invoices List */}
                <div
                  style={{
                    background: 'var(--color-surface, #ffffff)',
                    padding: '18px',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border, #e5e7eb)',
                  }}
                >
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 10px' }}>
                    Recent Invoices ({invoices.length})
                  </h3>
                  {isLoadingInvoices ? (
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Loading invoices...</p>
                  ) : invoices.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>No invoices created yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {invoices.slice(0, 5).map(inv => (
                        <div
                          key={inv._id}
                          onClick={() => setSelectedInvoice(inv)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--color-bg-hover)',
                            border: '1px solid var(--color-border)',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          <div>
                            <strong style={{ color: 'var(--color-primary)' }}>{inv.invoiceNumber}</strong>
                            <span style={{ color: 'var(--color-text-muted)', marginLeft: '6px' }}>
                              {inv.customerName || 'Walk-in'} • {new Date(inv.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <strong style={{ color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>KES {inv.totalAmount.toLocaleString()}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: CUSTOMER CREDIT (DEYN) LEDGER */}
          {/* ========================================================================= */}
          {activeTab === 'credit' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="14" x="2" y="5" rx="2" />
                      <line x1="2" x2="22" y1="10" y2="10" />
                    </svg>
                    <span>Customer Credit (Deyn) Ledger</span>
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '3px 0 0' }}>
                    Track fabrics handed out on credit, send WhatsApp payment reminders, and settle balances.
                  </p>
                </div>

                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: 'var(--shadow-sm)',
                  flexWrap: 'wrap',
                }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Outstanding Balance:</span>
                  <strong style={{ fontSize: '18px', color: '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>
                    KES {totalCreditBalance.toLocaleString()}
                  </strong>
                </div>
              </div>

              {creditInvoices.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '48px 20px',
                  background: '#ffffff',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid #e2e8f0',
                  color: 'var(--color-text-muted)',
                }}>
                  <div style={{ width: '48px', height: '48px', margin: '0 auto 12px', borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '16px', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                    No Outstanding Customer Debt
                  </h4>
                  <p style={{ fontSize: '13px', margin: 0 }}>
                    All customer sales have been paid in full via Cash or M-Pesa.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))', gap: '16px' }}>
                  {creditInvoices.map(inv => (
                    <div
                      key={inv._id}
                      style={{
                        background: '#ffffff',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid #e2e8f0',
                        padding: '16px',
                        boxShadow: 'var(--shadow-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                          <div>
                            <strong style={{ fontSize: '15px', color: 'var(--color-text-primary)', display: 'block' }}>
                              {inv.customerName || 'Walk-in Customer'}
                            </strong>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                              {inv.customerPhone ? formatKenyanPhoneDisplay(inv.customerPhone) : 'No phone saved'}
                            </span>
                          </div>
                          <span style={{
                            background: '#fef2f2',
                            color: '#b91c1c',
                            fontWeight: 700,
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid #fecaca',
                          }}>
                            Credit Debt
                          </span>
                        </div>

                        <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', padding: '10px 12px', borderRadius: 'var(--radius-md)', marginBottom: '12px', fontSize: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: 'var(--color-text-secondary)', alignItems: 'center' }}>
                            <span>Receipt #:</span>
                            <button
                              type="button"
                              onClick={() => handleSelectInvoice(inv)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-primary)',
                                textDecoration: 'underline',
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: '12px',
                              }}
                              title="Click to view full receipt or print slip"
                            >
                              {inv.invoiceNumber}
                            </button>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: 'var(--color-text-muted)' }}>
                            <span>Sale Date:</span>
                            <span>{new Date(inv.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Fabrics Taken:</div>
                            {inv.items.map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-primary)' }}>
                                <span>{item.quantity}x {item.fullCode}</span>
                                <span style={{ fontVariantNumeric: 'tabular-nums' }}>KES {item.subtotal.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Amount Owed:</span>
                          <strong style={{ fontSize: '18px', color: '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>
                            KES {inv.totalAmount.toLocaleString()}
                          </strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 110px), 1fr))', gap: '8px' }}>
                          <button
                            type="button"
                            disabled={isUpdatingPayment === inv._id}
                            onClick={() => handleMarkInvoicePaid(inv._id, 'cash')}
                            style={{
                              background: '#16a34a',
                              color: '#ffffff',
                              border: 'none',
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Paid (Cash)
                          </button>
                          <button
                            type="button"
                            disabled={isUpdatingPayment === inv._id}
                            onClick={() => handleMarkInvoicePaid(inv._id, 'mpesa')}
                            style={{
                              background: 'var(--color-primary)',
                              color: '#ffffff',
                              border: 'none',
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Paid (M-Pesa)
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSendCreditReminder(inv)}
                          style={{
                            background: '#128C7E',
                            color: '#ffffff',
                            border: 'none',
                            padding: '9px 10px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                          </svg>
                          <span>Send WhatsApp Reminder</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: SALES & DAILY REGISTER CLOSE */}
          {/* ========================================================================= */}
          {activeTab === 'analytics' && (
            <div>
              {/* Range Filters */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {[
                  { key: 'today', label: 'Today' },
                  { key: 'week', label: 'This Week' },
                  { key: 'month', label: 'This Month' },
                  { key: 'year', label: 'This Year' },
                  { key: 'all', label: 'All Time' },
                ].map(r => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setSelectedRange(r.key)}
                    className={`btn ${selectedRange === r.key ? 'btn--primary' : 'btn--secondary'}`}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Daily Register Close (Z-Report) Card */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px 22px',
                  color: 'var(--color-text-primary)',
                  marginBottom: '24px',
                  boxShadow: 'var(--shadow-sm)',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '0.3px' }}>
                        Daily Register Close (Z-Report)
                      </h3>
                      <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>
                        {selectedRange === 'today' ? "Today's Close" : `Period: ${selectedRange.toUpperCase()}`}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      Physical drawer cash vs. M-Pesa on Till balance for Mandera African Wear
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendDailyCloseWhatsApp}
                    style={{
                      background: '#128C7E',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      padding: '9px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span>Send Daily Close to Owner via WhatsApp</span>
                  </button>
                </div>

                {/* Drawer Breakdown Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '12px' }}>
                  <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b', display: 'block', fontWeight: 700, marginBottom: '2px' }}>
                      Physical Cash in Drawer
                    </span>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                      KES {drawerBreakdown.cash.toLocaleString()}
                    </div>
                    <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                      Must match physical cash
                    </span>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b', display: 'block', fontWeight: 700, marginBottom: '2px' }}>
                      M-Pesa on Till
                    </span>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                      KES {drawerBreakdown.mpesa.toLocaleString()}
                    </div>
                    <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                      Confirmed via shop phone
                    </span>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#b91c1c', display: 'block', fontWeight: 700, marginBottom: '2px' }}>
                      Customer Credit (Deyn)
                    </span>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>
                      KES {drawerBreakdown.credit.toLocaleString()}
                    </div>
                    <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                      Handed out on credit debt
                    </span>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--color-primary)', display: 'block', fontWeight: 700, marginBottom: '2px' }}>
                      Total Sales Recorded
                    </span>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      KES {(financeData?.summary.totalRevenue || 0).toLocaleString()}
                    </div>
                    <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                      {financeData?.summary.totalPiecesSold || 0} fabric rolls sold
                    </span>
                  </div>
                </div>
              </div>

              {/* Stat Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: '14px', marginBottom: '24px' }}>
                <div style={{ background: '#ffffff', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Total Sales Revenue</span>
                  <strong style={{ fontSize: '20px', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                    KES {(financeData?.summary.totalRevenue || 0).toLocaleString()}
                  </strong>
                  <span style={{ fontSize: '11px', color: '#16a34a', display: 'block', marginTop: '4px' }}>
                    {financeData?.summary.pricedPiecesSold || 0} pieces priced
                  </span>
                </div>

                <div style={{ background: '#ffffff', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Wholesale Fabric Cost</span>
                  <strong style={{ fontSize: '20px', color: '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>
                    KES {(financeData?.summary.totalCost || 0).toLocaleString()}
                  </strong>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                    Cost of items sold
                  </span>
                </div>

                <div style={{ background: '#ffffff', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Shop Expenses</span>
                  <strong style={{ fontSize: '20px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                    KES {(financeData?.summary.totalExpenses !== undefined ? financeData.summary.totalExpenses : totalExpensesComputed).toLocaleString()}
                  </strong>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                    Rent, electricity, cargo, etc.
                  </span>
                </div>

                {(() => {
                  const expTotal = financeData?.summary.totalExpenses !== undefined ? financeData.summary.totalExpenses : totalExpensesComputed
                  const net = financeData?.summary.netProfit !== undefined ? financeData.summary.netProfit : ((financeData?.summary.estimatedProfit || 0) - expTotal)
                  const isProfit = net >= 0
                  return (
                    <div style={{
                      background: isProfit ? '#f0fdf4' : '#fef2f2',
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isProfit ? '#bbf7d0' : '#fecaca'}`,
                      boxShadow: 'var(--shadow-sm)',
                    }}>
                      <span style={{ fontSize: '12px', color: isProfit ? '#15803d' : '#b91c1c', display: 'block', marginBottom: '4px', fontWeight: 700 }}>
                        Net Take-Home Profit
                      </span>
                      <strong style={{ fontSize: '20px', color: isProfit ? '#15803d' : '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>
                        KES {net.toLocaleString()}
                      </strong>
                      <span style={{ fontSize: '11px', color: isProfit ? '#166534' : '#991b1b', display: 'block', marginTop: '4px' }}>
                        Gross profit minus expenses
                      </span>
                    </div>
                  )
                })()}

                <div style={{ background: '#ffffff', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Total Fabrics Sold</span>
                  <strong style={{ fontSize: '20px', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                    {financeData?.summary.totalPiecesSold || 0} pcs
                  </strong>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                    {financeData?.summary.unpricedPiecesSold || 0} pcs sold without price
                  </span>
                </div>
              </div>

              {/* Recent Sales History */}
              <div style={{ background: '#ffffff', borderRadius: 'var(--radius-lg)', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>Sales History & Profits</h3>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                      All fabrics sold in your shop, listed from newest to oldest
                    </p>
                  </div>
                  {isLoadingAnalytics && <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Refreshing...</span>}
                </div>

                <div className="finance-table-wrapper">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Sold Time</th>
                        <th>Fabric Code</th>
                        <th>Quantity</th>
                        <th>Agreed Sold Price</th>
                        <th>Buying Cost</th>
                        <th>Estimated Profit</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRecentSales.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            No sales recorded in this period.
                          </td>
                        </tr>
                      ) : (
                        sortedRecentSales.map((sale, idx) => {
                          const timeInfo = formatFriendlyTime(sale.timestamp)
                          return (
                            <tr key={sale.id} style={{ background: idx === 0 ? 'rgba(91, 26, 62, 0.03)' : undefined }}>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <strong style={{ color: 'var(--color-text-primary)', fontSize: '12px' }}>{timeInfo.label}</strong>
                                  {idx === 0 && (
                                    <span style={{ fontSize: '9px', fontWeight: 700, background: 'var(--color-primary)', color: '#ffffff', padding: '1px 5px', borderRadius: 'var(--radius-sm)' }}>
                                      Latest
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                  {new Date(sale.timestamp).toLocaleDateString()}
                                </div>
                              </td>
                              <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                {sale.fullCode}
                                {sale.subVariantLabel && (
                                  <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '11px', marginLeft: '4px' }}>
                                    ({sale.subVariantLabel})
                                  </span>
                                )}
                              </td>
                              <td>{sale.quantity} pc{sale.quantity > 1 ? 's' : ''}</td>
                              <td>
                                {sale.soldPrice !== undefined ? (
                                  <span style={{ color: sale.isLoss ? '#b91c1c' : 'var(--color-text-primary)', fontWeight: 600 }}>
                                    KES {sale.soldPrice.toLocaleString()}
                                    {sale.isLoss && <span style={{ fontSize: '10px', marginLeft: '4px', color: '#b91c1c' }}>(Below Cost)</span>}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Unrecorded</span>
                                )}
                              </td>
                              <td style={{ color: 'var(--color-text-secondary)' }}>
                                {sale.costPrice !== undefined ? `KES ${sale.costPrice.toLocaleString()}` : '—'}
                              </td>
                              <td>
                                {sale.itemProfit !== undefined ? (
                                  <span style={{ color: sale.itemProfit >= 0 ? '#16a34a' : '#b91c1c', fontWeight: 600 }}>
                                    {sale.itemProfit >= 0 ? '+' : ''}KES {sale.itemProfit.toLocaleString()}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReceiptForSale(sale)}
                                    title="Print paper slip or send WhatsApp receipt to customer"
                                    style={{
                                      background: 'transparent',
                                      color: 'var(--color-primary)',
                                      border: '1px solid var(--color-primary)',
                                      padding: '5px 9px',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Receipt
                                  </button>
                                  <button
                                    type="button"
                                    disabled={voidingSaleId === sale.id}
                                    onClick={() => handleVoidSale(sale)}
                                    title="Undo this sale and return the fabric back to shelves"
                                    style={{
                                      background: 'rgba(198, 40, 40, 0.08)',
                                      color: 'var(--color-danger)',
                                      border: '1px solid rgba(198, 40, 40, 0.2)',
                                      padding: '5px 10px',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {voidingSaleId === sale.id ? 'Returning...' : 'Return to Shelf'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: SHOP EXPENSES & MONTH-END P&L */}
          {/* ========================================================================= */}
          {activeTab === 'expenses' && (
            <div>
              {/* Range Filters */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { key: 'today', label: 'Today' },
                    { key: 'week', label: 'This Week' },
                    { key: 'month', label: 'This Month' },
                    { key: 'year', label: 'This Year' },
                    { key: 'all', label: 'All Time' },
                  ].map(r => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => {
                        setSelectedRange(r.key)
                        fetchFinanceAnalytics(r.key)
                        fetchExpenses(r.key)
                      }}
                      className={`btn ${selectedRange === r.key ? 'btn--primary' : 'btn--secondary'}`}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {isLoadingExpenses && (
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Refreshing expenses...</span>
                )}
              </div>

              {/* MONTH-END PROFIT & LOSS (P&L) CALCULATION CARD */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 'var(--radius-lg)',
                  padding: '22px 24px',
                  color: 'var(--color-text-primary)',
                  marginBottom: '24px',
                  boxShadow: 'var(--shadow-sm)',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23"/>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                      </svg>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '0.3px' }}>
                        Month-End Calculation & Net Take-Home
                      </h3>
                      <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', padding: '3px 10px', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>
                        {selectedRange === 'month' ? 'This Month' : selectedRange.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      Complete breakdown of sales revenue minus wholesale fabric costs minus shop operating expenses.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendDailyCloseWhatsApp}
                    style={{
                      background: '#128C7E',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      padding: '9px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span>Send P&L Summary via WhatsApp</span>
                  </button>
                </div>

                {/* 5-Step P&L Flow Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '12px' }}>
                  {/* Step 1: Revenue */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b', display: 'block', fontWeight: 700, marginBottom: '4px' }}>
                      1. Sales Revenue
                    </span>
                    <div style={{ fontSize: '19px', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                      KES {(financeData?.summary.totalRevenue || 0).toLocaleString()}
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '3px' }}>
                      {financeData?.summary.totalPiecesSold || 0} fabric rolls sold
                    </span>
                  </div>

                  {/* Step 2: Cost of Inventory */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b', display: 'block', fontWeight: 700, marginBottom: '4px' }}>
                      2. Wholesale Cost (COGS)
                    </span>
                    <div style={{ fontSize: '19px', fontWeight: 800, color: '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>
                      − KES {(financeData?.summary.totalCost || 0).toLocaleString()}
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '3px' }}>
                      Fabric purchase costs
                    </span>
                  </div>

                  {/* Step 3: Gross Trading Profit */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b', display: 'block', fontWeight: 700, marginBottom: '4px' }}>
                      3. Gross Profit
                    </span>
                    <div style={{ fontSize: '19px', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                      = KES {(financeData?.summary.estimatedProfit || 0).toLocaleString()}
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '3px' }}>
                      Margin before shop costs
                    </span>
                  </div>

                  {/* Step 4: Operating Expenses */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b', display: 'block', fontWeight: 700, marginBottom: '4px' }}>
                      4. Shop Expenses
                    </span>
                    <div style={{ fontSize: '19px', fontWeight: 800, color: '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>
                      − KES {(financeData?.summary.totalExpenses !== undefined ? financeData.summary.totalExpenses : totalExpensesComputed).toLocaleString()}
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '3px' }}>
                      Rent, electricity, cargo, etc.
                    </span>
                  </div>

                  {/* Step 5: NET TAKE HOME PROFIT */}
                  {(() => {
                    const expTotal = financeData?.summary.totalExpenses !== undefined ? financeData.summary.totalExpenses : totalExpensesComputed
                    const net = financeData?.summary.netProfit !== undefined ? financeData.summary.netProfit : ((financeData?.summary.estimatedProfit || 0) - expTotal)
                    const isProfit = net >= 0
                    return (
                      <div
                        style={{
                          background: isProfit ? '#f0fdf4' : '#fef2f2',
                          padding: '14px',
                          borderRadius: 'var(--radius-md)',
                          border: `1.5px solid ${isProfit ? '#86efac' : '#fca5a5'}`,
                        }}
                      >
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: isProfit ? '#15803d' : '#b91c1c', display: 'block', fontWeight: 800, marginBottom: '4px' }}>
                          5. Net Take-Home
                        </span>
                        <div style={{ fontSize: '20px', fontWeight: 900, color: isProfit ? '#15803d' : '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>
                          KES {net.toLocaleString()}
                        </div>
                        <span style={{ fontSize: '11px', color: isProfit ? '#166534' : '#991b1b', display: 'block', marginTop: '3px', fontWeight: 600 }}>
                          {isProfit ? 'Clean Net Profit' : 'Operating Deficit'}
                        </span>
                      </div>
                    )
                  })()}
                </div>

                {/* Cash Drawer & M-Pesa Till Verification */}
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#64748b' }}>Physical Cash in Drawer:</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: '#0f172a', fontWeight: 700 }}>
                      KES {drawerBreakdown.cash.toLocaleString()}
                    </span>
                    {drawerBreakdown.cashExpenses ? (
                      <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                        (Gross KES {(drawerBreakdown.grossCash || drawerBreakdown.cash).toLocaleString()} − KES {drawerBreakdown.cashExpenses.toLocaleString()} paid out)
                      </span>
                    ) : null}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#64748b' }}>M-Pesa on Till:</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: '#0f172a', fontWeight: 700 }}>
                      KES {drawerBreakdown.mpesa.toLocaleString()}
                    </span>
                    {drawerBreakdown.mpesaExpenses ? (
                      <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                        (Gross KES {(drawerBreakdown.grossMpesa || drawerBreakdown.mpesa).toLocaleString()} − KES {drawerBreakdown.mpesaExpenses.toLocaleString()} paid out)
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Two Column Section: Add Expense Form + Expenses Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '20px', marginBottom: '24px' }}>
                {/* Form: Record New Expense */}
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(91, 26, 62, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        Record Shop Expense
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        Deducts directly from the selected drawer or till
                      </p>
                    </div>
                  </div>

                  {expenseSuccessMsg && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, marginBottom: '14px' }}>
                      {expenseSuccessMsg}
                    </div>
                  )}

                  <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-primary)' }}>
                        Expense Title / Purpose *
                      </label>
                      <input
                        type="text"
                        className="form-group__input"
                        placeholder="e.g. October Shop Rent, Electricity Token, Nairobi Bus Cargo"
                        value={expenseTitle}
                        onChange={e => setExpenseTitle(e.target.value)}
                        required
                        style={{ fontSize: '14px' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-primary)' }}>
                          Amount (KES) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          className="form-group__input"
                          placeholder="e.g. 5000"
                          value={expenseAmount}
                          onChange={e => setExpenseAmount(e.target.value)}
                          required
                          style={{ fontSize: '16px', fontWeight: 700 }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-primary)' }}>
                          Date
                        </label>
                        <input
                          type="date"
                          className="form-group__input"
                          value={expenseDate}
                          onChange={e => setExpenseDate(e.target.value)}
                          style={{ fontSize: '13px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-primary)' }}>
                        Category
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
                        {EXPENSE_CATEGORIES.map(cat => (
                          <button
                            key={cat.key}
                            type="button"
                            onClick={() => setExpenseCategory(cat.key)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: expenseCategory === cat.key ? '1.5px solid var(--color-primary)' : '1px solid #e2e8f0',
                              background: expenseCategory === cat.key ? 'rgba(91, 26, 62, 0.06)' : '#ffffff',
                              color: expenseCategory === cat.key ? 'var(--color-primary)' : '#475569',
                              fontWeight: expenseCategory === cat.key ? 700 : 500,
                              fontSize: '12px',
                              cursor: 'pointer',
                              textAlign: 'center',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <span>{cat.shortLabel || cat.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-primary)' }}>
                        Paid From
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {[
                          { key: 'cash', label: 'Cash Drawer', sub: 'Deducts cash' },
                          { key: 'mpesa', label: 'M-Pesa Till', sub: 'Deducts till' },
                          { key: 'other', label: 'Other / Personal', sub: 'No drawer change' },
                        ].map(m => (
                          <button
                            key={m.key}
                            type="button"
                            onClick={() => setExpensePaymentMethod(m.key as any)}
                            style={{
                              padding: '10px 8px',
                              borderRadius: '8px',
                              border: expensePaymentMethod === m.key ? '1.5px solid var(--color-primary)' : '1px solid #e2e8f0',
                              background: expensePaymentMethod === m.key ? 'rgba(91, 26, 62, 0.06)' : '#ffffff',
                              color: expensePaymentMethod === m.key ? 'var(--color-primary)' : '#475569',
                              fontWeight: expensePaymentMethod === m.key ? 700 : 500,
                              fontSize: '12px',
                              cursor: 'pointer',
                              textAlign: 'center',
                            }}
                          >
                            <div>{m.label}</div>
                            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{m.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-primary)' }}>
                        Notes (Optional)
                      </label>
                      <input
                        type="text"
                        className="form-group__input"
                        placeholder="Receipt voucher # or details..."
                        value={expenseNotes}
                        onChange={e => setExpenseNotes(e.target.value)}
                        style={{ fontSize: '13px' }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingExpense}
                      className="btn btn--primary"
                      style={{ padding: '12px', fontSize: '14px', fontWeight: 700, marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      {isSavingExpense ? 'Saving Expense...' : 'Save Shop Expense'}
                    </button>
                  </form>
                </div>

                {/* Right Column: Category Breakdown & Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ background: '#ffffff', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      Expenses by Category
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {EXPENSE_CATEGORIES.map(cat => {
                        const amt = expensesByCategoryComputed[cat.key] || (financeData?.summary.expensesByCategory?.[cat.key]) || 0
                        const total = totalExpensesComputed || financeData?.summary.totalExpenses || 1
                        const pct = Math.round((amt / (total || 1)) * 100)

                        return (
                          <div key={cat.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                              <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                                {cat.label}
                              </span>
                              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: amt > 0 ? '#b91c1c' : '#94a3b8' }}>
                                KES {amt.toLocaleString()} {amt > 0 ? `(${pct}%)` : ''}
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-primary)', borderRadius: '3px' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                      <span>How this helps at month-end:</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <li>Record any rent, electricity tokens, cargo, or lunches as they happen.</li>
                      <li>Selecting <strong>This Month</strong> immediately tells you if the shop is in profit and by how much.</li>
                      <li>Drawer cash matches real physical notes in your cash drawer at all times.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Recorded Expenses Ledger Table */}
              <div style={{ background: '#ffffff', borderRadius: 'var(--radius-lg)', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                      Recorded Expenses Ledger ({expenses.length})
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                      All operating expenses recorded for this period
                    </p>
                  </div>
                  <strong style={{ fontSize: '16px', color: '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>
                    Total: KES {totalExpensesComputed.toLocaleString()}
                  </strong>
                </div>

                <div className="finance-table-wrapper">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description / Title</th>
                        <th>Category</th>
                        <th>Paid From</th>
                        <th>Notes</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            No expenses recorded for this period. Use the form above to record rent, utilities, transport, or wages.
                          </td>
                        </tr>
                      ) : (
                        expenses.map(exp => {
                          const catInfo = EXPENSE_CATEGORIES.find(c => c.key === exp.category) || { label: exp.category, shortLabel: exp.category }
                          return (
                            <tr key={exp._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ fontSize: '12px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                                {new Date(exp.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td>
                                <strong style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{exp.title}</strong>
                              </td>
                              <td>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  background: '#f1f5f9',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: '#475569',
                                }}>
                                  {catInfo.label}
                                </span>
                              </td>
                              <td>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  background: exp.paymentMethod === 'cash' ? '#f0fdf4' : exp.paymentMethod === 'mpesa' ? '#eff6ff' : '#f8fafc',
                                  color: exp.paymentMethod === 'cash' ? '#16a34a' : exp.paymentMethod === 'mpesa' ? '#2563eb' : '#64748b',
                                  border: `1px solid ${exp.paymentMethod === 'cash' ? '#bbf7d0' : exp.paymentMethod === 'mpesa' ? '#bfdbfe' : '#e2e8f0'}`,
                                }}>
                                  {exp.paymentMethod === 'cash' ? 'Cash Drawer' : exp.paymentMethod === 'mpesa' ? 'M-Pesa Till' : 'Other'}
                                </span>
                              </td>
                              <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                                {exp.notes || '—'}
                              </td>
                              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: '#b91c1c', fontSize: '14px' }}>
                                KES {Number(exp.amount).toLocaleString()}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  disabled={deletingExpenseId === exp._id}
                                  onClick={() => handleDeleteExpense(exp)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#b91c1c',
                                    cursor: 'pointer',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                  }}
                                  title="Delete this expense"
                                >
                                  {deletingExpenseId === exp._id ? (
                                    <span style={{ fontSize: '11px' }}>...</span>
                                  ) : (
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                  )}
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: PRICE MANAGER (CRUD) */}
          {/* ========================================================================= */}
          {activeTab === 'prices' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>Fabric Price Manager (CRUD)</h2>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                    Set, update, or remove prices for any fabric. Blank prices mean the item remains purely quantity-tracked.
                  </p>
                </div>

                <input
                  type="text"
                  className="form-group__input"
                  placeholder="Filter by fabric code..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  style={{ maxWidth: '240px' }}
                />
              </div>

              <div style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                <div className="finance-table-wrapper">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Fabric Code</th>
                        <th>Stock</th>
                        <th>Buying Price (Cost)</th>
                        <th>Selling Price (Retail)</th>
                        <th>Expected Profit</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredColorways.map(cw => {
                        const hasBuying = cw.buyingPrice !== undefined
                        const hasSelling = cw.sellingPrice !== undefined
                        const profit = hasBuying && hasSelling ? cw.sellingPrice! - cw.buyingPrice! : undefined
                        const marginPercent = hasBuying && hasSelling && cw.buyingPrice! > 0
                          ? ((profit! / cw.buyingPrice!) * 100).toFixed(1)
                          : undefined

                        return (
                          <tr key={cw._id}>
                            <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{cw.fullCode}</td>
                            <td>{cw.quantityAvailable} pcs</td>
                            <td style={{ color: hasBuying ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                              {hasBuying ? `KES ${cw.buyingPrice?.toLocaleString()}` : 'Not set'}
                            </td>
                            <td style={{ color: hasSelling ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                              {hasSelling ? `KES ${cw.sellingPrice?.toLocaleString()}` : 'Not set'}
                            </td>
                            <td>
                              {profit !== undefined ? (
                                <span style={{ color: profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                                  {profit >= 0 ? '+' : ''}KES {profit.toLocaleString()} ({marginPercent}%)
                                </span>
                              ) : (
                                <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn--primary"
                                onClick={() => {
                                  setEditingPriceCw(cw)
                                  setEditBuyingPrice(cw.buyingPrice !== undefined ? cw.buyingPrice.toString() : '')
                                  setEditSellingPrice(cw.sellingPrice !== undefined ? cw.sellingPrice.toString() : '')
                                }}
                                style={{
                                  padding: '5px 12px',
                                  fontSize: '11px',
                                  borderRadius: 'var(--radius-sm)',
                                }}
                              >
                                {hasBuying || hasSelling ? 'Edit Price' : '+ Add Price'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Quick Edit/Delete Price Modal */}
      {editingPriceCw && (
        <div className="modal-overlay" onClick={() => setEditingPriceCw(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal__header">
              <h3 className="modal__title" style={{ fontSize: '16px' }}>
                Pricing: {editingPriceCw.fullCode}
              </h3>
              <button className="modal__close-btn" onClick={() => setEditingPriceCw(null)} type="button">
                ✕
              </button>
            </div>

            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Buying Price / Cost (KES)
                </label>
                <input
                  type="number"
                  className="form-group__input"
                  placeholder="e.g. 1500 (Leave blank for none)"
                  min="0"
                  value={editBuyingPrice}
                  onChange={e => setEditBuyingPrice(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Selling Price / Retail (KES)
                </label>
                <input
                  type="number"
                  className="form-group__input"
                  placeholder="e.g. 2200 (Leave blank for none)"
                  min="0"
                  value={editSellingPrice}
                  onChange={e => setEditSellingPrice(e.target.value)}
                />
              </div>

              {(editBuyingPrice || editSellingPrice) && (
                <button
                  type="button"
                  onClick={() => {
                    setEditBuyingPrice('')
                    setEditSellingPrice('')
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-danger)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    textAlign: 'left',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Clear / Remove All Prices
                </button>
              )}
            </div>

            <div className="modal__footer">
              <button
                className="btn btn--secondary"
                onClick={() => setEditingPriceCw(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={handleSavePrice}
                disabled={isSavingPrice}
                type="button"
              >
                {isSavingPrice ? 'Saving...' : 'Save Price'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Luxury Boutique Invoice / Receipt Modal */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={() => handleSelectInvoice(null)} style={{ backdropFilter: 'blur(6px)', background: 'rgba(30, 8, 20, 0.7)' }}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 'min(94vw, 500px)',
              width: '100%',
              padding: 0,
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-xl)',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
            }}
          >
            {/* Brand Theme Header */}
            <div
              style={{
                background: 'linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%)',
                color: '#FFFFFF',
                padding: '22px 20px 18px',
                textAlign: 'center',
                position: 'relative',
                borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              <button
                type="button"
                onClick={() => handleSelectInvoice(null)}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '14px',
                  background: 'rgba(255,255,255,0.18)',
                  border: 'none',
                  color: '#FFFFFF',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  fontSize: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                ✕
              </button>

              <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', fontWeight: 700, marginBottom: '4px' }}>
                OFFICIAL BOUTIQUE RECEIPT
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '0.3px' }}>
                MANDERA AFRICAN WEAR
              </h2>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', margin: '4px 0 0' }}>
                Authentic African Fabrics & Specialist Prints • Mandera Town
              </p>
            </div>

            {/* Receipt Metadata Ribbon */}
            <div
              style={{
                background: 'var(--color-bg-hover)',
                padding: '12px 18px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '12px',
              }}
            >
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Receipt / Invoice</span>
                <strong style={{ color: 'var(--color-primary)', fontSize: '13px' }}>{selectedInvoice.invoiceNumber}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date & Time</span>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                  {new Date(selectedInvoice.createdAt).toLocaleDateString()} {new Date(selectedInvoice.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment</span>
                <span
                  style={{
                    background: selectedInvoice.paymentMethod === 'credit' ? 'rgba(198, 40, 40, 0.1)' : 'rgba(91, 26, 62, 0.08)',
                    color: selectedInvoice.paymentMethod === 'credit' ? 'var(--color-danger)' : 'var(--color-primary)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  {selectedInvoice.paymentMethod || 'CASH'}
                </span>
              </div>
            </div>

            {/* Receipt Body */}
            <div style={{ padding: '18px 20px', maxHeight: '65vh', overflowY: 'auto' }}>
              {selectedInvoice.customerName && (
                <div style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '14px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <span>Customer: <strong style={{ color: 'var(--color-text-primary)' }}>{selectedInvoice.customerName}</strong></span>
                  {selectedInvoice.customerPhone && (
                    <span style={{ color: 'var(--color-text-secondary)' }}>Phone: {selectedInvoice.customerPhone}</span>
                  )}
                </div>
              )}

              {/* Items Table */}
              <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '8px 4px' }}>Fabric Item</th>
                      <th style={{ padding: '8px 4px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '8px 4px', textAlign: 'right' }}>Unit Price</th>
                      <th style={{ padding: '8px 4px', textAlign: 'right' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '10px 4px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.fullCode}</div>
                          {item.subVariantLabel && (
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{item.subVariantLabel}</div>
                          )}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                          {item.quantity} pc{item.quantity > 1 ? 's' : ''}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                          KES {item.unitPrice.toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                          KES {item.subtotal.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  color: '#FFFFFF',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '18px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: selectedInvoice.paymentMethod === 'credit' ? '#fca5a5' : 'rgba(255,255,255,0.85)', display: 'block', fontWeight: 700 }}>
                    {selectedInvoice.paymentMethod === 'credit' ? 'UNPAID BALANCE (DEYN)' : 'TOTAL AMOUNT'}
                  </span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
                    {selectedInvoice.items.reduce((acc, i) => acc + i.quantity, 0)} total fabric pieces
                  </span>
                </div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                  KES {selectedInvoice.totalAmount.toLocaleString()}
                </div>
              </div>

              {/* Credit Settle Buttons */}
              {selectedInvoice.paymentMethod === 'credit' && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  marginBottom: '18px',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#b91c1c', marginBottom: '6px' }}>
                    Unpaid Credit Balance: KES {selectedInvoice.totalAmount.toLocaleString()}
                  </div>
                  <p style={{ fontSize: '11px', color: '#475569', margin: '0 0 10px' }}>
                    Customer took this on credit (Deyn). Settle now when payment is received:
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: '8px' }}>
                    <button
                      type="button"
                      disabled={isUpdatingPayment === selectedInvoice._id}
                      onClick={() => handleMarkInvoicePaid(selectedInvoice._id, 'cash')}
                      style={{
                        background: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        padding: '9px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Settle via Cash
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingPayment === selectedInvoice._id}
                      onClick={() => handleMarkInvoicePaid(selectedInvoice._id, 'mpesa')}
                      style={{
                        background: 'var(--color-primary)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        padding: '9px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Settle via M-Pesa
                    </button>
                  </div>
                </div>
              )}

              {/* Interactive WhatsApp Sender Section */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#128C7E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                      Send Receipt via WhatsApp
                    </h4>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Enter customer mobile number to open direct WhatsApp chat
                    </span>
                  </div>
                </div>

                {/* Styled Kenyan Phone Input */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0 10px',
                      flex: '1 1 200px',
                      minWidth: 0,
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginRight: '8px' }}>
                      +254
                    </span>
                    <input
                      type="tel"
                      placeholder="e.g. 0725 996 394"
                      value={modalPhone}
                      onChange={e => setModalPhone(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleSendWhatsApp()
                        }
                      }}
                      style={{
                        border: 'none',
                        outline: 'none',
                        width: '100%',
                        padding: '9px 0',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        background: 'transparent',
                      }}
                    />
                    {modalPhone.trim() && (
                      <button
                        type="button"
                        onClick={() => setModalPhone('')}
                        style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    style={{
                      background: '#128C7E',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      padding: '9px 16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      flex: '1 1 auto',
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span>Send WhatsApp</span>
                  </button>
                </div>

                {/* Live Kenyan Phone Helper */}
                <div style={{ marginTop: '8px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                  {isValidKenyanPhone(modalPhone) ? (
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>
                      Ready for {formatKenyanPhoneDisplay(modalPhone)}
                    </span>
                  ) : modalPhone.trim() ? (
                    <span style={{ color: '#475569' }}>
                      Type full 9 or 10 digits (e.g. 0725996394)
                    </span>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>
                      Type Kenyan number starting with 07, 01, 7, or +254
                    </span>
                  )}
                  <span style={{ color: '#94a3b8', fontSize: '10px' }}>Press Enter</span>
                </div>

                {/* Instant Fallback Link */}
                {lastWaUrl && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '8px 12px',
                      background: '#f0fdf4',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid #bbf7d0',
                      fontSize: '12px',
                      color: '#166534',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '2px' }}>WhatsApp link ready!</div>
                    <div>
                      If the chat did not open automatically,{' '}
                      <a
                        href={lastWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#047857', fontWeight: 700, textDecoration: 'underline' }}
                      >
                        Click here to open WhatsApp directly
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons: PDF & Print */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '10px', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => generateInvoicePdf(selectedInvoice)}
                  className="btn btn--primary"
                  style={{
                    padding: '10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                  <span>Download PDF Invoice</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    background: '#ffffff',
                    color: 'var(--color-primary)',
                    border: '1px solid var(--color-primary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"/>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                    <rect width="12" height="8" x="6" y="14"/>
                  </svg>
                  <span>Print Counter Slip</span>
                </button>
              </div>

              {/* Void Sale / Delete Action */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  disabled={isVoidingInvoice}
                  onClick={handleVoidInvoice}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#b91c1c',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <span>{isVoidingInvoice ? 'Voiding transaction...' : 'Void / Cancel this Sale (Restores Stock)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectInvoice(null)}
                  className="btn btn--secondary"
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
