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
  const reference = searchParams.get('reference')
  const trxref = searchParams.get('trxref')

  if (!reference) {
    console.error('Paystack callback: Missing reference parameter')
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/payment/error?provider=paystack&error=missing_reference`
    )
  }

  try {
    console.log(`Paystack callback: Verifying payment with reference ${reference}`)

    // Verify the payment with Paystack
    const verificationResult = await paymentService.verifyPaystackPayment(reference)

    if (!verificationResult.success || !verificationResult.verified) {
      console.error('Paystack callback: Payment verification failed', verificationResult.error)

      // Extract amount from reference if possible (for notification)
      const referenceParts = reference.split('fakedetector_')[1]?.split('_')
      const estimatedAmount = referenceParts ? parseInt(referenceParts[0]) : 0

      // Send payment failure notification
      await sendPaymentFailureNotification(
        'unknown', // User ID not available in GET callback
        estimatedAmount,
        'NGN',
        'paystack',
        reference,
        verificationResult.error || 'verification_failed'
      )

      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/payment/failure?provider=paystack&reference=${reference}&error=${verificationResult.error || 'verification_failed'}`
      )
    }

    console.log('Paystack callback: Payment verified successfully', {
      amount: verificationResult.amount,
      pointsCount: verificationResult.pointsCount
    })

    // Get callback stored data from request headers or query params
    // In a real implementation, you might store this in a session or temporary table
    // For now, we'll extract from the payment reference or stored localStorage data

    const referenceParts = reference.split('fakedetector_')[1]?.split('_')
    if (!referenceParts || referenceParts.length < 2) {
      console.error('Paystack callback: Unable to extract payment details from reference')

      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/payment/failure?provider=paystack&reference=${reference}&error=invalid_reference`
      )
    }

    // Extract details from reference (timestamp_random)
    const timestamp = referenceParts[0]
    const randomId = referenceParts[1]

    // In a real app, you'd have a database table to store these details
    // For now, we'll use a simpler approach by checking recent payments
    // You'll need to implement proper session management for production

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/payment/success?provider=paystack&reference=${reference}&amount=${verificationResult.amount || 0}`
    )

  } catch (error) {
    console.error('Paystack callback error:', error)

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/payment/failure?provider=paystack&reference=${reference}&error=server_error`
    )
  }
}

export async function POST(request: NextRequest) {
  // Paystack also sends webhooks as POST requests
  // This is more reliable than relying on GET callbacks

  try {
    const body = await request.json()
    const { event, data } = body

    console.log('Paystack webhook received:', { event, reference: data?.reference })

    if (event === 'charge.failed') {
      const { reference, amount, customer, gateway_response, status } = data

      console.log('Paystack webhook: Processing failed charge', {
        reference,
        amount: amount / 100,
        email: customer?.email,
        status,
        reason: gateway_response?.message
      })

      // Find user by email (same method as successful payments)
      let userId = 'unknown'
      if (customer?.email) {
        try {
          const user = await prisma.user.findUnique({
            where: { email: customer.email },
            select: { id: true }
          })
          if (user) {
            userId = user.id
          }
        } catch (userLookupError) {
          console.error('Paystack webhook: Failed to lookup user for failed charge:', userLookupError)
        }
      }

      // Send payment failure notification with proper userId
      await sendPaymentFailureNotification(
        userId,
        amount / 100, // Convert from kobo
        'NGN',
        'paystack',
        reference,
        gateway_response?.message || `Charge ${status}: Charge failed`
      )

      return NextResponse.json({
        status: 'failure_recorded',
        message: 'Failed payment recorded',
        data: {
          reference,
          userId,
          amount: amount / 100,
          reason: gateway_response?.message
        }
      })

    } else if (event === 'charge.success') {
      const { reference, amount, customer, metadata } = data

      console.log('Paystack webhook: Processing successful charge', {
        reference,
        amount,
        email: customer?.email,
        pointsCount: metadata?.pointsCount
      })

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: customer.email },
        select: {
          id: true,
          email: true,
          name: true,
          planId: true,
          pointsBalance: true,
          planBasicPoints: true,
          planStandardPoints: true,
          planBusinessPoints: true
        }
      })

      if (!user) {
        console.error('Paystack webhook: User not found for email:', customer.email)
        return NextResponse.json({ status: 'error', message: 'User not found' }, { status: 404 })
      }

      // Parse pointsCount to integer with proper error handling
      const rawPointsCount = metadata?.pointsCount || metadata?.custom_fields?.find((f: any) => f.variable_name === 'points_count')?.value
      const pointsCount = parseInt(String(rawPointsCount || '0'), 10)

      // Get plan info from metadata or fallback to user's plan
      const planIdFromMeta = metadata?.planId || metadata?.custom_fields?.find((f: any) => f.variable_name === 'plan_type')?.value
      const planTier = String(planIdFromMeta || user.planId || 'basic')

      console.log('Paystack webhook: Processing payment update', {
        pointsCount,
        planTier,
        userEmail: user.email,
        currentBalances: {
          total: user.pointsBalance,
          basic: user.planBasicPoints,
          standard: user.planStandardPoints,
          business: user.planBusinessPoints
        }
      })

      // Determine which plan-specific field to update
      let planSpecificField: string
      switch (planTier) {
        case 'basic':
          planSpecificField = 'planBasicPoints'
          break
        case 'standard':
          planSpecificField = 'planStandardPoints'
          break
        case 'business':
          planSpecificField = 'planBusinessPoints'
          break
        default:
          planSpecificField = 'planBasicPoints' // Default to basic
          break
      }

      // Update planId if this is a plan purchase
      const shouldUpdatePlanId = (user.planId !== planTier && ['basic', 'standard', 'business'].includes(planTier))

      // Build update data dynamically to avoid TypeScript errors
      const updateData: Record<string, any> = {
        pointsBalance: { increment: pointsCount }
      }
      updateData[planSpecificField] = { increment: pointsCount }

      // Update planId if needed
      if (shouldUpdatePlanId) {
        updateData.planId = planTier
        console.log(`📋 Updating user plan from ${user.planId || 'null'} to ${planTier}`)
      }

      // Update both general balance, plan-specific balance, and planId
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          pointsBalance: true,
          planBasicPoints: true,
          planStandardPoints: true,
          planBusinessPoints: true,
          planId: true
        } as any
      })

      console.log(`✅ Payment update complete:`, {
        planUpdated: shouldUpdatePlanId,
        newPlanId: updatedUser.planId,
        newPointsBalance: updatedUser.pointsBalance,
        planSpecificPoints: updatedUser[planSpecificField]
      })

      // Create payment record
      try {
        await prisma.payment.create({
          data: {
            userId: user.id,
            transactionId: reference,
            amount: amount / 100, // Convert from kobo
            currency: 'NGN',
            status: 'completed',
            pointsPurchased: pointsCount,
            paymentGateway: 'paystack',
            planTier: planTier,
            pointsAddedTo: planSpecificField,
            processedAt: new Date()
          }
        })

        console.log(`Paystack webhook: ✅ Successfully added ${pointsCount} points for ${planTier} plan to ${user.email}`)
        console.log('Updated balance:', updatedUser.pointsBalance)

      } catch (paymentError) {
        console.error('Paystack webhook: Failed to create payment record:', paymentError)
        // Don't fail the entire webhook for this
      }

      // Success response
      return NextResponse.json({
        status: 'success',
        message: 'Payment processed successfully',
        data: {
          userId: user.id,
          pointsAdded: pointsCount,
          planTier: planTier,
          pointsAddedTo: planSpecificField,
          updatedBalances: {
            total: updatedUser.pointsBalance
          }
        }
      })
    }

    return NextResponse.json({ status: 'ignored', message: `Unhandled event: ${event}` })

  } catch (error) {
    console.error('Paystack webhook processing error:', error)
    return NextResponse.json(
      { status: 'error', message: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
