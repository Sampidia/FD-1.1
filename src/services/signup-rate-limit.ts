/**
 * Signup Rate Limiting Service
 *
 * Manages rate limiting for signup attempts to prevent abuse.
 * Tracks attempts per email/IP with 5 attempt limit and 15 minute cooldown.
 */

import prisma from '@/lib/prisma'

export class SignupRateLimitService {
  private static instance: SignupRateLimitService
  private readonly MAX_FAILED_ATTEMPTS = 5
  private readonly BLOCK_WINDOW_MINUTES = 15
  private readonly CLEANUP_WINDOW_HOURS = 24

  static getInstance(): SignupRateLimitService {
    if (!SignupRateLimitService.instance) {
      SignupRateLimitService.instance = new SignupRateLimitService()
    }
    return SignupRateLimitService.instance
  }

  /**
   * Record a failed signup attempt (when user tries to sign up with existing email)
   */
  async recordFailedSignup(email: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const normalizedEmail = email.toLowerCase()
    const now = new Date()

    try {
      // Check if user is already blocked
      const existingAttempt = await prisma.signupAttempt.findFirst({
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
        console.log(`🚫 User ${normalizedEmail} is already blocked from signup attempts`)
        return
      }

      // Find or create attempt record within the current block window
      const blockWindowStart = new Date(now.getTime() - this.BLOCK_WINDOW_MINUTES * 60 * 1000)

      let attempt = await prisma.signupAttempt.findFirst({
        where: {
          email: normalizedEmail,
          isActive: true,
          lastAttempt: { gte: blockWindowStart }
        }
      })

      if (attempt) {
        // Update existing attempt
        attempt = await prisma.signupAttempt.update({
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
        attempt = await prisma.signupAttempt.create({
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

        await prisma.signupAttempt.update({
          where: { id: attempt.id },
          data: {
            blockedUntil: blockedUntil,
            updatedAt: now
          }
        })

        console.log(`🚫 Blocked signup attempts for ${normalizedEmail} until ${blockedUntil.toISOString()}`)
      }

      console.log(`📝 Recorded signup attempt ${attempt.attemptCount} for ${normalizedEmail}`)

    } catch (error) {
      console.error('Error recording failed signup:', error)
    }
  }

  /**
   * Check if signup attempts are blocked for an email
   */
  async isSignupBlocked(email: string): Promise<{ blocked: boolean, blockedUntil?: Date, remainingAttempts: number }> {
    const normalizedEmail = email.toLowerCase()
    const now = new Date()

    try {
      const latestAttempt = await prisma.signupAttempt.findFirst({
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
      console.error('Error checking signup block status:', error)
      return { blocked: false, remainingAttempts: this.MAX_FAILED_ATTEMPTS }
    }
  }

  /**
   * Get detailed signup attempt status for an email
   */
  async getSignupAttemptsStatus(email: string): Promise<{
    email: string
    attemptCount: number
    remainingAttempts: number
    isBlocked: boolean
    blockedUntil?: Date
    lastAttempt?: Date
    nextAttemptAllowed?: Date
  }> {
    const normalizedEmail = email.toLowerCase()
    const now = new Date()

    try {
      const latestAttempt = await prisma.signupAttempt.findFirst({
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
        return {
          email: normalizedEmail,
          attemptCount: 0,
          remainingAttempts: this.MAX_FAILED_ATTEMPTS,
          isBlocked: false
        }
      }

      const isBlocked = latestAttempt.blockedUntil && latestAttempt.blockedUntil > now
      const remainingAttempts = isBlocked ? 0 : Math.max(0, this.MAX_FAILED_ATTEMPTS - latestAttempt.attemptCount)

      return {
        email: normalizedEmail,
        attemptCount: latestAttempt.attemptCount,
        remainingAttempts,
        isBlocked: Boolean(isBlocked),
        blockedUntil: isBlocked && latestAttempt.blockedUntil ? latestAttempt.blockedUntil : undefined,
        lastAttempt: latestAttempt.lastAttempt,
        nextAttemptAllowed: isBlocked && latestAttempt.blockedUntil ? latestAttempt.blockedUntil : new Date(now)
      }

    } catch (error) {
      console.error('Error getting signup attempts status:', error)
      return {
        email: normalizedEmail,
        attemptCount: 0,
        remainingAttempts: this.MAX_FAILED_ATTEMPTS,
        isBlocked: false
      }
    }
  }

  /**
   * Clean up old signup attempt records
   */
  async cleanupOldRecords(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - this.CLEANUP_WINDOW_HOURS * 60 * 60 * 1000)

      const result = await prisma.signupAttempt.updateMany({
        where: { lastAttempt: { lt: cutoffDate } },
        data: { isActive: false }
      })

      console.log(`🧹 Cleaned up ${result.count} old signup attempt records`)

    } catch (error) {
      console.error('Error during signup records cleanup:', error)
    }
  }

  /**
   * Reset attempt count for an email (admin function)
   */
  async resetSignupAttempts(email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase()

    try {
      const result = await prisma.signupAttempt.updateMany({
        where: { email: normalizedEmail },
        data: {
          attemptCount: 0,
          blockedUntil: null,
          updatedAt: new Date()
        }
      })

      console.log(`🔄 Reset signup attempts for ${normalizedEmail} (${result.count} records updated)`)
      return result.count > 0

    } catch (error) {
      console.error('Error resetting signup attempts:', error)
      return false
    }
  }
}

// Export singleton instance
export const signupRateLimit = SignupRateLimitService.getInstance()
