/**
 * System Health Monitoring Service
 *
 * Monitors critical system health metrics and triggers alerts when thresholds are exceeded.
 * Integrates with admin notifications for proactive system management.
 */

import prisma from '@/lib/prisma'
import { EmailService } from '@/lib/email'
import { ocrMetricsCollector } from './ocr-metrics-collector'

export interface HealthMetric {
  name: 'ocr_accuracy' | 'api_response_time' | 'error_rate' | 'memory_usage' | 'db_connection_time'
  value: number
  threshold: number
  unit: string
}

export interface HealthCheckResult {
  metric: HealthMetric
  status: 'healthy' | 'warning' | 'critical'
  message: string
  timestamp: Date
}

export class SystemHealthMonitor {
  private static instance: SystemHealthMonitor
  private lastHealthCheck: Date = new Date(0)
  private healthCheckInterval = 5 * 60 * 1000 // 5 minutes

  // Health thresholds
  private thresholds = {
    ocr_accuracy: { warning: 0.7, critical: 0.5 }, // Below 70% = warning, below 50% = critical
    api_response_time: { warning: 5000, critical: 10000 }, // Over 5s = warning, over 10s = critical
    error_rate: { warning: 0.1, critical: 0.25 }, // Over 10% = warning, over 25% = critical
    memory_usage: { warning: 0.8, critical: 0.9 }, // Over 80% = warning, over 90% = critical
    db_connection_time: { warning: 1000, critical: 5000 } // Over 1s = warning, over 5s = critical
  }

  static getInstance(): SystemHealthMonitor {
    if (!SystemHealthMonitor.instance) {
      SystemHealthMonitor.instance = new SystemHealthMonitor()
    }
    return SystemHealthMonitor.instance
  }

  /**
   * Perform comprehensive system health check
   */
  async performHealthCheck(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = []

    // OCR Accuracy Check
    const ocrAccuracy = await this.checkOCRAccuracy()
    results.push(ocrAccuracy)

    // API Response Time Check
    const apiResponseTime = await this.checkAPIResponseTime()
    results.push(apiResponseTime)

    // Error Rate Check
    const errorRate = await this.checkErrorRate()
    results.push(errorRate)

    // Database Connection Check
    const dbConnectionTime = await this.checkDatabaseConnection()
    results.push(dbConnectionTime)

    // Memory Usage Check (simplified)
    const memoryUsage = await this.checkMemoryUsage()
    results.push(memoryUsage)

    // Process critical issues
    const criticalIssues = results.filter(r => r.status === 'critical')
    if (criticalIssues.length > 0) {
      await this.sendHealthAlert(criticalIssues, 'critical')
    }

    // Process warning issues
    const warningIssues = results.filter(r => r.status === 'warning')
    if (warningIssues.length > 0) {
      await this.sendHealthAlert(warningIssues, 'warning')
    }

    this.lastHealthCheck = new Date()
    return results
  }

  /**
   * Check OCR accuracy over the last hour
   */
  private async checkOCRAccuracy(): Promise<HealthCheckResult> {
    try {
      // Get OCR metrics from the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const recentMetrics = await prisma.oCRMetrics.findMany({
        where: {
          timestamp: { gte: oneHourAgo },
          success: true
        }
      })

      if (recentMetrics.length === 0) {
        return {
          metric: { name: 'ocr_accuracy', value: 1.0, threshold: 0.7, unit: '%' },
          status: 'healthy',
          message: 'No recent OCR operations to analyze',
          timestamp: new Date()
        }
      }

      const totalMetrics = recentMetrics.length
      const successfulMetrics = recentMetrics.filter((m: { confidence: number | null }) => m.confidence && m.confidence >= 0.5).length
      const accuracy = successfulMetrics / totalMetrics

      const status = accuracy < this.thresholds.ocr_accuracy.critical ? 'critical' :
                    accuracy < this.thresholds.ocr_accuracy.warning ? 'warning' : 'healthy'

      return {
        metric: { name: 'ocr_accuracy', value: accuracy * 100, threshold: 70, unit: '%' },
        status,
        message: `OCR accuracy: ${(accuracy * 100).toFixed(1)}% (${successfulMetrics}/${totalMetrics} successful)`,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        metric: { name: 'ocr_accuracy', value: 0, threshold: 70, unit: '%' },
        status: 'critical',
        message: 'Failed to check OCR accuracy',
        timestamp: new Date()
      }
    }
  }

  /**
   * Check API response times
   */
  private async checkAPIResponseTime(): Promise<HealthCheckResult> {
    try {
      // Get recent AI usage records
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const recentUsage = await prisma.aIUsageRecord.findMany({
        where: {
          createdAt: { gte: oneHourAgo }
        },
        select: { responseTime: true }
      })

      if (recentUsage.length === 0) {
        return {
          metric: { name: 'api_response_time', value: 0, threshold: 5000, unit: 'ms' },
          status: 'healthy',
          message: 'No recent API calls to analyze',
          timestamp: new Date()
        }
      }

      const avgResponseTime = recentUsage.reduce((sum, record) =>
        sum + (record.responseTime || 0), 0) / recentUsage.length

      const status = avgResponseTime > this.thresholds.api_response_time.critical ? 'critical' :
                    avgResponseTime > this.thresholds.api_response_time.warning ? 'warning' : 'healthy'

      return {
        metric: { name: 'api_response_time', value: avgResponseTime, threshold: 5000, unit: 'ms' },
        status,
        message: `Average API response time: ${avgResponseTime.toFixed(0)}ms (${recentUsage.length} requests)`,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        metric: { name: 'api_response_time', value: 0, threshold: 5000, unit: 'ms' },
        status: 'critical',
        message: 'Failed to check API response times',
        timestamp: new Date()
      }
    }
  }

  /**
   * Check system error rate
   */
  private async checkErrorRate(): Promise<HealthCheckResult> {
    try {
      // Get recent OCR metrics and AI usage
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

      const [ocrMetrics, aiUsage] = await Promise.all([
        prisma.oCRMetrics.findMany({
          where: { timestamp: { gte: oneHourAgo } },
          select: { success: true }
        }),
        prisma.aIUsageRecord.findMany({
          where: { createdAt: { gte: oneHourAgo } },
          select: { success: true }
        })
      ])

      const totalOperations = ocrMetrics.length + aiUsage.length
      if (totalOperations === 0) {
        return {
          metric: { name: 'error_rate', value: 0, threshold: 10, unit: '%' },
          status: 'healthy',
          message: 'No recent operations to analyze',
          timestamp: new Date()
        }
      }

      const failedOperations = ocrMetrics.filter(m => !m.success).length +
                              aiUsage.filter(u => !u.success).length
      const errorRate = (failedOperations / totalOperations) * 100

      const status = errorRate > this.thresholds.error_rate.critical ? 'critical' :
                    errorRate > this.thresholds.error_rate.warning ? 'warning' : 'healthy'

      return {
        metric: { name: 'error_rate', value: errorRate, threshold: 10, unit: '%' },
        status,
        message: `Error rate: ${errorRate.toFixed(1)}% (${failedOperations}/${totalOperations} failed)`,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        metric: { name: 'error_rate', value: 0, threshold: 10, unit: '%' },
        status: 'critical',
        message: 'Failed to check error rate',
        timestamp: new Date()
      }
    }
  }

  /**
   * Check database connection time
   */
  private async checkDatabaseConnection(): Promise<HealthCheckResult> {
    try {
      const startTime = Date.now()
      // Use ping command for MongoDB compatibility
      await prisma.$runCommandRaw({ ping: 1 })
      const connectionTime = Date.now() - startTime

      const status = connectionTime > this.thresholds.db_connection_time.critical ? 'critical' :
                    connectionTime > this.thresholds.db_connection_time.warning ? 'warning' : 'healthy'

      return {
        metric: { name: 'db_connection_time', value: connectionTime, threshold: 1000, unit: 'ms' },
        status,
        message: `Database connection time: ${connectionTime}ms`,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        metric: { name: 'db_connection_time', value: 0, threshold: 1000, unit: 'ms' },
        status: 'critical',
        message: 'Database connection failed',
        timestamp: new Date()
      }
    }
  }

  /**
   * Check memory usage (simplified - Node.js memory)
   */
  private async checkMemoryUsage(): Promise<HealthCheckResult> {
    try {
      const memUsage = process.memoryUsage()
      const usedMemoryMB = memUsage.heapUsed / 1024 / 1024
      const totalMemoryMB = memUsage.heapTotal / 1024 / 1024
      const memoryUsageRatio = usedMemoryMB / totalMemoryMB

      const status = memoryUsageRatio > this.thresholds.memory_usage.critical ? 'critical' :
                    memoryUsageRatio > this.thresholds.memory_usage.warning ? 'warning' : 'healthy'

      return {
        metric: { name: 'memory_usage', value: memoryUsageRatio * 100, threshold: 80, unit: '%' },
        status,
        message: `Memory usage: ${(memoryUsageRatio * 100).toFixed(1)}% (${usedMemoryMB.toFixed(0)}MB/${totalMemoryMB.toFixed(0)}MB)`,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        metric: { name: 'memory_usage', value: 0, threshold: 80, unit: '%' },
        status: 'critical',
        message: 'Failed to check memory usage',
        timestamp: new Date()
      }
    }
  }

  /**
   * Send health alert notifications
   */
  private async sendHealthAlert(issues: HealthCheckResult[], severity: 'warning' | 'critical'): Promise<void> {
    try {
      const adminEmail = process.env.AD_EMAIL
      if (!adminEmail) {
        console.warn('AD_EMAIL not configured, skipping health alert')
        return
      }

      const alertTitle = severity === 'critical' ? '🚨 Critical System Health Alert!' : '⚠️ System Health Warning'
      const issuesSummary = issues.map(issue =>
        `• ${issue.metric.name}: ${issue.metric.value.toFixed(1)}${issue.metric.unit} (${issue.status})`
      ).join('\n')

      console.log(`${severity === 'critical' ? '🚨' : '⚠️'} Sending system health alert: ${issues.length} issues detected`)

      // Create system notification
      await prisma.systemNotification.create({
        data: {
          type: 'system_health_alert',
          title: alertTitle,
          message: `System health issues detected:\n${issuesSummary}`,
          severity: severity === 'critical' ? 'critical' : 'high',
          metadata: {
            issues: issues.map(issue => ({
              metric: issue.metric.name,
              value: issue.metric.value,
              threshold: issue.metric.threshold,
              status: issue.status,
              message: issue.message
            })),
            timestamp: new Date().toISOString()
          }
        }
      })

      // Send email notification
      await EmailService.sendSystemHealthAlert(
        adminEmail,
        alertTitle,
        issues.map(issue => ({
          metric: issue.metric.name,
          value: issue.metric.value,
          threshold: issue.metric.threshold,
          status: issue.status,
          message: issue.message
        })),
        severity
      )

      console.log(`✅ System health alert sent to ${adminEmail}`)

    } catch (error) {
      console.error('Failed to send system health alert:', error)
    }
  }

  /**
   * Start periodic health monitoring
   */
  startPeriodicMonitoring(): void {
    setInterval(async () => {
      try {
        await this.performHealthCheck()
      } catch (error) {
        console.error('Health check failed:', error)
      }
    }, this.healthCheckInterval)

    console.log(`🔍 System health monitoring started (interval: ${this.healthCheckInterval / 1000}s)`)
  }

  /**
   * Get last health check results
   */
  getLastHealthCheck(): Date {
    return this.lastHealthCheck
  }
}

// Export singleton instance
export const systemHealthMonitor = SystemHealthMonitor.getInstance()
