import { NextRequest, NextResponse } from 'next/server'
import { nafdacScraper } from '@/lib/scraper'
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth-minimal'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting NAFDAC enrichment process...')

    // 🚀 EXTERNAL AUTHENTICATION SUPPORT (for cron-job.org)
    const authHeader = request.headers.get('authorization')
    const externalToken = process.env.EXTERNAL_SCRAPER_TOKEN
    const manualTrigger = !!externalToken && authHeader === `Bearer ${externalToken}`

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
      console.log('🔑 External scraper token authenticated for enrichment')
    }

    // 🧠 AUTOMATIC PAGINATION TRACKING
    // We store the current "skip" index in the ScraperStatus table so the cron job knows exactly where to resume
    const STATE_ID = 'enrichment_state'
    let currentState = await prisma.scraperStatus.findUnique({
      where: { id: STATE_ID }
    })

    // Parse manual override if provided (e.g. for testing) or use database state
    const url = new URL(request.url)
    const manualSkip = url.searchParams.get('skip')
    let skip = manualSkip ? parseInt(manualSkip, 10) : 0

    if (!manualSkip) {
      // Use state from database if no manual override
      if (currentState && currentState.lastError) {
        skip = parseInt(currentState.lastError, 10) || 0 // Re-using lastError field to store simple string state to avoid schema changes
      } else if (!currentState) {
        // Create initial state record
        currentState = await prisma.scraperStatus.create({
          data: {
            id: STATE_ID,
            lastScrapedAt: new Date(),
            lastError: '0', // Storing skip as string here
            isScraping: false
          }
        })
      }
    }

    console.log(`⏱️  Enrichment batch starting at offset: ${skip}`)

    // Get alerts that need enrichment
    // We target ALL active alerts, processing oldest first.
    const alertsToEnrich = await prisma.nafdacAlert.findMany({
      where: {
        active: true
      },
      orderBy: {
        scrapedAt: 'asc'
      },
      skip: skip,
      take: 3 // Small batch to prevent Vercel timeout (10s limit on hobby plan)
    })

    if (alertsToEnrich.length === 0) {
      // 🔄 RESET LOOP: If we reached the end, reset the skip counter to 0 so it cycles back
      await prisma.scraperStatus.update({
        where: { id: STATE_ID },
        data: {
          lastError: '0',
          lastUpdated: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Reached end of alerts database. Resetting counter to 0 for next cycle.',
        processedCount: 0,
        nextSkip: 0
      })
    }

    console.log(`⏱️  Found ${alertsToEnrich.length} alerts to enrich. Processing...`)
    
    const results = []
    let successCount = 0

    // Process sequentially
    for (const alert of alertsToEnrich) {
      const result = await nafdacScraper.enrichExistingAlert(alert.id, alert.url)
      
      results.push({
        id: alert.id,
        url: alert.url,
        success: result.success,
        updates: result.updatedFields,
        error: result.error
      })

      if (result.success) {
        successCount++
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    const nextSkip = skip + alertsToEnrich.length;

    // 💾 SAVE NEW STATE
    await prisma.scraperStatus.upsert({
      where: { id: STATE_ID },
      update: {
        lastError: nextSkip.toString(),
        lastScrapedAt: new Date(),
        lastUpdated: new Date()
      },
      create: {
        id: STATE_ID,
        lastError: nextSkip.toString(),
        lastScrapedAt: new Date(),
        lastUpdated: new Date(),
        isScraping: false
      }
    })

    return NextResponse.json({
      success: true,
      message: `Enrichment complete. Successfully updated ${successCount}/${alertsToEnrich.length} alerts.`,
      processedCount: alertsToEnrich.length,
      successCount,
      currentSkip: skip,
      nextSkip: nextSkip,
      details: results
    })

  } catch (error) {
    console.error('❌ Enrichment API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: 'Enrichment failed',
        message: errorMessage
      },
      { status: 500 }
    )
  }
}
