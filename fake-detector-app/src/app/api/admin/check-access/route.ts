import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth-minimal'
import "@/types/nextauth"

export async function GET() {
  try {
    // COMPREHENSIVE BUILD-TIME PROTECTION - Prevent ANY auth operations during build
    if (process.env.NEXT_PHASE?.includes('build') ||
        process.env.NODE_ENV === 'development' ||
        process.env.NEXT_PHASE === 'phase-production-build') {
      console.log('[BUILD-TIME] Skipping authentication operations for check-access')
      return NextResponse.json({
        authenticated: false,
        isAdmin: false,
        user: null
      })
    }
    const session = await getServerSession(authOptions)

    const userId = session?.user?.id as string
    const userEmail = session?.user?.email as string

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const isAdmin = session.user.email?.includes('admin@') ||
                   session.user.id === 'admin001' ||
                   session.user.email === 'admin@fakedetector.ng'

    return NextResponse.json({
      authenticated: true,
      isAdmin,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        pointsBalance: session.user.pointsBalance || 0
      }
    })

  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { error: 'Authentication check failed' },
      { status: 500 }
    )
  }
}
