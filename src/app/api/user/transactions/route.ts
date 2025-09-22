import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Force dynamic rendering for this route (required for auth)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth()
    console.log('💳 Transactions API - Session:', session ? 'Found' : 'Not found')
    console.log('💳 Transactions API - User ID:', session?.user?.id)
    console.log('💳 Transactions API - User Email:', session?.user?.email)

    if (!session) {
      console.log('💳 Transactions API - No session, returning 401')
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      )
    }

    // Fetch all user payments/transactions
    const transactions = await prisma.payment.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`💳 Transactions API: ${session.user.email} has ${transactions.length} transactions`)

    return NextResponse.json({
      success: true,
      transactions
    })

  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch transactions',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}