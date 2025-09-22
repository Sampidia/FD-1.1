/**
 * OCR Metrics Collector Service
 *
 * Collects and stores performance metrics for OCR operations including:
 * - Processing times and success rates
 * - Strategy performance analysis
 * - Error tracking and categorization
 * - Cost analysis and optimization insights
 * - System health monitoring
 */

import prisma from '@/lib/prisma'

export interface OCRMetrics {
  requestId: string
  timestamp: Date
  strategy: 'claude' | 'gemini' | 'openai' | 'tesseract' | 'preprocessing_retry'
  userPlan: string
  imageCount: number
  processingTime: number // milliseconds
  confidence: number
  success: boolean
  errorType?: 'api_error' | 'timeout' | 'low_quality' | 'parsing_error' | 'rate_limit' | 'auth_error' | 'network_error' | 'unknown'
  errorMessage?: string
  preprocessingUsed: boolean
  pharmaceuticalForm?: string
  batchDetected: boolean
  expiryDetected: boolean
  manufacturerDetected: boolean
  cost: number // API cost in USD
  rawOcrText?: string
}

export interface SystemHealthMetrics {
  metricName: 'cpu_usage' | 'memory_usage' | 'api_response_time' | 'db_connection_pool' | 'error_rate'
  value: number
  metadata?: Record<string, any>
}

export interface OCRPerformanceStats {
  totalRequests: number
  successRate: number
  averageProcessingTime: number
  averageConfidence: number
  strategyPerformance: Record<string, {
    requests: number
    successRate: number
    averageTime: number
    averageCost: number
  }>
  errorBreakdown: Record<string, number>
  planPerformance: Record<string, {
    requests: number
    successRate: number
    averageTime: number
  }>
  pharmaceuticalFormStats: Record<string, {
    requests: number
    successRate: number
    averageConfidence: number
  }>
}

export class OCRMetricsCollector {
  private static instance: OCRMetricsCollector

  static getInstance(): OCRMetricsCollector {
    if (!OCRMetricsCollector.instance) {
      OCRMetricsCollector.instance = new OCRMetricsCollector()
    }
    return OCRMetricsCollector.instance
  }

  /**
   * Record OCR operation metrics
   */
  async recordMetrics(metrics: OCRMetrics): Promise<void> {
    try {
      console.log('💾 ATTEMPTING TO SAVE OCR METRICS TO DATABASE:', {
        requestId: metrics.requestId,
        strategy: metrics.strategy,
        success: metrics.success,
        confidence: metrics.confidence,
        processingTime: metrics.processingTime
      });

      const result = await prisma.oCRMetrics.create({
        data: {
          requestId: metrics.requestId,
          timestamp: metrics.timestamp,
          strategy: metrics.strategy,
          userPlan: metrics.userPlan,
          imageCount: metrics.imageCount,
          processingTime: metrics.processingTime,
          confidence: metrics.confidence,
          success: metrics.success,
          errorType: metrics.errorType || null,
          errorMessage: metrics.errorMessage || null,
          preprocessingUsed: metrics.preprocessingUsed,
          pharmaceuticalForm: metrics.pharmaceuticalForm || null,
          batchDetected: metrics.batchDetected,
          expiryDetected: metrics.expiryDetected,
          manufacturerDetected: metrics.manufacturerDetected,
          cost: metrics.cost,
          rawOcrText: metrics.rawOcrText || null
        }
      });

      console.log('✅ OCR METRICS SUCCESSFULLY SAVED TO DATABASE:', {
        id: result.id,
        requestId: result.requestId,
        strategy: result.strategy
      });

      // Log critical errors for immediate attention
      if (!metrics.success && metrics.errorType === 'api_error') {
        console.error(`🔴 OCR API Error [${metrics.strategy}]: ${metrics.errorMessage}`)
      }

    } catch (error) {
      console.error('❌ FAILED TO SAVE OCR METRICS TO DATABASE:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code,
        meta: (error as any)?.meta
      });
      // Don't throw - metrics collection shouldn't break the main flow
    }
  }

  /**
   * Record system health metrics
   */
  async recordSystemHealth(metrics: SystemHealthMetrics): Promise<void> {
    try {
      await prisma.systemHealth.create({
        data: {
          metricName: metrics.metricName,
          value: metrics.value,
          metadata: metrics.metadata || {}
        }
      })
    } catch (error) {
      console.error('Failed to record system health metrics:', error)
    }
  }

  /**
   * Get OCR performance statistics for a time range
   */
  async getPerformanceStats(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<OCRPerformanceStats> {
    try {
      const metrics = await prisma.oCRMetrics.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      })

      if (metrics.length === 0) {
        return this.getEmptyStats()
      }

      return this.calculateStats(metrics as OCRMetrics[])
    } catch (error) {
      console.error('Failed to get performance stats:', error)
      return this.getEmptyStats()
    }
  }

  /**
   * Get recent OCR errors for analysis
   */
  async getRecentErrors(limit: number = 50): Promise<OCRMetrics[]> {
    try {
      return await prisma.oCRMetrics.findMany({
        where: {
          success: false
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: limit
      }) as OCRMetrics[]
    } catch (error) {
      console.error('Failed to get recent errors:', error)
      return []
    }
  }

  /**
   * Get strategy performance comparison
   */
  async getStrategyComparison(hours: number = 24): Promise<Record<string, any>> {
    try {
      const startDate = new Date(Date.now() - hours * 60 * 60 * 1000)

      const strategyStats = await prisma.oCRMetrics.groupBy({
        by: ['strategy'],
        where: {
          timestamp: {
            gte: startDate
          }
        },
        _count: {
          id: true
        },
        _avg: {
          processingTime: true,
          confidence: true,
          cost: true
        },
        _sum: {
          cost: true
        }
      })

      const result: Record<string, any> = {}

      for (const stat of strategyStats) {
        // Calculate success rate by querying successful records for this strategy
        const successCount = await prisma.oCRMetrics.count({
          where: {
            strategy: stat.strategy,
            success: true,
            timestamp: { gte: startDate }
          }
        })

        result[stat.strategy] = {
          requests: stat._count.id,
          successRate: stat._count.id > 0 ? (successCount / stat._count.id) * 100 : 0,
          averageTime: stat._avg?.processingTime || 0,
          averageConfidence: stat._avg?.confidence || 0,
          averageCost: stat._avg?.cost || 0,
          totalCost: stat._sum?.cost || 0
        }
      }

      return result
    } catch (error) {
      console.error('Failed to get strategy comparison:', error)
      return {}
    }
  }

  /**
   * Clean up old metrics (keep last 90 days)
   */
  async cleanupOldMetrics(): Promise<void> {
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

      const deletedMetrics = await prisma.oCRMetrics.deleteMany({
        where: {
          timestamp: {
            lt: ninetyDaysAgo
          }
        }
      })

      const deletedHealth = await prisma.systemHealth.deleteMany({
        where: {
          timestamp: {
            lt: ninetyDaysAgo
          }
        }
      })

      console.log(`🧹 Cleaned up ${deletedMetrics.count} old OCR metrics and ${deletedHealth.count} health records`)
    } catch (error) {
      console.error('Failed to cleanup old metrics:', error)
    }
  }

  /**
   * Get error rate trends for alerting
   */
  async getErrorRateTrend(hours: number = 24): Promise<{ timestamp: Date; errorRate: number }[]> {
    try {
      const startDate = new Date(Date.now() - hours * 60 * 60 * 1000)
      const intervalMinutes = Math.max(30, Math.floor(hours * 60 / 48)) // Max 48 data points

      // This would require a more complex query with window functions
      // For now, return simplified trend data
      const metrics = await prisma.oCRMetrics.findMany({
        where: {
          timestamp: {
            gte: startDate
          }
        },
        select: {
          timestamp: true,
          success: true
        },
        orderBy: {
          timestamp: 'asc'
        }
      })

      // Group by time intervals
      const trends: { timestamp: Date; errorRate: number }[] = []
      const intervalMs = intervalMinutes * 60 * 1000

      for (let time = startDate.getTime(); time <= Date.now(); time += intervalMs) {
        const intervalEnd = time + intervalMs
        const intervalMetrics = metrics.filter((m: { timestamp: Date; success: boolean }) =>
          m.timestamp.getTime() >= time && m.timestamp.getTime() < intervalEnd
        )

        const errorRate = intervalMetrics.length > 0
          ? (intervalMetrics.filter(m => !m.success).length / intervalMetrics.length) * 100
          : 0

        trends.push({
          timestamp: new Date(time),
          errorRate
        })
      }

      return trends
    } catch (error) {
      console.error('Failed to get error rate trend:', error)
      return []
    }
  }

  private getEmptyStats(): OCRPerformanceStats {
    return {
      totalRequests: 0,
      successRate: 0,
      averageProcessingTime: 0,
      averageConfidence: 0,
      strategyPerformance: {},
      errorBreakdown: {},
      planPerformance: {},
      pharmaceuticalFormStats: {}
    }
  }

  private calculateStats(metrics: OCRMetrics[]): OCRPerformanceStats {
    const totalRequests = metrics.length
    const successfulRequests = metrics.filter(m => m.success).length
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0

    const processingTimes = metrics.map(m => m.processingTime).filter(t => t > 0)
    const confidences = metrics.map(m => m.confidence).filter(c => c > 0)

    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      : 0

    const averageConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0

    // Calculate strategy performance
    const strategyPerformance: Record<string, any> = {}
    const strategyGroups = metrics.reduce((acc, m) => {
      if (!acc[m.strategy]) {
        acc[m.strategy] = []
      }
      acc[m.strategy].push(m)
      return acc
    }, {} as Record<string, any[]>)

    for (const [strategy, strategyMetrics] of Object.entries(strategyGroups)) {
      const strategyRequests = strategyMetrics.length
      const strategySuccesses = strategyMetrics.filter(m => m.success).length
      const strategyTimes = strategyMetrics.map(m => m.processingTime).filter(t => t > 0)
      const strategyCosts = strategyMetrics.map(m => m.cost).filter(c => c > 0)

      strategyPerformance[strategy] = {
        requests: strategyRequests,
        successRate: strategyRequests > 0 ? (strategySuccesses / strategyRequests) * 100 : 0,
        averageTime: strategyTimes.length > 0 ? strategyTimes.reduce((a, b) => a + b, 0) / strategyTimes.length : 0,
        averageCost: strategyCosts.length > 0 ? strategyCosts.reduce((a, b) => a + b, 0) / strategyCosts.length : 0
      }
    }

    // Calculate error breakdown
    const errorBreakdown: Record<string, number> = {}
    metrics.filter(m => !m.success && m.errorType).forEach(m => {
      errorBreakdown[m.errorType!] = (errorBreakdown[m.errorType!] || 0) + 1
    })

    // Calculate plan performance
    const planPerformance: Record<string, any> = {}
    const planGroups = metrics.reduce((acc, m) => {
      if (!acc[m.userPlan]) {
        acc[m.userPlan] = []
      }
      acc[m.userPlan].push(m)
      return acc
    }, {} as Record<string, any[]>)

    for (const [plan, planMetrics] of Object.entries(planGroups)) {
      const planRequests = planMetrics.length
      const planSuccesses = planMetrics.filter(m => m.success).length
      const planTimes = planMetrics.map(m => m.processingTime).filter(t => t > 0)

      planPerformance[plan] = {
        requests: planRequests,
        successRate: planRequests > 0 ? (planSuccesses / planRequests) * 100 : 0,
        averageTime: planTimes.length > 0 ? planTimes.reduce((a, b) => a + b, 0) / planTimes.length : 0
      }
    }

    // Calculate pharmaceutical form stats
    const pharmaceuticalFormStats: Record<string, any> = {}
    const formGroups = metrics.reduce((acc, m) => {
      const form = m.pharmaceuticalForm || 'unknown'
      if (!acc[form]) {
        acc[form] = []
      }
      acc[form].push(m)
      return acc
    }, {} as Record<string, any[]>)

    for (const [form, formMetrics] of Object.entries(formGroups)) {
      const formRequests = formMetrics.length
      const formSuccesses = formMetrics.filter(m => m.success).length
      const formConfidences = formMetrics.map(m => m.confidence).filter(c => c > 0)

      pharmaceuticalFormStats[form] = {
        requests: formRequests,
        successRate: formRequests > 0 ? (formSuccesses / formRequests) * 100 : 0,
        averageConfidence: formConfidences.length > 0 ? formConfidences.reduce((a, b) => a + b, 0) / formConfidences.length : 0
      }
    }

    return {
      totalRequests,
      successRate,
      averageProcessingTime,
      averageConfidence,
      strategyPerformance,
      errorBreakdown,
      planPerformance,
      pharmaceuticalFormStats
    }
  }
}

// Export singleton instance
export const ocrMetricsCollector = OCRMetricsCollector.getInstance()
