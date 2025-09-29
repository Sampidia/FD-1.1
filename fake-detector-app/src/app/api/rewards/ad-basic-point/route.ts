import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth-minimal'
import prisma from '@/lib/prisma'
import "@/types/nextauth"

// Force dynamic rendering since this uses request data
export const dynamic = 'force-dynamic'

// Ad reward rate limiting (3 per day per user)
const AD_REWARD_LIMIT = 3
const AD_REWARD_WINDOW = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

export async function POST(request: NextRequest) {
  try {
    // Authentication required
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Check user's ad reward history for rate limiting
    const oneDayAgo = new Date(Date.now() - AD_REWARD_WINDOW)

    const recentAdRewards = await prisma.adRewardLog.findMany({
      where: {
        userId,
        rewardType: 'BASIC_POINT_AD',
        grantedAt: {
          gte: oneDayAgo
        }
      }
    })

    if (recentAdRewards.length >= AD_REWARD_LIMIT) {
      return NextResponse.json(
        {
          error: 'Daily reward limit reached',
          message: 'You can earn up to 3 basic points per day from ads. Try again tomorrow!',
          rewardsUsed: recentAdRewards.length,
          resetTime: new Date(Date.now() + AD_REWARD_WINDOW).toISOString()
        },
        { status: 429 }
      )
    }

    // Verify user has access to rewards (any plan or free)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        planBasicPoints: true,
        planStandardPoints: true,
        planBusinessPoints: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Grant 1 basic point
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        planBasicPoints: { increment: 1 }
      },
      select: {
        planBasicPoints: true,
        planStandardPoints: true,
        planBusinessPoints: true
      }
    })

    // Calculate new total available points
    const newTotalPoints = updatedUser.planBasicPoints +
                          updatedUser.planStandardPoints +
                          updatedUser.planBusinessPoints

    // Log the reward in database for tracking
    await prisma.adRewardLog.create({
      data: {
        userId,
        rewardType: 'BASIC_POINT_AD',
        pointsGranted: 1,
        grantedAt: new Date(),
        // Optional: track source (mobile app, web, etc.)
        metadata: {
          userAgent: request.headers.get('user-agent') || 'unknown',
          platform: 'mobile' // Since this is ad-based, it's likely mobile
        }
      }
    })

    // Log security event
    console.log(`🎉 AD REWARD: User ${userId} earned 1 basic point from ad. Total basic points: ${updatedUser.planBasicPoints}`)

    return NextResponse.json({
      success: true,
      message: 'Basic point granted successfully!',
      pointsAdded: 1,
      newBasicPoints: updatedUser.planBasicPoints,
      newTotalPoints,
      rewardsUsedToday: recentAdRewards.length + 1,
      dailyLimit: AD_REWARD_LIMIT,
      nextRewardAvailable: recentAdRewards.length + 1 >= AD_REWARD_LIMIT ?
        new Date(Date.now() + AD_REWARD_WINDOW).toISOString() : null
    })

  } catch (error) {
    console.error('Ad reward error:', error)

    return NextResponse.json(
      {
        error: 'Reward processing failed',
        message: 'Unable to process your reward. Please try again.'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check reward status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Check recent reward history
    const oneDayAgo = new Date(Date.now() - AD_REWARD_WINDOW)

    const recentAdRewards = await prisma.adRewardLog.findMany({
      where: {
        userId,
        rewardType: 'BASIC_POINT_AD',
        grantedAt: {
          gte: oneDayAgo
        }
      },
      orderBy: {
        grantedAt: 'desc'
      }
    })

    // Get current point balances
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        planBasicPoints: true,
        planStandardPoints: true,
        planBusinessPoints: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const totalPoints = user.planBasicPoints + user.planStandardPoints + user.planBusinessPoints

    return NextResponse.json({
      canEarnReward: recentAdRewards.length < AD_REWARD_LIMIT,
      rewardsUsedToday: recentAdRewards.length,
      dailyLimit: AD_REWARD_LIMIT,
      nextRewardTime: recentAdRewards.length >= AD_REWARD_LIMIT ?
        new Date(Math.max(...recentAdRewards.map(r => r.grantedAt.getTime())) + AD_REWARD_WINDOW).toISOString()
        : null,
      currentPoints: {
        basic: user.planBasicPoints,
        standard: user.planStandardPoints,
        business: user.planBusinessPoints,
        total: totalPoints
      },
      recentRewards: recentAdRewards.slice(0, 5).map(r => ({
        grantedAt: r.grantedAt.toISOString(),
        pointsGranted: r.pointsGranted
      }))
    })

  } catch (error) {
    console.error('Reward status check error:', error)

    return NextResponse.json(
      { error: 'Status check failed' },
      { status: 500 }
    )
  }
}
