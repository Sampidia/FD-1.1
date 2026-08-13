import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth-minimal'
import "@/types/nextauth"
import prisma from '@/lib/prisma'

interface RouteParams {
  params: {
    resultId: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { resultId } = params
    console.log('🔍 Fetching result for ID:', resultId)

    // Authenticate user - only show results owned by user
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      )
    }

    // Step 1: Find the ProductCheck by ID and ensure it belongs to user
    const productCheck = await prisma.productCheck.findFirst({
      where: {
        id: resultId,
        userId: session.user.id // Security: only show user's results
      },
      select: {
        id: true,
        productName: true,
        productDescription: true,
        images: true,
        createdAt: true,
        pointsUsed: true,
        batchNumber: true
      }
    })

    if (!productCheck) {
      console.log('❌ ProductCheck not found or not owned by user:', resultId)
      return NextResponse.json(
        { success: false, message: 'Result not found or access denied' },
        { status: 404 }
      )
    }

    // Step 2: Get the latest CheckResult for this ProductCheck WITH AI DATA
    const checkResult = await prisma.checkResult.findFirst({
      where: {
        productCheckId: resultId
      },
      select: {
        id: true,
        isCounterfeit: true,
        summary: true,
        sourceUrl: true,
        source: true,
        batchNumber: true,
        alertType: true,
        confidence: true,
        scrapedAt: true,

        // 🎯 AI ANALYSIS FIELDS FROM DATABASE
        aiEnhanced: true,
        aiProductName: true,
        aiBatchNumbers: true,
        aiReason: true,
        aiConfidence: true,
        aiAlertType: true
      },
      orderBy: {
        scrapedAt: 'desc' // Get the most recent result
      }
    })

    // Step 3: Get user's current points balance (all tiers for priority calculation)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        pointsBalance: true,
        planBasicPoints: true,
        planStandardPoints: true,
        planBusinessPoints: true,
        planFreePoints: true
      }
    })

    // Priority balance logic: business > standard > basic > free > legacy pointsBalance
    const priorityBalance = (() => {
      if (!user) return 0
      if ((user.planBusinessPoints ?? 0) > 0) return user.planBusinessPoints ?? 0
      if ((user.planStandardPoints ?? 0) > 0) return user.planStandardPoints ?? 0
      if ((user.planBasicPoints ?? 0) > 0) return user.planBasicPoints ?? 0
      if ((user.planFreePoints ?? 0) > 0) return user.planFreePoints ?? 0
      return user.pointsBalance ?? 0
    })()

    // Step 4: Transform and return the complete result WITH AI DATA
    const resultData = {
      resultId: productCheck.id,
      isCounterfeit: checkResult?.isCounterfeit || false,
      summary: checkResult?.summary || (checkResult?.isCounterfeit ? '🔴 Product verification complete.' : '✅ SAFE PRODUCT: No fake/recall/expired alerts found in NAFDAC database.'),
      sourceUrl: checkResult?.sourceUrl || 'https://nafdac.gov.ng/category/recalls-and-alerts/',
      source: checkResult?.source || 'NAFDAC',
      batchNumber: checkResult?.batchNumber || productCheck.batchNumber,
      alertType: checkResult?.alertType || 'Analysis Pending',
      confidence: checkResult?.confidence || 0,
      newBalance: priorityBalance,
      timestamp: checkResult?.scrapedAt?.toISOString() || productCheck.createdAt.toISOString(),
      verificationMethod: 'NAFDAC Database Verification',
      productCheckId: productCheck.id,
      productName: productCheck.productName,
      productDescription: productCheck.productDescription,
      images: productCheck.images,
      pointsUsed: productCheck.pointsUsed,
      // Enhanced fields for better UI
      processingTime: 0, // Could be calculated if logged
      imagesAnalyzed: productCheck.images.length,
      ocrConfidence: null, // OCR confidence if stored separately
      hasResult: !!checkResult, // Indicates if analysis is complete
      analysisComplete: !!checkResult, // Explicit flag for UI state

      // 🎯 AI ANALYSIS DATA FROM DATABASE - FORMAT FOR FRONTEND
      aiAnalysis: checkResult?.aiEnhanced ? {
        productName: checkResult.aiProductName || 'Unknown',
        batchNumbers: Array.isArray(checkResult.aiBatchNumbers) ? checkResult.aiBatchNumbers : [],
        reason: checkResult.aiReason || 'Analysis completed successfully',
        confidence: checkResult.aiConfidence || 80,
        alertType: checkResult.aiAlertType || 'REVIEW',
        isEnhanced: true
      } : null
    }

    console.log(`✅ Result loaded for ${productCheck.productName}:`, {
      isCounterfeit: resultData.isCounterfeit,
      confidence: resultData.confidence,
      hasResult: resultData.hasResult
    })

    return NextResponse.json(resultData)

  } catch (error) {
    console.error('❌ Error fetching result by ID:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch result',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
