/**
 * Admin Security Attempts API - Fetch authentication attempt data for security monitoring
 *
 * This endpoint retrieves LoginAttempt and SignupAttempt records for admin dashboard
 * security monitoring, showing rate limiting and suspicious activity patterns.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Type definitions for selected fields from security attempt queries
type SecurityAttemptSelected = {
  id: string
  email: string
  ipAddress: string | null
  attemptCount: number
  firstAttempt: Date
  lastAttempt: Date
  blockedUntil: Date | null
  isActive: boolean
  createdAt: Date
}

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

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'login', 'signup', or 'all' (default)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200) // Max 200 records

    console.log('🛡️ FETCHING SECURITY ATTEMPT RECORDS FROM DATABASE...')

    // Base query conditions
    const baseWhere = {
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      }
    }

    let loginAttempts: SecurityAttemptSelected[] = []
    let signupAttempts: SecurityAttemptSelected[] = []

    if (type === 'login' || type === 'all' || !type) {
      loginAttempts = await prisma.loginAttempt.findMany({
        where: baseWhere,
        take: limit,
        orderBy: { lastAttempt: 'desc' },
        select: {
          id: true,
          email: true,
          ipAddress: true,
          attemptCount: true,
          firstAttempt: true,
          lastAttempt: true,
          blockedUntil: true,
          isActive: true,
          createdAt: true
        }
      })
      console.log(`✅ FOUND ${loginAttempts.length} LOGIN ATTEMPT RECORDS`)
    }

    if (type === 'signup' || type === 'all' || !type) {
      signupAttempts = await prisma.signupAttempt.findMany({
        where: baseWhere,
        take: limit,
        orderBy: { lastAttempt: 'desc' },
        select: {
          id: true,
          email: true,
          ipAddress: true,
          attemptCount: true,
          firstAttempt: true,
          lastAttempt: true,
          blockedUntil: true,
          isActive: true,
          createdAt: true
        }
      })
      console.log(`✅ FOUND ${signupAttempts.length} SIGNUP ATTEMPT RECORDS`)
    }

    // Calculate security statistics
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    // Count blocked users
    const blockedLoginUsers = loginAttempts.filter((a: any) => a.blockedUntil && a.blockedUntil > now).length
    const blockedSignupUsers = signupAttempts.filter((a: any) => a.blockedUntil && a.blockedUntil > now).length

    // Count today's failed attempts
    const todaysLoginAttempts = loginAttempts.filter((a: any) => a.lastAttempt > oneDayAgo).length
    const todaysSignupAttempts = signupAttempts.filter((a: any) => a.lastAttempt > oneDayAgo).length

    // Count current hour's activity
    const hourlyLoginAttempts = loginAttempts.filter((a: any) => a.lastAttempt > oneHourAgo).length
    const hourlySignupAttempts = signupAttempts.filter((a: any) => a.lastAttempt > oneHourAgo).length

    // Get unique suspicious IPs (multiple failed attempts from same IP in short time)
    const suspiciousIPs = new Set<string>()

    // Check for IPs with 3+ attempts in last hour
    const recentAttempts = [...loginAttempts, ...signupAttempts].filter((a: any) => a.lastAttempt > oneHourAgo)
    const ipCountMap = new Map<string, number>()

    recentAttempts.forEach(attempt => {
      if (attempt.ipAddress) {
        const current = ipCountMap.get(attempt.ipAddress) || 0
        ipCountMap.set(attempt.ipAddress, current + 1)
      }
    })

    ipCountMap.forEach((count, ip) => {
      if (count >= 3) {
        suspiciousIPs.add(ip)
      }
    })

    const stats = {
      totalLoginAttempts: loginAttempts.length,
      totalSignupAttempts: signupAttempts.length,
      blockedLoginUsers,
      blockedSignupUsers,
      todaysLoginAttempts,
      todaysSignupAttempts,
      hourlyLoginAttempts,
      hourlySignupAttempts,
      suspiciousIPsCount: suspiciousIPs.size,
      totalBlockedUsers: blockedLoginUsers + blockedSignupUsers,
      totalTodaysAttempts: todaysLoginAttempts + todaysSignupAttempts
    }

    // Combine and sort attempts by recency
    const combinedAttempts = [
      ...loginAttempts.map(attempt => ({ ...attempt, type: 'login' as const })),
      ...signupAttempts.map(attempt => ({ ...attempt, type: 'signup' as const }))
    ].sort((a, b) => b.lastAttempt.getTime() - a.lastAttempt.getTime())

    return NextResponse.json({
      success: true,
      stats,
      attempts: combinedAttempts.slice(0, limit),
      metadata: {
        type: type || 'all',
        limit,
        timeRange: '7 days',
        timestamp: now.toISOString()
      }
    })

  } catch (error) {
    console.error('Admin security attempts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch security attempt data' },
      { status: 500 }
    )
  }
}
