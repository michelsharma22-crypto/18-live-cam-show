import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import { getAdminFirestore, verifyIdToken, isAdminUser } from '@/lib/firebase-admin'

const WITHDRAW_RATE = 1500
const MIN_WITHDRAW_COINS = 15000

interface WithdrawRequest {
  paypalEmail: string
}

interface WithdrawalUpdateRequest {
  withdrawalId: string
  status: 'approved' | 'rejected'
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await verifyIdToken(idToken)
    
    if (!decodedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const uid = decodedToken.uid
    const body: WithdrawRequest = await request.json()
    const { paypalEmail } = body

    if (!paypalEmail || !paypalEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid PayPal email required' }, { status: 400 })
    }

    const db = getAdminFirestore()
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    // Get user profile
    const profileRef = db.collection('profiles').doc(uid)
    const profileDoc = await profileRef.get()
    
    if (!profileDoc.exists) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const profileData = profileDoc.data()
    
    // Check minimum coins
    if (!profileData || profileData.coins < MIN_WITHDRAW_COINS) {
      return NextResponse.json({ 
        error: `Minimum ${MIN_WITHDRAW_COINS} coins required`,
        minCoins: MIN_WITHDRAW_COINS 
      }, { status: 400 })
    }

    // Check if user has purchased before (isPremium or hasUsedFirstTimeOffer)
    if (!profileData.isPremium && !profileData.hasUsedFirstTimeOffer) {
      return NextResponse.json({ 
        error: 'Please purchase a package first before withdrawing'
      }, { status: 400 })
    }

    const coinsToWithdraw = profileData.coins
    const dollarAmount = (coinsToWithdraw / WITHDRAW_RATE).toFixed(2)

    // Create withdrawal request and reset coins atomically
    await db.runTransaction(async (transaction) => {
      // Reset user coins to 0
      transaction.update(profileRef, {
        coins: 0
      })
      
      // Create withdrawal record
      const withdrawalRef = db.collection('withdrawals').doc()
      transaction.set(withdrawalRef, {
        uid,
        displayName: profileData.displayName,
        email: profileData.email,
        paypalEmail,
        amountInDollars: `$${dollarAmount}`,
        coinsRedeemed: coinsToWithdraw,
        status: 'pending',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      })
    })

    return NextResponse.json({ 
      success: true, 
      message: `Withdrawal request created for $${dollarAmount}`,
      amount: dollarAmount,
      coinsRedeemed: coinsToWithdraw
    })

  } catch (error) {
    console.error('Withdraw API error:', error)
    return NextResponse.json({ 
      error: 'Failed to create withdrawal request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Admin: Update withdrawal status
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await verifyIdToken(idToken)
    
    if (!decodedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check if admin
    if (!isAdminUser(decodedToken.uid, decodedToken.email)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body: WithdrawalUpdateRequest = await request.json()
    const { withdrawalId, status } = body

    if (!withdrawalId || !status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const db = getAdminFirestore()
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const withdrawalRef = db.collection('withdrawals').doc(withdrawalId)
    await withdrawalRef.update({
      status,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      processedBy: decodedToken.uid
    })

    return NextResponse.json({ 
      success: true, 
      message: `Withdrawal ${status}` 
    })

  } catch (error) {
    console.error('Withdrawal update API error:', error)
    return NextResponse.json({ 
      error: 'Failed to update withdrawal',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
