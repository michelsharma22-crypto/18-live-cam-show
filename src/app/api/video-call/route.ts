import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import { getAdminFirestore, verifyIdToken } from '@/lib/firebase-admin'

const PREMIUM_VIDEO_CALL_RATE = 2800

interface VideoCallRequest {
  hostUid: string
  minutes: number
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

    const callerUid = decodedToken.uid
    const body: VideoCallRequest = await request.json()
    const { hostUid, minutes } = body

    if (!hostUid || !minutes || minutes <= 0) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    if (callerUid === hostUid) {
      return NextResponse.json({ error: 'Cannot call yourself' }, { status: 400 })
    }

    const totalCoins = minutes * PREMIUM_VIDEO_CALL_RATE
    const hostEarnings = Math.floor(totalCoins * 0.9) // 90% to host

    const db = getAdminFirestore()
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    // Get caller's profile
    const callerRef = db.collection('profiles').doc(callerUid)
    const callerDoc = await callerRef.get()
    
    if (!callerDoc.exists) {
      return NextResponse.json({ error: 'Caller profile not found' }, { status: 404 })
    }

    const callerData = callerDoc.data()
    if (!callerData || callerData.coins < totalCoins) {
      return NextResponse.json({ 
        error: 'Insufficient coins',
        required: totalCoins,
        current: callerData?.coins || 0
      }, { status: 400 })
    }

    // Get host's profile
    const hostRef = db.collection('profiles').doc(hostUid)
    const hostDoc = await hostRef.get()
    
    if (!hostDoc.exists) {
      return NextResponse.json({ error: 'Host profile not found' }, { status: 404 })
    }

    // Deduct from caller and add to host
    await db.runTransaction(async (transaction) => {
      transaction.update(callerRef, {
        coins: admin.firestore.FieldValue.increment(-totalCoins)
      })
      
      transaction.update(hostRef, {
        coins: admin.firestore.FieldValue.increment(hostEarnings)
      })
    })

    return NextResponse.json({ 
      success: true, 
      message: `${totalCoins} coins deducted for ${minutes} minute(s)`,
      coinsDeducted: totalCoins,
      hostEarnings,
      minutes
    })

  } catch (error) {
    console.error('Video call API error:', error)
    return NextResponse.json({ 
      error: 'Failed to process video call',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
