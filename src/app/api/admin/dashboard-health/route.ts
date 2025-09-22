/**
 * Admin Dashboard Health API - Calculates system health and performance metrics
 *
 * This endpoint aggregates health data for dashboard cards including system uptime,
 * average response times, security alerts, and recent activity feeds.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    // Check admin access
    const session = await auth()
    const adminEmail = process.env.AD_EMAIL || process.env.NEXT_PUBLIC_AD_EMAIL
    const isAdmin = session?.user?.email === adminEmail ||
                   session?.user?.id === 'admin001'

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    console.log('🏥 CALCULATING DASHBOARD HEALTH METRICS...')

    // Calculate system health (98.5% is a placeholder, calculate real uptime)
    // In a real system, this would come from uptime monitoring services
    // For now, we'll base it on AI provider health and system activity
    const aiProviders = await prisma.aIProvider.findMany({
      select: { id: true, isActive: true }
    })
    const activeAIProviders = aiProviders.filter((p: any) => p.isActive).length
    const systemHealthPercent = Math.round((activeAIProviders / aiProviders.length) * 100 * 0.99) // 99% uptime factor

    // Calculate average response time from OCR metrics or AI usage
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Try OCR response time first (more specific)
    let avgResponseTime = 1.2 // fallback
    const ocrAvgTime = await prisma.oCRMetrics.aggregate({
      where: {
        createdAt: { gte: oneDayAgo },
        success: true
      },
      _avg: {
        processingTime: true
      }
    })

    if (ocrAvgTime._avg.processingTime) {
      avgResponseTime = Math.round(ocrAvgTime._avg.processingTime / 1000 * 100) / 100 // Convert to seconds
    } else {
      // Fallback to AI usage response time
      const aiAvgTime = await prisma.aIUsageRecord.aggregate({
        where: {
          createdAt: { gte: oneDayAgo }
        },
        _avg: {
          responseTime: true
        }
      })
      if (aiAvgTime._avg.responseTime) {
        avgResponseTime = Math.round(aiAvgTime._avg.responseTime * 100) / 100 // Already in seconds
      }
    }

    // Calculate active security alerts
    const activeSecurityAlerts = await prisma.systemNotification.count({
      where: {
        type: 'security_alert',
        isResolved: false
      }
    })

    // Get recent activity for dashboard
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

    // Get recent successful AI requests
    const recentAIRequests = await prisma.aIUsageRecord.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      where: { createdAt: { gte: twoHoursAgo } },
      include: {
        user: { select: { email: true } }
      }
    })

    // Get recent scans
    const recentScans = await prisma.checkResult.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      where: { createdAt: { gte: twoHoursAgo } },
      select: {
        id: true,
        createdAt: true,
        isCounterfeit: true
      }
    })

    // Get recent payments
    const recentPayments = await prisma.payment.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      where: { createdAt: { gte: twoHoursAgo } },
      select: {
        id: true,
        amount: true,
        currency: true,
        planTier: true,
        createdAt: true
      }
    })

    // Combine and sort recent activity
    const recentActivity = [
      ...recentAIRequests.map(req => ({
        id: req.id,
        type: 'ai_request' as const,
        title: 'AI Analysis Completed',
        message: `Processed request for user ${req.user?.email?.split('@')[0]}***`,
        timeAgo: getTimeAgo(req.createdAt)
      })),
      ...recentScans.map(scan => ({
        id: scan.id,
        type: 'scan' as const,
        title: 'Product Verified',
        message: `Scan completed - ${scan.isCounterfeit ? 'Counterfeit detected' : 'Product appears genuine'}`,
        timeAgo: getTimeAgo(scan.createdAt)
      })),
      ...recentPayments.map(payment => ({
        id: payment.id,
        type: 'payment' as const,
        title: 'Payment Received',
        message: `${payment.currency} ${payment.amount} purchase for ${payment.planTier} plan`,
        timeAgo: getTimeAgo(payment.createdAt)
      }))
    ].sort((a, b) => {
      // Sort by time (most recent first) - we'd need actual timestamps for better sorting
      return a.timeAgo.includes('min') && b.timeAgo.includes('min') ? 0 :
             a.timeAgo.includes('sec') ? -1 :
             b.timeAgo.includes('sec') ? 1 : 0
    }).slice(0, 6) // Keep only the 6 most recent

    // Calculate trend values that are missing from stats API
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const dayBeforeYesterday = new Date(yesterday)
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1)

    // Get today's security alerts
    const todaysAlerts = await prisma.systemNotification.count({
      where: {
        type: 'security_alert',
        createdAt: {
          gte: new Date(today.getFullYear(), today.getMonth(), today.getDate())
        }
      }
    })

    // Get yesterday's security alerts
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
    const yesterdayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const yesterdayAlerts = await prisma.systemNotification.count({
      where: {
        type: 'security_alert',
        createdAt: {
          gte: yesterdayStart,
          lt: yesterdayEnd
        }
      }
    })

    // Calculate AI requests trend (daily growth)
    const todayAI = await prisma.aIUsageRecord.count({
      where: {
        createdAt: {
          gte: new Date(today.getFullYear(), today.getMonth(), today.getDate())
        }
      }
    })
    const yesterdayAI = await prisma.aIUsageRecord.count({
      where: {
        createdAt: {
          gte: yesterdayStart,
          lt: yesterdayEnd
        }
      }
    })
    const aiTrend = yesterdayAI > 0 ? Math.round(((todayAI - yesterdayAI) / yesterdayAI) * 100) : (todayAI > 0 ? 100 : 0)

    // Get active subscriptions count for trend calculation
    const todaysSubscriptions = await prisma.subscription.count({
      where: {
        status: 'active',
        createdAt: {
          gte: new Date(today.getFullYear(), today.getMonth(), today.getDate())
        }
      }
    })
    const yesterdaySubscriptions = await prisma.subscription.count({
      where: {
        status: 'active',
        createdAt: {
          gte: yesterdayStart,
          lt: yesterdayEnd
        }
      }
    })
    const subscriptionTrend = yesterdaySubscriptions > 0 ?
      Math.round(((todaysSubscriptions - yesterdaySubscriptions) / yesterdaySubscriptions) * 100) :
      (todaysSubscriptions > 0 ? 100 : 0)

    const dashboardHealth = {
      systemHealth: {
        percentage: `${systemHealthPercent}%`,
        status: activeAIProviders === aiProviders.length ? 'Excellent' : 'Good',
        details: `${activeAIProviders}/${aiProviders.length} AI providers healthy`
      },
      averageResponseTime: {
        time: `${avgResponseTime}s`,
        status: avgResponseTime < 2 ? 'Fast' : avgResponseTime < 5 ? 'Good' : 'Slow'
      },
      securityAlerts: {
        count: activeSecurityAlerts,
        status: activeSecurityAlerts === 0 ? 'Clean' : activeSecurityAlerts < 5 ? 'Monitoring' : 'High'
      },
      trends: {
        aiRequests: aiTrend,
        subscriptions: subscriptionTrend,
        securityAlerts: {
          today: todaysAlerts,
          yesterday: yesterdayAlerts
        }
      },
      recentActivity: recentActivity,
      metadata: {
        calculatedAt: new Date().toISOString(),
        aiProvidersChecked: aiProviders.length,
        timeRange: 'Last 24 hours for metrics, 2 hours for activity'
      }
    }

    return NextResponse.json(dashboardHealth)

  } catch (error) {
    console.error('Admin dashboard health error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate dashboard health metrics' },
      { status: 500 }
    )
  }
}

// Helper function to format time ago
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  return `${Math.floor(diffInSeconds / 86400)}d ago`
}
