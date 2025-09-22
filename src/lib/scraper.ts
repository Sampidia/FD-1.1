import axios from 'axios'
import * as cheerio from 'cheerio'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Simple alert data structure
interface ScrapedAlertData {
  title: string
  url: string
  excerpt: string
  date: string
  fullContent: string
  productNames: string[]
  batchNumbers: string[]
}

// Simple NAFDAC Web Scraper
export class NafdacSimpleScraper {
  private baseUrl = 'https://nafdac.gov.ng/category/recalls-and-alerts/'

  // Main method to scrape and store alerts
  async scrapeAndStoreAlerts(limit: number = 5): Promise<{
    success: boolean
    newAlerts: number
    totalProcessed: number
    errors: string[]
  }> {
    console.log('🚀 Starting SIMPLE NAFDAC scraping...')

    const result = {
      success: false,
      newAlerts: 0,
      totalProcessed: 0,
      errors: [] as string[]
    }

    try {
      // Fetch main alerts page
      console.log('📄 Fetching NAFDAC alerts page...')
      const response = await axios.get(this.baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 10000
      })

      const $ = cheerio.load(response.data)

      // ENHANCED ARTICLE-BASED LINK EXTRACTION
      console.log('🔍 Looking for individual alert articles...')
      const alertLinks: { url: string; title: string }[] = []

      // DEBUG: Show page structure first
      console.log('📄 Analyzing page structure...')
      const articlesCount = $('article').length || $('.post').length || $('.entry').length
      console.log(`📊 Found ${articlesCount} article/post elements`)

      // Look at ALL links on the page first for debugging
      $('a[href*="nafdac.gov.ng"]').each((index, element) => {
        const $elem = $(element)
        const url = $elem.attr('href')
        const title = $elem.text().trim()

        // DEBUG: Show ALL NAFDAC links found
        if (url && url !== this.baseUrl) { // Exclude the main page itself
          console.log(`DEBUG Link ${index + 1}: "${title}" -> ${url}`)
        }
      })

      // STRATEGY 1: Look for WordPress blog post structures
      console.log('🔍 Strategy 1: Looking for blog post links...')

      // Target entry-title and post title links specifically (typical WordPress structure)
      $('.entry-title a, .post-title a, article h2 a, article h3 a, .post h2 a, .post h3 a').each((index, element) => {
        const $elem = $(element)

        // Skip if no href
        const url = $elem.attr('href')
        if (!url) return

        // Skip if it's the main page itself
        if (url === this.baseUrl || url === this.baseUrl + '/') return

        // Skip category, tag, and archive pages
        if (url.includes('/category/') ||
            url.includes('/tag/') ||
            url.includes('/page/') ||
            url.includes('/author/') ||
            url.includes('?paged=') ||
            url.includes('#comments') ||
            url.includes('/feed/')) {
          return
        }

        // Get the title text
        const title = $elem.text().trim()

        // Skip if title is too short or generic
        if (!title || title.length < 10 ||
            title.toLowerCase().includes('home') ||
            title.toLowerCase().includes('contact') ||
            title.toLowerCase().includes('about') ||
            title.toLowerCase().includes('privacy') ||
            title.toLowerCase().includes('terms')) {
          return
        }

        // Additional alert keyword check (for relevance)
        const alertKeywords = ['alert', 'recall', 'counterfeit', 'fake', 'substandard', 'falsified', 'batch', 'lot', 'nafdac']
        const hasAlertContent = alertKeywords.some(keyword =>
          title.toLowerCase().includes(keyword) ||
          url.toLowerCase().includes(keyword) ||
          url.includes('/recalls-and-alerts/') ||
          url.includes('/alert') ||
          url.includes('/recall') ||
          url.includes('/substandard') ||
          url.includes('/counterfeit')
        )

        // Check for duplicates
        const isNew = !alertLinks.some(link => link.url === url)

        if (isNew && url.startsWith('http') && (hasAlertContent || url.includes('nafdac.gov.ng'))) {
          alertLinks.push({ url, title: title || 'Unnamed Alert' })
          console.log(`🎯 FOUND ALERT ARTICLE: "${title}" -> ${url}`)
        }

        if (alertLinks.length >= limit) return
      })

      // STRATEGY 2: Look for post links in blog/content archives
      if (alertLinks.length === 0) {
        console.log('🔍 Strategy 2: Looking in post archive structures...')
        $('.post a, .entry a, article a').each((index, element) => {
          const $elem = $(element)
          const url = $elem.attr('href')
          if (!url || url === this.baseUrl) return

          // Skip non-permalink URLs
          if (!url.startsWith('http') ||
              url.includes('/category/') ||
              url.includes('?paged=') ||
              url.includes('#') ||
              url === this.baseUrl ||
              (url.includes('nafdac.gov.ng') && !url.includes('/recalls')) && !url.includes('alert')) {
            return
          }

          // Get title from link text or parent element
          let title = $elem.text().trim()
          if (!title || title.length < 5) {
            title = $elem.closest('article, .post, .entry').find('.entry-title, .post-title, h2, h3').first().text().trim() ||
                   $elem.closest('article, .post, .entry').find('.title, h1').first().text().trim() ||
                   'Unknown Alert'
          }

          // Skip short or generic titles
          if (!title || title.length < 10 ||
              title.toLowerCase().includes('read more') ||
              title.toLowerCase().includes('continue reading') ||
              title.toLowerCase().includes('click here')) {
            return
          }

          const isNew = !alertLinks.some(link => link.url === url)

          if (isNew && url.includes('nafdac.gov.ng')) {
            alertLinks.push({ url, title })
            console.log(`🎯 FOUND ARCHIVE ALERT: "${title}" -> ${url}`)
          }

          if (alertLinks.length >= limit) return
        })
      }

      // STRATEGY 3: Direct URL pattern matching (fallback)
      if (alertLinks.length === 0) {
        console.log('🔍 Strategy 3: Direct URL pattern matching...')
        $('a[href]').each((index, element) => {
          const $elem = $(element)
          const url = $elem.attr('href')
          if (!url) return

          // Look for permalink-like URLs
          if (url.includes('nafdac.gov.ng') &&
              url !== this.baseUrl &&
              !url.includes('/category/') &&
              (url.includes('/recalls') || url.includes('/alert') || url.includes('/public-alert') || url.includes('/notice')) &&
              url.startsWith('http')) {

            const title = $elem.text().trim() || $elem.closest('article, .post').find('h1,h2,h3,.title').first().text().trim() || 'Public Alert'

            if (title && title.length > 5) {
              const isNew = !alertLinks.some(link => link.url === url)
              if (isNew) {
                alertLinks.push({ url, title })
                console.log(`🎯 FOUND PATTERN ALERT: "${title}" -> ${url}`)
              }
            }
          }

          if (alertLinks.length >= limit) return
        })
      }

      console.log(`🔗 Found ${alertLinks.length} alert links`)

      result.success = true

      // Process ALL found alerts (up to 5)
      if (alertLinks.length > 0) {
        console.log(`📝 Processing ${alertLinks.length} alerts...`)

        for (let i = 0; i < alertLinks.length; i++) {
          const alert = alertLinks[i]
          console.log(`   📝 Processing alert ${i + 1}/${alertLinks.length}: "${alert.title}"`)

          try {
            const alertData = await this.scrapeSingleAlert(alert.url, alert.title)

            if (alertData) {
              console.log(`   ✅ Successfully extracted alert: ${alertData.title}`)
              console.log(`   📄 Content length: ${alertData.fullContent.length} characters`)

              // Store in database
              const saved = await this.storeAlertToDatabase(alertData)
              if (saved) {
                result.newAlerts++
              }
            } else {
              console.log(`   ❌ Failed to extract alert data for: ${alert.title}`)
              result.errors.push(`Failed to extract alert: ${alert.title}`)
            }

            result.totalProcessed++

            // Add a small delay between requests to avoid overwhelming the server
            if (i < alertLinks.length - 1) {
              console.log(`   ⏳ Waiting 2 seconds before next alert...`)
              await new Promise(resolve => setTimeout(resolve, 2000))
            }

          } catch (error) {
            console.error(`   ❌ Error processing alert ${i + 1}: ${alert.title}`, error)
            result.errors.push(`Alert processing error: ${alert.title} - ${error}`)
            result.totalProcessed++
          }
        }

        console.log(`📊 Processing complete: ${result.newAlerts}/${result.totalProcessed} alerts successfully processed`)
      } else {
        console.log('❌ No alert articles found to process')
      }

    } catch (error) {
      console.error('❌ Scraping failed:', error)
      result.errors.push(`Main scraping error: ${error}`)
    }

    return result
  }

  // Scrape individual alert page
  async scrapeSingleAlert(url: string, fallbackTitle: string): Promise<ScrapedAlertData | null> {
    try {
      console.log(`🔍 Fetching alert page: ${url}`)

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 10000
      })

      const $ = cheerio.load(response.data)

      // EXTRACT TITLE - try multiple simple selectors
      const title = $('.entry-title, h1').first().text().trim() ||
                   $('h1').first().text().trim() ||
                   $('title').text().trim() ||
                   fallbackTitle

      // EXTRACT DATE - simple string search
      const dateText = $('.entry-date, .published, time').first().text().trim() ||
                      $('time').first().text().trim() ||
                      new Date().toISOString().split('T')[0]

      let date = new Date().toISOString().split('T')[0] // fallback
      try {
        const parsed = new Date(dateText)
        if (!isNaN(parsed.getTime())) {
          date = parsed.toISOString().split('T')[0]
        }
      } catch (e) {
        console.log('⚠️  Could not parse date, using today')
      }

      // EXTRACT CONTENT - simple selectors
      const fullContent = $('.entry-content, .content, article').text().trim() ||
                         $('p').text().trim() ||
                         title

      // SIMPLE PRODUCT EXTRACTION - basic string matching
      const productNames: string[] = []
      const batchNumbers: string[] = []

      const lowerContent = fullContent.toLowerCase()

      // Look for common drug names using simple contains
      const commonDrugs = ['paracetamol', 'ibuprofen', 'metronidazole', 'ciprofloxacin']

      commonDrugs.forEach(drug => {
        if (lowerContent.includes(drug.toLowerCase())) {
          productNames.push(drug)
        }
      })

      // Look for "Batch" or "Lot" followed by numbers/letters
      const batchMatches = fullContent.match(/\bbatch\s+(\w+)/gi) ||
                          fullContent.match(/\blot\s+(\w+)/gi) ||
                          []
      batchNumbers.push(...batchMatches.map(match => match.split(/\s+/)[1]))

      // Create excerpt from first paragraph
      const excerpt = $('p').first().text().trim() || fullContent.substring(0, 200) + '...'

      const alertData: ScrapedAlertData = {
        title: title || 'Untitled Alert',
        url,
        excerpt,
        date,
        fullContent,
        productNames,
        batchNumbers
      }

      console.log('📋 Extracted alert data:')
      console.log(`   Title: ${alertData.title}`)
      console.log(`   Date: ${alertData.date}`)
      console.log(`   Products: ${alertData.productNames.join(', ')}`)
      console.log(`   Batches: ${alertData.batchNumbers.join(', ')}`)
      console.log(`   Content preview: ${alertData.excerpt.substring(0, 100)}...`)

      return alertData

    } catch (error) {
      console.error(`❌ Failed to scrape alert: ${url}`, error)
      return null
    }
  }

  // Store alert data in database using Prisma
  async storeAlertToDatabase(alertData: ScrapedAlertData): Promise<boolean> {
    try {
      console.log(`💾 Storing alert in database: ${alertData.title}`)

      // Check if alert already exists to avoid duplicates
      const existingAlert = await prisma.nafdacAlert.findFirst({
        where: {
          url: alertData.url,
        }
      })

      if (existingAlert) {
        console.log('⚠️  Alert already exists in database, updating...')
        // Update existing alert
        await prisma.nafdacAlert.update({
          where: {
            id: existingAlert.id
          },
          data: {
            title: alertData.title,
            excerpt: alertData.excerpt,
            date: alertData.date,
            fullContent: alertData.fullContent,
            productNames: alertData.productNames,
            batchNumbers: alertData.batchNumbers,
            manufacturer: alertData.productNames.length > 0 ? alertData.productNames[0] : null,
            alertType: "PUBLIC_ALERT",
            category: "recalls",
            scrapedAt: new Date()
          }
        })
        console.log('✅ Updated existing alert in database')
        return true
      } else {
        // Create new alert
        await prisma.nafdacAlert.create({
          data: {
            title: alertData.title,
            url: alertData.url,
            excerpt: alertData.excerpt,
            date: alertData.date,
            fullContent: alertData.fullContent,
            aiConfidence: 0.8,
            productNames: alertData.productNames,

            batchNumbers: alertData.batchNumbers,
            manufacturer: alertData.productNames.length > 0 ? alertData.productNames[0] : null,
            alertType: "PUBLIC_ALERT",
            category: "recalls",
            severity: "MEDIUM",
            active: true
          }
        })
        console.log('✅ Created new alert in database')
        return true
      }

    } catch (error) {
      console.error('❌ Database storage failed:', error)
      return false
    }
  }

  // Get database statistics
  async getDatabaseStats(): Promise<{
    totalAlerts: number
    activeAlerts: number
    severityDistribution: Record<string, number>
    lastScrapedAt: string | null
  }> {
    try {
      console.log('📊 Getting database statistics...')

      // Get total alerts count
      const totalAlerts = await prisma.nafdacAlert.count()

      // Get active alerts count
      const activeAlerts = await prisma.nafdacAlert.count({
        where: { active: true }
      })

      // Get severity distribution using raw query
      const severityStats = await prisma.nafdacAlert.groupBy({
        by: ['severity'],
        _count: {
          severity: true
        },
        where: { active: true }
      })

      // Convert to simple object
      const severityDistribution: Record<string, number> = {}
      severityStats.forEach(item => {
        severityDistribution[item.severity] = item._count.severity
      })

      // Get last scraped date
      const latestAlert = await prisma.nafdacAlert.findFirst({
        where: { active: true },
        select: { scrapedAt: true },
        orderBy: { scrapedAt: 'desc' }
      })

      return {
        totalAlerts,
        activeAlerts,
        severityDistribution,
        lastScrapedAt: latestAlert?.scrapedAt?.toISOString() || null
      }

    } catch (error) {
      console.error('❌ Failed to get database statistics:', error)
      throw new Error('Failed to retrieve database statistics')
    }
  }
}

// Export singleton instance
export const nafdacScraper = new NafdacSimpleScraper()
