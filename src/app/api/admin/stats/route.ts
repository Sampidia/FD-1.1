import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth-minimal'
import "@/types/nextauth"
import prisma from '@/lib/prisma'

// Force dynamic rendering for auth-required API routes
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Check admin access
    const session = await getServerSession(authOptions)
    const adminEmail = process.env.AD_EMAIL || process.env.NEXT_PUBLIC_AD_EMAIL
    const isAdmin = session?.user?.email === adminEmail ||
                   session?.user?.id === 'admin001'

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get user statistics
    const totalUsers = await prisma.user.count()
    const activeUsersToday = await prisma.user.count({
      where: {
        // Users who have logged in within the last 24 hours (approximated by recent data)
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    })

    // Get NAFDAC alert statistics
    const totalAlerts = await prisma.nafdacAlert.count()
    const activeAlerts = await prisma.nafdacAlert.count({
      where: { active: true }
    })

    // Get recent alert statistics (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentAlerts = await prisma.nafdacAlert.count({
      where: {
        scrapedAt: {
          gte: sevenDaysAgo
        }
      }
    })

    // Get product verification statistics for today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)

    const todayVerification = await prisma.checkResult.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    // Get AI usage statistics for today
    const todayAIUsage = await prisma.aIUsageRecord.aggregate({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      },
      _count: { id: true },
      _sum: { cost: true }
    })

    // Get total AI usage this month
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthlyAIUsage = await prisma.aIUsageRecord.aggregate({
      where: {
        createdAt: {
          gte: firstDayOfMonth
        }
      },
      _count: { id: true },
      _sum: { cost: true }
    })

    // Get user subscription statistics
    const subscriptionStats = await prisma.subscription.aggregate({
      where: { status: 'active' },
      _count: { id: true }
    })

    // Note: Contact submissions table doesn't exist in schema,
    // this would be added in future if contact form functionality is implemented
    const recentContacts = 0

    // Calculate total scans across all time
    const totalScans = await prisma.checkResult.count()

    // Calculate total revenue from payments
    const totalRevenueResult = await prisma.payment.aggregate({
      where: { status: 'completed' },
      _sum: { amount: true }
    })
    const totalRevenue = totalRevenueResult._sum.amount || 0

    // Calculate revenue growth (last 30 days vs previous 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    const recentRevenue = await prisma.payment.aggregate({
      where: {
        status: 'completed',
        createdAt: { gte: thirtyDaysAgo }
      },
      _sum: { amount: true }
    })

    const previousRevenue = await prisma.payment.aggregate({
      where: {
        status: 'completed',
        createdAt: {
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo
        }
      },
      _sum: { amount: true }
    })

    const currentRevenue = recentRevenue._sum.amount || 0
    const previousRevenueAmount = previousRevenue._sum.amount || 0
    const revenueGrowth = previousRevenueAmount > 0
      ? ((currentRevenue - previousRevenueAmount) / previousRevenueAmount) * 100
      : 0

    // Calculate user growth (last 30 days vs previous 30 days)
    const recentUsers = await prisma.user.count({
      where: {
        createdAt: { gte: thirtyDaysAgo }
      }
    })

    const previousUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo
        }
      }
    })

    const currentUserCount = recentUsers
    const previousUserCount = previousUsers
    const usersGrowth = previousUserCount > 0
      ? Math.round(((currentUserCount - previousUserCount) / previousUserCount) * 100)
      : (currentUserCount > 0 ? 100 : 0) // If no previous users but current users exist, show 100% growth

    // Calculate scans growth (last 30 days vs previous 30 days)
    const recentScans = await prisma.checkResult.count({
      where: {
        createdAt: { gte: thirtyDaysAgo }
      }
    })

    const previousScans = await prisma.checkResult.count({
      where: {
        createdAt: {
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo
        }
      }
    })

    const currentScans = recentScans
    const previousScansCount = previousScans
    const scansGrowth = previousScansCount > 0
      ? Math.round(((currentScans - previousScansCount) / previousScansCount) * 100)
      : (currentScans > 0 ? 100 : 0) // If no previous scans but current scans exist, show 100% growth

    const stats = {
      totalUsers,
      activeSubscriptions: subscriptionStats._count.id || 0,
      totalScans,
      totalRevenue,
      totalAIRequests: monthlyAIUsage._count.id,
      revenueGrowth: Math.round(revenueGrowth),
      usersGrowth,
      scansGrowth,
      // Keep additional details for enhanced dashboard
      details: {
        users: {
          total: totalUsers,
          activeToday: activeUsersToday
        },
        alerts: {
          total: totalAlerts,
          active: activeAlerts,
          recent: recentAlerts
        },
        verification: {
          todayScans: todayVerification,
          totalScans
        },
        aiUsage: {
          todayRequests: todayAIUsage._count.id,
          todaysCost: todayAIUsage._sum.cost || 0,
          monthlyRequests: monthlyAIUsage._count.id,
          monthlyCost: monthlyAIUsage._sum.cost || 0
        },
        subscriptions: {
          active: subscriptionStats._count.id || 0
        },
        contacts: {
          recentSubmissions: recentContacts
        },
        system: {
          lastScrape: new Date().toISOString(),
          version: "1.2.0",
          uptime: "Good"
        }
      }
    }

    return NextResponse.json(stats)

  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin statistics' },
      { status: 500 }
    )
  }
}
