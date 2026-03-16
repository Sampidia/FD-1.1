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
    .regex(/^[A-Za-z0-9\-_\s\/\.]*$/, 'Batch number contains invalid characters')
    .optional(),

  images: z.array(z.string())
    .max(3, 'Maximum 3 images allowed')
    .optional(),
  preferredProvider: z.string().optional()
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

    console.log('🔍 DATABASE USER:', {
      found: !!user,
      points_balance: user?.pointsBalance,
      user_email: user?.email
    })

    const { productName, productDescription, images, userBatchNumber, preferredProvider } = requestBody

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
        aiProvider = preferredProvider === 'amazon-nova' ? 'amazon-nova' : 'google'
        aiEnabled = !!preferredProvider || true // Default to true if you want free users to have AI
        console.log(`🎯 Free Tier Detected → AI Enabled with ${aiProvider}`)
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
    let aiExtractedData: any = null

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
          if (userPlan === 'basic') {
            ocrStrategies = ['gemini', 'tesseract']
          } else if (userPlan === 'standard') {
            ocrStrategies = ['anthropic', 'gemini', 'tesseract']
          } else if (userPlan === 'business') {
            ocrStrategies = ['openai', 'anthropic', 'gemini', 'tesseract']
          } else {
            ocrStrategies = ['gemini', 'tesseract'] // Free tier
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
          enableManualFallback: false,
          preferredProvider
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

    // Enhanced Database Search - Multiple strategies for better matching
    const searchText = `${productName} ${productDescription} ${userBatchNumber || ''} ${ocrText}`.toLowerCase().trim()
    console.log('🔍 Searching NAFDAC database with enhanced matching...')
    console.log('📋 Search terms:', { productName, searchText: searchText.substring(0, 100) + '...' })

    // 🚨 CRITICAL DEBUG: Check if product is in our known seeded products
    const knownSeededProducts = ['postinor', 'amoxicillin', 'paracetamol', 'coartem']
    const knownBatches = ['TXXXXXB', 'A2023001', 'PCT2023002', 'MALARIA001']

    const isKnownProduct = knownSeededProducts.some(p =>
      productName.toLowerCase().includes(p) || productDescription.toLowerCase().includes(p)
    )
    const isKnownBatch = userBatchNumber && knownBatches.includes(userBatchNumber.trim().toUpperCase())

    console.log('🧪 KNOWN SEED PRODUCT CHECK:')
    console.log(`  - Is known seeded product: ${isKnownProduct}`)
    console.log(`  - Is known batch: ${isKnownBatch}`)
    console.log(`  - Product name search: "${productName}"`)
    console.log(`  - Batch number search: "${userBatchNumber || 'none'}"`)

    if (isKnownProduct || isKnownBatch) {
      console.log('🚨 ALERT: This is a KNOWN seeded product/batch that should be detected!')
      console.log('🚨 If it shows as safe, the search logic is broken!')
    }

    const searchStart = Date.now()

    // Strategy 1: Batch-based search (highest priority)
    let batchMatches: AlertSearchResult[] = []
    if (userBatchNumber && userBatchNumber.trim()) {
      console.log(`🔍 Batch search initiated for: "${userBatchNumber.trim()}"`)

      try {
        const batchSearchResults = await nafdacDatabaseService.searchAlerts({
          batchNumber: userBatchNumber.trim(),
          limit: 10
        })
        batchMatches = batchSearchResults
        console.log(`🎯 Batch search result: ${batchMatches.length} matches found`)

        if (batchMatches.length === 0) {
          console.log('⚠️ No batch matches - checking if alerts have batch numbers...')

          // Debug: Check if any active alerts actually have batch numbers
          const alertsWithBatches = await nafdacDatabaseService.searchAlerts({
            limit: 10
          })

          console.log('📊 Active alerts with batch numbers:')
          alertsWithBatches.forEach(alert => {
            console.log(`  - ${alert.title}: ${JSON.stringify(alert.batchNumbers)}`)
          })
        } else {
          console.log('🎯 Batch matches found:', batchMatches.map(b => ({ title: b.title, batches: b.batchNumbers })))
        }
      } catch (batchSearchError) {
        console.error('🚨 Batch search failed with retry logic:', batchSearchError)
        // Continue with other search strategies
        batchMatches = []
      }
    } else {
      console.log(`⚠️ No batch number provided for batch search: "${userBatchNumber}"`)
    }

    // Strategy 2: Multiple product name search strategies (RESTRICTED VERSION)
    let nameMatches1: AlertSearchResult[] = []
    let nameMatches2: AlertSearchResult[] = []
    let nameMatches3: AlertSearchResult[] = []

    const searchTerms = productName.split(/\s+/).filter((term: string) =>
      term.length > 3 && !['mg', 'ml', 'mcg', 'g', 'kg', 'mls', 'iu'].includes(term.toLowerCase())
    ).slice(0, 2) // Only first 2 longest keywords

    console.log('🔍 Extracted search terms (restricted):', searchTerms)

    if (searchTerms.length > 0) {
      try {
        // Strategy 2A: Exact title matches (most restrictive)
        const exactTitleMatches = await nafdacDatabaseService.searchAlerts({
          keywords: [productName.trim()],
          limit: 3
        })
        nameMatches1 = exactTitleMatches

        // Strategy 2B: REMOVED - Too broad keyword matching causing false matches
        // This was causing amoxicillin to show for unrelated products!
        nameMatches2 = []

        // Strategy 2C: Strict product name matching (FIXED VERSION)
        // Only find alerts where the specific product name appears in the productNames array

        // First, try to find exact product name matches
        const exactProductMatches = await nafdacDatabaseService.searchAlerts({
          productNames: [productName.trim().toLowerCase()],
          limit: 5
        })

        // Fallback: Look for individual keywords if no exact matches
        let keywordProductMatches: AlertSearchResult[] = []
        if (exactProductMatches.length === 0) {
          // Search for each keyword separately
          for (const term of searchTerms.slice(0, 2)) {
            const keywordMatches = await nafdacDatabaseService.searchAlerts({
              productNames: [term.toLowerCase()],
              keywords: [productName.split(' ')[0]], // First word of product name
              limit: 3
            })
            keywordProductMatches.push(...keywordMatches)
          }
        }

        // Combine exact and keyword matches
        nameMatches3 = [...exactProductMatches, ...keywordProductMatches].filter(
          // Remove duplicates by ID
          (alert, index, self) => self.findIndex((a: typeof alert) => a.id === alert.id) === index
        )
      } catch (productSearchError) {
        console.error('🚨 Product search failed with retry logic:', productSearchError)
        // Continue with description search
        nameMatches1 = []
        nameMatches2 = []
        nameMatches3 = []
      }
    }

    // Strategy 3: Description/excerpt search as fallback
    let descMatches: AlertSearchResult[] = []
    if (productDescription && productDescription.length > 10) {
      const descKeywords = productDescription.split(/\s+/)
        .filter((word: string) => word.length > 4 && !/^\d+$/.test(word))
        .slice(0, 3)

      if (descKeywords.length > 0) {
        try {
          const descSearch = await nafdacDatabaseService.searchAlerts({
            keywords: descKeywords,
            limit: 3
          })
          descMatches = descSearch
        } catch (descSearchError) {
          console.error('🚨 Description search failed with retry logic:', descSearchError)
          descMatches = []
        }
      }
    }

    // Combine all matches and deduplicate by ID
    const allMatches: AlertSearchResult[] = [...batchMatches, ...nameMatches1, ...nameMatches2, ...nameMatches3, ...descMatches]

    console.log(`📊 Search breakdown:`, {
      batches: batchMatches.length,
      exactTitle: nameMatches1.length,
      keywords: nameMatches2.length,
      productsArray: nameMatches3.length,
      descriptions: descMatches.length
    })

    // 🔍 DEBUGGING: Log sample search results
    if (batchMatches.length > 0) {
      console.log('🔍 Batch matches found:', batchMatches.slice(0, 2).map(b => ({ title: b.title, batchNumbers: b.batchNumbers })))
    }
    if (nameMatches1.length > 0) {
      console.log('🔍 Exact title matches found:', nameMatches1.slice(0, 2).map(n => ({ title: n.title, productNames: n.productNames })))
    }
    if (nameMatches3.length > 0) {
      console.log('🔍 Product array matches found:', nameMatches3.slice(0, 2).map(n => ({ title: n.title, productNames: n.productNames })))
    }

    // Remove duplicates based on ID - PREFER ALERTS WITH productNames
    const uniqueMatches: AlertSearchResult[] = allMatches.reduce((acc, current) => {
      const existing = acc.find(item => item.id === current.id)

      // If we haven't seen this alert, add it
      if (!existing) {
        acc.push(current)
      }
      // If we have seen it, prefer the one with productNames
      else if ((current.productNames?.length ?? 0) > 0 && (existing.productNames?.length ?? 0) === 0) {
        // Replace the existing alert with this one (which has productNames)
        const index = acc.findIndex(item => item.id === current.id)
        acc[index] = current
      }
      // Keep the existing one if it already has productNames or current doesn't have them

      return acc
    }, [] as AlertSearchResult[])

    console.log(`🧹 Deduplication: ${allMatches.length} → ${uniqueMatches.length} unique matches`)

    // 🔍 FINAL VERIFICATION: Log final unique matches
    if (uniqueMatches.length > 0) {
      console.log('✅ FINAL MATCHES FOUND:')
      uniqueMatches.forEach((match, index) => {
        console.log(`  ${index + 1}. ${match.title} (${match.alertType})`)
        console.log(`     Product names: ${JSON.stringify(match.productNames)}`)
        console.log(`     Batch numbers: ${JSON.stringify(match.batchNumbers)}`)
      })
    } else {
      console.log('❌ NO MATCHES FOUND - THIS IS THE PROBLEM!')
      console.log('❌ Search terms:', searchTerms)
      console.log('❌ Product name:', productName)
      console.log('❌ Batch number:', userBatchNumber)
    }

    // Sort by most relevant (recent alerts and exact matches first)
    const orderedMatches = uniqueMatches.sort((a, b) => {
      // Prioritize exact matches or recent alerts
      const aTitleMatch = searchTerms.some((term: string) =>
        a.title.toLowerCase().includes(term.toLowerCase())
      ) ? 1 : 0
      const bTitleMatch = searchTerms.some((term: string) =>
        b.title.toLowerCase().includes(term.toLowerCase())
      ) ? 1 : 0

      if (aTitleMatch !== bTitleMatch) return bTitleMatch - aTitleMatch
      return new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime()
    }).slice(0, 8) // Take top 8 most relevant

    // Use sorted matches as final alerts - simplified typing to match actual data structure
    const uniqueAlerts = orderedMatches.map(alert => ({
      id: alert.id,
      title: alert.title,
      excerpt: alert.excerpt,
      url: alert.url,
      batchNumbers: alert.batchNumbers,
      manufacturer: alert.manufacturer,
      alertType: alert.alertType,
      severity: alert.severity,
      scrapedAt: alert.scrapedAt,
      productNames: alert.productNames || []  // ✅ Ensure productNames is preserved
    }))

    // Set sourceUrl from the first alert if any alerts were found
    if (uniqueAlerts.length > 0) {
      sourceUrl = uniqueAlerts[0].url
      console.log(`🔗 Using alert URL for source: ${sourceUrl}`)
    }

    const searchTime = Date.now() - searchStart
    console.log(`⚡ Search complete: ${uniqueAlerts.length} matches in ${searchTime}ms`)

    // 🟡 ENHANCED BATCH-AWARE DECISION LOGIC
    let isCounterfeit = false
    let confidence = 0
    let summary = ''
    let alertType = "No Alert"
    let batchNumber = null
    let detectedAlerts: string[] = []

    // Determine if user provided their own batch number
    const userProvidedBatch = userBatchNumber && userBatchNumber.trim().length > 0

    console.log(`🎯 USER BATCH STATUS: ${userProvidedBatch ? `Provided: "${userBatchNumber}"` : 'Not provided by user'}`)

    // 🎯 SMART BATCH COMPARISON LOGIC
    if (uniqueAlerts.length > 0) {
      let userBatchMatch = false
      let productNameMatch = false

      // Check if AI extracted any batches from database content
      const aiExtractedBatches = aiBatchNumbers || []
      console.log(`🤖 AI EXTRACTED BATCHES: ${aiExtractedBatches.length > 0 ? JSON.stringify(aiExtractedBatches) : 'None extracted'}`)

      // STEP 1: Batch Comparison Logic
      if (userProvidedBatch) {
        // User provided a batch number - compare against AI-extracted batches
        const exactBatchMatch = aiExtractedBatches.some(aiBatch =>
          aiBatch.toUpperCase().trim() === userBatchNumber.toUpperCase().trim()
        )

        // Also check database batch numbers as fallback
        const dbBatchMatch = uniqueAlerts.some(alert =>
          alert.batchNumbers?.some((dbBatch: string) =>
            dbBatch.toUpperCase().trim() === userBatchNumber.toUpperCase().trim()
          )
        )

        userBatchMatch = exactBatchMatch || dbBatchMatch
        console.log(`� BATCH COMPARISON: User "${userBatchNumber}" vs AI-extracted ${JSON.stringify(aiExtractedBatches)}`)
        console.log(`🔍 BATCH MATCH RESULT: ${userBatchMatch ? '✅ EXACT MATCH' : '❌ NO MATCH'}`)
      } else {
        // User didn't provide batch - no comparison possible
        console.log(`🔍 NO BATCH COMPARISON POSSIBLE: User didn't provide batch number`)
      }

      // 🔧 STRICT CORRELATED VALIDATION: REQUIRE BOTH PRODUCT & BATCH IN SAME ALERT
      let correlatedAlerts: AlertSearchResult[] = []
      let batchOnlyMatches: AlertSearchResult[] = []
      let productOnlyMatches: AlertSearchResult[] = []

      if (userProvidedBatch && productName) {
        // Find alerts with CORRELATED matching (both product AND batch)
        correlatedAlerts = uniqueAlerts.filter(alert => {
          // Check if product name appears in alert
          const productMatch = alert.productNames?.some((alertProduct: string) =>
            searchTerms.some((searchTerm: string) =>
              alertProduct.toLowerCase().includes(searchTerm.toLowerCase()) ||
              alert.title.toLowerCase().includes(searchTerm.toLowerCase())
            )
          ) || searchTerms.some((searchTerm: string) =>
            alert.title.toLowerCase().includes(searchTerm.toLowerCase())
          )

          // Check if batch appears in alert
          const batchMatch = alert.batchNumbers?.some((alertBatch: string) =>
            alertBatch.toLowerCase().trim() === userBatchNumber.toLowerCase().trim()
          )

          return productMatch && batchMatch // BOTH must match in SAME alert!
        })

        // Separate checks for partial matches (for warnings)
        batchOnlyMatches = uniqueAlerts.filter(alert =>
          !correlatedAlerts.some(ca => ca.id === alert.id) && // Exclude correlated matches
          alert.batchNumbers?.some((batch: string) =>
            batch.trim().toLowerCase() === userBatchNumber.toLowerCase().trim()
          )
        )

        productOnlyMatches = uniqueAlerts.filter(alert =>
          !correlatedAlerts.some(ca => ca.id === alert.id) && // Exclude correlated matches
          (
            alert.productNames?.some((product: string) =>
              searchTerms.some((term: string) => product.toLowerCase().includes(term.toLowerCase()))
            ) ||
            searchTerms.some((term: string) => alert.title.toLowerCase().includes(term.toLowerCase()))
          )
        )

      // 🐛 DETAILED DEBUGGING FOR CORRELATION ANALYSIS
      console.log(`🔗 DETAILED CORRELATION ANALYSIS:`)
      console.log(`📝 User Search Terms: ${JSON.stringify(searchTerms)}`)
      console.log(`🧢 User Batch: "${userBatchNumber}"`)

      uniqueAlerts.forEach((alert, index) => {
        console.log(`🔍 Alert ${index + 1}:`)
        console.log(`   🏷️  Title: "${alert.title}"`)
        console.log(`   📦 Product Names: ${JSON.stringify(alert.productNames)}`)
        console.log(`   🔢 Batch Numbers: ${JSON.stringify(alert.batchNumbers)}`)

        // Test product match manually
        const productMatch = alert.productNames?.some((alertProduct: string) =>
          searchTerms.some((searchTerm: string) =>
            alertProduct.toLowerCase().includes(searchTerm.toLowerCase())
          )
        )

        // Test batch match manually
        const batchMatch = alert.batchNumbers?.some((alertBatch: string) =>
          alertBatch.toLowerCase().trim() === userBatchNumber.toLowerCase().trim()
        )

        console.log(`   ✅ Product Match: ${productMatch} (search terms: ${searchTerms.join(', ')})`)
        console.log(`   ✅ Batch Match: ${batchMatch} (user batch: ${userBatchNumber})`)
        console.log(`   🎯 Overall Match: ${productMatch && batchMatch}`)
      })

      console.log(`📊 FINAL RESULTS:`)
        console.log(`  - Correlated matches (both product + batch): ${correlatedAlerts.length}`)
        console.log(`  - Batch-only matches: ${batchOnlyMatches.length}`)
        console.log(`  - Product-only matches: ${productOnlyMatches.length}`)
      }

      // 🎯 STRICT CORRELATED DECISION LOGIC
      if (correlatedAlerts.length > 0) {
        // 🔴 HIGH CONFIDENCE: BOTH product and batch match in SAME alert
        isCounterfeit = true
        confidence = Math.min(95, 85 + (correlatedAlerts.length * 5))
        alertType = correlatedAlerts[0].alertType
        batchNumber = userBatchNumber
        detectedAlerts = correlatedAlerts.map(a => a.title)

        summary = `🔴 FAKE/RECALL/EXPIRED PRODUCT DETECTED: "${productName}" with batch "${userBatchNumber}" matches ${correlatedAlerts.length} NAFDAC alert(s) exactly.`

        if (correlatedAlerts.length <= 4) {
          summary += correlatedAlerts.map((a, idx) => `\n${idx + 1}. ${a.title}`).join('')
        } else {
          summary += `\n• ${correlatedAlerts[0].title}`
          summary += `\n• Plus ${correlatedAlerts.length - 1} additional matching alerts`
        }

        console.log(`🎯 DECISION: CONFIRMED COUNTERFEIT (correlated match)`)
        console.log(`   Products: ${correlatedAlerts.map(a => `${a.title} (${a.productNames?.join(', ') || 'unknown'})`).join('; ')}`)
      } else if (batchOnlyMatches.length > 0 && batchOnlyMatches.length <= 2) {
        // 🟡 MEDIUM CONFIDENCE: Batch matches but product doesn't in SAME alert
        isCounterfeit = false
        confidence = Math.min(60, 35 + (batchOnlyMatches.length * 8))
        alertType = "BATCH_NUMBER_SUSPICIOUS"
        batchNumber = userBatchNumber
        detectedAlerts = batchOnlyMatches.map(a => a.title)

        summary = `🟡 BATCH NUMBER ALERT - DIFFERENT PRODUCT: Your batch "${userBatchNumber}" appears in ${batchOnlyMatches.length} alert(s), but for different product(s). This could indicate batch contamination or rebranding.`

        if (batchOnlyMatches.length <= 3) {
          summary += batchOnlyMatches.map((a, idx) => `\n${idx + 1}. ${a.title} (${a.productNames?.join(', ') || 'unknown product'})`).join('')
        }

        summary += `\n\n⚠️ Important: Verify if your product "${productName}" might be a repackaged version of these alerted products.`

        console.log(`🎯 DECISION: BATCH ALERT - DIFFERENT PRODUCT`)
      } else if (productOnlyMatches.length > 0 && productOnlyMatches.length <= 3) {
        // 🟡 LOW-MEDIUM CONFIDENCE: Product matches but batch doesn't
        isCounterfeit = false
        confidence = Math.min(50, 25 + (productOnlyMatches.length * 6))
        alertType = "PRODUCT_ALERT_DIFFERENT_BATCH"
        batchNumber = userBatchNumber || null
        detectedAlerts = productOnlyMatches.map(a => a.title)

        summary = `🟡 PRODUCT ALERTS FOUND - YOUR BATCH MAY NOT BE AFFECTED: Similar product "${productName}" appears in ${productOnlyMatches.length} alert(s), but your batch "${userBatchNumber || 'unknown'}" doesn't match.`

        if (productOnlyMatches.length <= 3) {
          productOnlyMatches.forEach((alert, idx) => {
            const alertBatches = alert.batchNumbers?.join(', ') || 'unknown';
            summary += `\n${idx + 1}. ${alert.title} (batches: ${alertBatches})`;
          });
        }

        summary += `\n\n✅ Your batch may be safe, but exercise caution with this product type.`;

        console.log(`🎯 DECISION: PRODUCT ALERT - DIFFERENT BATCH`)
      } else if (!userProvidedBatch && uniqueAlerts.length > 0) {
        // 🟡 GENERAL ALERTS FOUND - No specific batch provided
        isCounterfeit = false
        confidence = Math.min(45, 20 + (uniqueAlerts.length * 3))
        alertType = "GENERAL_PRODUCT_ALERTS"
        batchNumber = null
        detectedAlerts = uniqueAlerts.map(a => a.title)

        summary = `🟡 PRODUCT ALERTS FOUND - PROVIDE BATCH FOR ACCURATE CHECK: Detected ${uniqueAlerts.length} alert(s) for products similar to "${productName}".`

        if (uniqueAlerts.length <= 4) {
          summary += uniqueAlerts.map((a, idx) => `\n${idx + 1}. ${a.title}`).join('')
        } else {
          summary += `\n• ${uniqueAlerts[0].title}`
          summary += `\n• Plus ${uniqueAlerts.length - 1} additional alerts`
        }

        summary += `\n\n💡 Tip: Include the batch number for more accurate verification.`;

        console.log(`🎯 DECISION: GENERAL ALERTS (no user batch)`)
      }
    } else {
      // ✅ NO ALERTS FOUND: Safe product
      isCounterfeit = false
      confidence = 95  // High confidence when no alerts found
      alertType = "No Alert"
      batchNumber = null
      detectedAlerts = []

      summary = '✅ SAFE PRODUCT: No fake/recall/expired alerts found in NAFDAC database.'
      console.log(`🎯 DECISION: SAFE PRODUCT (no matches found)`)
    }

    const result = {
      isCounterfeit,
      summary,
      source: "NAFDAC Database Check",
      sourceUrl,
      alertType,
      batchNumber,
      confidence,
      alertsFound: uniqueAlerts.length,
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

    if (aiEnabled && uniqueAlerts.length > 0) {
      console.log(`🤖 Starting enhanced ${aiProvider} AI analysis for ${uniqueAlerts.length} found alerts...`)

      try {
        let aiService: any = null

        if (aiProvider === 'google') {
          aiService = aiRouter['aiInstances']?.gemini
        } else if (aiProvider === 'anthropic') {
          aiService = aiRouter['aiInstances']?.claude
        } else if (aiProvider === 'openai') {
          aiService = aiRouter['aiInstances']?.openai
        } else if (aiProvider === 'amazon-nova') {
          aiService = aiRouter['aiInstances']?.amazonNova
        }

        if (!aiService) {
          console.warn(`⚠️ ${aiProvider} AI service unavailable`)
        } else {
          console.log('🔍 AI Service initialized successfully')

          // Step 1: Use the same alerts found in database search
          const relevantAlerts = uniqueAlerts

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
            const userProductMatchesAlert = uniqueAlerts.some((alert: any) =>
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
    if (!aiEnhanced && uniqueAlerts.length > 0) {
      console.log('🛟 AI failed, but we have alerts - creating fallback analysis')
      aiEnhanced = false  // Don't mark as enhanced since no AI was used
      aiProductNames = [enhancedProductName]
      aiReason = `Product has ${uniqueAlerts.length} active NAFDAC alerts. Most recent: "${uniqueAlerts[0].title}". No AI analysis available for your plan tier.`
      aiConfidence = 75

      // ALWAYS try to extract batch numbers from database
      if (uniqueAlerts[0].batchNumbers && uniqueAlerts[0].batchNumbers.length > 0) {
        aiBatchNumbers = uniqueAlerts[0].batchNumbers
        console.log(`🛟 Fallback extracted batches from alert: ${aiBatchNumbers.join(', ')}`)
      }
    }

    console.log(`✅ Final Analysis State: AI=${aiEnhanced ? 'Enabled' : 'Disabled'}, Batches=${aiBatchNumbers.length}`)

    // 🛟 POST-AI BATCH RE-VERIFICATION: Check if AI extracted batches make user batch match
    if (aiEnhanced && uniqueAlerts.length > 0 && userProvidedBatch && aiBatchNumbers.length > 0) {
      console.log(`🔄 POST-AI BATCH RE-VERIFICATION: Checking ${aiBatchNumbers.length} AI-extracted batches`)

      // Check if any alert now has a batch that matches the user's batch (after AI extraction)
      const aiMatchedAlerts = uniqueAlerts.filter(alert => {
        // Check if AI extracted batches for this alert match user batch
        const aiBatchesForAlert = aiBatchNumbers.filter(batch =>
          batch.toUpperCase().trim() === userBatchNumber.toUpperCase().trim()
        )
        return aiBatchesForAlert.length > 0
      })

      if (aiMatchedAlerts.length > 0) {
        console.log(`🎯 POST-AI SUCCESS: Found ${aiMatchedAlerts.length} alerts with AI-extracted matching batches!`)

        // UPGRADE RESULT: From "PRODUCT ALERT - DIFFERENT BATCH" to "CONFIRMED COUNTERFEIT"
        isCounterfeit = true
        confidence = Math.min(95, confidence + 60) // Significant confidence boost
        alertType = "CONFIRMED_COUNTERFEIT_AI"
        batchNumber = userBatchNumber
        detectedAlerts = aiMatchedAlerts.map(a => a.title)

        summary = `🔴 CONFIRMED FAKE/COUNTERFEIT DETECTED VIA AI ANALYSIS: "${productName}" with batch "${userBatchNumber}" matches ${aiMatchedAlerts.length} NAFDAC alert(s) after AI batch number extraction.`

        if (aiMatchedAlerts.length <= 4) {
          summary += aiMatchedAlerts.map((a, idx) => `\n${idx + 1}. ${a.title}`).join('')
        } else {
          summary += `\n• ${aiMatchedAlerts[0].title}`
          summary += `\n• Plus ${aiMatchedAlerts.length - 1} additional alerts with AI-confirmed batch matches`
        }

        summary += `\n\n🤖 AI analyzed alert content and confirmed batch "${userBatchNumber}" matches falsified/unregistered products.`

        console.log(`🚀 RESULT UPGRADED: PRODUCT ALERT → CONFIRMED COUNTERFEIT (${confidence}% confidence)`)

        // GENERATE CONTEXT-AWARE ALERT TYPE BASED ON AI ANALYSIS
        let confirmedType = "CONFIRMED COUNTERFEIT" // Default
        if (aiEnhanced && aiAlertType) {
          const aiType = aiAlertType.toUpperCase()
          if (aiType.includes("EXPIRED")) {
            confirmedType = "CONFIRMED EXPIRED"
          } else if (aiType.includes("RECALL")) {
            confirmedType = "CONFIRMED RECALL"
          } else if (aiType.includes("FAKE") || aiType.includes("CONTAMINATED")) {
            confirmedType = "CONFIRMED COUNTERFEIT"
          }
        }
        alertType = confirmedType

        console.log(`🏷️ ALERT TYPE DETERMINED: ${confirmedType}`)

        // UPDATE RESULT OBJECT for database save
        result.isCounterfeit = isCounterfeit
        result.alertType = alertType
        result.confidence = confidence
        result.summary = summary
        result.batchNumber = batchNumber
      } else {
        console.log(`🔍 POST-AI RESULT: No batch matches found in AI-extracted data, keeping original decision`)
      }
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
      newBalance: user.pointsBalance - 1
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
