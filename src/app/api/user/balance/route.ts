import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Get user's current balance and daily points info
    const user = await prisma.user.findUnique({
      where: { id: userId },
  select: {
    pointsBalance: true,
    planBasicPoints: true,
    planStandardPoints: true,
    planBusinessPoints: true,
    planFreePoints: true,      // Add free points to select
    dailyPointsLastGiven: true,
    createdAt: true,
    updatedAt: true
  }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Priority logic for points balance display
    // Business > Standard > Basic > General pointsBalance
    let displayBalance = user.pointsBalance // fallback to general balance

    if (user.planBusinessPoints && user.planBusinessPoints > 0) {
      displayBalance = user.planBusinessPoints
    } else if (user.planStandardPoints && user.planStandardPoints > 0) {
      displayBalance = user.planStandardPoints
    } else if (user.planBasicPoints && user.planBasicPoints > 0) {
      displayBalance = user.planBasicPoints
    }

    // Calculate total available points across plan tiers (EXCLUDE legacy pointsBalance)
    const totalAvailablePoints = (user.planBusinessPoints || 0) +
                                (user.planStandardPoints || 0) +
                                (user.planBasicPoints || 0) +
                                (user.planFreePoints || 0)
                                // EXCLUDE: (user.pointsBalance || 0) - Legacy balance not included

    const today = new Date().toDateString()
    const lastGiven = user.dailyPointsLastGiven || ''
    const canClaimDailyPoints = lastGiven !== today

    // Calculate next daily points availability
    let nextDailyPointsTime = null
    if (!canClaimDailyPoints && lastGiven === today) {
      // If claimed today, next is tomorrow
      nextDailyPointsTime = new Date(Date.now() + 24 * 60 * 60 * 1000)
    }

    return NextResponse.json({
      success: true,
      data: {
        userId,
        pointsBalance: displayBalance,
        totalAvailablePoints,
        canClaimDailyPoints,
        nextDailyPointsTime: nextDailyPointsTime?.toISOString(),
        lastDailyPointsGiven: user.dailyPointsLastGiven,
        accountCreated: user.createdAt.toISOString(),
        lastUpdated: user.updatedAt.toISOString()
      }
    })

  } catch (error) {
    Logger.error('Balance API error', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// UPDATE balance (for internal operations like product scans)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const { points, operation } = await request.json()

    if (typeof points !== 'number' || points < 0) {
      return NextResponse.json(
        { error: 'Invalid points amount' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pointsBalance: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    let newBalance: number

    if (operation === 'subtract') {
      if (user.pointsBalance < points) {
        return NextResponse.json(
          { error: 'Insufficient points balance' },
          { status: 400 }
        )
      }
      newBalance = user.pointsBalance - points
    } else if (operation === 'add') {
      newBalance = user.pointsBalance + points
    } else {
      return NextResponse.json(
        { error: 'Invalid operation. Use "add" or "subtract"' },
        { status: 400 }
      )
    }

    // Update user balance
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        pointsBalance: newBalance,
        updatedAt: new Date()
      },
      select: {
        pointsBalance: true,
        updatedAt: true
      }
    })

    Logger.info('Balance updated', {
      userId,
      operation,
      points,
      oldBalance: user.pointsBalance,
      newBalance
    })

    return NextResponse.json({
      success: true,
      data: {
        pointsBalance: updatedUser.pointsBalance,
        updatedAt: updatedUser.updatedAt.toISOString()
      }
    })

  } catch (error) {
    Logger.error('Balance update error', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
