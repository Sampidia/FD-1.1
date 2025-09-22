// API endpoint to get user's current plan and balance
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get user with plan
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        pointsBalance: true,
        // Plan-specific point balances for batch scan functionality
        planBasicPoints: true,
        planStandardPoints: true,
        planBusinessPoints: true,
        planUsers: {
          select: {
            id: true,
            name: true,
            displayName: true,
            maxScansPerMonth: true,
            maxAIRequestsPerMonth: true,
            priority: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Calculate usage for current month
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
    const monthStart = new Date(`${currentMonth}-01T00:00:00Z`)

    const usageStats = await prisma.checkResult.aggregate({
      where: {
        userId: session.user.id,
        createdAt: { gte: monthStart }
      },
      _count: { id: true }
    })

    // Get AI requests for the month
    const aiUsage = await prisma.aIUsageRecord.aggregate({
      where: {
        userId: session.user.id,
        createdAt: { gte: monthStart }
      },
      _count: { id: true }
    })

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        pointsBalance: user.pointsBalance,
        // Plan-specific point balances for batch scan functionality
        planBasicPoints: user.planBasicPoints,
        planStandardPoints: user.planStandardPoints,
        planBusinessPoints: user.planBusinessPoints,
        currentPlan: user.planUsers || null
      },
      usageStats: {
        scansThisMonth: usageStats._count.id,
        aiRequestsThisMonth: aiUsage._count.id
      }
    })

  } catch (error) {
    console.error("Get user plan error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
