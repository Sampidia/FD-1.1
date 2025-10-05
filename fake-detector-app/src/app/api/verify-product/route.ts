import { NextRequest, NextResponse } from 'next/server'
import { EnhancedNafdacService } from '@/services/nafdac-service'
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth-minimal'
import "@/types/nextauth"
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { aiRouter } from '@/services/ai/ai-router'
import { ocrFallbackManager } from '@/services/ocr-fallback-manager'
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
    let aiBatchNumbers: string[] = []
    let sourceUrl = 'https://nafdac.gov.ng/category/recalls-and-alerts/' // Default fallback

    // 🚨 CRITICAL DEBUG: Check total active alerts
    const totalActiveAlerts = await nafdacDatabaseService.countActiveAlerts()
    console.log('🚨 CRITICAL DEBUG: Total active NAFDAC alerts in database:', totalActiveAlerts)

    if (totalActiveAlerts === 0) {
      console.log('🚨 SERIOUS ISSUE: NO ACTIVE ALERTS FOUND IN DATABASE!')
      console.log('🚨 This explains why all products are marked as safe!')
    }

    // 🚀 AI-Enhanced Verification
    console.log('🔍 Starting AI-Enhanced Verification...')
    const nafdacService = new EnhancedNafdacService()
    await aiRouter.initializeProviders()

    // 🎯 HIERARCHICAL AI PLAN DETECTION
    let userPlan = 'free'
    let aiProvider = 'none'
    let aiEnabled = false

    try {
      // Check for plan-specific fields by trying different approaches
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

      // 🏆 HIERARCHICAL DETECTION (Highest tier first)
      if (businessPoints > 0) {
        userPlan = 'business'
        aiProvider = 'openai'
        aiEnabled = true
        console.log('🎯 Business Plan Detected → OpenAI Enabled')
      } else if (standardPoints > 0) {
        userPlan = 'standard'
        aiProvider = 'anthropic'
        aiEnabled = true
        console.log('🎯 Standard Plan Detected → Claude AI Enabled')
      } else if (basicPoints > 0) {
        userPlan = 'basic'
        aiProvider = 'google'
        aiEnabled = true
        console.log('🎯 Basic Plan Detected → Gemini AI Enabled')
      } else {
        userPlan = 'free'
        aiProvider = 'none'
        aiEnabled = false
        console.log('🎯 Free Tier Detected → AI Disabled')
      }

      if (aiEnabled && process.env.ENABLE_AI_ENHANCEMENT !== 'true') {
        aiEnabled = false
        aiProvider = 'none'
        console.log('⚠️ AI Enhancement disabled in environment')
      }
    } catch (error) {
      console.log('⚠️ Could not check point balances')
      userPlan = 'free'
      aiProvider = 'none'
      aiEnabled = false
    }

    console.log(`🤖 AI Status: ${aiEnabled ? `ENABLED (${userPlan} → ${aiProvider})` : 'DISABLED'}`)

    // OCR Processing with Fallback Manager (includes metrics collection)
    let ocrText = ''
    let aiExtractedData: { productName?: string; batchNumbers?: string[]; manufacturers?: string[]; confidence?: number } | null = null

    if (images && images.length > 0) {
      try {
        console.log(`🤖 Starting OCR processing with fallback manager for ${images.length} images...`)

        // Get correct OCR strategy order based on plan assignments
        let ocrStrategies: string[] = []
        if (userPlan !== 'free') {
          try {
            // Get plan assignments from AI router to determine correct OCR order
            // Pass null to get fallback plan-specific defaults for the given planId
            const planAssignments = await aiRouter.getAIAssignments(null, 'ocr')

            // Extract provider names in priority order for OCR strategies
            ocrStrategies = planAssignments
              .filter(assignment => assignment.aiType === 'ocr')
              .sort((a, b) => a.priority - b.priority)
              .map(assignment => assignment.provider)

            console.log(`🎯 Plan ${userPlan} OCR strategy order: ${ocrStrategies.join(' → ')}`)
          } catch (assignmentError) {
            console.warn('⚠️ Failed to get plan assignments, using fallback strategy order')
          }
        }

        // Fallback strategy order if plan assignments fail
        if (ocrStrategies.length === 0) {
          // Priority 1: Gemini for all OCR
          // Priority 2: Claude for all plans (fallback)
          if (userPlan === 'free' || userPlan === 'basic') {
            ocrStrategies = ['gemini', 'claude', 'tesseract']
          } else if (userPlan === 'standard') {
            ocrStrategies = ['gemini', 'claude', 'tesseract']
          } else if (userPlan === 'business') {
            ocrStrategies = ['gemini', 'claude', 'tesseract']
          } else {
            ocrStrategies = ['gemini', 'claude', 'tesseract'] // All plans
          }
        }

        // Use OCR Fallback Manager for comprehensive OCR processing with metrics
        const ocrFallbackOptions = {
          maxAttempts: userPlan === 'business' ? 5 : userPlan === 'standard' ? 4 : 3,
          maxTime: userPlan === 'business' ? 30000 : 25000,
          strategies: ocrStrategies,
          userPlan,
          enablePreprocessingRetry: userPlan !== 'free',
          minConfidence: userPlan === 'free' ? 0.4 : 0.6,
          enableManualFallback: false // We're handling fallbacks in the main logic
        }

        console.log(`🔄 Final OCR strategies for ${userPlan}: ${ocrStrategies.join(' → ')}`)

        const ocrResult = await ocrFallbackManager.processWithFallback(images, ocrFallbackOptions)
        console.log(`🤖 OCR Fallback result: ${ocrResult.success ? 'SUCCESS' : 'FAILED'}`)

        if (ocrResult.success && ocrResult.result) {
          // Extract structured data from OCR result
          aiExtractedData = {
            productName: ocrResult.result.productName,
            batchNumbers: [], // Will be populated from raw text parsing
            manufacturers: ocrResult.result.manufacturer ? [ocrResult.result.manufacturer] : [],
            confidence: ocrResult.result.confidence
          }

          // Use raw OCR text for database searching
          ocrText = ocrResult.result.rawText || ''

          // Add structured data to OCR text for search
          if (aiExtractedData.productName) {
            ocrText += ` ${aiExtractedData.productName}`
          }
          if (aiExtractedData.manufacturers && aiExtractedData.manufacturers.length > 0) {
            ocrText += ` ${aiExtractedData.manufacturers.join(' ')}`
          }

          console.log(`🎯 OCR extracted: ${aiExtractedData.productName || 'Unknown product'}`)
          console.log(`📊 OCR confidence: ${aiExtractedData.confidence}%`)
        } else {
          console.log('⚠️ OCR failed, using fallback text extraction')
          // Fallback to basic text extraction if OCR fails
          ocrText = `Product images provided but OCR extraction failed. User input: ${productName}`
        }
      } catch (ocrError) {
        console.error('🚨 OCR processing error:', ocrError)
        console.log('⚠️ OCR failed completely, continuing without OCR data')
        ocrText = `Product images provided but OCR processing failed. User input: ${productName}`
      }
    } else {
      console.log('📝 No images provided, using text-only processing')
    }

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

    // 🤖 ENHANCED AI ANALYSIS WITH NAFDAC DATABASE COMPARISON
    let aiEnhanced = false
    let aiConfidence = null
    let enhancedProductName = productName
    let aiProductNames: string[] = []
    // aiBatchNumbers is already declared earlier, don't redeclare it
    let aiReason = ''
    let aiAlertType = '' // Store AI-determined alert type for context-aware naming

    if (aiEnabled && sortedAlerts.length > 0) {
      console.log(`🤖 Starting enhanced ${aiProvider} AI analysis for ${sortedAlerts.length} found alerts...`)

      try {
        // VERIFICATION PROVIDER PRIORITY (Priority 1: Primary, Priority 2: Fallback)
        let providerPriority: string[] = []
        if (userPlan === 'business') {
          providerPriority = ['openai', 'gemini'] // OpenAI → Gemini
        } else if (userPlan === 'standard') {
          providerPriority = ['anthropic', 'gemini'] // Claude → Gemini
        } else {
          providerPriority = ['google', 'anthropic'] // Basic/Free: Gemini → Claude
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let aiService: any = null
        let finalAiProvider = aiProvider

        // Try providers in priority order
        for (const provider of providerPriority) {
          if (provider === 'google') {
            aiService = aiRouter['aiInstances']?.gemini
            finalAiProvider = 'google'
          } else if (provider === 'anthropic') {
            aiService = aiRouter['aiInstances']?.claude
            finalAiProvider = 'anthropic'
          } else if (provider === 'openai') {
            aiService = aiRouter['aiInstances']?.openai
            finalAiProvider = 'openai'
          }

          if (aiService) {
            console.log(`✅ AI Provider ${provider} available - using for verification`)
            break
          }
          console.warn(`⚠️ AI Provider ${provider} unavailable - trying fallback`)
        }

        if (!aiService) {
          console.warn(`🚨 No AI providers available for plan ${userPlan}`)
        } else {
          console.log('🔍 AI Service initialized successfully')

          // Step 1: Use the same alerts found in database search
          const relevantAlerts = sortedAlerts

          console.log(`📊 Using ${relevantAlerts.length} previously found alerts for AI analysis`)

          // Step 2: Fetch full content for these alerts
          const alertIds = relevantAlerts.map(alert => alert.id)
          const alertsWithContent = await nafdacDatabaseService.getAlertsForAIAnalysis(alertIds)

          console.log(`🎯 Retrieved full content for ${alertsWithContent.length} alerts`)

          // Step 3: Enhanced AI analysis comparing user input with NAFDAC content
          let nafdacContent = ''
          if (alertsWithContent.length > 0) {
            nafdacContent = alertsWithContent.map(alert =>
              `ALERT: ${alert.title}\nFULL CONTENT: ${alert.fullContent ? alert.fullContent.substring(0, 1500) : 'No full content available'}`
            ).join('\n\n--- ALERT SEPARATOR ---\n\n')

            console.log(`📋 AI processing ${nafdacContent.length} characters of NAFDAC content...`)
          }

          // Include OCR-extracted data if available
          let ocrDataSummary = 'No OCR data available'
          if (aiExtractedData) {
            ocrDataSummary = `OCR PRODUCT: ${aiExtractedData.productName || 'Unknown'}
OCR BATCHES: ${aiExtractedData.batchNumbers?.join(', ') || 'None found'}
OCR MANUFACTURERS: ${aiExtractedData.manufacturers?.join(', ') || 'Unknown'}
OCR CONFIDENCE: ${aiExtractedData.confidence || 'Unknown'}`
          }

          const userInputSummary = `
USER PRODUCT: ${productName}
USER DESCRIPTION: ${productDescription}
USER BATCH: ${userBatchNumber || 'Not Provided'}
OCR TEXT: ${ocrText || 'None available'}
${ocrDataSummary}
NAFDAC ALERTS FOUND: ${alertsWithContent.length}
ALERTS TITLES: ${relevantAlerts.map(a => a.title).join('; ')}`

          console.log('🔍 Starting AI analysis with user input and NAFDAC content...')

          // Step 4: HYBRID AI ANALYSIS WITH ENHANCED BATCH EXTRACTION
          const analysisPrompt = `ANALYSIS TASK: Analyze this product's NAFDAC alert information and extract batch numbers for Nigerian products.

USER INPUT SUMMARY:
${userInputSummary}

RELEVANT NAFDAC ALERTS:
${nafdacContent}

INSTRUCTIONS - IMPORTANT BATCH NUMBER PATTERNS:
1. Look for numeric batch numbers like: 39090439, 12345678, 98765432
2. Look for alphanumeric batches like: UI4004, ABC123, XYZ789, BatchA123
3. Look for patterns like "batch XXXXXXXXXX", "lot number XXXXXXXX", "Batch: XX9999", "UIXXXXXX", "BATCH-NO-XXXXXX"
4. Extract ALL batch numbers found in the alert content (even falsified/expired ones mentioned for reference)
5. Compare user input with NAFDAC alert content to find matching or similar batches
6. Extract clean product name (remove manufacturer details if possible)
7. Summarize why this product has alerts and potential safety concerns
8. Rate confidence in analysis (1-100%) and classify alert type

RESPONSE FORMAT (ONLY RETURN JSON, NO OTHER TEXT):
{
  "productName": "clean product name",
  "batchNumbers": ["39090439", "UI4004", "any_found_batches"],
  "reason": "detailed reason for alerts and safety concerns",
  "alertType": "FAKE|EXPIRED|RECALL|CONTAMINATED|OTHER",
  "confidence": 85,
  "extractionSuccess": true
}`

          console.log('🤖 Sending analysis request to AI service...')

          const aiAnalysisResponse = await aiService.processText({
            text: analysisPrompt,
            task: 'analysis'
          })

          console.log('📡 AI service response received')

          if (aiAnalysisResponse?.extractedData) {
            console.log('🧠 AI Analysis Response:', aiAnalysisResponse.extractedData)

            const analysisData = aiAnalysisResponse.extractedData

            // Save AI analysis results
            aiEnhanced = true
            aiBatchNumbers = analysisData.batchNumbers || []
            aiReason = analysisData.reason || 'Product has active NAFDAC alerts requiring attention'
            aiConfidence = analysisData.confidence ?? 80  // Use 80% as meaningful AI default
            aiAlertType = analysisData.alertType || ''  // Store AI-determined alert type

            // 🎯 SMART PRODUCT NAME PRESERVATION
            // Only replace user's product name if it doesn't match any alerts
            // This prevents AI from overwriting user input with title-extracted names
            const userProductMatchesAlert = sortedAlerts.some((alert) =>
              alert.productNames?.some((alertProduct: string) =>
                alertProduct.toLowerCase().includes(productName.toLowerCase())
              )
            )

            if (userProductMatchesAlert && productName) {
              // KEEP user's original product name - it's valid
              aiProductNames = [productName]
              enhancedProductName = productName
              console.log(`🔒 PRESERVED user product name: "${productName}" (found in alert data)`)
            } else {
              // Use AI-extracted product name or fallback
              aiProductNames = analysisData.productName ? [analysisData.productName] : [enhancedProductName]
              enhancedProductName = aiProductNames[0] || productName
              console.log(`🤖 Used AI extracted product name: "${enhancedProductName}"`)
            }

            // 🛟 FIX FOR USER BATCH COMPARISON BUG
            // This was the PRIMARY CAUSE: aiBatchNumbers was empty, so batch comparison failed
            if (aiBatchNumbers.length === 0 && alertsWithContent.length > 0) {
              console.log('🛟 FALLBACK: Extracting batches from database alerts...')

              // Extract from the top alert's batchNumbers
              const alertBatches = alertsWithContent[0].batchNumbers || []
              if (alertBatches.length > 0) {
                aiBatchNumbers = alertBatches
                console.log(`🛟 Used fallback batches from alert: ${aiBatchNumbers.join(', ')}`)
              }
            }

          console.log(`🔍 AI Extracted Product: ${enhancedProductName}`)
          console.log(`🧾 Final AI Batches: ${aiBatchNumbers.join(', ')} (${aiBatchNumbers.length > 0 ? '✅ FOUND' : '❌ EMPTY'})`)
          console.log(`📋 AI Reason: ${aiReason.substring(0, 100)}...`)

          // Step 5: Save AI analysis to database alerts (for future reference)
          try {
            for (const alert of alertsWithContent.slice(0, 3)) { // Update up to 3 alerts
              await nafdacDatabaseService.updateAlertWithAIAnalysis(alert.id, {
                aiExtracted: true,
                aiProductNames: aiProductNames,
                aiBatchNumbers: aiBatchNumbers,
                aiReason: aiReason,
                aiConfidence: aiConfidence
              })
            }
            console.log(`💾 Updated ${alertsWithContent.length} NAFDAC alerts with AI analysis`)
          } catch (dbError) {
            console.warn('⚠️ Failed to save AI analysis to database:', dbError)
          }

          // Step 6: Boost confidence if AI finds strong evidence
          if (result.confidence < 90 && aiConfidence > 75) {
            result.confidence = Math.min(95, result.confidence + 5)
            console.log(`🎯 AI confidence boost: ${result.confidence}%`)
          }

          } else {
            console.log('⚠️ AI analysis returned no structured data, using fallback')
            console.log('🔍 FALLBACK DEBUG: About to trigger batch fallback...')

            // Fallback: Extract batches from alertsWithContent if available
            if (alertsWithContent && alertsWithContent.length > 0) {
              console.log(`🔍 FALLBACK DEBUG: alertsWithContent has ${alertsWithContent.length} alerts`)
              for (const alert of alertsWithContent.slice(0, 2)) {
                console.log(`🔍 FALLBACK DEBUG: Alert ${alert.id} has batches: ${JSON.stringify(alert.batchNumbers)}`)
              }
            } else {
              console.log('🔍 FALLBACK DEBUG: alertsWithContent is empty or undefined')
            }

            console.log(`🔍 FALLBACK DEBUG: aiBatchNumbers before fallback: ${JSON.stringify(aiBatchNumbers)}`)

            // Try to extract batches from the first alert
            if (alertsWithContent && alertsWithContent.length > 0 && alertsWithContent[0].batchNumbers) {
              aiBatchNumbers = alertsWithContent[0].batchNumbers
              console.log(`🛟 SUCCESS: Fallback extracted batches: ${aiBatchNumbers.join(', ')}`)
            } else {
              console.log('🛟 FAILED: No batches found in fallback')
            }

            console.log(`🔍 FALLBACK DEBUG: aiBatchNumbers after fallback: ${JSON.stringify(aiBatchNumbers)}`)

            // Fallback: Create basic AI analysis from available data
            aiEnhanced = true
            aiProductNames = [enhancedProductName]
            aiReason = `Product has ${alertsWithContent.length} active NAFDAC alerts. Most recent: "${alertsWithContent[0]?.title}". Consult official sources for detailed information.`
            aiConfidence = 75

            console.log('✅ Using fallback AI analysis')
          }

          console.log(`✅ AI Enhancement Complete: ${aiEnhanced ? `Enhanced (${aiProductNames.length} products, ${aiBatchNumbers.length} batches)` : 'No enhancement'}`)

        }

      } catch (aiError) {
        console.error('🚨 AI Enhancement Error:', aiError instanceof Error ? aiError.message : String(aiError))
        console.warn('⚠️ AI enhancement failed, proceeding without analysis')
        aiEnhanced = false
      }
    } else {
      console.log(`🤖 AI skipped: ${!aiEnabled ? 'AI not enabled' : 'No alerts found for analysis'}`)
    }

    console.log('✅ AI Analysis Phase Complete')

    // 🛟 COMPREHENSIVE FALLBACK: If AI failed OR didn't find batches, use structured data
    if (!aiEnhanced && sortedAlerts.length > 0) {
      console.log('🛟 AI failed, but we have alerts - creating fallback analysis')
      aiEnhanced = false  // Don't mark as enhanced since no AI was used
      aiProductNames = [enhancedProductName]
      aiReason = `Product has ${sortedAlerts.length} active NAFDAC alerts. Most recent: "${sortedAlerts[0].title}". No AI analysis available for your plan tier.`
      aiConfidence = 75

      // ALWAYS try to extract batch numbers from database
      if (sortedAlerts[0].batchNumbers && sortedAlerts[0].batchNumbers.length > 0) {
        aiBatchNumbers = sortedAlerts[0].batchNumbers
        console.log(`🛟 Fallback extracted batches from alert: ${aiBatchNumbers.join(', ')}`)
      }
    }

    console.log(`✅ Final Analysis State: AI=${aiEnhanced ? 'Enabled' : 'Disabled'}, Batches=${aiBatchNumbers.length}`)

    // 🛟 ENHANCED POST-AI DIFFERENTIAL MATCHING: Compare user input vs AI extractions for proper categorization
    if (aiEnhanced && sortedAlerts.length > 0 && userProvidedBatch && aiBatchNumbers.length > 0) {
      console.log(`🔄 ENHANCED POST-AI DIFERENTIAL MATCHING: ${aiBatchNumbers.length} batches, AI product: "${enhancedProductName}"`)

      // STEP 1: COMPARE AI EXTRACTIONS VS USER INPUT
      const aiProductMatch = fuzzyProductMatch(productName, enhancedProductName || '')
      const aiBatchMatch = aiBatchNumbers.some(aiBatch =>
        aiBatch.toUpperCase().trim() === userBatchNumber.toUpperCase().trim()
      )

      console.log(`🔍 MATCH ANALYSIS: Product ${aiProductMatch ? '✅' : '❌'} | Batch ${aiBatchMatch ? '✅' : '❌'}`)

      // STEP 2: DECIDE RESULT BASED ON AI INPUT COMPARISON
      const wasOriginallySafe = (alertType === "No Alert") || (alertType === "GENERAL_PRODUCT_ALERTS")
      const wasOriginallyPartial = (alertType === "PRODUCT_ALERT_DIFFERENT_BATCH") || (alertType === "BATCH NUMBER ALERT BUT DIFFERENT PRODUCT")
      const wasOriginallyCounterfeit = result.isCounterfeit

      if (aiProductMatch && aiBatchMatch) {
        // 🔴 CONFIRMED COUNTERFEIT: BOTH AI product AND batch match user input
        isCounterfeit = true
        confidence = Math.min(95, 85 + (aiConfidence || 10))
        alertType = "CONFIRMED COUNTERFEIT"
        batchNumber = userBatchNumber
        detectedAlerts = sortedAlerts.map(a => a.title)

        summary = `🔴 CONFIRMED FAKE/COUNTERFEIT DETECTED VIA AI ENHANCED ANALYSIS: "${productName}" with batch "${userBatchNumber}" matches NAFDAC alerts for "${enhancedProductName}".`

        if (aiReason) {
          summary += `\n\n${aiReason}`
        }

        console.log(`🎯 CONFIRMED COUNTERFEIT: Both AI product and batch match user input`)

        // CONTEXT-AWARE TYPE BASED ON AI ALERT TYPE
        if (aiAlertType) {
          const aiType = aiAlertType.toUpperCase()
          if (aiType.includes("EXPIRED")) {
            alertType = "CONFIRMED EXPIRED"
          } else if (aiType.includes("RECALL")) {
            alertType = "CONFIRMED RECALL"
          } else if (aiType.includes("CONTAMINATED")) {
            alertType = "CONFIRMED CONTAMINATED"
          }
        }

      } else if (aiProductMatch && !aiBatchMatch) {
        // 🟡 PRODUCT ALERT - DIFFERENT BATCH: AI product matches, batch doesn't
        isCounterfeit = false
        confidence = Math.min(75, Math.max(confidence, 60))
        alertType = "PRODUCT_ALERT_DIFFERENT_BATCH"
        batchNumber = userBatchNumber

        summary = `🟡 PRODUCT ALERTS FOUND - YOUR BATCH MAY NOT BE AFFECTED: ${productName} matches NAFDAC alerts for ${enhancedProductName}, but batch ${userBatchNumber} is not affected.`

        if (aiReason) {
          summary += `\n\nAI Analysis: ${aiReason}`
        }

        console.log(`🎯 PRODUCT ALERT - DIFFERENT BATCH: AI product matches, batch doesn't`)

      } else if (!aiProductMatch && aiBatchMatch) {
        // 🚨 BATCH ALERT - DIFFERENT PRODUCT: AI batch matches, product doesn't
        isCounterfeit = false
        confidence = Math.min(70, Math.max(confidence, 55))
        alertType = "BATCH NUMBER ALERT BUT DIFFERENT PRODUCT"
        batchNumber = userBatchNumber

        const aiProductNamesDisplay = enhancedProductName && enhancedProductName !== 'Unknown' ?
          `product "${enhancedProductName}"` : 'unknown products'

        summary = `🚨 BATCH ALERT DETECTED - PRODUCT MISMATCH: Your batch "${userBatchNumber}" appears in NAFDAC alerts for ${aiProductNamesDisplay}, but this may not affect your "${productName}".`

        if (aiReason) {
          summary += `\n\n⚠️ Important: This batch number is associated with alerts for different products. Exercise caution but note that your specific product "${productName}" wasn't directly mentioned in these alerts.`
        }

        console.log(`🚨 BATCH ALERT - DIFFERENT PRODUCT: AI batch matches but product doesn't`)

      } else {
        // 🔄 NO NEW MATCHES: Keep original decision but enhance with AI info
        console.log(`🔍 AI extractions don't match user input, keeping original decision: ${alertType}`)
      }

      // UPDATE RESULT OBJECT
      result.isCounterfeit = isCounterfeit
      result.alertType = alertType
      result.confidence = confidence
      result.summary = summary
      result.batchNumber = batchNumber
    }

    // Point consumption - deduct from the specific plan tier that was used for AI analysis
    const { pointConsumptionService } = await import('@/services/point-consumption-service')

    // Use the AI tier that was actually used (userPlan), not user's assigned plan hierarchy
    const consumptionResult = await pointConsumptionService.consumeFromSpecificPlan(session.user.id, userPlan)

    if (!consumptionResult.success) {
      const response = NextResponse.json({
        error: 'Insufficient points',
        message: consumptionResult.error || `${userPlan} plan points required`
      }, { status: 400 })
      return addSecurityHeaders(response)
    }

    console.log(`✅ Points consumed from ${userPlan} plan tier, balances:`, consumptionResult.pointsRemaining)

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

    // Save result for unsafe products WITH AI Data
    await prisma.checkResult.create({
      data: {
        userId: session.user.id,
        productCheckId: savedResult.id,
        isCounterfeit: result.isCounterfeit,
        summary: result.summary,
        source: result.source,
        sourceUrl: result.sourceUrl || 'https://nafdac.gov.ng/category/recalls-and-alerts/', // ✅ Now properly saved
        alertType: result.alertType,
        confidence: result.confidence,
        batchNumber: result.batchNumber, // ✅ Add missing batchNumber field

        // 🎯 SAVE AI ANALYSIS DATA (just like free tier data)
        aiEnhanced: aiEnhanced,
        aiProductName: aiProductNames[0] || null,
        aiBatchNumbers: aiBatchNumbers || [],
        aiReason: aiReason,
        aiConfidence: aiConfidence,
        aiAlertType: alertType
      } as {
        userId: string
        productCheckId: string
        isCounterfeit: boolean
        summary: string
        source: string
        sourceUrl: string
        alertType: string
        confidence: number
        batchNumber: string | null
        aiEnhanced: boolean
        aiProductName: string | null
        aiBatchNumbers: string[]
        aiReason: string
        aiConfidence: number | null
        aiAlertType: string
      }
    })

    // Final response with AI analysis results
    const responseData = {
      resultId: savedResult.id,
      isCounterfeit: result.isCounterfeit,
      confidence: result.confidence,
      summary: result.summary,
      alertsFound: result.alertsFound,
      verificationMethod: aiEnhanced
        ? `AI-Enhanced (${userPlan} Plan)`
        : "NAFDAC Database Only",

      // 🔗 USE REAL ALERT URL FROM RESULT
      sourceUrl: result.sourceUrl,

      // Include AI analysis results at top level
      ...(aiEnhanced && {
        aiAnalysis: {
          productName: enhancedProductName,
          batchNumbers: aiBatchNumbers,
          reason: aiReason,
          confidence: aiConfidence,
          alertType: alertType,
          isEnhanced: true
        }
      }),

      // Original structure for backward compatibility
      ...(aiEnhanced && { aiEnhanced: true, aiConfidence }),
      enhancedProductName: aiEnhanced ? enhancedProductName : productName,
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
