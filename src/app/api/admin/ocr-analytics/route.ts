import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ocrMetricsCollector } from '@/services/ocr-metrics-collector'

// Admin-only route for OCR analytics
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth()
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // TODO: Add admin role check when user roles are implemented
    // For now, allow access (in production, check for admin role)

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '24h'
    const metric = searchParams.get('metric') || 'overview'

    // Calculate date range
    const endDate = new Date()
    let startDate: Date

    switch (timeRange) {
      case '1h':
        startDate = new Date(endDate.getTime() - 60 * 60 * 1000)
        break
      case '24h':
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000)
    }

    let data

    switch (metric) {
      case 'overview':
        data = await getOverviewMetrics(startDate, endDate)
        break
      case 'performance':
        data = await getPerformanceMetrics(startDate, endDate)
        break
      case 'errors':
        data = await getErrorMetrics(startDate, endDate)
        break
      case 'strategy':
        data = await getStrategyMetrics(startDate, endDate)
        break
      case 'trends':
        data = await getTrendMetrics(startDate, endDate)
        break
      default:
        data = await getOverviewMetrics(startDate, endDate)
    }

    return NextResponse.json({
      success: true,
      timeRange,
      metric,
      data,
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Admin OCR analytics error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch analytics data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function getOverviewMetrics(startDate: Date, endDate: Date) {
  const stats = await ocrMetricsCollector.getPerformanceStats(startDate, endDate)
  const recentErrors = await ocrMetricsCollector.getRecentErrors(10)
  const strategyComparison = await ocrMetricsCollector.getStrategyComparison(24)

  return {
    summary: {
      totalRequests: stats.totalRequests,
      successRate: Math.round(stats.successRate * 100) / 100,
      averageProcessingTime: Math.round(stats.averageProcessingTime),
      averageConfidence: Math.round(stats.averageConfidence * 100) / 100,
      totalErrors: recentErrors.length
    },
    topErrors: recentErrors.slice(0, 5).map(error => ({
      strategy: error.strategy,
      errorType: error.errorType,
      errorMessage: error.errorMessage,
      timestamp: error.timestamp
    })),
    strategyPerformance: strategyComparison
  }
}

async function getPerformanceMetrics(startDate: Date, endDate: Date) {
  const stats = await ocrMetricsCollector.getPerformanceStats(startDate, endDate)

  return {
    overall: {
      successRate: Math.round(stats.successRate * 100) / 100,
      averageTime: Math.round(stats.averageProcessingTime),
      averageConfidence: Math.round(stats.averageConfidence * 100) / 100
    },
    byStrategy: stats.strategyPerformance,
    byPlan: stats.planPerformance,
    byForm: stats.pharmaceuticalFormStats
  }
}

async function getErrorMetrics(startDate: Date, endDate: Date) {
  const recentErrors = await ocrMetricsCollector.getRecentErrors(50)
  const errorRateTrend = await ocrMetricsCollector.getErrorRateTrend(24)

  // Group errors by type
  const errorGroups: Record<string, number> = {}
  recentErrors.forEach(error => {
    const type = error.errorType || 'unknown'
    errorGroups[type] = (errorGroups[type] || 0) + 1
  })

  // Group errors by strategy
  const strategyErrors: Record<string, number> = {}
  recentErrors.forEach(error => {
    const strategy = error.strategy
    strategyErrors[strategy] = (strategyErrors[strategy] || 0) + 1
  })

  return {
    totalErrors: recentErrors.length,
    errorTypes: errorGroups,
    errorByStrategy: strategyErrors,
    recentErrors: recentErrors.slice(0, 20).map(error => ({
      strategy: error.strategy,
      errorType: error.errorType,
      errorMessage: error.errorMessage,
      userPlan: error.userPlan,
      timestamp: error.timestamp,
      processingTime: error.processingTime
    })),
    errorRateTrend
  }
}

async function getStrategyMetrics(startDate: Date, endDate: Date) {
  const strategyComparison = await ocrMetricsCollector.getStrategyComparison(24)
  const stats = await ocrMetricsCollector.getPerformanceStats(startDate, endDate)

  return {
    comparison: strategyComparison,
    detailed: stats.strategyPerformance
  }
}

async function getTrendMetrics(startDate: Date, endDate: Date) {
  const errorRateTrend = await ocrMetricsCollector.getErrorRateTrend(24)

  // Get hourly success rates for the last 24 hours
  const hourlyStats: Array<{ hour: string; successRate: number; totalRequests: number }> = []

  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(Date.now() - i * 60 * 60 * 1000)
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)

    try {
      const hourStats = await ocrMetricsCollector.getPerformanceStats(hourStart, hourEnd)
      hourlyStats.push({
        hour: hourStart.toISOString().slice(0, 13) + ':00',
        successRate: Math.round(hourStats.successRate * 100) / 100,
        totalRequests: hourStats.totalRequests
      })
    } catch (error) {
      hourlyStats.push({
        hour: hourStart.toISOString().slice(0, 13) + ':00',
        successRate: 0,
        totalRequests: 0
      })
    }
  }

  return {
    errorRateTrend,
    hourlySuccessRates: hourlyStats
  }
}