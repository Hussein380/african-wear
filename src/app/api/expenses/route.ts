import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { startOfShopDay, shopDaysAgo } from '@/lib/stockRules'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'month'
    const customStart = searchParams.get('startDate')
    const customEnd = searchParams.get('endDate')

    const now = new Date()
    let startDate: Date

    if (customStart) {
      startDate = new Date(customStart)
    } else if (range === 'today') {
      startDate = startOfShopDay(now)
    } else if (range === 'week') {
      startDate = shopDaysAgo(7)
    } else if (range === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1)
    } else if (range === 'all') {
      startDate = new Date(2020, 0, 1)
    } else {
      // Default: this month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const endDate = customEnd ? new Date(customEnd) : now
    endDate.setHours(23, 59, 59, 999)

    const db = await getDb()
    const expensesColl = db.collection('expenses')

    const startIso = startDate.toISOString()
    const endIso = endDate.toISOString()

    const expenses = await expensesColl
      .find({
        date: {
          $gte: startIso,
          $lte: endIso,
        },
      })
      .sort({ date: -1, createdAt: -1 })
      .toArray()

    let totalExpenses = 0
    const byCategory: Record<string, number> = {
      rent: 0,
      utilities: 0,
      wages: 0,
      transport: 0,
      packaging: 0,
      food: 0,
      maintenance: 0,
      other: 0,
    }

    const byPaymentMethod: Record<string, number> = {
      cash: 0,
      mpesa: 0,
      other: 0,
    }

    const formattedExpenses = expenses.map(exp => {
      const amt = Number(exp.amount) || 0
      totalExpenses += amt

      const cat = exp.category || 'other'
      if (byCategory[cat] !== undefined) {
        byCategory[cat] += amt
      } else {
        byCategory[cat] = amt
      }

      const pm = exp.paymentMethod || 'cash'
      if (byPaymentMethod[pm] !== undefined) {
        byPaymentMethod[pm] += amt
      } else {
        byPaymentMethod[pm] = amt
      }

      return {
        _id: exp._id.toString(),
        title: exp.title,
        amount: amt,
        category: exp.category,
        paymentMethod: exp.paymentMethod,
        notes: exp.notes || '',
        date: exp.date,
        createdAt: exp.createdAt,
      }
    })

    return NextResponse.json({
      period: {
        range,
        startDate: startIso,
        endDate: endIso,
      },
      expenses: formattedExpenses,
      totalExpenses,
      byCategory,
      byPaymentMethod,
    })
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, amount, category, paymentMethod, notes, date } = body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Expense title is required' }, { status: 400 })
    }

    const parsedAmount = Number(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Valid expense amount greater than 0 is required' }, { status: 400 })
    }

    const validCategories = ['rent', 'utilities', 'wages', 'transport', 'packaging', 'food', 'maintenance', 'other']
    const selectedCategory = validCategories.includes(category) ? category : 'other'

    const validMethods = ['cash', 'mpesa', 'other']
    const selectedMethod = validMethods.includes(paymentMethod) ? paymentMethod : 'cash'

    const expenseDate = date ? new Date(date).toISOString() : new Date().toISOString()
    const nowIso = new Date().toISOString()

    const newExpense = {
      title: title.trim(),
      amount: parsedAmount,
      category: selectedCategory,
      paymentMethod: selectedMethod,
      notes: notes ? String(notes).trim() : '',
      date: expenseDate,
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    const db = await getDb()
    const result = await db.collection('expenses').insertOne(newExpense)

    return NextResponse.json({
      success: true,
      expense: {
        _id: result.insertedId.toString(),
        ...newExpense,
      },
    })
  } catch (error) {
    console.error('Error creating expense:', error)
    return NextResponse.json({ error: 'Failed to record expense' }, { status: 500 })
  }
}
