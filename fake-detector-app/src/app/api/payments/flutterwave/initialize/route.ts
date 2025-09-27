import { NextRequest, NextResponse } from 'next/server'
import { PaymentService } from '@/services/payment-service'

const paymentService = new PaymentService()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      amount,
      email,
      name,
      phone,
      pointsCount,
      planId = 'basic'
    } = body

    console.log('Flutterwave payment initialization request:', {
      amount, email, pointsCount, planId
    })

    if (!amount || !email || !pointsCount) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: amount, email, or pointsCount'
      }, { status: 400 })
    }

    // Initialize payment on server-side
    const result = await paymentService.initializeFlutterwavePayment({
      amount,
      email,
      name: name || 'AI Points Purchase',
      phone,
      pointsCount,
      planId
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        paymentUrl: result.paymentUrl,
        transactionId: result.transactionId
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Payment initialization failed'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Flutterwave initialize API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
}
