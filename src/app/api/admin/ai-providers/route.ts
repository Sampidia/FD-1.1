import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Force dynamic rendering for auth-required API routes
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Check admin access
    const session = await auth()
    const isAdmin = session?.user?.email?.includes('admin@') ||
                   session?.user?.id === 'admin001' ||
                   session?.user?.email === 'admin@fakedetector.ng'

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get all AI providers
    const aiProviders = await prisma.aIProvider.findMany({
      include: {
        planAssignments: {
          include: {
            plan: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    // Calculate usage stats for today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)

    // Get today's usage data for each provider
    const providerStats = await Promise.all(
      aiProviders.map(async (provider) => {
        // Count requests today
        const todayUsage = await prisma.aIUsageRecord.aggregate({
          where: {
            aiProviderId: provider.id,
            createdAt: {
              gte: today,
              lt: tomorrow
            }
          },
          _count: {
            id: true
          },
          _sum: {
            cost: true,
            requestTokens: true,
            responseTokens: true
          },
          _avg: {
            responseTime: true
          }
        })

        // Total usage all time
        const totalUsage = await prisma.aIUsageRecord.aggregate({
          where: { aiProviderId: provider.id },
          _count: { id: true },
          _sum: { cost: true }
        })

        // Simulate health check (in production, this would call the actual provider API)
        const isHealthy = provider.isActive && Math.random() > 0.05 // 95% uptime simulation

        return {
          id: provider.id,
          name: provider.name,
          provider: provider.provider,
          model: provider.modelName,
          status: isHealthy ? 'healthy' : 'unhealthy',
          usageToday: todayUsage._count.id,
          totalUsage: totalUsage._count.id || 0,
          responseTime: Math.round((todayUsage._avg.responseTime || 0) * 1000), // Convert to ms
          costToday: todayUsage._sum.cost || 0,
          totalCost: totalUsage._sum.cost || 0,
          plans: provider.planAssignments.map(pa => ({
            name: pa.plan.name,
            displayName: pa.plan.displayName
          }))
        }
      })
    )

    // Calculate overall statistics
    const totalRequests = providerStats.reduce((sum, p) => sum + p.usageToday, 0)
    const totalCost = providerStats.reduce((sum, p) => sum + p.costToday, 0)
    const avgResponseTime = providerStats.length > 0 ?
      Math.round(providerStats.reduce((sum, p) => sum + p.responseTime, 0) / providerStats.length) : 0

    return NextResponse.json({
      providers: providerStats,
      summary: {
        totalProviders: providerStats.length,
        activeProviders: providerStats.filter(p => p.status === 'healthy').length,
        totalRequestsToday: totalRequests,
        totalCostToday: totalCost,
        avgResponseTime,
        systemHealth: providerStats.filter(p => p.status === 'healthy').length / providerStats.length * 100
      }
    })

  } catch (error) {
    console.error('AI providers fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI provider data' },
      { status: 500 }
    )
  }
}
