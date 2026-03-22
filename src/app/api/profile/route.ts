import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import { getAdminFirestore, verifyIdToken, isAdminUser } from '@/lib/firebase-admin'

interface ProfileUpdateRequest {
  displayName?: string
  bio?: string
  age?: number
  country?: string
  city?: string
  phone?: string
  gender?: string
  birthday?: string
  language?: string
  photoURL?: string
}

interface CoinsUpdateRequest {
  coins: number
  targetUid?: string
}

// Update profile
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

    const uid = decodedToken.uid
    const body: ProfileUpdateRequest = await request.json()

    const db = getAdminFirestore()
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    // Prepare update data (only allowed fields)
    const updateData: Record<string, unknown> = {}
    const allowedFields = ['displayName', 'bio', 'age', 'country', 'city', 'phone', 'gender', 'birthday', 'language', 'photoURL']
    
    for (const field of allowedFields) {
      if (body[field as keyof ProfileUpdateRequest] !== undefined) {
        updateData[field] = body[field as keyof ProfileUpdateRequest]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const profileRef = db.collection('profiles').doc(uid)
    await profileRef.update(updateData)

    return NextResponse.json({ 
      success: true, 
      message: 'Profile updated successfully',
      updatedFields: Object.keys(updateData)
    })

  } catch (error) {
    console.error('Profile update API error:', error)
    return NextResponse.json({ 
      error: 'Failed to update profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Add coins (for PayPal purchases) - Admin or self with verification
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
    const body: CoinsUpdateRequest = await request.json()
    const { coins, targetUid } = body

    if (!coins || coins <= 0) {
      return NextResponse.json({ error: 'Invalid coins amount' }, { status: 400 })
    }

    // Determine target user
    const targetUserId = targetUid || uid

    // Only admins can add coins to other users
    if (targetUid && targetUid !== uid && !isAdminUser(decodedToken.uid, decodedToken.email)) {
      return NextResponse.json({ error: 'Admin access required to add coins to other users' }, { status: 403 })
    }

    const db = getAdminFirestore()
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const profileRef = db.collection('profiles').doc(targetUserId)
    await profileRef.update({
      coins: admin.firestore.FieldValue.increment(coins)
    })

    return NextResponse.json({ 
      success: true, 
      message: `${coins} coins added successfully`,
      coinsAdded: coins
    })

  } catch (error) {
    console.error('Coins add API error:', error)
    return NextResponse.json({ 
      error: 'Failed to add coins',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Update online status
export async function PUT(request: NextRequest) {
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
    const body = await request.json()
    const { isOnline, isLive } = body

    const db = getAdminFirestore()
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const updateData: Record<string, unknown> = {
      lastSeen: admin.firestore.FieldValue.serverTimestamp()
    }

    if (typeof isOnline === 'boolean') {
      updateData.isOnline = isOnline
    }

    if (typeof isLive === 'boolean') {
      updateData.islive = isLive
    }

    const profileRef = db.collection('profiles').doc(uid)
    await profileRef.update(updateData)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Status update API error:', error)
    return NextResponse.json({ 
      error: 'Failed to update status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
