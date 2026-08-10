import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth-minimal'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import "@/types/nextauth"

// Force dynamic rendering since this route uses Prisma
export const dynamic = 'force-dynamic'

// Limits to prevent abuse: max rewarded ads per day
const MAX_AD_REWARDS_PER_DAY = 5
const POINTS_PER_AD = 2

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    const userId = session?.user?.id as string
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        planFreePoints: true,
        adRewardsToday: true,
        adRewardsLastReset: true,
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Reset daily ad count if it's a new day
    const today = new Date().toDateString()
    const lastReset = user.adRewardsLastReset || ''
    const adsUsedToday = lastReset === today ? (user.adRewardsToday || 0) : 0

    // Enforce daily cap
    if (adsUsedToday >= MAX_AD_REWARDS_PER_DAY) {
      return NextResponse.json({
        success: false,
        message: `Daily ad reward limit reached (${MAX_AD_REWARDS_PER_DAY} ads/day). Try again tomorrow!`,
        adsUsedToday,
        maxAdsPerDay: MAX_AD_REWARDS_PER_DAY,
      })
    }

    // Credit POINTS_PER_AD to planFreePoints
    const newFreePoints = (user.planFreePoints || 0) + POINTS_PER_AD
    const newAdsUsedToday = adsUsedToday + 1

    await prisma.user.update({
      where: { id: userId },
      data: {
        planFreePoints: newFreePoints,
        adRewardsToday: newAdsUsedToday,
        adRewardsLastReset: today,
        updatedAt: new Date()
      }
    })

    Logger.info('Ad reward granted', {
      userId,
      pointsAdded: POINTS_PER_AD,
      newFreePoints,
      adsUsedToday: newAdsUsedToday
    })

    return NextResponse.json({
      success: true,
      message: `+${POINTS_PER_AD} points added for watching an ad!`,
      pointsAdded: POINTS_PER_AD,
      newBalance: newFreePoints,
      adsUsedToday: newAdsUsedToday,
      adsRemaining: MAX_AD_REWARDS_PER_DAY - newAdsUsedToday
    })

  } catch (error) {
    Logger.error('Ad reward API error', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
