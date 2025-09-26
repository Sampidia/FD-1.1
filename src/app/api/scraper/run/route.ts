import { NextRequest, NextResponse } from 'next/server'
import { nafdacScraper } from '@/lib/scraper'
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth-minimal'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting NAFDAC scraping process...')

    // 🚀 EXTERNAL AUTHENTICATION SUPPORT (for manual/GitHub Actions)
    const authHeader = request.headers.get('authorization')
    const externalToken = process.env.EXTERNAL_SCRAPER_TOKEN
    const manualTrigger = !!externalToken && authHeader === `Bearer ${externalToken}`

    console.log('🔍 DEBUG INFO:')
    console.log('📥 Received authorization header:', authHeader ? `"${authHeader}"` : 'undefined/null')
    console.log('🔑 External token env var:', externalToken ? `"${externalToken}"` : 'undefined/null')
    console.log('✅ Manual trigger:', manualTrigger)

    // Return debug info instead of processing
    return NextResponse.json({
      debug: true,
      receivedAuthHeader: authHeader,
      expectedAuthHeader: `Bearer ${externalToken}`,
      manualTrigger: manualTrigger,
      externalTokenExists: !!externalToken,
      authMatch: authHeader === `Bearer ${externalToken}`,
      timestamp: new Date().toISOString()
    })

    if (!manualTrigger) {
      // Check for admin session (internal calls)
      const session = await getServerSession(authOptions)
      if (!session?.user?.email) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      // Admin-only for internal calls
      const adminEmail = process.env.AD_EMAIL || process.env.NEXT_PUBLIC_AD_EMAIL
      if (session.user.email !== adminEmail) {
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        )
      }

      console.log('🔐 Authenticated admin access:', session.user.email)
    } else {
      console.log('🔑 External scraper token authenticated')
    }

    // Check for mode parameter - "cron" (default, 2 alerts) or "continuous" (all alerts in batches)
  const url = new URL(request.url)
  const mode = url.searchParams.get('mode') || 'cron'

  let result
  if (mode === 'continuous') {
    console.log('🔄 Using CONTINUOUS BATCH MODE - will process ALL available alerts in batches')
    result = await nafdacScraper.scrapeAllAvailableAlerts()
  } else {
    console.log('⏱️  Using CRON MODE - processing 2 alerts with sequential delays')
    // Start the scraping process - HOBBY OPTIMIZED (2 alerts max)
    result = await nafdacScraper.scrapeAndStoreAlerts(2) // ⬅️ HOBBY: Max 2 alerts to fit 10s timeout
  }

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'NAFDAC alerts scraped and stored successfully',
        stats: {
          newAlerts: result.newAlerts,
          totalProcessed: result.totalProcessed,
          errors: result.errors.length
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Scraping completed with errors',
        errorCount: result.errors.length
      })
    }

  } catch (error) {
    console.error('❌ Scraping API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: 'Scraping failed',
        message: errorMessage
      },
      { status: 500 }
    )
  }
}
