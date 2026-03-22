import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseDb } from '@/lib/firebase'
import { Timestamp, collection, addDoc, doc, updateDoc, increment } from 'firebase/firestore'

// PayPal Webhook Handler
// This endpoint receives webhook notifications from PayPal

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // PayPal webhook event types
    const eventType = body.event_type
    const resource = body.resource || {}

    console.log('PayPal Webhook received:', eventType)

    const db = getFirebaseDb()
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    // Handle different webhook events
    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePaymentCaptured(db, resource)
        break
      
      case 'PAYMENT.CAPTURE.DENIED':
        await handlePaymentFailed(db, resource, 'denied')
        break
      
      case 'PAYMENT.CAPTURE.REFUNDED':
        await handlePaymentRefunded(db, resource)
        break
      
      case 'CHECKOUT.ORDER.APPROVED':
        await handleOrderApproved(db, resource)
        break
      
      case 'CHECKOUT.ORDER.COMPLETED':
        await handleOrderCompleted(db, resource)
        break
      
      default:
        console.log('Unhandled webhook event:', eventType)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed',
      eventType 
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Handle successful payment capture
async function handlePaymentCaptured(db: ReturnType<typeof getFirebaseDb>, resource: Record<string, unknown>) {
  if (!db) return
  try {
    const orderId = (resource.supplementary_data as Record<string, unknown>)?.related_ids || resource.id
    const transactionId = resource.id as string
    const amount = (resource.amount as Record<string, unknown>)?.value
    const currency = (resource.amount as Record<string, unknown>)?.currency_code || 'USD'
    const customId = resource.custom_id as string || ''

    // Extract user info from custom_id (format: uid_coins)
    const [uid, coinsStr] = customId.split('_')
    const coins = parseInt(coinsStr || '0')

    if (uid && coins > 0) {
      // Create payment record
      await addDoc(collection(db, 'payments'), {
        uid,
        amount: parseFloat(amount as string || '0'),
        coins,
        currency,
        paypalOrderId: orderId as string,
        paypalTransactionId: transactionId,
        status: 'completed',
        paymentMethod: 'paypal',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })

      // Update user coins
      await updateDoc(doc(db, 'profiles', uid), {
        coins: increment(coins),
        lastPayment: Timestamp.now()
      })

      console.log(`Payment captured: ${coins} coins for user ${uid}`)
    }
  } catch (error) {
    console.error('Error handling payment capture:', error)
  }
}

// Handle payment denied
async function handlePaymentFailed(db: ReturnType<typeof getFirebaseDb>, resource: Record<string, unknown>, reason: string) {
  if (!db) return
  try {
    const orderId = resource.id as string
    const customId = resource.custom_id as string || ''
    const [uid] = customId.split('_')

    if (uid) {
      // Create failed payment record
      await addDoc(collection(db, 'payments'), {
        uid,
        amount: parseFloat((resource.amount as Record<string, unknown>)?.value as string || '0'),
        coins: 0,
        currency: (resource.amount as Record<string, unknown>)?.currency_code || 'USD',
        paypalOrderId: orderId,
        status: 'failed',
        failureReason: reason,
        paymentMethod: 'paypal',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })

      console.log(`Payment failed for user ${uid}: ${reason}`)
    }
  } catch (error) {
    console.error('Error handling payment failure:', error)
  }
}

// Handle refund
async function handlePaymentRefunded(db: ReturnType<typeof getFirebaseDb>, resource: Record<string, unknown>) {
  if (!db) return
  try {
    const refundAmount = (resource.amount as Record<string, unknown>)?.value

    // Find original payment and update status
    // Note: In production, you'd query by paypalTransactionId

    console.log(`Payment refunded: ${refundAmount}`)
  } catch (error) {
    console.error('Error handling refund:', error)
  }
}

// Handle order approved
async function handleOrderApproved(_db: ReturnType<typeof getFirebaseDb>, resource: Record<string, unknown>) {
  console.log('Order approved:', resource.id)
}

// Handle order completed
async function handleOrderCompleted(_db: ReturnType<typeof getFirebaseDb>, resource: Record<string, unknown>) {
  console.log('Order completed:', resource.id)
}
