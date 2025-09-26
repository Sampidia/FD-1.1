import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Force dynamic rendering since this route uses request.headers
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Check if request is authorized (from Vercel cron)
    const cronSecret = request.headers.get('x-vercel-cron-job-signature')
    const expectedSecret = process.env.CRON_SECRET_KEY

    if (!cronSecret || !expectedSecret || cronSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized cron job access' },
        { status: 401 }
      )
    }

    console.log('[CRON] Starting daily free points reset...')

    // Reset all users' free points to 0
    const result = await prisma.user.updateMany({
      data: {
        planFreePoints: 0,
      }
    })

    // Log the reset activity
    await prisma.systemNotification.create({
      data: {
        type: 'cron_job',
        title: 'Daily Free Points Reset',
        message: `Successfully reset free points for ${result.count} users at 12 AM UTC`,
        severity: 'low',
        metadata: {
          resetCount: result.count,
          timestamp: new Date().toISOString(),
          timezone: 'UTC',
          schedule: 'cron: 0 0 * * * (12 AM UTC)'
        }
      }
    })

    console.log(`[CRON] Successfully reset ${result.count} users' free points to 0`)

    return NextResponse.json({
      success: true,
      message: `Reset free points for ${result.count} users`,
      resetCount: result.count
    })
  } catch (error) {
    console.error('[CRON] Free points reset failed:', error)

    await prisma.systemNotification.create({
      data: {
        type: 'cron_error',
        title: 'Free Points Reset Failed',
        message: `Daily reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'medium',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      }
    })

    return NextResponse.json({
      error: 'Reset failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
