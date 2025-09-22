import { NextRequest, NextResponse } from 'next/server'
import { nafdacScraper } from '@/lib/scraper'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// POST endpoint for Vercel cron jobs
export async function POST(request: NextRequest) {
  try {
    console.log('🕘 Vercel cron job triggered at:', new Date().toISOString())

    // Check if cron is enabled (security check)
    const cronSecret = request.headers.get('x-vercel-cron-job-signature')
    const expectedSecret = process.env.CRON_SECRET_KEY

    if (!cronSecret || !expectedSecret || cronSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized cron job access' },
        { status: 401 }
      )
    }

    // Set maintenance mode
    await prisma.scraperStatus.updateMany({
      data: { isScraping: true, lastUpdated: new Date() }
    })

    console.log('🔧 Maintenance mode activated')

    // Execute scraping job
    const result = await nafdacScraper.scrapeAndStoreAlerts(5)

    // Reset maintenance mode
    await prisma.scraperStatus.updateMany({
      data: {
        isScraping: false,
        lastScrapedAt: new Date(),
        lastUpdated: new Date()
      }
    })

    console.log('🔧 Maintenance mode deactivated')
    console.log('✅ Cron job completed successfully')

    return NextResponse.json({
      success: true,
      message: 'NAFDAC scraping cron job completed',
      stats: result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Cron job failed:', error)

    // Reset maintenance mode on error
    try {
      await prisma.scraperStatus.updateMany({
        data: {
          isScraping: false,
          lastError: error instanceof Error ? error.message : 'Unknown error',
          lastUpdated: new Date()
        }
      })
    } catch (dbError) {
      console.error('❌ Failed to reset maintenance mode:', dbError)
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: 'Cron job failed',
        message: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check scraper status (for frontend)
export async function GET() {
  try {
    const status = await prisma.scraperStatus.findFirst({
      orderBy: { lastUpdated: 'desc' }
    })

    if (!status) {
      return NextResponse.json({
        isScraping: false,
        lastScrapedAt: null,
        lastError: null,
        lastUpdated: new Date().toISOString()
      })
    }

    return NextResponse.json({
      isScraping: status.isScraping,
      lastScrapedAt: status.lastScrapedAt,
      lastError: status.lastError,
      lastUpdated: status.lastUpdated
    })

  } catch (error) {
    console.error('❌ Status check failed:', error)

    return NextResponse.json(
      {
        error: 'Failed to check scraper status',
        isScraping: false,
        lastError: 'Status check error'
      },
      { status: 500 }
    )
  }
}
