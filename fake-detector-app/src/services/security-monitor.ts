/**
 * Security Monitoring Service
 *
 * Monitors security-related events and triggers alerts for suspicious activities.
 * Integrates with admin notifications for security incident response.
 * Now uses database persistence for login attempts with rate limiting.
 */

import prisma from '@/lib/prisma'
import { EmailService } from '@/lib/email'

export interface SecurityEvent {
  type: 'failed_login' | 'suspicious_activity' | 'unusual_traffic' | 'data_access_anomaly' | string
  severity: 'low' | 'medium' | 'high' | 'critical'
  userId?: string
  ipAddress?: string
  userAgent?: string
  details: Record<string, unknown>
  timestamp: Date
}

export class SecurityMonitor {
  private static instance: SecurityMonitor
  private readonly MAX_FAILED_ATTEMPTS = 5
  private readonly ALERT_WINDOW_MINUTES = 5  // Alert window (for security alerts)
  private readonly BLOCK_WINDOW_MINUTES = 15  // Block window (rate limit)
  private readonly CLEANUP_WINDOW_HOURS = 24  // Cleanup old records

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor()
    }
    return SecurityMonitor.instance
  }

  /**
   * Record a failed login attempt with rate limiting
   */
  async recordFailedLogin(email: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const normalizedEmail = email.toLowerCase()
    const now = new Date()

    try {
      // Check if user is already blocked
      const existingAttempt = await prisma.loginAttempt.findFirst({
        where: {
          email: normalizedEmail,
          isActive: true,
          OR: [
            { blockedUntil: { gt: now } }, // Still blocked
            {
              attemptCount: { gte: this.MAX_FAILED_ATTEMPTS },
              lastAttempt: {
                gt: new Date(now.getTime() - this.BLOCK_WINDOW_MINUTES * 60 * 1000)
              }
            } // Exceeded attempts within block window
          ]
        }
      })

      if (existingAttempt) {
        await this.triggerSecurityAlert({
          type: 'failed_login',
          severity: 'critical',
          userId: normalizedEmail,
          ipAddress,
          userAgent,
          details: {
            alreadyBlocked: true,
            attemptId: existingAttempt.id,
            blockedUntil: existingAttempt.blockedUntil,
            attemptCount: existingAttempt.attemptCount
          },
          timestamp: now
        })
        return
      }

      // Find or create attempt record within the current block window
      const blockWindowStart = new Date(now.getTime() - this.BLOCK_WINDOW_MINUTES * 60 * 1000)

      let attempt = await prisma.loginAttempt.findFirst({
        where: {
          email: normalizedEmail,
          isActive: true,
          lastAttempt: { gte: blockWindowStart }
        }
      })

      if (attempt) {
        // Update existing attempt
        attempt = await prisma.loginAttempt.update({
          where: { id: attempt.id },
          data: {
            attemptCount: attempt.attemptCount + 1,
            lastAttempt: now,
            ipAddress: ipAddress || attempt.ipAddress,
            userAgent: userAgent || attempt.userAgent,
            updatedAt: now
          }
        })
      } else {
        // Create new attempt
        attempt = await prisma.loginAttempt.create({
          data: {
            email: normalizedEmail,
            ipAddress,
            userAgent,
            attemptCount: 1,
            firstAttempt: now,
            lastAttempt: now,
            isActive: true
          }
        })
      }

      // Check if user should be blocked
      if (attempt.attemptCount >= this.MAX_FAILED_ATTEMPTS) {
        const blockedUntil = new Date(now.getTime() + this.BLOCK_WINDOW_MINUTES * 60 * 1000)

        await prisma.loginAttempt.update({
          where: { id: attempt.id },
          data: {
            blockedUntil: blockedUntil,
            updatedAt: now
          }
        })

        // Trigger security alert for blocked user
        await this.triggerSecurityAlert({
          type: 'failed_login',
          severity: 'high',
          userId: normalizedEmail,
          ipAddress,
          userAgent,
          details: {
            blocked: true,
            attemptCount: attempt.attemptCount,
            blockedUntil: blockedUntil,
            timeWindow: this.BLOCK_WINDOW_MINUTES
          },
          timestamp: now
        })
      }

    } catch (error) {
      console.error('Error recording failed login:', error)
    }
  }

  /**
   * Check if login attempts are blocked for an email
   */
  async isLoginBlocked(email: string): Promise<{ blocked: boolean, blockedUntil?: Date, remainingAttempts: number }> {
    const normalizedEmail = email.toLowerCase()
    const now = new Date()

    try {
      const latestAttempt = await prisma.loginAttempt.findFirst({
        where: {
          email: normalizedEmail,
          isActive: true,
          lastAttempt: {
            gt: new Date(now.getTime() - this.BLOCK_WINDOW_MINUTES * 60 * 1000)
          }
        },
        orderBy: { lastAttempt: 'desc' }
      })

      if (!latestAttempt) {
        return { blocked: false, remainingAttempts: this.MAX_FAILED_ATTEMPTS }
      }

      if (latestAttempt.blockedUntil && latestAttempt.blockedUntil > now) {
        return {
          blocked: true,
          blockedUntil: latestAttempt.blockedUntil,
          remainingAttempts: 0
        }
      }

      const remaining = Math.max(0, this.MAX_FAILED_ATTEMPTS - latestAttempt.attemptCount)
      return { blocked: false, remainingAttempts: remaining }

    } catch (error) {
      console.error('Error checking login block status:', error)
      return { blocked: false, remainingAttempts: this.MAX_FAILED_ATTEMPTS }
    }
  }

  /**
   * Record unusual activity
   */
  async recordUnusualActivity(
    type: 'failed_login' | 'suspicious_activity' | 'unusual_traffic' | 'data_access_anomaly',
    userId?: string,
    details: Record<string, any> = {},
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const severity = this.determineSeverity(type, details)

    if (severity !== 'low') { // Only alert on medium+ severity
      await this.triggerSecurityAlert({
        type,
        severity,
        userId,
        ipAddress,
        userAgent,
        details,
        timestamp: new Date()
      })
    }
  }

  /**
   * Check for unusual scan patterns
   */
  async checkScanAnomalies(): Promise<void> {
    try {
      // Check for users with unusually high scan rates
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

      const scanStats = await prisma.checkResult.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: oneHourAgo }
        },
        _count: { id: true }
      })

      const highVolumeUsers = scanStats.filter((stat: { userId: string | null; _count: { id: number } }) => stat._count.id > 50) // More than 50 scans per hour

      for (const user of highVolumeUsers) {
        await this.recordUnusualActivity(
          'unusual_traffic',
          user.userId,
          {
            scanCount: user._count.id,
            timeWindow: '1 hour',
            threshold: 50
          }
        )
      }

      // Check for suspicious scan patterns (high volume)
      const suspiciousUsers = scanStats.filter((stat: { userId: string | null; _count: { id: number } }) => stat._count.id > 20) // More than 20 scans per hour

      for (const user of suspiciousUsers) {
        await this.recordUnusualActivity(
          'unusual_traffic',
          user.userId,
          {
            scanCount: user._count.id,
            timeWindow: '1 hour',
            threshold: 20
          }
        )
      }
    } catch (error) {
      console.error('Failed to check scan anomalies:', error)
    }
  }

  /**
   * Determine severity of security event
   */
  private determineSeverity(type: string, details: Record<string, unknown>): 'low' | 'medium' | 'high' | 'critical' {
    switch (type) {
      case 'failed_login':
        const attempts = details.totalAttempts as number
        if (attempts >= 10) return 'critical'
        if (attempts >= 5) return 'high'
        return 'medium'

      case 'suspicious_activity':
        const failureRate = details.failureRate as number
        if (failureRate > 90) return 'critical'
        if (failureRate > 80) return 'high'
        return 'medium'

      case 'unusual_traffic':
        const scanCount = details.scanCount as number
        if (scanCount > 100) return 'critical'
        if (scanCount > 50) return 'high'
        return 'medium'

      case 'data_access_anomaly':
        return 'high'

      default:
        return 'low'
    }
  }

  /**
   * Trigger security alert
   */
  private async triggerSecurityAlert(event: SecurityEvent): Promise<void> {
    try {
      const adminEmail = process.env.AD_EMAIL
      if (!adminEmail) {
        console.warn('AD_EMAIL not configured, skipping security alert')
        return
      }

      // Create system notification with enhanced security data
      await prisma.systemNotification.create({
        data: {
          type: 'security_alert',
          title: this.getAlertTitle(event),
          message: this.getAlertMessage(event),
          severity: event.severity === 'critical' ? 'critical' : 'high',
          status: 'unread',

          // User & Service Context
          userEmail: event.userId || undefined, // For failed logins, userId contains email
          serviceName: 'auth', // Most security alerts are auth-related

          // Geographic & Network Context
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,

          // Response & Action Tracking
          autoResolved: false,

          // Scoring & ML Enhancement
          threatScore: this.calculateThreatScore(event),
          confidence: this.calculateConfidence(event),
          similarEventCount: (event.details.similarEventCount as number) || 1,
          patternId: this.detectAttackPattern(event),

          // Existing metadata (will be migrated to new fields over time)
          metadata: JSON.parse(JSON.stringify({
            eventType: event.type,
            userId: event.userId,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            details: event.details,
            timestamp: event.timestamp.toISOString()
          }))
        }
      })

      // Send email alert
      await EmailService.sendSecurityAlert(
        adminEmail,
        this.getAlertTitle(event),
        event.type as string,
        event.severity,
        event.userId,
        event.ipAddress,
        event.details
      )

      console.log(`🚨 Security alert triggered: ${event.type} (${event.severity})`)

    } catch (error) {
      console.error('Failed to trigger security alert:', error)
    }
  }

  /**
   * Get alert title based on event type
   */
  private getAlertTitle(event: SecurityEvent): string {
    switch (event.type) {
      case 'failed_login':
        return `🚨 Multiple Failed Login Attempts - ${event.severity.toUpperCase()}`
      case 'suspicious_activity':
        return `⚠️ Suspicious User Activity Detected`
      case 'unusual_traffic':
        return `📈 Unusual Traffic Pattern Detected`
      case 'data_access_anomaly':
        return `🔒 Data Access Anomaly Detected`
      default:
        return `🚨 Security Alert - ${(event.type as string).toUpperCase()}`
    }
  }

  /**
   * Get alert message based on event details
   */
  private getAlertMessage(event: SecurityEvent): string {
    const details = event.details

    switch (event.type) {
      case 'failed_login':
        const ipAddresses = details.ipAddresses as string[] || []
        return `Multiple failed login attempts detected for user ${event.userId || 'unknown'}. ${details.totalAttempts || 0} attempts from ${ipAddresses.length || 1} IP addresses.`

      case 'suspicious_activity':
        return `Unusual activity detected: ${details.failureRate || 'High'} failure rate with ${details.totalScans || 0} scans.`

      case 'unusual_traffic':
        return `High traffic volume: ${details.scanCount || 0} scans in ${details.timeWindow || 'time period'}.`

      case 'data_access_anomaly':
        return `Data access anomaly detected: ${JSON.stringify(details)}`

      default:
        return `Security event: ${event.type} - ${JSON.stringify(details)}`
    }
  }


  /**
   * Get security statistics for monitoring
   */
  async getSecurityStats(hours: number = 24): Promise<{
    failedLogins: number
    securityAlerts: number
    blockedIPs: string[]
    recentEvents: SecurityEvent[]
  }> {
    try {
      const startDate = new Date(Date.now() - hours * 60 * 60 * 1000)

      // Get failed login attempts from database
      const failedLoginCount = await prisma.loginAttempt.count({
        where: {
          attemptCount: { gte: 1 },
          createdAt: { gte: startDate }
        }
      })

      const alerts = await prisma.systemNotification.findMany({
        where: {
          type: 'security_alert',
          createdAt: { gte: startDate }
        },
        orderBy: { createdAt: 'desc' }
      })

      return {
        failedLogins: failedLoginCount,
        securityAlerts: alerts.length,
        blockedIPs: [], // Could track blocked IPs here
        recentEvents: alerts.slice(0, 10).map((alert: { severity: string; createdAt: Date; metadata?: unknown }) => ({
          type: ((alert.metadata as Record<string, unknown>)?.eventType as string) || 'unknown',
          severity: alert.severity as 'low' | 'medium' | 'high' | 'critical',
          userId: (alert.metadata as Record<string, unknown>)?.userId as string,
          ipAddress: (alert.metadata as Record<string, unknown>)?.ipAddress as string,
          userAgent: (alert.metadata as Record<string, unknown>)?.userAgent as string,
          details: (alert.metadata as Record<string, unknown>)?.details as Record<string, unknown> || {},
          timestamp: alert.createdAt
        }))
      }
    } catch (error) {
      console.error('Failed to get security stats:', error)
      return {
        failedLogins: 0,
        securityAlerts: 0,
        blockedIPs: [],
        recentEvents: []
      }
    }
  }

  /**
   * Calculate threat score based on event type and severity
   */
  private calculateThreatScore(event: SecurityEvent): number {
    let baseScore = 0

    switch (event.severity) {
      case 'low': baseScore = 20; break
      case 'medium': baseScore = 40; break
      case 'high': baseScore = 70; break
      case 'critical': baseScore = 95; break
    }

    // Adjust based on event type
    switch (event.type) {
      case 'failed_login':
        baseScore += (event.details.totalAttempts as number || 1) * 5
        break
      case 'unusual_traffic':
        baseScore += Math.min((event.details.scanCount as number || 0) / 2, 20)
        break
      case 'suspicious_activity':
        baseScore += 15
        break
    }

    return Math.min(Math.max(baseScore, 0), 100)
  }

  /**
   * Calculate confidence score for the alert
   */
  private calculateConfidence(event: SecurityEvent): number {
    let confidence = 0.5 // Base confidence

    // Higher confidence for repeated attempts
    const similarEvents = event.details.similarEventCount as number || 1
    confidence += Math.min(similarEvents * 0.1, 0.3)

    // Higher confidence for failed logins with multiple IP addresses
    if (event.type === 'failed_login' && event.details.ipAddresses) {
      confidence += Math.min((event.details.ipAddresses as string[]).length * 0.1, 0.2)
    }

    return Math.min(Math.max(confidence, 0), 1)
  }

  /**
   * Detect attack pattern from event
   */
  private detectAttackPattern(event: SecurityEvent): string | undefined {
    if (event.type === 'failed_login') {
      if ((event.details.totalAttempts as number || 0) >= 10) {
        return 'brute_force_attack'
      } else if ((event.details.ipAddresses as string[] || []).length > 3) {
        return 'distributed_brute_force'
      }
    } else if (event.type === 'unusual_traffic') {
      const scanCount = event.details.scanCount as number || 0
      if (scanCount > 100) {
        return 'high_volume_scan'
      } else if (scanCount > 50) {
        return 'automated_scanning'
      }
    }
    return undefined
  }

  /**
   * Clean up old security records
   */
  async cleanupOldRecords(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - this.CLEANUP_WINDOW_HOURS * 60 * 60 * 1000)

      const [loginDeactivated, signupDeactivated] = await Promise.all([
        // @ts-ignore - Prisma model naming may be inconsistent
        prisma.loginAttempt?.updateMany({
          where: { lastAttempt: { lt: cutoffDate } },
          data: { isActive: false }
        }) || Promise.resolve({ count: 0 }),
        // @ts-ignore - Prisma model naming may be inconsistent
        prisma.signupAttempt?.updateMany({
          where: { lastAttempt: { lt: cutoffDate } },
          data: { isActive: false }
        }) || Promise.resolve({ count: 0 })
      ])

      console.log(`🧹 Cleaned up ${loginDeactivated.count} old login attempts and ${signupDeactivated.count} old signup attempts`)

    } catch (error) {
      console.error('Error during security records cleanup:', error)
    }
  }
}

// Export singleton instance
export const securityMonitor = SecurityMonitor.getInstance()
