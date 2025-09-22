import { NextRequest, NextResponse } from 'next/server'
import { nafdacScraper } from '@/lib/scraper'

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Getting NAFDAC database statistics...')

    const stats = await nafdacScraper.getDatabaseStats()

    return NextResponse.json({
      success: true,
      data: {
        totalAlerts: stats.totalAlerts,
        activeAlerts: stats.activeAlerts,
        severityDistribution: stats.severityDistribution,
        lastScrapedAt: stats.lastScrapedAt,
        summary: {
          alertsProcessed: `${stats.totalAlerts} total, ${stats.activeAlerts} active`,
          mostCommonSeverity: Object.entries(stats.severityDistribution)
            .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A',
          lastUpdate: stats.lastScrapedAt ?
            new Date(stats.lastScrapedAt).toLocaleString() : 'Never'
        }
      }
    })

  } catch (error: unknown) {
    console.error('❌ Stats API error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get statistics',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}
