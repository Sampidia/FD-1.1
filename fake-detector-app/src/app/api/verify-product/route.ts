import { NextRequest, NextResponse } from 'next/server'
import { EnhancedNafdacService } from '@/services/nafdac-service'
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth-minimal'
import "@/types/nextauth"
import prisma from '@/lib/prisma'
import { z } from 'zod'
// OCR processing removed - now handled by /api/analyze-image endpoint
import { nafdacDatabaseService } from '@/services/nafdac-database-service'

// Force dynamic rendering since this route uses request.headers
export const dynamic = 'force-dynamic'

// Interface for alert search results to fix implicit any types
interface AlertSearchResult {
  id: string
  title: string
  excerpt: string
  url: string
  batchNumbers: string[]
  manufacturer: string | null
  alertType: string
  severity: string
  scrapedAt: Date | string
  productNames?: string[]
}

// Security Headers Middleware
function addSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=()')
  return response
}

// Rate Limiting (simple in-memory store)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 10

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const userLimit = rateLimitStore.get(ip)

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  userLimit.count++
  return true
}

// Input validation schema
const verifyProductSchema = z.object({
  productName: z.string()
    .min(2, 'Product name must be at least 2 characters')
    .max(200, 'Product name must not exceed 200 characters')
    .regex(/^[^<>\"';&]*$/, 'Product name contains invalid characters'),

  productDescription: z.string()
    .optional() // Make description optional
    .refine((val) => !val || val.length >= 3, {
      message: 'Description must be at least 3 characters if provided'
    })
    .refine((val) => !val || val.length <= 1000, {
      message: 'Description must not exceed 1000 characters'
    })
    .refine((val) => !val || /^[^<>\"';&]*$/.test(val), {
      message: 'Description contains invalid characters'
    }),

  userBatchNumber: z.string()
    .max(50, 'Batch number must not exceed 50 characters')
    .regex(/^[A-Za-z0-9\-_\s]*$/, 'Batch number contains invalid characters')
    .optional(),

  images: z.array(z.string())
    .max(3, 'Maximum 3 images allowed')
    .optional()
})

// Enhanced logging for security events
function logSecurityEvent(event: string, data: {
  ip?: string
  userId?: string
  details?: Record<string, string | number | boolean>
}) {
  const timestamp = new Date().toISOString()
  console.log(`🔒 SECURITY EVENT [${timestamp}]: ${event}`, {
    ip: data.ip || 'unknown',
    userId: data.userId || 'unknown',
    details: data.details || {}
  })
}

// Input sanitization function
function sanitizeInput(input: string): string {
  return input.trim()
    .replace(/[<>\"';&]/g, '')
    .replace(/\s+/g, ' ')
    .substring(0, 1000)
}

// Fuzzy product name matching function - STRICTER VERSION
// MOVED UP to avoid hoisting issues
function fuzzyProductMatch(userInput: string, aiExtracted: string): boolean {
  if (!userInput || !aiExtracted) return false

  // Normalize strings for comparison
  const normalize = (str: string) => str.toLowerCase().trim()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize spaces

  const userNormalized = normalize(userInput)
  const aiNormalized = normalize(aiExtracted)

  // Exact match (case-insensitive)
  if (userNormalized === aiNormalized) {
    return true
  }

  // Substring check (whole user input must be contained in AI result)
  if (aiNormalized.includes(userNormalized)) {
    return true
  }

  // Split into words for more precise matching
  const userWords = userNormalized.split(/\s+/)
  const aiWords = aiNormalized.split(/\s+/)

  // Single word: must match exactly
  if (userWords.length === 1) {
    return aiWords.includes(userNormalized)
  }

  // Multiple words: require at least 80% of key words (>2 chars) to match exactly
  const keyWords = userWords.filter(word => word.length > 2)
  if (keyWords.length === 0) return false

  const exactMatches = keyWords.filter(word => aiWords.includes(word))
  const exactMatchRatio = exactMatches.length / keyWords.length

  // Require 80% exact matches, OR all words if <= 3 keywords
  return exactMatchRatio >= 0.8 || (keyWords.length <= 3 && exactMatches.length === keyWords.length)
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const clientIP = request.headers.get('x-forwarded-for') ||
                  request.headers.get('x-real-ip') ||
                  request.ip ||
                  'unknown'

  try {
    // 🔒 RATE LIMITING
    const isAllowed = checkRateLimit(clientIP)
    if (!isAllowed) {
      logSecurityEvent('Rate limit exceeded', {
        ip: clientIP,
        userId: 'unknown',
        details: { requestPath: '/api/verify-product' }
      })
      const response = NextResponse.json(
        { error: 'Too many requests', message: 'Please wait a moment before trying again.' },
        { status: 429 }
      )
      return addSecurityHeaders(response)
    }

    // 🔒 REQUEST VALIDATION
    let requestBody
    try {
      requestBody = await request.json()
      const validationResult = verifyProductSchema.safeParse(requestBody)
      if (!validationResult.success) {
        const response = NextResponse.json(
          { error: 'Invalid input', message: validationResult.error.issues[0]?.message || 'Invalid request format' },
          { status: 400 }
        )
        return addSecurityHeaders(response)
      }

      // Sanitize inputs
      requestBody.productName = sanitizeInput(requestBody.productName)
      requestBody.productDescription = sanitizeInput(requestBody.productDescription)
      if (requestBody.userBatchNumber) {
        requestBody.userBatchNumber = sanitizeInput(requestBody.userBatchNumber)
      }
    } catch (jsonError) {
      const response = NextResponse.json(
        { error: 'Invalid request format', message: 'Request body must be valid JSON' },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    // 🔒 AUTHENTICATION
    const session = await getServerSession(authOptions)
    if (!session) {
      const response = NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 })
      return addSecurityHeaders(response)
    }

    logSecurityEvent('Authenticated request', {
      ip: clientIP,
      userId: session.user.id,
      details: { requestPath: '/api/verify-product' }
    })

    // 🔒 USER VALIDATION
    let user
    try {
      user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          pointsBalance: true,
          planBasicPoints: true,
          planStandardPoints: true,
          planBusinessPoints: true,
          planFreePoints: true,
          email: true
        }
      })

      // 🔥 DYNAMICALLY ADD planFreePoints IF EXISTS (fallback for older databases)
      try {
        const userWithFreePoints = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { planFreePoints: true } as { planFreePoints: true }
        })
        if (userWithFreePoints && (userWithFreePoints as { planFreePoints?: number }).planFreePoints !== undefined) {
          (user as { planFreePoints?: number }).planFreePoints = (userWithFreePoints as { planFreePoints?: number }).planFreePoints || 0
        } else {
          (user as { planFreePoints?: number }).planFreePoints = 0 // Default if field doesn't exist
        }
      } catch (fieldError) {
        // Field might not exist in older databases
        (user as { planFreePoints?: number }).planFreePoints = 0
      }

      if (!user && session.user.email) {
        user = await prisma.user.create({
          data: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name || 'Unknown',
            pointsBalance: 5
          }
        })
      }

      // Calculate total available points across all plan tiers
      const totalAvailablePoints = (user?.planBusinessPoints || 0) +
                                  (user?.planStandardPoints || 0) +
                                  (user?.planBasicPoints || 0) +
                                  (user?.planFreePoints || 0) // 🔥 FIXED: Use planFreePoints instead of pointsBalance

      if (!user || totalAvailablePoints < 1) {
        const response = NextResponse.json({
          error: 'Insufficient points',
          message: 'You need at least 1 point for verification.'
        }, { status: 400 })
        return addSecurityHeaders(response)
      }
    } catch (dbError) {
      const response = NextResponse.json({
        error: 'Service temporarily unavailable',
        message: 'Please try again later.'
      }, { status: 503 })
      return addSecurityHeaders(response)
    }

    // Calculate total available points for logging (same formula as above)
    const loggedTotalPoints = (user?.planBusinessPoints || 0) +
                             (user?.planStandardPoints || 0) +
                             (user?.planBasicPoints || 0) +
                             (user?.planFreePoints || 0)

    console.log('🔍 DATABASE USER:', {
      found: !!user,
      points_balance: {
        legacy: user?.pointsBalance || 0,
        total_plan_points: loggedTotalPoints,  // Show actual total
        breakdown: {
          business: user?.planBusinessPoints || 0,
          standard: user?.planStandardPoints || 0,
          basic: user?.planBasicPoints || 0,
          free: user?.planFreePoints || 0
        }
      },
      user_email: user?.email
    })

    const { productName, productDescription, images, userBatchNumber } = requestBody

    console.log('🔍 VERIFICATION REQUEST:', {
      productName,
      userBatchNumber: userBatchNumber || 'none provided',
      imagesCount: images?.length || 0
    })

    // 🚨 INITIALIZE VARIABLES EARLY for decision logic
    let sourceUrl = 'https://nafdac.gov.ng/category/recalls-and-alerts/' // Default fallback

    // 🎯 SIMPLE PLAN DETECTION FOR POINT CONSUMPTION
    // Check for plan-specific fields to determine point consumption tier
    let businessPoints = 0
    let standardPoints = 0
    let basicPoints = 0

    try {
      // Try to get business points
      const businessData = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { planBusinessPoints: true } as { planBusinessPoints: true }
      })
      businessPoints = (businessData as { planBusinessPoints?: number })?.planBusinessPoints || 0
    } catch (error) {
      console.log('⚠️ Business points field not available')
    }

    try {
      // Try to get standard points
      const standardData = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { planStandardPoints: true } as { planStandardPoints: true }
      })
      standardPoints = (standardData as { planStandardPoints?: number })?.planStandardPoints || 0
    } catch (error) {
      console.log('⚠️ Standard points field not available')
    }

    try {
      // Try to get basic points
      const basicData = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { planBasicPoints: true } as { planBasicPoints: true }
      })
      basicPoints = (basicData as { planBasicPoints?: number })?.planBasicPoints || 0
    } catch (error) {
      console.log('⚠️ Basic points field not available')
    }

    console.log('📊 POINT BALANCE:', {
      business: businessPoints,
      standard: standardPoints,
      basic: basicPoints
    })

    // 🏆 DETERMINE PLAN FOR CONSUMPTION (Highest tier first)
    let userPlan = 'free'
    if (businessPoints > 0) {
      userPlan = 'business'
      console.log('🎯 Detected Business Plan User')
    } else if (standardPoints > 0) {
      userPlan = 'standard'
      console.log('🎯 Detected Standard Plan User')
    } else if (basicPoints > 0) {
      userPlan = 'basic'
      console.log('🎯 Detected Basic Plan User')
    } else {
      userPlan = 'free'
      console.log('🎯 Free Tier User')
    }

    // 🚨 CRITICAL DEBUG: Check total active alerts
    const totalActiveAlerts = await nafdacDatabaseService.countActiveAlerts()
    console.log('🚨 CRITICAL DEBUG: Total active NAFDAC alerts in database:', totalActiveAlerts)

    if (totalActiveAlerts === 0) {
      console.log('🚨 SERIOUS ISSUE: NO ACTIVE ALERTS FOUND IN DATABASE!')
      console.log('🚨 This explains why all products are marked as safe!')
    }

    // ✂️ OCR processing removed - now handled by /api/analyze-image endpoint

    // 🚀 CORRECTED LOGIC: Get all active NAFDAC alerts first, THEN compare user input
    console.log('🔍 CORRECTED LOGIC: Retrieving all active NAFDAC alerts for comparison...')

    const compareStart = Date.now()

    // 🎯 STEP 1: Retrieve ALL active NAFDAC alerts (legitimate problem products)
    // Use high limit to get all active alerts, then filter client-side
    const allActiveAlerts = await nafdacDatabaseService.searchAlerts({ limit: 1000 })
    console.log(`📊 Retrieved ${allActiveAlerts.length} active NAFDAC alerts`)

    if (allActiveAlerts.length === 0) {
      console.log('⚠️ No active alerts found - database may be empty')
    }

    // 🎯 STEP 2: Compare user input against each alert's structured data
    const matchingAlerts: AlertSearchResult[] = []
    const debugComparisons: { alertId: string; alertTitle: string; productMatch: boolean; batchMatch: boolean; matchType: string | null; confidence: number }[] = []

    for (const alert of allActiveAlerts) {
      const comparison = {
        alertId: alert.id,
        alertTitle: alert.title,
        productMatch: false,
        batchMatch: false,
        matchType: null as string | null,
        confidence: 0
      }

      // Primary comparison: Check against structured productNames array
      const structuredProducts = alert.productNames || []
      const structuredBatches = alert.batchNumbers || []

      // Fallback to AI-extracted data if structured data is empty
      const aiProducts = alert.aiProductNames || []
      const aiBatches = alert.aiBatchNumbers || []

      // Combine both structured and AI data
      const allProductNames = [...structuredProducts, ...aiProducts].filter(Boolean)
      const allBatchNumbers = [...structuredBatches, ...aiBatches].filter(Boolean)

      console.log(`🔍 Checking alert "${alert.title}" against user "${productName}"`)

      // 🎯 PRODUCT MATCHING LOGIC (3-STAGE PRIORITY)
      let productMatchScore = 0

      // STAGE 1: Check structured product names arrays (highest confidence - 100/80)
      if (allProductNames.length > 0) {
        // Try exact match first
        const exactProductMatch = allProductNames.some(alertProduct =>
          alertProduct.toLowerCase().trim() === productName.toLowerCase().trim()
        )

        if (exactProductMatch) {
          productMatchScore = 100
          comparison.productMatch = true
          console.log(`  ✅ Exact product match in arrays: "${productName}"`)
        } else {
          // Try fuzzy matching on product name arrays
          const isFuzzyMatch = fuzzyProductMatch(productName, allProductNames.join(' '))
          if (isFuzzyMatch) {
            productMatchScore = 80
            comparison.productMatch = true
            console.log(`  🤏 Fuzzy product match in arrays: "${productName}" ~ "${allProductNames.join(', ')}"`)
          }
        }
      }

      // STAGE 2: Check full content if no match in arrays (medium confidence - 70)
      if (productMatchScore === 0) {
        // Fetch full content only when needed for matching
        try {
          const alertsWithContent = await nafdacDatabaseService.getAlertsForAIAnalysis([alert.id])
          if (alertsWithContent.length > 0 && alertsWithContent[0].fullContent) {
            const fullContentMatch = fuzzyProductMatch(productName, alertsWithContent[0].fullContent)
            if (fullContentMatch) {
              productMatchScore = 70
              comparison.productMatch = true
              console.log(`  🟡 Product match in full content: "${productName}" found in alert content`)
            }
          }
        } catch (contentError) {
          console.log(`⚠️ Could not fetch full content for alert ${alert.id}`)
        }
      }

      // STAGE 3: Check title/excerpt as final fallback (lowest confidence - 60)
      if (productMatchScore === 0) {
        const titleExcerpt = `${alert.title} ${alert.excerpt || ''}`.toLowerCase()
        if (titleExcerpt.includes(productName.toLowerCase())) {
          productMatchScore = 60
          comparison.productMatch = true
          console.log(`  🤏 Title match: "${productName}" in alert title/excerpt (fallback)`)
        } else {
          console.log(`  ❌ No product match found in any source`)
        }
      }

      // 🎯 BATCH MATCHING LOGIC (3-STAGE PRIORITY)
      let batchMatchScore = 0

      // STAGE 1: Check structured batch arrays (highest confidence - 100)
      if (userBatchNumber && userBatchNumber.trim() && allBatchNumbers.length > 0) {
        // Normalize batch comparison (trim, uppercase)
        const userBatchNormalized = userBatchNumber.trim().toUpperCase()

        const exactBatchMatch = allBatchNumbers.some(alertBatch =>
          alertBatch.toUpperCase().trim() === userBatchNormalized
        )

        if (exactBatchMatch) {
          batchMatchScore = 100
          comparison.batchMatch = true
          console.log(`  ✅ Exact batch match in arrays: "${userBatchNormalized}"`)
        } else {
          console.log(`  ❌ No batch match in arrays: "${userBatchNormalized}"`)
        }
      }

      // STAGE 2: Check full content if no match in arrays (medium confidence - 85)
      if (batchMatchScore === 0 && userBatchNumber && userBatchNumber.trim()) {
        const userBatchNormalized = userBatchNumber.trim().toUpperCase()

        try {
          const alertsWithContent = await nafdacDatabaseService.getAlertsForAIAnalysis([alert.id])
          if (alertsWithContent.length > 0 && alertsWithContent[0].fullContent) {
            // Check if batch number appears in full content (exact match)
            const contentMatch = alertsWithContent[0].fullContent.toUpperCase().includes(userBatchNormalized)
            if (contentMatch) {
              batchMatchScore = 85
              comparison.batchMatch = true
              console.log(`  🟡 Batch match in full content: "${userBatchNormalized}" found in alert content`)
            }
          }
        } catch (contentError) {
          console.log(`⚠️ Could not fetch full content for batch checking: ${alert.id}`)
        }
      }

      // STAGE 3: No match found in any source (0 confidence)
      if (batchMatchScore === 0 && userBatchNumber && userBatchNumber.trim()) {
        console.log(`  ❌ No batch match found in any source`)
      }

      // 🎯 DETERMINE MATCH TYPE
      if (productMatchScore >= 80 && batchMatchScore >= 100) {
        // 🔴 EXACT MATCH - DEFINITE COUNTERFEIT
        comparison.matchType = 'EXACT_MATCH'
        comparison.confidence = Math.max(productMatchScore, batchMatchScore)
        matchingAlerts.push(alert)
        console.log(`  🎯 RESULT: EXACT MATCH COUNTERFEIT`)
      } else if (productMatchScore >= 60 && batchMatchScore < 100) {
        // 🟡 PRODUCT WARNING - DIFFERENT BATCH
        comparison.matchType = 'PRODUCT_WARNING_DIFFERENT_BATCH'
        comparison.confidence = productMatchScore
        matchingAlerts.push(alert)
        console.log(`  🎯 RESULT: PRODUCT WARNING (same product, different batch)`)
      } else if (productMatchScore < 60 && batchMatchScore >= 100) {
        // 🚨 BATCH WARNING - DIFFERENT PRODUCT
        comparison.matchType = 'BATCH_WARNING_DIFFERENT_PRODUCT'
        comparison.confidence = batchMatchScore
        matchingAlerts.push(alert)
        console.log(`  🎯 RESULT: BATCH WARNING (same batch, different product)`)
      } else if (productMatchScore > 0 || batchMatchScore > 0) {
        // 🤏 WEAK MATCH - May be relevant
        comparison.matchType = 'WEAK_MATCH'
        comparison.confidence = Math.max(productMatchScore, batchMatchScore)
        matchingAlerts.push(alert)  // ✅ CRITICAL FIX: Add weak matches to results!
        console.log(`  🤏 WEAK MATCH (${comparison.confidence}% confidence)`)
      } else {
        // ✅ NO MATCH
        comparison.matchType = 'NO_MATCH'
        console.log(`  ✅ No match`)
      }

      debugComparisons.push(comparison)
    }

    // 🎯 STEP 3: Deduplicate and prioritize matches
    const uniqueMatchingAlerts = matchingAlerts.filter((alert, index, self) =>
      index === self.findIndex(a => a.id === alert.id)
    )

    // Sort by confidence and recency
    const sortedAlerts = uniqueMatchingAlerts.sort((a, b) => {
      // Higher confidence first, then newer alerts
      const aConfidence = debugComparisons.find(c => c.alertId === a.id)?.confidence || 0
      const bConfidence = debugComparisons.find(c => c.alertId === b.id)?.confidence || 0

      if (aConfidence !== bConfidence) return bConfidence - aConfidence
      return new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime()
    }).slice(0, 10) // Top 10 most relevant

    console.log(`📊 Found ${sortedAlerts.length} matching alerts from ${allActiveAlerts.length} total alerts`)

    // Set source URL from best match
    if (sortedAlerts.length > 0) {
      sourceUrl = sortedAlerts[0].url
      console.log(`🔗 Using best match URL: ${sourceUrl}`)
    }

    const compareTime = Date.now() - compareStart
    console.log(`⚡ Comparison complete: ${sortedAlerts.length} matches in ${compareTime}ms`)

    // 🎯 CORRECTED DECISION LOGIC: Three-tier warning system based on direct alert comparison
    const searchTime = compareTime // Define searchTime for the result object
    let isCounterfeit = false
    let confidence = 0
    let summary = ''
    let alertType = "No Alert"
    let batchNumber = null
    let detectedAlerts: string[] = []

    // Determine if user provided batch number
    const userProvidedBatch = userBatchNumber && userBatchNumber.trim().length > 0
    console.log(`🎯 USER BATCH STATUS: ${userProvidedBatch ? `Provided: "${userBatchNumber}"` : 'Not provided by user'}`)

    if (sortedAlerts.length === 0) {
      // ✅ NO MATCHES FOUND: Safe product
      isCounterfeit = false
      confidence = 95  // High confidence when no alerts match
      alertType = "No Alert"
      batchNumber = null
      detectedAlerts = []

      summary = '✅ SAFE PRODUCT: No matching alerts found for this product/batch combination in NAFDAC database.'
      console.log(`🎯 DECISION: SAFE PRODUCT (no matches found)`)
    } else {
      // 🎯 ANALYZE MATCH TYPES FROM COMPARISON
      const exactMatches = debugComparisons.filter(c => c.matchType === 'EXACT_MATCH')
      const productWarnings = debugComparisons.filter(c => c.matchType === 'PRODUCT_WARNING_DIFFERENT_BATCH')
      const batchWarnings = debugComparisons.filter(c => c.matchType === 'BATCH_WARNING_DIFFERENT_PRODUCT')

      console.log(`📊 MATCH ANALYSIS: ${exactMatches.length} exact | ${productWarnings.length} product warnings | ${batchWarnings.length} batch warnings`)

      // 🎯 DECISION BRANCHING BASED ON MATCH TYPES
      if (exactMatches.length > 0) {
        // 🔴 EXACT MATCH - DEFINITE COUNTERFEIT
        const bestMatch = sortedAlerts[0]
        isCounterfeit = true
        confidence = Math.min(95, 85 + (exactMatches.length * 5))
        alertType = bestMatch.alertType || "CONFIRMED COUNTERFEIT"
        batchNumber = userBatchNumber || bestMatch.batchNumbers[0]
        detectedAlerts = sortedAlerts.slice(0, 3).map(a => a.title)

        summary = `🔴 FAKE/RECALL/EXPIRED PRODUCT DETECTED: "${productName}" matches ${exactMatches.length} NAFDAC alert(s).`
        if (sortedAlerts.length <= 3) {
          summary += '\n\nMatching Alerts:' + sortedAlerts.map((a, idx) => `\n${idx + 1}. ${a.title}`).join('')
        } else {
          summary += `\n\n${sortedAlerts[0].title} (and ${sortedAlerts.length - 1} other alerts)`
        }
        summary += `\n\n⚠️ This product batch has been officially recalled/reported as counterfeit by NAFDAC.`

        console.log(`🎯 DECISION: CONFIRMED COUNTERFEIT (${confidence}% confidence)`)
        console.log(`   Based on ${exactMatches.length} exact matches`)

      } else if (productWarnings.length > 0) {
        // 🟡 PRODUCT WARNING - SAME PRODUCT, DIFFERENT BATCH
        isCounterfeit = false
        confidence = Math.min(80, 60 + (productWarnings.length * 5))
        alertType = "PRODUCT_ALERT_DIFFERENT_BATCH"
        batchNumber = null
        detectedAlerts = sortedAlerts.slice(0, 3).map(a => a.title)

        const affectedBatches = sortedAlerts.flatMap(a => a.batchNumbers).join(', ')

        summary = `🟡 PRODUCT ALERT - YOUR BATCH MAY BE SAFE: "${productName}" appears in NAFDAC alerts, but your batch ${userProvidedBatch ? `"${userBatchNumber}" ` : ''}is not listed.`

        if (sortedAlerts.length <= 3) {
          sortedAlerts.forEach((alert, idx) => {
            const alertBatches = alert.batchNumbers?.join(', ') || 'unspecified batches'
            summary += `\n${idx + 1}. ${alert.title} (affected batches: ${alertBatches})`
          })
        } else {
          summary += `\n\nAffected alerts include: ${sortedAlerts[0].title} and ${sortedAlerts.length - 1} others`
        }

        summary += `\n\n✅ Your specific batch may be safe, but exercise caution with this product type and consult official sources.`

        console.log(`🎯 DECISION: PRODUCT WARNING - DIFFERENT BATCH (${confidence}% confidence)`)

      } else if (batchWarnings.length > 0) {
        // 🚨 BATCH WARNING - SAME BATCH, DIFFERENT PRODUCT
        isCounterfeit = false
        confidence = Math.min(75, 55 + (batchWarnings.length * 5))
        alertType = "BATCH_ALERT_DIFFERENT_PRODUCT"
        batchNumber = userBatchNumber
        detectedAlerts = sortedAlerts.slice(0, 3).map(a => a.title)

        summary = `🚨 BATCH ALERT DETECTED - POTENTIAL ISSUE: Your batch "${userBatchNumber}" appears in NAFDAC alerts for different products.`

        if (sortedAlerts.length <= 3) {
          sortedAlerts.forEach((alert, idx) => {
            const alertProducts = alert.productNames?.join(', ') || 'other products'
            summary += `\n${idx + 1}. ${alert.title} (affected products: ${alertProducts})`
          })
        }

        summary += `\n\n⚠️ This could indicate:`
        summary += `\n• Manufacturing contamination across batch`
        summary += `\n• Repackaging or distribution issues`
        summary += `\n• Counterfeit network using same batch numbering`

        summary += `\n\n⚠️ Exercise caution - while your specific product "${productName}" wasn't directly named, the batch number suggests potential issues.`

        console.log(`🎯 DECISION: BATCH WARNING - DIFFERENT PRODUCT (${confidence}% confidence)`)

      } else {
        // 🤏 WEAK MATCHES: Found matches but don't fit EXACT/PRODUCT/BATCH categories
        const weakMatches = debugComparisons.filter(c => c.matchType === 'WEAK_MATCH')
        if (weakMatches.length > 0) {
          // 🎯 HANDLE WEAK MATCHES PROPERLY - return alerts with low confidence
          isCounterfeit = false
          confidence = Math.min(70, 50 + (weakMatches.length * 5))
          alertType = "WEAK_MATCH_FOUND"
          batchNumber = null
          detectedAlerts = sortedAlerts.slice(0, 3).map(a => a.title)

          summary = `🟡 WEAK MATCH DETECTED: Found ${weakMatches.length} NAFDAC alert(s) with partial matches for "${productName}".`

          if (userProvidedBatch) {
            summary += ` Your batch "${userBatchNumber}" shows some similarities with alert data but not an exact match.`
          }

          if (sortedAlerts.length <= 3) {
            summary += '\n\nRelated Alerts:' + sortedAlerts.map((a, idx) => `\n${idx + 1}. ${a.title}`).join('')
          } else {
            summary += `\n\nTop alerts include: ${sortedAlerts[0].title} (and ${sortedAlerts.length - 1} more)`
          }

          summary += `\n\n⚠️ This is a WEAK match - exercise caution but this may not directly affect your specific product.`

          console.log(`🎯 DECISION: WEAK MATCH (${confidence}% confidence)`)
          console.log(`   Based on ${weakMatches.length} weak matches`)
        } else {
          // 🤏 GENERAL ALERTS: No exact criteria match, but alerts found (fallback)
          isCounterfeit = false
          confidence = Math.min(60, 40 + (sortedAlerts.length * 3))
          alertType = "GENERAL_SIMILAR_ALERTS"
          batchNumber = null
          detectedAlerts = sortedAlerts.slice(0, 3).map(a => a.title)

          summary = `🟡 SIMILAR PRODUCTS HAVE ALERTS: Found ${sortedAlerts.length} NAFDAC alert(s) for similar products to "${productName}".`

          if (!userProvidedBatch) {
            summary += `\n\n💡 Tip: Provide your batch number for more accurate verification of whether your specific product is affected.`
          }

          if (sortedAlerts.length <= 3) {
            summary += '\n\nRelated Alerts:' + sortedAlerts.map((a, idx) => `\n${idx + 1}. ${a.title}`).join('')
          }

          console.log(`🎯 DECISION: GENERAL ALERTS (${confidence}% confidence)`)
        }
      }
    }

    const result = {
      isCounterfeit,
      summary,
      source: "NAFDAC Database Check",
      sourceUrl,
      alertType,
      batchNumber,
      confidence,
      alertsFound: sortedAlerts.length,
      searchTime
    }

    console.log(`🎯 DECISION: ${result.isCounterfeit ? 'UNSAFE' : 'SAFE'} (${result.confidence}% confidence)`)

    // ✂️ AI Analysis removed - now handled by /api/analyze-image endpoint (database-only verification)
    // Consume 1 point from detected plan tier
    const { pointConsumptionService } = await import('@/services/point-consumption-service')

    const consumptionResult = await pointConsumptionService.consumeFromSpecificPlan(session.user.id, userPlan)

    if (!consumptionResult.success) {
      const response = NextResponse.json({
        error: 'Insufficient points',
        message: consumptionResult.error || 'You need at least 1 point for verification.'
      }, { status: 400 })
      return addSecurityHeaders(response)
    }

    console.log(`✅ 1 point consumed from ${userPlan} plan tier`)

    // Save scan result
    const savedResult = await prisma.productCheck.create({
      data: {
        userId: session.user.id,
        productName,
        productDescription,
        images: images || [],
        pointsUsed: 1
      }
    })

    // Handle results
    if (result.confidence === 0) {
      await prisma.checkResult.create({
        data: {
          userId: session.user.id,
          productCheckId: savedResult.id,
          isCounterfeit: false,
          summary: '✅ SAFE PRODUCT: No alerts found.',
          source: "NAFDAC Database Check",
          sourceUrl: sourceUrl, // Use the determined sourceUrl (alert URL if found, otherwise fallback)
          batchNumber: null,
          alertType: "No Alert",
          confidence: result.confidence // Use the computed confidence (95%)
        } as {
          userId: string
          productCheckId: string
          isCounterfeit: boolean
          summary: string
          source: string
          sourceUrl: string
          batchNumber: string | null
          alertType: string
          confidence: number
        }
      })

      const safeResponse = NextResponse.json({
        resultId: savedResult.id,
        isCounterfeit: false,
        confidence: result.confidence,
        summary: '✅ SAFE PRODUCT: No alerts found.',
        alertsFound: 0,
        verificationMethod: "NAFDAC Database Only",
        newBalance: user.pointsBalance - 1
      })
      return addSecurityHeaders(safeResponse)
    }

    // Save result as database-only verification
    await prisma.checkResult.create({
      data: {
        userId: session.user.id,
        productCheckId: savedResult.id,
        isCounterfeit: result.isCounterfeit,
        summary: result.summary,
        source: result.source,
        sourceUrl: result.sourceUrl || 'https://nafdac.gov.ng/category/recalls-and-alerts/',
        alertType: result.alertType,
        confidence: result.confidence,
        batchNumber: result.batchNumber,

        // No AI analysis data saved - OCR handled separately in /api/analyze-image
        aiEnhanced: false,
        aiProductName: null,
        aiBatchNumbers: [],
        aiReason: null,
        aiConfidence: null,
        aiAlertType: null
      }
    })

    // Final response for database-only verification
    const responseData = {
      resultId: savedResult.id,
      isCounterfeit: result.isCounterfeit,
      confidence: result.confidence,
      summary: result.summary,
      alertsFound: result.alertsFound,
      verificationMethod: "NAFDAC Database Only",
      sourceUrl: result.sourceUrl,
      newBalance: consumptionResult.pointsRemaining.total
    }

    logSecurityEvent('Verification completed', {
      ip: clientIP,
      userId: session.user.id,
      details: {
        isCounterfeit: result.isCounterfeit,
        confidence: result.confidence
      }
    })

    console.log('✅ Verification complete')

    // Point consumption and Save scan result logic goes here

    // Point consumption and Save scan result logic should go before returning the response

    const successResponse = NextResponse.json(responseData)
    return addSecurityHeaders(successResponse)
  } catch (error) {
    console.error('⨯ Verification error:', error)

    const errorResponse = NextResponse.json(
      { error: 'Verification failed', message: 'An error occurred during product verification. Please try again.' },
      { status: 500 }
    )
    return addSecurityHeaders(errorResponse)
  }
}
