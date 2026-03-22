import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseDb } from '@/lib/firebase'
import { doc, updateDoc, increment } from 'firebase/firestore'

// PayPal API Configuration
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET
const PAYPAL_API_BASE = 'https://api-m.paypal.com' // Live API

// Get PayPal Access Token
async function getAccessToken(): Promise<string | null> {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    return null
  }

  try {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')
    
    const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    const data = await response.json()
    return data.access_token || null
  } catch (error) {
    console.error('PayPal auth error:', error)
    return null
  }
}

// POST - Capture PayPal Order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderID, coins, uid, isOffer } = body

    // Validate input
    if (!orderID || !coins || !uid) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get access token
    const accessToken = await getAccessToken()

    if (!accessToken) {
      // Return fallback - client will capture
      return NextResponse.json({
        useClientFallback: true,
        message: 'Use client-side capture'
      })
    }

    // Capture the order
    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      }
    })

    const captureResult = await response.json()

    if (response.ok && captureResult.status === 'COMPLETED') {
      // Payment successful - update user coins
      const db = getFirebaseDb()
      if (db) {
        const updateData: Record<string, unknown> = { 
          coins: increment(coins)
        }
        if (isOffer) {
          updateData.hasUsedFirstTimeOffer = true
        }
        
        await updateDoc(doc(db, 'profiles', uid), updateData)
        
        // Log transaction
        console.log(`✅ Payment captured: ${coins} coins for user ${uid}`)
        
        return NextResponse.json({
          success: true,
          status: 'COMPLETED',
          coins: coins,
          transactionId: captureResult.id
        })
      }
    } else {
      console.error('PayPal capture failed:', captureResult)
      
      return NextResponse.json({
        success: false,
        status: captureResult.status || 'FAILED',
        error: captureResult.message || 'Capture failed'
      })
    }
  } catch (error) {
    console.error('Capture order error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// GET - Check PayPal configuration
export async function GET() {
  return NextResponse.json({
    configured: !!PAYPAL_CLIENT_ID,
    hasSecret: !!PAYPAL_CLIENT_SECRET
  })
}
