import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import { getAdminFirestore, verifyIdToken } from '@/lib/firebase-admin'

const DAILY_BONUS_AMOUNT = 5

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
    const db = getAdminFirestore()
    
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const today = new Date().toISOString().split('T')[0]
    
    // Check if already claimed today
    const bonusRef = db.collection('dailyBonus').doc(uid)
    const bonusDoc = await bonusRef.get()
    
    if (bonusDoc.exists && bonusDoc.data()?.lastClaimDate === today) {
      return NextResponse.json({ 
        error: 'Already claimed today',
        canClaim: false 
      }, { status: 400 })
    }

    // Use transaction for atomic update
    await db.runTransaction(async (transaction) => {
      const profileRef = db.collection('profiles').doc(uid)
      
      // Update profile coins
      transaction.update(profileRef, {
        coins: admin.firestore.FieldValue.increment(DAILY_BONUS_AMOUNT)
      })
      
      // Update bonus record
      const previousTotal = bonusDoc.exists ? (bonusDoc.data()?.totalClaimed || 0) : 0
      transaction.set(bonusRef, {
        lastClaimDate: today,
        totalClaimed: previousTotal + DAILY_BONUS_AMOUNT,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      })
    })

    return NextResponse.json({ 
      success: true, 
      message: `Daily bonus claimed: +${DAILY_BONUS_AMOUNT} coins!`,
      bonusAmount: DAILY_BONUS_AMOUNT,
      canClaim: false
    })

  } catch (error) {
    console.error('Daily bonus API error:', error)
    return NextResponse.json({ 
      error: 'Failed to claim daily bonus',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
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
    const db = getAdminFirestore()
    
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const today = new Date().toISOString().split('T')[0]
    const bonusRef = db.collection('dailyBonus').doc(uid)
    const bonusDoc = await bonusRef.get()

    if (bonusDoc.exists) {
      const data = bonusDoc.data()
      const canClaim = data?.lastClaimDate !== today
      
      return NextResponse.json({
        canClaim,
        lastClaimDate: data?.lastClaimDate || null,
        totalClaimed: data?.totalClaimed || 0
      })
    }

    return NextResponse.json({
      canClaim: true,
      lastClaimDate: null,
      totalClaimed: 0
    })

  } catch (error) {
    console.error('Daily bonus check API error:', error)
    return NextResponse.json({ 
      error: 'Failed to check daily bonus status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
