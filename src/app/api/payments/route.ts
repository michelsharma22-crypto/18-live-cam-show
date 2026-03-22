import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseDb } from '@/lib/firebase'
import { Timestamp, collection, addDoc, getDocs, query, where, orderBy, limit, doc, updateDoc } from 'firebase/firestore'

// GET - Fetch payment history
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const uid = searchParams.get('uid')
    const admin = searchParams.get('admin')
    const pageLimit = parseInt(searchParams.get('limit') || '50')

    const db = getFirebaseDb()
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const payments: unknown[] = []

    if (admin === 'true') {
      // Admin - get all payments
      const paymentsRef = collection(db, 'payments')
      const q = query(paymentsRef, orderBy('createdAt', 'desc'), limit(pageLimit))
      const snapshot = await getDocs(q)
      
      snapshot.forEach((d) => {
        payments.push({ id: d.id, ...d.data() })
      })
    } else if (uid) {
      // Get user's payment history
      const paymentsRef = collection(db, 'payments')
      const q = query(
        paymentsRef,
        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(pageLimit)
      )
      const snapshot = await getDocs(q)
      
      snapshot.forEach((d) => {
        payments.push({ id: d.id, ...d.data() })
      })
    } else {
      return NextResponse.json({ error: 'Missing uid or admin parameter' }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      payments,
      count: payments.length 
    })

  } catch (error) {
    console.error('Payment fetch error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch payments',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST - Create new payment record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      uid, 
      displayName, 
      email,
      amount, 
      coins, 
      paymentMethod,
      paypalOrderId,
      paypalTransactionId,
      status = 'completed'
    } = body

    // Validate required fields
    if (!uid || !amount || !coins) {
      return NextResponse.json({ 
        error: 'Missing required fields: uid, amount, coins' 
      }, { status: 400 })
    }

    const db = getFirebaseDb()
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    // Create payment record
    const paymentData = {
      uid,
      displayName: displayName || 'Unknown',
      email: email || '',
      amount: parseFloat(amount),
      coins: parseInt(coins),
      currency: 'USD',
      paymentMethod: paymentMethod || 'paypal',
      paypalOrderId: paypalOrderId || '',
      paypalTransactionId: paypalTransactionId || '',
      status,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    }

    const docRef = await addDoc(collection(db, 'payments'), paymentData)

    return NextResponse.json({ 
      success: true, 
      paymentId: docRef.id,
      message: 'Payment recorded successfully'
    })

  } catch (error) {
    console.error('Payment creation error:', error)
    return NextResponse.json({ 
      error: 'Failed to create payment record',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PUT - Update payment status
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { paymentId, status, paypalTransactionId } = body

    if (!paymentId || !status) {
      return NextResponse.json({ 
        error: 'Missing paymentId or status' 
      }, { status: 400 })
    }

    const db = getFirebaseDb()
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }
    
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: Timestamp.now()
    }

    if (paypalTransactionId) {
      updateData.paypalTransactionId = paypalTransactionId
    }

    await updateDoc(doc(db, 'payments', paymentId), updateData)

    return NextResponse.json({ 
      success: true, 
      message: 'Payment updated successfully' 
    })

  } catch (error) {
    console.error('Payment update error:', error)
    return NextResponse.json({ 
      error: 'Failed to update payment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
