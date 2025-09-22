/**
 * Admin Payments API - Fetch payment records from database Payment model
 *
 * This endpoint retrieves payment records directly from the Prisma Payment model
 * and displays them in the admin dashboard payment table.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    // Check admin access
    const session = await auth()
    const adminEmail = process.env.AD_EMAIL || process.env.NEXT_PUBLIC_AD_EMAIL
    const isAdmin = session?.user?.email === adminEmail ||
                   session?.user?.id === 'admin001'

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get recent payments directly from database Payment model
    console.log('📊 FETCHING PAYMENT RECORDS FROM DATABASE...')
    const payments = await prisma.payment.findMany({
      take: 50, // Limit to recent 50 payments
      orderBy: {
        processedAt: 'desc'
      },
      select: {
        id: true,
        userId: true,
        amount: true,
        currency: true,
        status: true,
        pointsPurchased: true,
        paymentGateway: true,
        planTier: true,
        processedAt: true,
        createdAt: true
      }
    })
    console.log(`✅ FOUND ${payments.length} PAYMENT RECORDS IN DATABASE`)

    return NextResponse.json({
      success: true,
      data: payments
    })

  } catch (error) {
    console.error('Admin payments error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment data' },
      { status: 500 }
    )
  }
}