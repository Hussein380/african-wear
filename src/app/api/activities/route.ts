import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { shopDayBoundary } from '@/lib/stockRules'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '15', 10)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const soldOnly = searchParams.get('sold') === '1'
    
    if (page < 1 || limit < 1) {
      return NextResponse.json({ error: 'Invalid pagination parameters' }, { status: 400 })
    }

    const skip = (page - 1) * limit

    const db = await getDb()
    
    const query: any = {}

    if (soldOnly) {
      // Sales only: stock removed and tagged as sold (older rows have no kind and count as sold)
      query.type = 'OUT'
      query.$or = [{ kind: 'sold' }, { kind: { $exists: false } }]
    }
    
    if (startDate || endDate) {
      query.timestamp = {}
      if (startDate) {
        query.timestamp.$gte = shopDayBoundary(startDate, false).toISOString()
      }
      if (endDate) {
        query.timestamp.$lte = shopDayBoundary(endDate, true).toISOString()
      }
    }
    
    const activities = await db.collection('activities')
      .find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()

    const totalCount = await db.collection('activities').countDocuments(query)

    // For the Sales page: attach the receipt each sale belongs to, if any
    if (soldOnly) {
      const ids = [...new Set(activities.map(a => a.invoiceId).filter(Boolean).map(String))]
      const objectIds = ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id))
      const invoices = objectIds.length
        ? await db.collection('invoices')
            .find({ _id: { $in: objectIds } }, { projection: { invoiceNumber: 1, customerName: 1, totalAmount: 1 } })
            .toArray()
        : []
      const byId = new Map(invoices.map(inv => [inv._id.toString(), inv]))
      for (const a of activities) {
        const inv = a.invoiceId ? byId.get(String(a.invoiceId)) : undefined
        if (inv) {
          a.receipt = {
            _id: inv._id.toString(),
            invoiceNumber: inv.invoiceNumber,
            customerName: inv.customerName,
            totalAmount: inv.totalAmount,
          }
        }
      }
    }

    return NextResponse.json({
      activities,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching activities:', error)
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') // 'all' | 'older'
    const days = parseInt(searchParams.get('days') || '30', 10)

    const db = await getDb()
    let query: any = {}

    if (mode === 'older') {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days)
      query = {
        timestamp: { $lt: cutoff.toISOString() },
        $or: [
          { invoiceId: { $exists: false } },
          { invoiceId: null },
          { invoiceId: '' },
        ],
      }
    } else if (mode === 'all') {
      query = {
        $or: [
          { invoiceId: { $exists: false } },
          { invoiceId: null },
          { invoiceId: '' },
        ],
      }
    } else {
      return NextResponse.json({ error: 'Invalid mode. Use mode=all or mode=older&days=N' }, { status: 400 })
    }

    const result = await db.collection('activities').deleteMany(query)

    return NextResponse.json({ 
      success: true, 
      deletedCount: result.deletedCount,
      message: mode === 'all' 
        ? `Deleted ${result.deletedCount} un-invoiced history records (financial audit records preserved)`
        : `Deleted ${result.deletedCount} un-invoiced records older than ${days} days`
    })
  } catch (error) {
    console.error('Error deleting activities:', error)
    return NextResponse.json({ error: 'Failed to delete history' }, { status: 500 })
  }
}
