import { NextRequest, NextResponse } from 'next/server'

// ===========================================
// OxaPay API Configuration
// ===========================================
// Merchant Key - Use for generating payment requests/Top Ups
const OXAPAY_MERCHANT_KEY = process.env.OXAPAY_MERCHANT_KEY || 'NWWDFT-WOUARY-YTVKMH-HSWAJW'

// API Key - Use for status checks and admin-related tasks  
const OXAPAY_API_KEY = process.env.OXAPAY_API_KEY || 'FB15BH-N6MHUV-7BDCX7-YMQKJR'

// USDT Direct System API Key
const USDT_API_KEY = process.env.USDT_API_KEY || 'Rl3kI0BbXhkTpQUM'

// App URL for callbacks
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://18-live-cam-show.vercel.app'

interface OxaPayRequestResponse {
  result: number
  message: string
  trackId?: string
  payLink?: string
  orderId?: string
}

interface OxaPayStatusResponse {
  result: number
  message: string
  status?: 'pending' | 'confirming' | 'confirmed' | 'paid' | 'failed' | 'expired'
  amount?: string
  currency?: string
  trackId?: string
}

// ===========================================
// GET - Check payment status using API Key
// ===========================================
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const trackId = searchParams.get('trackId')
  const orderId = searchParams.get('orderId')

  if (!trackId && !orderId) {
    return NextResponse.json(
      { success: false, error: 'Track ID or Order ID required' },
      { status: 400 }
    )
  }

  try {
    // Use API Key for status checks (admin-related tasks)
    const response = await fetch('https://api.oxapay.com/merchants/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: OXAPAY_API_KEY, // API Key for status checks
        trackId: trackId || undefined,
        orderId: orderId || undefined
      })
    })

    const data: OxaPayStatusResponse = await response.json()

    if (data.result === 100) {
      return NextResponse.json({
        success: true,
        status: data.status || 'pending',
        amount: data.amount,
        currency: data.currency,
        trackId: data.trackId
      })
    } else {
      return NextResponse.json({
        success: false,
        status: 'unknown',
        message: data.message,
        result: data.result
      })
    }
  } catch (error) {
    console.error('OxaPay status check error:', error)
    return NextResponse.json({
      success: false,
      status: 'error',
      error: 'Failed to check payment status'
    })
  }
}

// ===========================================
// POST - Create OxaPay Payment Request
// Required fields: merchant, amount, currency, network, orderId, callbackUrl
// ===========================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, coins, uid, orderId: providedOrderId, description } = body

    // Validate required fields
    if (!amount || !coins || !uid) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: amount, coins, uid' },
        { status: 400 }
      )
    }

    // Generate unique Order ID if not provided
    const orderId = providedOrderId || `TOPUP-${Date.now()}-${uid.slice(0, 8).toUpperCase()}`
    
    // Generate unique Track ID
    const trackId = `TRK-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Build callback URL
    const callbackUrl = `${APP_URL}/api/callback`
    const returnUrl = `${APP_URL}/?payment=success`

    console.log('Creating OxaPay payment request:', {
      merchant: OXAPAY_MERCHANT_KEY.slice(0, 8) + '...',
      amount,
      currency: 'USDT',
      network: 'TRC20',
      orderId,
      trackId,
      callbackUrl
    })

    // Create payment request using OxaPay API
    // Endpoint: https://api.oxapay.com/merchants/request
    // Required fields: merchant, amount, currency, network, orderId, callbackUrl
    const requestBody = {
      merchant: OXAPAY_MERCHANT_KEY, // Merchant Key for payment requests
      amount: amount,
      currency: 'USDT',
      network: 'TRC20',
      orderId: orderId,
      trackId: trackId,
      callbackUrl: callbackUrl,
      returnUrl: returnUrl,
      description: description || `Top Up: ${coins.toLocaleString()} coins`,
      email: ''
    }

    const response = await fetch('https://api.oxapay.com/merchants/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    const data: OxaPayRequestResponse = await response.json()

    console.log('OxaPay response:', data)

    if (data.result === 100 && data.payLink) {
      return NextResponse.json({
        success: true,
        orderId: orderId,
        trackId: data.trackId || trackId,
        paymentUrl: data.payLink,
        message: 'Payment link created successfully'
      })
    } else {
      console.error('OxaPay API error:', data)
      
      return NextResponse.json({
        success: false,
        error: data.message || 'Failed to create payment request',
        result: data.result,
        debug: {
          sentRequest: {
            merchant: OXAPAY_MERCHANT_KEY.slice(0, 8) + '...',
            amount,
            currency: 'USDT',
            network: 'TRC20',
            orderId,
            callbackUrl
          },
          response: data
        }
      })
    }
  } catch (error) {
    console.error('OxaPay payment creation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create payment request' },
      { status: 500 }
    )
  }
}
