import { NextRequest, NextResponse } from 'next/server'
import { nafdacScraper } from '@/lib/scraper'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting NAFDAC scraping process...')

    // Start the scraping process
    const result = await nafdacScraper.scrapeAndStoreAlerts(10) // Limit to 10 for testing

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
