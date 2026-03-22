import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import { getAdminFirestore, verifyIdToken } from '@/lib/firebase-admin'

interface GiftRequest {
  hostUid: string
  giftCost: number
  giftEmoji: string
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

    const senderUid = decodedToken.uid
    const body: GiftRequest = await request.json()
    const { hostUid, giftCost } = body

    if (!hostUid || !giftCost || giftCost <= 0) {
      return NextResponse.json({ error: 'Invalid gift data' }, { status: 400 })
    }

    if (senderUid === hostUid) {
      return NextResponse.json({ error: 'Cannot send gift to yourself' }, { status: 400 })
    }

    const db = getAdminFirestore()
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    // Get sender's profile
    const senderRef = db.collection('profiles').doc(senderUid)
    const senderDoc = await senderRef.get()
    
    if (!senderDoc.exists) {
      return NextResponse.json({ error: 'Sender profile not found' }, { status: 404 })
    }

    const senderData = senderDoc.data()
    if (!senderData || senderData.coins < giftCost) {
      return NextResponse.json({ error: 'Insufficient coins' }, { status: 400 })
    }

    // Get host's profile
    const hostRef = db.collection('profiles').doc(hostUid)
    const hostDoc = await hostRef.get()
    
    if (!hostDoc.exists) {
      return NextResponse.json({ error: 'Host profile not found' }, { status: 404 })
    }

    // Use transaction to ensure atomicity
    await db.runTransaction(async (transaction) => {
      transaction.update(senderRef, {
        coins: admin.firestore.FieldValue.increment(-giftCost)
      })
      
      transaction.update(hostRef, {
        coins: admin.firestore.FieldValue.increment(giftCost)
      })
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Gift sent successfully!',
      coinsDeducted: giftCost 
    })

  } catch (error) {
    console.error('Gift API error:', error)
    return NextResponse.json({ 
      error: 'Failed to send gift',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
