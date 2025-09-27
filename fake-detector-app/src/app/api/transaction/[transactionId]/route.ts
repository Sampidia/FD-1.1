import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth-minimal'
import "@/types/nextauth"
import prisma from '@/lib/prisma'

// Force dynamic rendering for this route (required for auth)
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      )
    }

    const { transactionId } = params

    // Fetch the specific transaction - ensure it belongs to the authenticated user
    const transaction = await prisma.payment.findFirst({
      where: {
        id: transactionId,
        userId: session.user.id
      }
    })

    if (!transaction) {
      return NextResponse.json(
        { success: false, message: 'Transaction not found or access denied' },
        { status: 404 }
      )
    }

    console.log(`💳 Transaction Detail API: User ${session.user.email} accessed transaction ${transactionId}`)

    return NextResponse.json({
      success: true,
      transaction
    })

  } catch (error) {
    console.error('Error fetching transaction details:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch transaction details',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
