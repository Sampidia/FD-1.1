import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth-minimal'
import { aiRouter } from '@/services/ai/ai-router'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import "@/types/nextauth" // Import NextAuth type augmentation

// Input validation schema for image analysis
const analyzeImageSchema = z.object({
  images: z.array(z.string())
    .min(1, 'At least one image is required')
    .max(5, 'Maximum 5 images allowed'),
  analysisType: z.enum(['basic', 'comprehensive']).default('comprehensive')
})

// Enhanced extraction result interface
interface ImageAnalysisResult {
  productName: string | null
  batchNumbers: string[]
  expiryDate: string | null
  manufacturers: string[]
  confidence: number
  extractedText: string
  warnings: string[]
  recommendations: string[]
}

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id as string
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse and validate request
    const body = await request.json()
    const validationResult = analyzeImageSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validationResult.error.issues
        },
        { status: 400 }
      )
    }

    const { images, analysisType } = validationResult.data

    // Initialize AI router
    await aiRouter.initializeProviders()

    // Determine user plan for AI routing
    let userPlan = 'free'
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { planBasicPoints: true, planStandardPoints: true, planBusinessPoints: true }
      })

      if (user?.planBusinessPoints && user.planBusinessPoints > 0) {
        userPlan = 'business'
      } else if (user?.planStandardPoints && user.planStandardPoints > 0) {
        userPlan = 'standard'
      } else if (user?.planBasicPoints && user.planBasicPoints > 0) {
        userPlan = 'basic'
      }

      console.log(`🔍 [ANALYZE-IMAGE] USER PLAN DETECTION: Found user ${session.user.id}`)
      console.log(`🔍 [ANALYZE-IMAGE] Points: Basic=${user?.planBasicPoints || 0}, Standard=${user?.planStandardPoints || 0}, Business=${user?.planBusinessPoints || 0}`)
      console.log(`🔍 [ANALYZE-IMAGE] DETECTED PLAN: ${userPlan}`)
    } catch (error) {
      console.error('❌ [ANALYZE-IMAGE] Could not determine user plan, using free tier')
      console.error('❌ [ANALYZE-IMAGE] Error:', error)
      console.log('🔄 [ANALYZE-IMAGE] FALLBACK: Using free plan')
      userPlan = 'free'
    }

    console.log(`🤖 Starting ${analysisType} image analysis for ${userPlan} plan user`)
    console.log(`📸 Image count: ${images.length}`)

    // Debug: Check what plan assignments exist for this user
    try {
      const planAssignments = await prisma.planAssignment.findMany({
        where: { planId: userPlan, isActive: true },
        include: { aiProvider: true, plan: true }
      })
      console.log(`🔍 DEBUG: Found ${planAssignments.length} plan assignments for plan "${userPlan}":`,
        planAssignments.map((pa: any) => `${pa.aiProvider.name} (${pa.aiProvider.provider})`))

      if (planAssignments.length === 0) {
        console.log('⚠️ No plan assignments found - OCR will use free tier defaults')
      }
    } catch (debugError) {
      console.log('🔍 DEBUG: Error checking plan assignments:', debugError)
    }

    // Enhanced OCR prompt based on analysis type
    const ocrPrompt = analysisType === 'comprehensive'
      ? `EXTRACT ALL PHARMACEUTICAL PRODUCT INFORMATION from this image with maximum accuracy:

CRITICAL ELEMENTS TO EXTRACT:
1. PRODUCT NAME: Full drug name, brand name, generic name
2. BATCH NUMBER: Look for patterns like ASCORBIC2023, T36184B, UI4004, PCT2023002, 39090439
3. EXPIRY DATE: Manufacturing/expiry dates in any format
4. MANUFACTURER: Company name, pharmaceutical company
5. DOSAGE/STRENGTH: mg, ml, IU, mcg amounts
6. PACKAGING INFO: Tablet count, volume, package type

ANALYSIS REQUIREMENTS:
- Be extremely precise with batch numbers and dates
- Extract complete product names without abbreviations
- Look for both printed and embossed text
- Consider multiple languages if present
- Flag any uncertainty or ambiguity

Return structured JSON with confidence scores.`
      : `Quick extract: product name, batch number, and manufacturer from pharmaceutical packaging.`

    // Process images with enhanced OCR fallback system
    const ocrOptions = {
      maxAttempts: userPlan === 'business' ? 5 : userPlan === 'standard' ? 4 : 3,
      maxTime: userPlan === 'business' ? 45000 : 30000,
      strategies: ['claude', 'gemini', 'openai', 'tesseract'],
      userPlan,
      enablePreprocessingRetry: userPlan !== 'free',
      minConfidence: userPlan === 'free' ? 0.4 : 0.6,
      enableManualFallback: true
    }

    // Use AI router for backward compatibility, but ideally we'd use ocrFallbackManager directly
    const ocrRequest = {
      text: ocrPrompt,
      task: 'ocr' as const,
      images: images,
      maxTokens: analysisType === 'comprehensive' ? 2048 : 1024
    }

    const ocrResponse = await aiRouter.processRequest(ocrRequest, userId)

    if (!ocrResponse.metadata.success) {
      // Provide graceful degradation for OCR failures
      const fallbackRecommendations = [
        'Try uploading clearer, higher resolution images',
        'Ensure text is well-lit and not blurry',
        'Consider providing product information manually',
        'Check that batch numbers and expiry dates are clearly visible'
      ]

      return NextResponse.json(
        {
          error: 'Image analysis failed',
          message: 'Could not extract information from images. Please try manual input.',
          recommendations: fallbackRecommendations,
          degradationLevel: 'manual_input',
          canRetry: true
        },
        { status: 422 }
      )
    }

    // Parse and structure the AI response
    const analysisResult = parseAIResponse(ocrResponse.content, ocrResponse.extractedData as Record<string, unknown> | undefined)
    console.log(`📋 [ANALYZE-IMAGE] PARSED RESULT STRUCTURE:`)
    console.log(`   Product Name: "${analysisResult.productName || 'NOT FOUND'}"`)
    console.log(`   Batch Numbers: ${analysisResult.batchNumbers?.length > 0 ? JSON.stringify(analysisResult.batchNumbers) : 'NOT FOUND'}`)
    console.log(`   Manufacturers: ${analysisResult.manufacturers?.length > 0 ? JSON.stringify(analysisResult.manufacturers) : 'NOT FOUND'}`)
    console.log(`   Expiry Date: "${analysisResult.expiryDate || 'NOT FOUND'}"`)

    // Validate extraction quality
    const validation = validateExtraction(analysisResult)

    // Add OCR validation insights
    const ocrValidationInsights = {
      confidence: analysisResult.confidence,
      hasBatchNumber: !!analysisResult.batchNumbers?.length,
      hasProductName: !!analysisResult.productName,
      hasExpiryDate: !!analysisResult.expiryDate,
      quality: validation.quality,
      recommendations: validation.missingFields.length > 0 ?
        [`Missing: ${validation.missingFields.join(', ')}`] :
        ['All required fields detected']
    }

    const response = {
      success: true,
      analysis: analysisResult,
      validation,
      ocrValidation: ocrValidationInsights,
      metadata: {
        analysisType,
        userPlan,
        imageCount: images.length,
        processingTime: ocrResponse.metadata.responseTime,
        aiProvider: ocrResponse.metadata.provider,
        confidence: analysisResult.confidence
      }
    }

    console.log(`✅ Image analysis complete: ${analysisResult.confidence}% confidence`)

    return NextResponse.json(response)

  } catch (error: unknown) {
    console.error('Image analysis error:', error)

    return NextResponse.json(
      {
        error: 'Analysis failed',
        message: error instanceof Error ? error.message : 'An error occurred during image analysis'
      },
      { status: 500 }
    )
  }
}

// Parse AI response into structured format
function parseAIResponse(content: string, extractedData?: Record<string, unknown>): ImageAnalysisResult {
  const result: ImageAnalysisResult = {
    productName: null,
    batchNumbers: [],
    expiryDate: null,
    manufacturers: [],
    confidence: 0,
    extractedText: content,
    warnings: [],
    recommendations: []
  }

  try {
    // Try to parse JSON from AI response
    if (extractedData && typeof extractedData === 'object') {
      // Handle both singular and plural field names (AI router sends plural, frontend expects singular)
      result.productName = Array.isArray(extractedData.productNames) && extractedData.productNames.length > 0
        ? extractedData.productNames[0]
        : (typeof extractedData.productName === 'string' ? extractedData.productName : null)

      result.batchNumbers = Array.isArray(extractedData.batchNumbers) ? extractedData.batchNumbers : []
      result.expiryDate = typeof extractedData.expiryDate === 'string' ? extractedData.expiryDate : null
      result.manufacturers = Array.isArray(extractedData.manufacturers) ? extractedData.manufacturers : []
      result.confidence = typeof extractedData.confidence === 'number' ? extractedData.confidence : 0.5
      return result
    }

    // Fallback: Extract from raw text
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0)

    // Extract batch numbers using comprehensive patterns
    const batchPatterns = [
      /\b([A-Z]{4,10}\d{4})\b/g,      // ASCORBIC2023 - alphabetic batch patterns
      /\b([A-Z]{1,3}\d{4,8}[A-Z]?)\b/g, // T36184B, UI4004, PCT2023002
      /\b([A-Z]\d{5,6}[A-Z]?)\b/g,   // UI4004, T36184B
      /\b(\d{6,8})\b/g,               // 39090439 - numeric patterns
      /\b([A-Z]{2,3}\d{4,6})\b/g,     // PCT2023002
      /\b([A-Z]{1,3}\d{3}[A-Z]{0,3})\b/g, // ABC123
      /\b([A-Z]{1,4}\d{4}[A-Z]{1,3})\b/g, // Date-based batch patterns
      /\bbatch[\s:]*([^\s\n\r]{4,15})\b/gi,
      /\blot[\s:]*([^\s\n\r]{4,15})\b/gi
    ]

    const uniqueBatches = new Set<string>()
    for (const pattern of batchPatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const batch = match[1]?.trim().toUpperCase()
        if (batch && batch.length >= 4 && batch.length <= 15 && !batch.match(/^\d{4}$/)) { // Avoid pure years
          uniqueBatches.add(batch)
        }
      }
    }

    // Prefer alphabetic batches over numeric-only ones
    const batches = Array.from(uniqueBatches)
    if (batches.length > 1) {
      batches.sort((a, b) => {
        const aHasLetters = /[A-Z]/.test(a)
        const bHasLetters = /[A-Z]/.test(b)
        if (aHasLetters && !bHasLetters) return -1
        if (!aHasLetters && bHasLetters) return 1
        return b.length - a.length // Prefer longer batches
      })
    }
    result.batchNumbers = batches

    // Extract product name (look for capitalized words that might be drug names)
    const productPatterns = [
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g, // Multi-word capitalized names
      /\b([A-Z][a-z]+(?:\s+\d+(?:\.\d+)?\s*(?:mg|g|ml|IU|mcg)?))\b/gi // Drug with dosage
    ]

    for (const pattern of productPatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const product = match[1]?.trim()
        if (product && product.length > 3 && !result.productName) {
          result.productName = product
          break
        }
      }
    }

    // Extract expiry date
    const datePatterns = [
      /\bexp(?:iry)?[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\b/gi,
      /\bexp(?:iry)?[\s:]*(\d{2,4}[-\/]\d{1,2}[-\/]\d{1,2})\b/gi,
      /\bbest\s*before[\s:]*([^\s\n\r]{6,})\b/gi,
      /\buse\s*by[\s:]*([^\s\n\r]{6,})\b/gi
    ]

    for (const pattern of datePatterns) {
      const match = pattern.exec(content)
      if (match && match[1]) {
        result.expiryDate = match[1].trim()
        break
      }
    }

    // Extract manufacturer
    const manufacturerPatterns = [
      /\b(?:manufactured\s*by|mfg|maker)[\s:]*([^\n\r]{3,30})\b/gi,
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Ltd|PLC|Pharma|Labs?|Inc|Corp|Co\.))\b/g
    ]

    for (const pattern of manufacturerPatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const manufacturer = match[1]?.trim()
        if (manufacturer && manufacturer.length > 2) {
          result.manufacturers.push(manufacturer)
        }
      }
    }

    // Calculate confidence score
    let confidenceScore = 0
    if (result.productName) confidenceScore += 0.3
    if (result.batchNumbers.length > 0) confidenceScore += 0.3
    if (result.expiryDate) confidenceScore += 0.2
    if (result.manufacturers.length > 0) confidenceScore += 0.2

    result.confidence = Math.min(1.0, confidenceScore)

    // Add recommendations
    if (result.confidence < 0.6) {
      result.warnings.push('Low confidence in extracted data')
      result.recommendations.push('Consider providing manual input or clearer images')
    }

    if (result.batchNumbers.length === 0) {
      result.recommendations.push('Batch number not detected - critical for accurate verification')
    }

    if (!result.productName) {
      result.recommendations.push('Product name not detected - manual input recommended')
    }

  } catch (error) {
    console.error('Error parsing AI response:', error)
    result.confidence = 0.1
    result.warnings.push('Failed to parse AI response')
    result.recommendations.push('Please try again or provide manual input')
  }

  return result
}

// Validate extraction quality
function validateExtraction(result: ImageAnalysisResult) {
  const validation = {
    isValid: false,
    hasMinimumData: false,
    confidence: result.confidence,
    missingFields: [] as string[],
    quality: 'poor' as 'excellent' | 'good' | 'fair' | 'poor'
  }

  // Check for minimum required data
  if (!result.productName) validation.missingFields.push('productName')
  if (result.batchNumbers.length === 0) validation.missingFields.push('batchNumber')

  validation.hasMinimumData = validation.missingFields.length === 0

  // Determine quality
  if (result.confidence >= 0.8) {
    validation.quality = 'excellent'
    validation.isValid = true
  } else if (result.confidence >= 0.6) {
    validation.quality = 'good'
    validation.isValid = true
  } else if (result.confidence >= 0.4) {
    validation.quality = 'fair'
    validation.isValid = validation.hasMinimumData
  } else {
    validation.quality = 'poor'
    validation.isValid = false
  }

  return validation
}
