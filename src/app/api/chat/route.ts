import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore, verifyIdToken } from '@/lib/firebase-admin'

interface ChatMessageRequest {
  chatId: string
  text: string
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
    const body: ChatMessageRequest = await request.json()
    const { chatId, text } = body

    if (!chatId || !text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid message data' }, { status: 400 })
    }

    if (text.length > 500) {
      return NextResponse.json({ error: 'Message too long (max 500 characters)' }, { status: 400 })
    }

    const db = getAdminFirestore()
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    // Get user profile for name and photo
    const profileDoc = await db.collection('profiles').doc(uid).get()
    const profileData = profileDoc.exists ? profileDoc.data() : null

    const messageRef = db.collection('livechats').doc(chatId).collection('messages').doc()
    await messageRef.set({
      id: messageRef.id,
      text: text.trim(),
      sender: uid,
      senderName: profileData?.displayName || 'Anonymous',
      senderPhoto: profileData?.photoURL || '',
      timestamp: Date.now()
    })

    return NextResponse.json({ 
      success: true, 
      messageId: messageRef.id 
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ 
      error: 'Failed to send message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
