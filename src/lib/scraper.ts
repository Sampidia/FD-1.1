import axios from 'axios'
import * as cheerio from 'cheerio'
import prisma from '@/lib/prisma'

// Simple alert data structure
interface ScrapedAlertData {
  title: string
  url: string
  excerpt: string
  date: string
  fullContent: string
  productNames: string[]
  batchNumbers: string[]
  manufacturer: string | null
}

// Simple NAFDAC Web Scraper
export class NafdacSimpleScraper {
  private baseUrl = 'https://nafdac.gov.ng/category/recalls-and-alerts/'

  // Main method to scrape and store alerts - VERSEL HOBBY OPTIMIZED
  async scrapeAndStoreAlerts(limit: number = 2): Promise<{ // ⬅️ HOBBY: Max 2 alerts per run
    success: boolean
    newAlerts: number
    totalProcessed: number
    errors: string[]
  }> {
    console.log('🚀 Starting HOBBY-OPTIMIZED NAFDAC scraping (2 alerts max)...')

    const result = {
      success: false,
      newAlerts: 0,
      totalProcessed: 0,
      errors: [] as string[]
    }

    try {
      // Fetch main alerts page - KEEP TIMEOUT SHORT FOR HOBBY
      console.log('📄 Fetching NAFDAC alerts page...')
      const response = await axios.get(this.baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 8000 // ⬅️ HOBBY: Shorter timeout
      })

      const html = response.data // ✅ FULL CONTENT: No HTML truncation for complete content extraction
      const $ = cheerio.load(html)

      // FAST LINK EXTRACTION - PRIORITY ALERTS ONLY
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

      // DO NOT aggressively filter out existing URLs.
      // NAFDAC often updates recent alerts with new batch numbers.
      // By keeping them, `storeAlertToDatabase` will re-scrape and MERGE the new data.
      // But we will limit to only processing 'limit' alerts to save resources.
      const existingUrls = await prisma.nafdacAlert.findMany({
        select: { url: true }
      })
      const existingUrlSet = new Set(existingUrls.map(alert => alert.url))
      
      // Count how many are new vs updates
      const newLinksCount = alertLinks.filter(link => !existingUrlSet.has(link.url)).length
      console.log(`🔄 Found ${newLinksCount} completely new alerts, and ${alertLinks.length - newLinksCount} existing alerts that will be checked for updates`)

      // We don't filter `alertLinks` so the top ones get checked for NAFDAC updates


      result.success = true

      // 🔄 SECQUENTIAL PROCESSING WITH DELAYS (HOBBY OPTIMIZED)
      if (alertLinks.length > 0) {
        console.log(`📝 Processing ${alertLinks.slice(0, limit).length} alerts SEQUENTIALLY with delays...`)

        const alertsToProcess: { url: string; title: string }[] = alertLinks.slice(0, limit)

        // Process alerts SEQUENTIALLY with delays to be gentle on servers
        for (let index = 0; index < alertsToProcess.length; index++) {
          const alert = alertsToProcess[index]
          console.log(`   📝 Processing alert ${index + 1}/${limit}: "${alert.title}"`)

          try {
            // Scrape the individual alert
            const alertData = await this.scrapeSingleAlert(alert.url, alert.title)

            if (alertData) {
              console.log(`   ✅ Successfully extracted alert: ${alertData.title}`)
              // Store in database
              const saved = await this.storeAlertToDatabase(alertData)
              if (saved) {
                result.newAlerts++
                console.log(`   💾 Alert stored successfully`)
              } else {
                result.errors.push(`Alert ${index + 1} (${alert.title}): Database save failed`)
              }
            } else {
              console.warn(`   ❌ Failed to extract alert data for: ${alert.title}`)
              result.errors.push(`Alert ${index + 1} (${alert.title}): Extraction failed`)
            }

            result.totalProcessed++

            // Add delay between alerts to be server-friendly (except for last one)
            if (index < alertsToProcess.length - 1) {
              console.log(`   ⏱️  Waiting 1.5 seconds before next alert...`)
              await new Promise(resolve => setTimeout(resolve, 1500))
            }

          } catch (error: unknown) {
            console.error(`   ❌ Error processing alert ${index + 1}: ${alert.title}`, error)
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            result.errors.push(`Alert ${index + 1} (${alert.title}): ${errorMsg}`)
            result.totalProcessed++

            // Continue with next alert even if one fails
            continue
          }
        }

        console.log(`📊 Processing complete: ${result.newAlerts}/${result.totalProcessed} alerts processed SEQUENTIALLY WITH DELAYS`)
        console.log(`⚡ Total runtime: <${result.totalProcessed * 2 + 2} seconds (estimated)`)
      } else {
        console.log('❌ No alert articles found to process')
        result.errors.push('No alert articles found on NAFDAC website')
      }

    } catch (error) {
      console.error('❌ Scraping failed:', error)
      result.errors.push(`Main scraping error: ${error}`)
    }

    return result
  }

  // CONTINUOUS BATCH SCRAPER - For Manual/GitHub Actions (processes ALL alerts in batches of 4)
  async scrapeAllAvailableAlerts(): Promise<{
    success: boolean
    totalBatches: number
    totalAlerts: number
    newAlerts: number
    totalProcessed: number
    batchDetails: Array<{batch: number, alerts: number, processed: number, new: number}>
    errors: string[]
  }> {
    console.log('🚀 Starting CONTINUOUS BATCH SCRAPER - All Alerts Mode')

    let batchNumber = 1
    let totalProcessed = 0
    let totalNewAlerts = 0
    const batchDetails: Array<{batch: number, alerts: number, processed: number, new: number}> = []
    const allErrors: string[] = []

    while (true) {
      console.log(`\n📦 BATCH ${batchNumber}: Processing next 4 alerts...`)

      // Get next batch of alerts (always check for new ones on each iteration)
      const batchResult = await this.getNextAlertBatch(4)

      if (batchResult.alertLinks.length === 0) {
        console.log(`✅ NO MORE ALERTS - Processing complete after ${batchNumber - 1} batches`)
        break
      }

      console.log(`📊 Batch ${batchNumber}: Found ${batchResult.alertLinks.length} alerts to process`)

      // Process this batch sequentially with delays
      const batchProcessed = await this.processAlertBatch(batchResult.alertLinks, batchNumber)

      // Update totals
      totalProcessed += batchProcessed.totalProcessed
      totalNewAlerts += batchProcessed.newAlerts

      // Record batch details
      batchDetails.push({
        batch: batchNumber,
        alerts: batchResult.alertLinks.length,
        processed: batchProcessed.totalProcessed,
        new: batchProcessed.newAlerts
      })

      // Add batch errors
      allErrors.push(...batchProcessed.errors)

      console.log(`📊 Batch ${batchNumber} Complete: ${batchProcessed.newAlerts}/${batchProcessed.totalProcessed} new alerts`)

      // Increment batch counter
      batchNumber++

      // Safety check - don't run forever (max 10 batches)
      if (batchNumber > 10) {
        console.log(`⚠️ SAFETY BREAK: Stopped after 10 batches (max limit)`)
        allErrors.push('Reached maximum batch limit (10 batches)')
        break
      }

      // Pause between batches (3 seconds) - gentler on NAFDAC servers
      console.log(`⏱️  Resting 3 seconds before next batch...`)
      await new Promise(resolve => setTimeout(resolve, 3000))
    }

    // Final summary
    console.log(`\n🎯 CONTINUOUS SCRAPER COMPLETE:`)
    console.log(`   📦 Total batches: ${batchNumber - 1}`)
    console.log(`   📊 Total alerts processed: ${totalProcessed}`)
    console.log(`   ✨ New alerts added: ${totalNewAlerts}`)
    console.log(`   ⚠️  Errors: ${allErrors.length}`)

    return {
      success: allErrors.length === 0,
      totalBatches: batchNumber - 1,
      totalAlerts: totalProcessed,
      newAlerts: totalNewAlerts,
      totalProcessed,
      batchDetails,
      errors: allErrors
    }
  }

  // Helper: Get next batch of alerts to process
  private async getNextAlertBatch(batchSize: number): Promise<{alertLinks: {url: string, title: string}[]}> {
    try {
      // Fetch current alerts page - SAME LOGIC AS MAIN SCRAPER
      const response = await axios.get(this.baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 8000
      })

      const html = response.data // ✅ FULL CONTENT
      const $ = cheerio.load(html)

      const alertLinks: {url: string, title: string}[] = []

      // USE SAME STRATEGY 1 AS MAIN SCRAPER
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

        // Check for duplicates in found links
        const isNew = !alertLinks.some(link => link.url === url)

        if (isNew && url.startsWith('http') && (hasAlertContent || url.includes('nafdac.gov.ng'))) {
          alertLinks.push({ url, title: title || 'Unnamed Alert' })
          console.log(`🎯 CONTINUOUS: FOUND ALERT ARTICLE: "${title}" -> ${url}`)
        }

        if (alertLinks.length >= batchSize) return
      })

      console.log(`🔗 CONTINUOUS: Found ${alertLinks.length} alert links`)

      // LAST RESORT: Filter out alerts that already exist in database
      const existingUrls = await prisma.nafdacAlert.findMany({
        where: { active: true },
        select: { url: true }
      })

      const existingUrlSet = new Set(existingUrls.map(alert => alert.url))
      const newAlertLinks = alertLinks.filter(link => !existingUrlSet.has(link.url))

      console.log(`🔄 LAST RESORT: Filtered out ${alertLinks.length - newAlertLinks.length} existing alerts`)

      return { alertLinks: newAlertLinks }
    } catch (error) {
      console.error('❌ Failed to get alert batch:', error)
      return { alertLinks: [] }
    }
  }

  // Helper: Process a single batch of alerts
  private async processAlertBatch(alerts: {url: string, title: string}[], batchNumber: number): Promise<{
    totalProcessed: number
    newAlerts: number
    errors: string[]
  }> {
    const result = {
      totalProcessed: 0,
      newAlerts: 0,
      errors: [] as string[]
    }

    for (let index = 0; index < alerts.length; index++) {
      const alert = alerts[index]
      console.log(`   🔄 Batch ${batchNumber}.${index + 1}: "${alert.title}"`)

      try {
        const alertData = await this.scrapeSingleAlert(alert.url, alert.title)

        if (alertData) {
          const saved = await this.storeAlertToDatabase(alertData)
          if (saved) {
            result.newAlerts++
            console.log(`   ✅ New alert saved`)
          } else {
            result.errors.push(`Batch.${batchNumber}.${index + 1}: DB save failed`)
          }
        } else {
          result.errors.push(`Batch.${batchNumber}.${index + 1}: Extraction failed`)
        }

        result.totalProcessed++

        // Short pause between alerts in batch (1 second)
        if (index < alerts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        result.errors.push(`Batch.${batchNumber}.${index + 1}: ${errorMsg}`)
        result.totalProcessed++
      }
    }

    return result
  }

  // Scrape individual alert page - FULL CONTENT EXTRACTION
  async scrapeSingleAlert(url: string, fallbackTitle: string): Promise<ScrapedAlertData | null> {
    try {
      console.log(`🔍 Fetching alert page: ${url}`)

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 7000
      })

      const html = response.data
      const $ = cheerio.load(html)

      // EXTRACT TITLE
      const title = $('.entry-title, h1').first().text().trim() ||
                   $('h1').first().text().trim() ||
                   $('title').text().trim() ||
                   fallbackTitle

      // EXTRACT DATE
      const dateText = $('.entry-date, .published, time').first().text().trim() ||
                      $('time').first().text().trim() ||
                      new Date().toISOString().split('T')[0]

      let date = new Date().toISOString().split('T')[0]
      try {
        const parsed = new Date(dateText)
        if (!isNaN(parsed.getTime())) {
          date = parsed.toISOString().split('T')[0]
        }
      } catch (e) {
        console.log('⚠️  Could not parse date, using today')
      }

      // EXTRACT CONTENT - get both plain text AND preserve table/structured data
      const contentEl = $('.entry-content, .content, article').first()
      const plainText = contentEl.text().trim() || $('p').text().trim() || title
      
      // Extract structured table data
      const tableData = this.extractTablesAsText($, contentEl)
      
      // Combine plain text + table data for comprehensive fullContent
      const fullContent = tableData 
        ? (plainText + '\n\n--- STRUCTURED DATA ---\n' + tableData).trim()
        : plainText

      // COMPREHENSIVE PRODUCT & BATCH EXTRACTION
      const productNames: string[] = []
      const batchNumbers: string[] = []
      let manufacturer: string | null = null

      const lowerContent = fullContent.toLowerCase()

      // ═══ PRODUCT NAME EXTRACTION ═══
      // Common drug names
      const commonDrugs = [
        'paracetamol', 'ibuprofen', 'metronidazole', 'ciprofloxacin', 'amoxicillin',
        'ampicillin', 'chloroquine', 'artesunate', 'tramadol', 'codeine',
        'diclofenac', 'omeprazole', 'penicillin', 'erythromycin', 'tetracycline',
        'doxycycline', 'azithromycin', 'ceftriaxone', 'artemether', 'lumefantrine',
        'quinine', 'sulfadoxine', 'pyrimethamine', 'amlodipine', 'atenolol',
        'metformin', 'glibenclamide', 'captopril', 'enalapril', 'nifedipine',
        'clavulanic acid', 'suspension', 'tablet', 'capsule', 'injection', 'syrup'
      ]
      commonDrugs.forEach(drug => {
        if (lowerContent.includes(drug.toLowerCase())) {
          productNames.push(drug)
        }
      })

      // Extract product names from title patterns
      const titleProductMatch = title.match(/(?:substandard|counterfeit|falsified|fake)\s+(.+?)(?:\s+batch|\s+with|\s*$)/i)
      if (titleProductMatch && titleProductMatch[1]) {
        const extracted = titleProductMatch[1].trim().replace(/[\(\)]/g, '').trim()
        if (extracted.length > 2 && !productNames.includes(extracted.toLowerCase())) {
          productNames.push(extracted)
        }
      }

      // ═══ BATCH NUMBER EXTRACTION ═══
      // Pattern 1: Labeled batch numbers (Batch No: XXX, B/N: XXX, Lot: XXX)
      const labeledBatchPatterns = [
        /(?:batch\s*(?:no\.?|number|#)?[:\s]+)([A-Z0-9\-\/\.]+)/gi,
        /(?:lot\s*(?:no\.?|number)?[:\s]+)([A-Z0-9\-\/\.]+)/gi,
        /(?:b\.?\/?n\.?[:\s]+)([A-Z0-9\-\/\.]+)/gi,
        /(?:batch\s*nos?\.?[:\s]+)([A-Z0-9\-\/\.\s,and]+)/gi,
      ]
      for (const pattern of labeledBatchPatterns) {
        let match
        while ((match = pattern.exec(fullContent)) !== null) {
          // Handle comma/and-separated batches: "0503024, 0501724"
          const batchStr = match[1].trim()
          const parts = batchStr.split(/[,;]|\band\b/i).map(s => s.trim()).filter(s => s.length > 0 && /[A-Z0-9]/i.test(s))
          for (const part of parts) {
            const clean = part.replace(/^[\s,]+|[\s,]+$/g, '').trim()
            if (clean.length >= 2 && !batchNumbers.includes(clean)) {
              batchNumbers.push(clean)
            }
          }
        }
      }

      // Pattern 2: Standalone alphanumeric codes (360M, 4290M, UI4004)
      const standalonePatterns = [
        /\b(\d{2,5}[A-Z]{1,3})\b/g,     // 360M, 4290M, 826024M
        /\b([A-Z]{1,4}\d{3,10})\b/g,     // UI4004, ABC12345
        /\b(\d{5,10})\b/g,               // 826024, 39090439, 0503024
      ]
      for (const pattern of standalonePatterns) {
        let match
        while ((match = pattern.exec(fullContent)) !== null) {
          const batch = match[1].trim()
          // Filter out likely non-batch numbers (years, phone numbers, etc.)
          if (batch.length >= 3 && batch.length <= 15 && 
              !batch.match(/^(19|20)\d{2}$/) && // Not a year
              !batch.match(/^\d{11,}$/) && // Not a phone number
              !batchNumbers.includes(batch)) {
            batchNumbers.push(batch)
          }
        }
      }

      // Pattern 3: NAFDAC registration numbers
      const nafdacRegMatch = fullContent.match(/(?:NAFDAC\s*(?:Reg\.?)?\s*(?:No\.?)?[:\s]+)([A-Z0-9\-\/]+)/gi)
      if (nafdacRegMatch) {
        nafdacRegMatch.forEach(m => {
          const num = m.replace(/NAFDAC\s*(?:Reg\.?)?\s*(?:No\.?)?[:\s]+/i, '').trim()
          if (num.length >= 3 && !batchNumbers.includes(num)) {
            batchNumbers.push(num)
          }
        })
      }

      // ═══ MANUFACTURER EXTRACTION ═══
      const mfrPatterns = [
        /(?:manufactur(?:er|ed\s*by)|distribut(?:or|ed\s*by))[:\s]+([^\n\r.]+)/i,
        /(?:mfg\.?\s*(?:by)?)[:\s]+([^\n\r.]+)/i,
        /(?:company|produced\s*by|marketed\s*by)[:\s]+([^\n\r.]+)/i,
      ]
      for (const pattern of mfrPatterns) {
        const match = fullContent.match(pattern)
        if (match && match[1]?.trim()) {
          manufacturer = match[1].trim().substring(0, 200) // Cap length
          break
        }
      }

      // Create excerpt
      const excerpt = $('p').first().text().trim() || fullContent.substring(0, 200) + '...'

      const alertData: ScrapedAlertData = {
        title: title || 'Untitled Alert',
        url,
        excerpt,
        date,
        fullContent,
        productNames: [...new Set(productNames)],
        batchNumbers: [...new Set(batchNumbers)],
        manufacturer
      }

      console.log('📋 Extracted alert data:')
      console.log(`   Title: ${alertData.title}`)
      console.log(`   Date: ${alertData.date}`)
      console.log(`   Products: ${alertData.productNames.join(', ') || 'none'}`)
      console.log(`   Batches: ${alertData.batchNumbers.join(', ') || 'none'}`)
      console.log(`   Manufacturer: ${alertData.manufacturer || 'unknown'}`)
      console.log(`   Content length: ${alertData.fullContent.length} chars`)

      return alertData

    } catch (error) {
      console.error(`❌ Failed to scrape alert: ${url}`, error)
      return null
    }
  }

  // Extract table data as structured text (preserves Batch No, Mfg Date, Exp Date, etc.)
  private extractTablesAsText($: cheerio.CheerioAPI, element: any): string {
    const tables: string[] = []
    
    element.find('table').each((_idx: number, table: any) => {
      const rows: string[] = []
      $(table).find('tr').each((_rIdx: number, tr: any) => {
        const cells: string[] = []
        $(tr).find('th, td').each((_cIdx: number, cell: any) => {
          cells.push($(cell).text().trim())
        })
        if (cells.length > 0) {
          rows.push(cells.join(' | '))
        }
      })
      if (rows.length > 0) {
        tables.push(rows.join('\n'))
      }
    })

    // Also extract definition lists / labeled content
    element.find('dt, .label, strong, b').each((_idx: number, label: any) => {
      const labelText = $(label).text().trim()
      const valueEl = $(label).next('dd, span, .value')
      if (valueEl.length > 0) {
        const valueText = valueEl.text().trim()
        if (labelText && valueText) {
          tables.push(`${labelText}: ${valueText}`)
        }
      }
    })

    return tables.join('\n')
  }

  // Store alert data in database using Prisma — MERGES data for existing alerts
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
        console.log('⚠️  Alert already exists in database, MERGING new data...')

        // Merge batch numbers (combine old + new, deduplicate)
        const mergedBatches = [...new Set([
          ...(existingAlert.batchNumbers || []),
          ...alertData.batchNumbers
        ])]

        // Merge product names (combine old + new, deduplicate)
        const mergedProducts = [...new Set([
          ...(existingAlert.productNames || []),
          ...alertData.productNames
        ])]

        // Use longer fullContent (re-scraped content might be more complete)
        const bestContent = alertData.fullContent.length > (existingAlert.fullContent || '').length
          ? alertData.fullContent
          : existingAlert.fullContent

        // Use manufacturer if we found one and existing doesn't have one
        const bestManufacturer = alertData.manufacturer || existingAlert.manufacturer

        await prisma.nafdacAlert.update({
          where: {
            id: existingAlert.id
          },
          data: {
            title: alertData.title,
            excerpt: alertData.excerpt,
            date: alertData.date,
            fullContent: bestContent,
            productNames: mergedProducts,
            batchNumbers: mergedBatches,
            manufacturer: bestManufacturer,
            alertType: "PUBLIC_ALERT",
            category: "recalls",
            scrapedAt: new Date()
          }
        })

        const newBatchCount = mergedBatches.length - (existingAlert.batchNumbers || []).length
        const newProductCount = mergedProducts.length - (existingAlert.productNames || []).length  
        console.log(`✅ Merged: +${newBatchCount} batches, +${newProductCount} products (total: ${mergedBatches.length} batches, ${mergedProducts.length} products)`)
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
            manufacturer: alertData.manufacturer,
            alertType: "PUBLIC_ALERT",
            category: "recalls",
            severity: "MEDIUM",
            active: true
          }
        })
        console.log(`✅ Created new alert (${alertData.batchNumbers.length} batches, ${alertData.productNames.length} products)`)
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
      severityStats.forEach((item: { severity: string; _count: { severity: number } }) => {
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

  // ENRICH EXISTING ALERT: specifically built for the cron enrichment job
  async enrichExistingAlert(alertId: string, url: string): Promise<{
    success: boolean
    updatedFields: string[]
    error?: string
  }> {
    try {
      console.log(`🔄 Enriching existing alert: ${url}`)
      const alertData = await this.scrapeSingleAlert(url, 'Enriched Alert')
      
      if (!alertData) {
        return { success: false, updatedFields: [], error: 'Failed to scrape alert' }
      }

      const existingAlert = await prisma.nafdacAlert.findUnique({
        where: { id: alertId }
      })

      if (!existingAlert) {
        return { success: false, updatedFields: [], error: 'Alert not found in database' }
      }

      // Merge data
      const mergedBatches = [...new Set([
        ...(existingAlert.batchNumbers || []),
        ...alertData.batchNumbers
      ])]

      const mergedProducts = [...new Set([
        ...(existingAlert.productNames || []),
        ...alertData.productNames
      ])]

      const bestContent = alertData.fullContent.length > (existingAlert.fullContent || '').length
        ? alertData.fullContent
        : existingAlert.fullContent

      const bestManufacturer = alertData.manufacturer || existingAlert.manufacturer

      const updatedFields: string[] = []
      if (mergedBatches.length > (existingAlert.batchNumbers || []).length) updatedFields.push('batchNumbers')
      if (mergedProducts.length > (existingAlert.productNames || []).length) updatedFields.push('productNames')
      if (bestContent !== existingAlert.fullContent) updatedFields.push('fullContent')
      if (!existingAlert.manufacturer && bestManufacturer) updatedFields.push('manufacturer')

      await prisma.nafdacAlert.update({
        where: { id: alertId },
        data: {
          fullContent: bestContent,
          productNames: mergedProducts,
          batchNumbers: mergedBatches,
          manufacturer: bestManufacturer,
          aiExtracted: true, // Mark as enriched
          scrapedAt: new Date()
        }
      })

      return { success: true, updatedFields }

    } catch (error) {
      console.error(`❌ Enrichment failed for ${alertId}:`, error)
      return { 
        success: false, 
        updatedFields: [], 
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

// Export singleton instance
export const nafdacScraper = new NafdacSimpleScraper()
