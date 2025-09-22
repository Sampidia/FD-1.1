/**
 * Security Alerts Library
 *
 * Centralized security alert creation with enhanced tracking
 * for the Fake Detector application
 */

import prisma from './prisma'

export interface AlertData {
  type: string
  title: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  userId?: string
  userEmail?: string
  serviceName?: string
  resourceId?: string
  ipAddress?: string
  userAgent?: string
  deviceType?: 'mobile' | 'desktop' | 'tablet'
  browserName?: string
  osName?: string
  threatScore?: number
  confidence?: number
  patternId?: string
  similarEventCount?: number
  metadata?: Record<string, any>
}

/**
 * Create a security alert with enhanced tracking
 */
export async function createSecurityAlert(alertData: AlertData): Promise<void> {
  try {
    // Skip if no admin email configured
    const adminEmail = process.env.AD_EMAIL || process.env.NEXT_PUBLIC_AD_EMAIL
    if (!adminEmail) {
      console.warn('AD_EMAIL not configured, skipping security alert creation')
      return
    }

    // Determine service name if not provided
    const serviceName = alertData.serviceName || detectService(alertData.type)

    // Calculate threat score if not provided
    const threatScore = alertData.threatScore || calculateThreatScore(alertData)

    // Calculate confidence if not provided
    const confidence = alertData.confidence || 0.5

    // Detect pattern if not provided
    const patternId = alertData.patternId || detectPattern(alertData)

    // Count similar events
    const similarEventCount = alertData.similarEventCount ||
                             await countSimilarEvents(alertData.type, alertData.userId)

    await prisma.systemNotification.create({
      data: {
        type: alertData.type,
        title: alertData.title,
        message: alertData.message,
        severity: alertData.severity,
        status: 'unread',

        // User & Service Context
        userId: alertData.userId,
        userEmail: alertData.userEmail,
        serviceName: serviceName,
        resourceId: alertData.resourceId,

        // Geographic & Network Context
        ipAddress: alertData.ipAddress,
        userAgent: alertData.userAgent,
        deviceType: alertData.deviceType,
        browserName: alertData.browserName,
        osName: alertData.osName,

        // Response & Action Tracking
        autoResolved: false,

        // Scoring & ML Enhancement
        threatScore: threatScore,
        confidence: confidence,
        patternId: patternId,
        similarEventCount: similarEventCount,

        // Metadata
        metadata: alertData.metadata ? JSON.parse(JSON.stringify(alertData.metadata)) : undefined
      }
    })

    console.log(`🚨 ${alertData.type.toUpperCase()} Alert Created: ${alertData.title} (Threat: ${threatScore})`)

    // TODO: Send email notification to admin
    // await sendAdminEmailAlert(alertData)

  } catch (error) {
    console.error('Failed to create security alert:', error)
    // Consider logging to external monitoring service
  }
}

/**
 * Create AI Provider Failure Alert
 */
export async function createAIProviderAlert(
  provider: string,
  error: string,
  requestId?: string,
  userId?: string
): Promise<void> {
  await createSecurityAlert({
    type: 'ai_provider_failure',
    title: `🚨 AI Provider ${provider.toUpperCase()} Failed`,
    message: `AI provider ${provider} failed with error: ${error}`,
    severity: 'high',
    userId,
    serviceName: 'ai',
    resourceId: requestId,
    threatScore: 60,
    confidence: 0.9,
    metadata: {
      provider,
      error,
      requestId,
      timestamp: new Date().toISOString()
    }
  })
}

/**
 * Create Rate Limit Alert
 */
export async function createRateLimitAlert(
  userId: string,
  resource: string,
  limit: number,
  window: string,
  ipAddress?: string
): Promise<void> {
  await createSecurityAlert({
    type: 'rate_limit_exceeded',
    title: `🚨 Rate Limit Exceeded for ${resource}`,
    message: `${resource} rate limit of ${limit} per ${window} exceeded`,
    severity: 'medium',
    userId,
    serviceName: resource === 'login' || resource === 'signup' ? 'auth' : 'api',
    ipAddress,
    threatScore: 40,
    confidence: 0.8,
    metadata: {
      resource,
      limit,
      window,
      exceededAt: new Date().toISOString()
    }
  })
}

/**
 * Create Suspicious Scan Pattern Alert
 */
export async function createSuspiciousScanAlert(
  userId: string,
  scanCount: number,
  timeWindow: string,
  ipAddress?: string
): Promise<void> {
  await createSecurityAlert({
    type: 'unusual_scan_patterns',
    title: `⚠️ Unusual Scan Patterns Detected`,
    message: `High scan volume: ${scanCount} scans in ${timeWindow}`,
    severity: scanCount > 100 ? 'high' : 'medium',
    userId,
    serviceName: 'ocr',
    ipAddress,
    threatScore: scanCount > 100 ? 75 : 45,
    confidence: 0.7,
    metadata: {
      scanCount,
      timeWindow,
      pattern: 'high_volume_scanning',
      threshold: 50
    }
  })
}

/**
 * Create Batch Number Anomaly Alert
 */
export async function createBatchNumberAnomalyAlert(
  userId: string,
  batchNumber: string,
  suspiciousReason: string,
  ipAddress?: string
): Promise<void> {
  await createSecurityAlert({
    type: 'batch_number_anomalies',
    title: `🚨 Suspicious Batch Number Detected`,
    message: `Suspicious batch number pattern: ${batchNumber} - ${suspiciousReason}`,
    severity: 'medium',
    userId,
    serviceName: 'validation',
    ipAddress,
    threatScore: 50,
    confidence: 0.6,
    metadata: {
      batchNumber,
      suspiciousReason,
      validationTimestamp: new Date().toISOString()
    }
  })
}

/**
 * Create Payment Anomaly Alert
 */
export async function createPaymentAnomalyAlert(
  userId: string,
  paymentId: string,
  anomalyType: string,
  amount?: number,
  ipAddress?: string
): Promise<void> {
  await createSecurityAlert({
    type: 'payment_anomalies',
    title: `💳 Payment Anomaly Detected`,
    message: `Unusual payment pattern: ${anomalyType} (Amount: ${amount || 'unknown'})`,
    severity: 'high',
    userId,
    serviceName: 'payments',
    resourceId: paymentId,
    ipAddress,
    threatScore: 80,
    confidence: 0.9,
    metadata: {
      paymentId,
      anomalyType,
      amount,
      flaggedAt: new Date().toISOString()
    }
  })
}

/**
 * Utility function to detect service from alert type
 */
function detectService(type: string): string {
  if (type.includes('ai_') || type.includes('provider')) return 'ai'
  if (type.includes('login') || type.includes('signup')) return 'auth'
  if (type.includes('scan') || type.includes('ocr')) return 'ocr'
  if (type.includes('payment') || type.includes('billing')) return 'payments'
  if (type.includes('batch') || type.includes('validation')) return 'validation'
  return 'system'
}

/**
 * Calculate threat score based on alert data
 */
function calculateThreatScore(data: AlertData): number {
  let score = 50 // Base score

  switch (data.severity) {
    case 'critical': score = 95; break
    case 'high': score = 75; break
    case 'medium': score = 50; break
    case 'low': score = 25; break
  }

  // Adjust based on type
  if (data.type.includes('brute_force')) score += 20
  if (data.type.includes('payment')) score += 15
  if (data.type.includes('ai_provider') && data.type.includes('failure')) score += 10

  // Similar events increase score
  if ((data.similarEventCount || 0) > 5) score += 15
  if ((data.similarEventCount || 0) > 10) score += 10

  return Math.min(Math.max(score, 0), 100)
}

/**
 * Detect attack/security pattern
 */
function detectPattern(data: AlertData): string | undefined {
  if (data.type.includes('brute_force')) return 'credential_attack'
  if (data.type.includes('unusual_scan')) return 'enumeration_attack'
  if (data.type.includes('batch_number')) return 'counterfeit_attempt'
  if (data.type.includes('payment_anomaly')) return 'fraud_attempt'

  if (data.ipAddress) {
    // Could implement geographic anomaly detection here
    return 'ip_based_pattern'
  }

  return undefined
}

/**
 * Count similar recent events for pattern detection
 */
async function countSimilarEvents(type: string, userId?: string): Promise<number> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const count = await prisma.systemNotification.count({
      where: {
        type: type,
        userId: userId,
        createdAt: { gte: oneHourAgo }
      }
    })

    return count
  } catch (error) {
    console.error('Failed to count similar events:', error)
    return 1
  }
}

// Export for use in other services
export const securityAlerts = {
  createSecurityAlert,
  createAIProviderAlert,
  createRateLimitAlert,
  createSuspiciousScanAlert,
  createBatchNumberAnomalyAlert,
  createPaymentAnomalyAlert
}
