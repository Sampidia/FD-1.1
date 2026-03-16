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

    // Get alerts that need enrichment
    // We target ALL active alerts, processing oldest first.
    // Even if aiExtracted is true, we want to re-run the advanced regex to catch missing batches (like '360M').
    const alertsToEnrich = await prisma.nafdacAlert.findMany({
      where: {
        active: true
      },
      orderBy: {
        scrapedAt: 'asc'
      },
      take: 3 // Small batch to prevent Vercel timeout (10s limit on hobby plan)
    })

    if (alertsToEnrich.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No alerts need enrichment right now',
        processedCount: 0
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

    return NextResponse.json({
      success: true,
      message: `Enrichment complete. Successfully updated ${successCount}/${alertsToEnrich.length} alerts.`,
      processedCount: alertsToEnrich.length,
      successCount,
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
