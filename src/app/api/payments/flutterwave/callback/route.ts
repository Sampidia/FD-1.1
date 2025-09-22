import { NextRequest, NextResponse } from 'next/server'
import { PaymentService } from '@/services/payment-service'
import { EmailService } from '@/lib/email'
import prisma from '@/lib/prisma'

const paymentService = new PaymentService()

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
      // 🪖 EXISTING: CARD PAYMENT HANDLER
      const {
        id,
        tx_ref,
        amount,
        charged_amount,
        currency,
        status,
        customer,
        meta
      } = data

      const transactionId = id || tx_ref
      const pointsCount = meta?.pointsCount || 0

      console.log('Flutterwave webhook: Processing completed payment', {
        transactionId,
        reference: tx_ref,
        amount,
        currency,
        status,
        email: customer?.email,
        pointsCount
      })

    // 🆕 NEW: COMPREHENSIVE BANK TRANSFER HANDLER (All Flutterwave bank/account events)
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

      // For bank transfers, pointsCount comes from the amount
      // 7500 NGN = 50 points (basic plan)
      const pointsCount = Math.floor((charged_amount || amount) / 150) || 50

      // Verify the status
      if (status !== 'successful') {
        console.log('Flutterwave webhook: Payment status is not successful')
        return NextResponse.json({ status: 'ignored', message: 'Payment not successful' })
      }

      console.log('Flutterwave webhook: Bank transfer verified successfully', {
        transactionId,
        reference: txRef,
        amount,
        currency,
        status,
        email: customer?.email,
        pointsCount,
        eventType: 'BANK_TRANSFER_TRANSACTION'
      })

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
        return NextResponse.json({ status: 'error', message: 'User not found' }, { status: 404 })
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
      try {
        await prisma.payment.create({
          data: {
            userId: user.id,
            transactionId: transactionId.toString(),
            amount: charged_amount || amount,
            currency: currency || 'NGN',
            status: 'completed',
            pointsPurchased: pointsCount,
            paymentGateway: 'flutterwave',
            processedAt: new Date()
          }
        })

        console.log(`Flutterwave webhook: ✅ Successfully added ${pointsCount} points to ${user.email}`)
        console.log('Updated balance:', updatedUser.pointsBalance)

      } catch (paymentError) {
        console.error('Flutterwave webhook: Failed to create payment record:', paymentError)
        // Don't fail the entire webhook for this
      }

      // Success response
      return NextResponse.json({
        status: 'success',
        message: 'Payment processed successfully',
        data: {
          userId: user.id,
          transactionId: transactionId.toString(),
          pointsAdded: pointsCount,
          updatedBalances: {
            total: updatedUser.pointsBalance
          }
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
