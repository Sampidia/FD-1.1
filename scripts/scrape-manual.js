#!/usr/bin/env node

/**
 * MANUAL NAFDAC SCRAPER
 *
 * This script allows you to manually trigger NAFDAC alert scraping
 * from the command line as a backup when Vercel cron fails.
 *
 * Usage:
 *   node scripts/scrape-manual.js
 *   npm run scrape:manual
 *
 * Requirements:
 *   - EXTERNAL_SCRAPER_TOKEN in .env.local
 *   - Local dev server running (npm run dev)
 */

const https = require('https')
const http = require('http')

// Load environment variables (including .env.local)
const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' }) // Load .env.local first
dotenv.config() // Fallback to .env if needed

// Configuration
const LOCAL_URL = 'http://localhost:3000'
const TOKEN = process.env.EXTERNAL_SCRAPER_TOKEN

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http

    const defaultOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Manual-Scraper/1.0'
      }
    }

    const requestOptions = { ...defaultOptions, ...options }

    const req = protocol.request(url, requestOptions, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const response = JSON.parse(data)
          resolve({ statusCode: res.statusCode, data: response })
        } catch (error) {
          resolve({ statusCode: res.statusCode, data })
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.end()
  })
}

async function main() {
  const mode = process.argv[2] || 'default' // 'cron', 'continuous', or 'default'

  console.log('🧾 Manual NAFDAC Scraper')
  console.log('========================')

  if (mode === 'cron') {
    console.log('📝 MODE: CRON (2 alerts, fast sequence)')
  } else if (mode === 'continuous') {
    console.log('🔄 MODE: CONTINUOUS (4 alerts/batch, process all)')
  } else {
    console.log('📋 MODE: DEFAULT (same as cron mode)')
  }

  // Check if token is available
  if (!TOKEN) {
    console.error('❌ ERROR: EXTERNAL_SCRAPER_TOKEN not found in environment variables.')
    console.log('💡 Make sure you have EXTERNAL_SCRAPER_TOKEN in your .env.local file')
    console.log('💡 Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
    process.exit(1)
  }

  // Mask token for security
  const maskedToken = TOKEN.substring(0, 8) + '...' + TOKEN.substring(TOKEN.length - 8)
  console.log(`🔑 Using scraper token: ${maskedToken}`)

  try {
    console.log('\n⏳ Testing scraper API...')

    const apiUrl = mode === 'continuous'
      ? `${LOCAL_URL}/api/scraper/run?mode=continuous`
      : `${LOCAL_URL}/api/scraper/run`

    console.log(`📡 POST ${apiUrl}`)

    const response = await makeRequest(apiUrl)

    console.log(`📥 Response: ${response.statusCode}`)

    if (response.statusCode === 200) {
      console.log('✅ SUCCESS!')
      if (mode === 'continuous') {
        console.log('📊 CONTINUOUS MODE RESULTS:')
      } else {
        console.log('📊 CRON MODE RESULTS:')
      }
      console.log(JSON.stringify(response.data, null, 2))
    } else {
      console.log('❌ FAILED!')
      console.log('❌ Error:', response.data)
      console.log('\n🔍 Troubleshooting:')
      console.log('  1. Make sure your local dev server is running (npm run dev)')
      console.log('  2. Check that EXTERNAL_SCRAPER_TOKEN matches .env.local')
      console.log('  3. Try running the VS Code task "Scrape NAFDAC (Local)"')
      process.exit(1)
    }

  } catch (error) {
    console.error('❌ NETWORK ERROR:', error.message)
    console.log('\n🔍 Troubleshooting:')
    console.log('  1. Make sure your local dev server is running on port 3000')
    console.log('  2. Check that there are no firewall/proxy issues')
    console.log('  3. Try running: curl -X GET http://localhost:3000/api/scraper/stats')
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Script crashed:', error)
    process.exit(1)
  })
}

module.exports = { makeRequest }
