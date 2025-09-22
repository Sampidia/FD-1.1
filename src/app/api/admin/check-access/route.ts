import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

// Force dynamic rendering for auth-required API routes
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()

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
