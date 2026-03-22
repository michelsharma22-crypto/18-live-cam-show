import { NextRequest, NextResponse } from 'next/server'

// PayPal API Configuration
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET
const PAYPAL_API_BASE = 'https://api-m.paypal.com' // Live API

// Get PayPal Access Token
async function getAccessToken(): Promise<string | null> {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    console.error('PayPal credentials not configured')
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
    
    if (data.access_token) {
      return data.access_token
    }
    
    console.error('Failed to get PayPal access token:', data)
    return null
  } catch (error) {
    console.error('PayPal auth error:', error)
    return null
  }
}

// POST - Create PayPal Order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, description, coins } = body

    // Validate input
    if (!amount || isNaN(parseFloat(amount))) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    if (!PAYPAL_CLIENT_ID) {
      return NextResponse.json(
        { error: 'PayPal not configured' },
        { status: 500 }
      )
    }

    // Get access token
    const accessToken = await getAccessToken()
    
    if (!accessToken) {
      // Return a flag to use client-side fallback
      return NextResponse.json({
        useClientFallback: true,
        message: 'Using client-side order creation'
      })
    }

    // Create order with PayPal API
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: parseFloat(amount).toFixed(2)
        },
        description: description || `${coins} coins purchase`,
        custom_id: `coins_${coins}_${Date.now()}`
      }],
      application_context: {
        brand_name: 'LiveStream',
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING'
      }
    }

    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },
      body: JSON.stringify(orderData)
    })

    const order = await response.json()

    if (response.ok && order.id) {
      return NextResponse.json({
        success: true,
        orderId: order.id,
        status: order.status
      })
    } else {
      console.error('PayPal order creation failed:', order)
      
      // Return fallback flag
      return NextResponse.json({
        useClientFallback: true,
        message: 'Using client-side order creation',
        error: order.message || 'Order creation failed'
      })
    }
  } catch (error) {
    console.error('Create order error:', error)
    
    return NextResponse.json({
      useClientFallback: true,
      message: 'Using client-side order creation'
    })
  }
}
