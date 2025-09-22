import { NextRequest, NextResponse } from 'next/server'
import { EnhancedNafdacService } from '@/services/nafdac-service'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Check authentication (optional for testing)
    const session = await auth()

    const { productName, productDescription, images }: {
      productName: string
      productDescription: string
      images: string[]
    } = await request.json()

    if (!productName || !productDescription) {
      return NextResponse.json(
        { error: 'Missing product information' },
        { status: 400 }
      )
    }

    console.log('🧪 Testing AI Analysis:', {
      productName,
      descriptionLength: productDescription.length,
      imageCount: images?.length || 0,
      userId: session?.user?.id || 'Anonymous'
    })

    // Initialize the enhanced service with AI capabilities
    const enhancedService = new EnhancedNafdacService()

    // Use the new ensemble analysis method
    const result = await enhancedService.ensembleAnalysis(
      productName,
      productDescription,
      images || []
    )

    // Test the traditional method for comparison
    const traditionalResult = await enhancedService.deepVerifyProduct(
      productName,
      productDescription,
      images || []
    )

    const response = {
      // New AI Ensemble Results
      ensemble: {
        isCounterfeit: result.isCounterfeit,
        confidence: result.confidence,
        riskLevel: result.riskLevel,
        summary: result.summary,
        aiRecommendations: result.aiRecommendations,
        sources: result.sources
      },

      // Traditional Method for Comparison
      traditional: {
        isCounterfeit: traditionalResult.isCounterfeit,
        confidence: traditionalResult.confidence,
        summary: traditionalResult.summary
      },

      // Analysis Metadata
      metadata: {
        productName,
        descriptionLength: productDescription.length,
        imageCount: images?.length || 0,
        timestamp: new Date().toISOString(),
        userAuthenticated: !!session
      },

      // Performance Comparison
      comparison: {
        ensembleAccuracy: result.confidence,
        traditionalAccuracy: traditionalResult.confidence,
        ensembleRiskLevel: result.riskLevel,
        traditionalResult: traditionalResult.isCounterfeit ? 'COUNTERFEIT' : 'SAFE'
      }
    }

    console.log('✅ AI Analysis Complete:', {
      ensembleRisk: result.riskLevel,
      ensembleConfidence: result.confidence,
      traditionalResult: traditionalResult.isCounterfeit ? 'COUNTERFEIT' : 'SAFE'
    })

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('❌ AI Analysis Test Failed:', error)

    return NextResponse.json(
      {
        error: 'AI Analysis Test Failed',
        message: error.message || 'An error occurred during analysis',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}