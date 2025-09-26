import { NextRequest, NextResponse } from 'next/server'
import { PaymentService } from '@/services/payment-service'
import { EmailService } from '@/lib/email'
import prisma from '@/lib/prisma'

const paymentService = new PaymentService()

// Process successful payment (shared for all payment methods)
async function processSuccessfulPayment(
  transactionId: string,
  amount: number,
  pointsCount: number,
  customer: any,
  currency: string,
  paymentType: string,
  eventType: string
): Promise<void> {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: customer.email },
      select: {
        id: true,
        email: true,
        name: true,
        planId: true,
        pointsBalance: true
      }
    })

    if (!user) {
      console.error('Flutterwave webhook: User not found for email:', customer.email)
      throw new Error('User not found')
    }

    // Update user's points balance
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        pointsBalance: {
          increment: pointsCount
        }
      },
      select: {
        id: true,
        email: true,
        pointsBalance: true
      }
    })

    // Create payment record
    await prisma.payment.create({
      data: {
        userId: user.id,
        transactionId: transactionId.toString(),
        amount,
        currency,
        status: 'completed',
        pointsPurchased: pointsCount,
        paymentGateway: 'flutterwave',
        processedAt: new Date()
      }
    })

    console.log(`Flutterwave webhook: ✅ Successfully added ${pointsCount} points to ${user.email} (${paymentType})`)
    console.log('Updated balance:', updatedUser.pointsBalance)

  } catch (error) {
    console.error('Flutterwave webhook: Failed to process payment:', error)
    throw error
  }
}

// Send payment failure notification to admin
async function sendPaymentFailureNotification(
  userId: string,
  amount: number,
  currency: string,
  gateway: string,
  transactionId: string,
  failureReason: string
): Promise<void> {
  try {
    const adminEmail = process.env.AD_EMAIL
    if (!adminEmail) {
      console.warn('AD_EMAIL not configured, skipping payment failure notification')
      return
    }

    console.log(`🚨 Sending payment failure notification for ${gateway} transaction ${transactionId}: ${failureReason}`)

    // Send email notification
    await EmailService.sendPaymentFailure(
      adminEmail,
      userId,
      amount,
      currency,
      gateway,
      transactionId,
      failureReason
    )

    // Create system notification for admin dashboard
    await prisma.systemNotification.create({
      data: {
        type: 'payment_failed',
        title: `🚨 Payment Failed - ${gateway.toUpperCase()} ${currency} ${amount}`,
        message: `Payment failed for user ${userId}: ${failureReason}. Transaction ID: ${transactionId}`,
        severity: 'high',
        metadata: {
          userId,
          amount,
          currency,
          gateway,
          transactionId,
          failureReason,
          timestamp: new Date().toISOString()
        }
      }
    })

    // Create payment record for failed payment
    try {
      await prisma.payment.create({
        data: {
          userId,
          transactionId,
          amount,
          currency,
          status: 'failed',
          paymentGateway: gateway,
          gatewayResponse: { failureReason }
        }
      })
      console.log(`📝 Created failed payment record for ${transactionId}`)
    } catch (recordError) {
      console.error('Failed to create failed payment record:', recordError)
    }

    console.log(`✅ Payment failure notification sent to ${adminEmail} and saved to admin dashboard`)

  } catch (notificationError) {
    console.error('Failed to send payment failure notification:', notificationError)
    // Don't throw - we don't want notification failures to break the main flow
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const transactionId = searchParams.get('transaction_id')
  const txRef = searchParams.get('tx_ref')

  if (!transactionId && !txRef) {
    console.error('Flutterwave callback: Missing transaction parameters')
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/payment/error?provider=flutterwave&error=missing_parameters`
    )
  }

  const idToUse = transactionId || txRef

  try {
    console.log(`Flutterwave callback: Verifying payment with ID ${idToUse}`)

    // Verify the payment with Flutterwave
    const verificationResult = await paymentService.verifyFlutterwavePayment(idToUse!)

    if (!verificationResult.success || !verificationResult.verified) {
      console.error('Flutterwave callback: Payment verification failed', verificationResult.error)

      // Send payment failure notification
      await sendPaymentFailureNotification(
        'unknown', // User ID not available in GET callback
        0, // Amount not available in GET callback
        'NGN',
        'flutterwave',
        idToUse || 'unknown',
        verificationResult.error || 'verification_failed'
      )

      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/payment/failure?provider=flutterwave&transaction_id=${idToUse}&error=${verificationResult.error || 'verification_failed'}`
      )
    }

    console.log('Flutterwave callback: Payment verified successfully', {
      amount: verificationResult.amount,
      pointsCount: verificationResult.pointsCount
    })

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/payment/success?provider=flutterwave&transaction_id=${idToUse}&amount=${verificationResult.amount || 0}`
    )

  } catch (error) {
    console.error('Flutterwave callback error:', error)

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/payment/failure?provider=flutterwave&transaction_id=${idToUse}&error=server_error`
    )
  }
}

export async function POST(request: NextRequest) {
  // Flutterwave webhooks for automated payment processing

  try {
    const body = await request.json()
    const { event, eventType, data } = body

    console.log('Flutterwave webhook received:', {
      event,
      eventType,
      transactionId: data?.id,
      reference: data?.tx_ref
    })

    if (event === 'charge.completed' || eventType === 'CARD_TRANSACTION') {
      // 🪖 CARD PAYMENT HANDLER - Always verify to get accurate data
      const transactionId = data.id || data.tx_ref

      console.log('Flutterwave webhook: Processing card payment', {
        transactionId,
        flutterwaveId: data.id, // This is what we need!
        reference: data.tx_ref,
        amount: data.amount,
        email: data.customer?.email,
        eventType
      })

      // 🎯 CRITICAL: Always verify using Flutterwave's transaction ID (data.id)
      const verificationId = data.id || transactionId
      const verificationResult = await paymentService.verifyFlutterwavePayment(verificationId!)

      if (!verificationResult.success || !verificationResult.verified) {
        console.error('Flutterwave webhook: Card payment verification failed', {
          usedId: verificationId,
          error: verificationResult.error
        })

        await sendPaymentFailureNotification(
          data.customer?.email || 'unknown',
          data.charged_amount || data.amount || 0,
          data.currency || 'NGN',
          'flutterwave',
          verificationId || 'unknown',
          `Card verification failed: ${verificationResult.error || 'Unknown error'}`
        )
        return NextResponse.json({ status: 'error', message: 'Payment verification failed' }, { status: 500 })
      }

      console.log('Flutterwave webhook: Card payment verified successfully', {
        verifiedWithId: verificationId,
        amount: verificationResult.amount,
        pointsCount: verificationResult.pointsCount
      })

      // Use our transaction ID for database records, but verified amount/points
      const amount = verificationResult.amount!
      const pointsCount = parseInt(verificationResult.pointsCount || '0', 10)
      const customer = data.customer

      // 🎯 PROCESS PAYMENT (Shared for all methods after verification)
      await processSuccessfulPayment(
        transactionId!, // Use our reference for database
        amount,
        pointsCount,
        customer,
        data.currency || 'NGN',
        'card',
        'CARD_TRANSACTION'
      )

      return NextResponse.json({
        status: 'success',
        message: 'Card payment processed successfully',
        data: {
          transactionId: transactionId!.toString(),
          pointsAdded: pointsCount,
          amount,
          paymentType: 'card'
        }
      })

    } else if (
      // Bank Transfer Events
      event?.type === 'BANK_TRANSFER_TRANSACTION' ||
      body['event.type'] === 'BANK_TRANSFER_TRANSACTION' ||
      event?.type === 'ACCOUNT_TRANSACTION' ||
      body['event.type'] === 'ACCOUNT_TRANSACTION' ||
      // Mobile Money
      event?.type === 'VOICE_TRANSACTION' ||
      body['event.type'] === 'VOICE_TRANSACTION' ||
      event?.type === 'SMS_TRANSACTION' ||
      body['event.type'] === 'SMS_TRANSACTION' ||
      // Other Bank Transfer Variations
      event?.type === 'BANK_TRANSFER_RECONCILED' ||
      body['event.type'] === 'BANK_TRANSFER_RECONCILED' ||
      // USSD (Unstructured Supplementary Service Data)
      event?.type === 'USSD_TRANSACTION' ||
      body['event.type'] === 'USSD_TRANSACTION' ||
      // Wire/Bank Debits
      event?.type === 'WIRE_TRANSACTION' ||
      body['event.type'] === 'WIRE_TRANSACTION'
    ) {

      const eventType = event?.type || body['event.type'] || 'BANK_TRANSFER'
      console.log(`Flutterwave webhook: Processing ${eventType} bank transfer payment`)

      // Extract data from the body directly (bank transfers structure differently)
      const {
        id,
        txRef,
        tx_ref,
        amount,
        charged_amount,
        currency,
        status,
        customer,
        meta
      } = event || body  // Bank transfers put data at top level

      const transactionId = id || txRef || tx_ref
      const transactionAmount = charged_amount || amount

      console.log('Flutterwave webhook: Bank payment details', {
        transactionId, // Our tx_ref
        flutterwaveId: id, // This should be Flutterwave's ID
        reference: txRef || tx_ref,
        amount: transactionAmount,
        email: customer?.email,
        eventType
      })

      // Verify the status
      if (status !== 'successful') {
        console.log('Flutterwave webhook: Payment status is not successful')
        return NextResponse.json({ status: 'ignored', message: 'Payment not successful' })
      }

      // 📞 VERIFY BANK PAYMENT WITH FLUTTERWAVE API - Use actual Flutterwave transaction ID
      const verificationId = id || transactionId // Prefer Flutterwave's ID over our ref
      const verificationResult = await paymentService.verifyFlutterwavePayment(verificationId!)
      if (!verificationResult.success || !verificationResult.verified) {
        console.error('Flutterwave webhook: Bank payment verification failed', {
          usedId: verificationId,
          error: verificationResult.error
        })

        await sendPaymentFailureNotification(
          customer?.email || 'unknown',
          transactionAmount,
          currency || 'NGN',
          'flutterwave',
          verificationId || 'unknown',
          `Bank verification failed: ${verificationResult.error || 'Unknown error'}`
        )
        return NextResponse.json({ status: 'error', message: 'Payment verification failed' }, { status: 500 })
      }

      console.log('Flutterwave webhook: Bank payment verified', {
        transactionId,
        reference: txRef,
        amount: verificationResult.amount,
        pointsCount: verificationResult.pointsCount
      })

      const pointsCount = parseInt(verificationResult.pointsCount || '0', 10)
      const verifiedAmount = verificationResult.amount!

      // Verify transaction ID exists
      if (!transactionId) {
        console.error('Flutterwave webhook: Missing transaction ID in webhook')
        return NextResponse.json({ status: 'error', message: 'Missing transaction ID' }, { status: 400 })
      }

      // Find user by email
      if (!customer?.email) {
        console.error('Flutterwave webhook: Missing customer email')
        return NextResponse.json({ status: 'error', message: 'Missing customer email' }, { status: 400 })
      }

      // 🎯 PROCESS PAYMENT (Shared for all methods after verification)
      await processSuccessfulPayment(
        transactionId,
        verifiedAmount,
        Number.isNaN(pointsCount) ? 0 : pointsCount,
        customer,
        currency || 'NGN',
        'bank',
        eventType
      )

      return NextResponse.json({
        status: 'success',
        message: 'Bank payment processed successfully',
        data: {
          transactionId: transactionId.toString(),
          pointsAdded: pointsCount,
          amount: verifiedAmount,
          paymentType: 'bank'
        }
      })
    }

    return NextResponse.json({ status: 'ignored', message: `Unhandled event: ${event}` })

  } catch (error) {
    console.error('Flutterwave webhook processing error:', error)
    return NextResponse.json(
      { status: 'error', message: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
