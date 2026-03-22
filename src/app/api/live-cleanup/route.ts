import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseDb } from '@/lib/firebase'
import { doc, updateDoc, Timestamp } from 'firebase/firestore'

// Live cleanup endpoint for sendBeacon
// Called when a host's browser closes unexpectedly
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { uid, action } = body

    if (action !== 'endLive' || !uid) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const db = getFirebaseDb()
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    // Set islive to false and clear heartbeat
    await updateDoc(doc(db, 'profiles', uid), {
      islive: false,
      liveHeartbeat: null,
      lastSeen: Timestamp.now()
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Live cleanup error:', error)
    return NextResponse.json({ 
      error: 'Cleanup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
