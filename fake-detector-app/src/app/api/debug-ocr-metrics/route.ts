import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Check if OCRMetrics table exists and get data
    const metrics = await prisma.oCRMetrics.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        requestId: true,
        strategy: true,
        userPlan: true,
        success: true,
        confidence: true,
        processingTime: true,
        createdAt: true,
        errorType: true,
        errorMessage: true
      }
    })

    // Get total count
    const totalCount = await prisma.oCRMetrics.count()

    // Note: Table structure info not available in MongoDB debug query
    const tableInfo = null // MongoDB doesn't have information_schema like PostgreSQL

    return NextResponse.json({
      success: true,
      totalMetrics: totalCount,
      recentMetrics: metrics,
      tableStructure: tableInfo,
      message: totalCount > 0 ? `${totalCount} OCR metrics found in database` : 'No OCR metrics found in database'
    })

  } catch (error) {
    console.error('Debug OCR metrics error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to check OCR metrics in database'
      },
      { status: 500 }
    )
  }
}
