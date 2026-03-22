import { NextRequest, NextResponse } from 'next/server'

// OxaPay Callback Handler
// This endpoint is called by OxaPay when payment status changes
const OXAPAY_API_KEY = process.env.OXAPAY_API_KEY || 'FB15BH-N6MHUV-7BDCX7-YMQKJR'

interface OxaPayCallback {
  trackId: string
  orderId: string
  status: 'confirming' | 'confirmed' | 'paid' | 'failed' | 'expired'
  amount: string
  currency: string
  network: string
  txId?: string
  paidAmount?: string
  fee?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: OxaPayCallback = await request.json()
    
    console.log('OxaPay Callback Received:', {
      trackId: body.trackId,
      orderId: body.orderId,
      status: body.status,
      amount: body.amount,
      currency: body.currency,
      network: body.network
    })

    // Validate callback
    if (!body.trackId || !body.orderId) {
      return NextResponse.json(
        { success: false, error: 'Invalid callback data' },
        { status: 400 }
      )
    }

    // Verify the payment with OxaPay using API Key
    const verifyResponse = await fetch('https://api.oxapay.com/merchants/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: OXAPAY_API_KEY,
        trackId: body.trackId,
        orderId: body.orderId
      })
    })

    const verifyData = await verifyResponse.json()

    if (verifyData.result === 100 && verifyData.status === 'paid') {
      // Payment confirmed - update user balance
      // Parse order ID to get user info: TOPUP-{timestamp}-{uid_prefix}
      const orderParts = body.orderId.split('-')
      const uidPrefix = orderParts[2] || ''
      
      console.log(`✅ Payment confirmed for order ${body.orderId}`)
      console.log(`   Amount: ${body.paidAmount || body.amount} ${body.currency}`)
      console.log(`   Network: ${body.network}`)
      console.log(`   TX ID: ${body.txId || 'N/A'}`)
      
      // Return success to OxaPay
      return NextResponse.json({
        success: true,
        message: 'Payment confirmed',
        orderId: body.orderId,
        status: 'paid'
      })
    } else {
      console.log(`⚠️ Payment status: ${verifyData.status || body.status}`)
      
      return NextResponse.json({
        success: true,
        message: `Payment status: ${verifyData.status || body.status}`,
        orderId: body.orderId,
        status: verifyData.status || body.status
      })
    }
  } catch (error) {
    console.error('OxaPay callback error:', error)
    return NextResponse.json(
      { success: false, error: 'Callback processing failed' },
      { status: 500 }
    )
  }
}

// GET - Simple health check for callback URL
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'OxaPay callback endpoint is active',
    timestamp: new Date().toISOString()
  })
}
