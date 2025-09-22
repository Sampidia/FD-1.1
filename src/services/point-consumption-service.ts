// Smart Point Consumption Service with Plan Isolation
// Prevents users from consuming points from cheaper plan tiers

import prisma from '@/lib/prisma'

export class PointConsumptionService {
  /**
   * Attempts to consume 1 point using plan isolation rules
   */
  async tryConsumePoint(userId: string): Promise<{
    success: boolean
    planUsed?: string
    pointsRemaining: {
      business: number
      standard: number
      basic: number
      total: number
    }
    error?: string
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        planId: true,
        planBusinessPoints: true,
        planStandardPoints: true,
        planBasicPoints: true,
        pointsBalance: true // Keep for backward compatibility
      }
    })

    if (!user) {
      return {
        success: false,
        pointsRemaining: { business: 0, standard: 0, basic: 0, total: 0 },
        error: 'User not found'
      }
    }

    // Apply consumption hierarchy based on user plan
    // Provide default plan ID if null - default to free plan for users without assigned plans
    const planId = user.planId || 'free'
    const result = await this.consumeFromHierarchy(userId, planId, user)

    if (result.success) {
      // Get updated balances
      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          planBusinessPoints: true,
          planStandardPoints: true,
          planBasicPoints: true,
          pointsBalance: true
        }
      })

      return {
        success: true,
        planUsed: result.planUsed,
        pointsRemaining: {
          business: updatedUser?.planBusinessPoints || 0,
          standard: updatedUser?.planStandardPoints || 0,
          basic: updatedUser?.planBasicPoints || 0,
          total: (updatedUser?.planBusinessPoints || 0) +
                (updatedUser?.planStandardPoints || 0) +
                (updatedUser?.planBasicPoints || 0)
        }
      }
    }

    return {
      success: false,
      pointsRemaining: {
        business: user.planBusinessPoints,
        standard: user.planStandardPoints,
        basic: user.planBasicPoints,
        total: user.pointsBalance
      },
      error: result.error
    }
  }

  /**
   * Consumes 1 point from a specific plan tier (used when AI tier is determined)
   */
  async consumeFromSpecificPlan(userId: string, planTier: string): Promise<{
    success: boolean
    pointsRemaining: {
      business: number
      standard: number
      basic: number
      free: number // 🔥 ADDED: Include planFreePoints
      total: number
    }
    error?: string
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        planBusinessPoints: true,
        planStandardPoints: true,
        planBasicPoints: true,
        planFreePoints: true, // Include planFreePoints in select
        pointsBalance: true
      }
    })

    if (!user) {
      return {
        success: false,
        pointsRemaining: { business: 0, standard: 0, basic: 0, free: 0, total: 0 },
        error: 'User not found'
      }
    }

    // 🔥 DYNAMICALLY ADD planFreePoints IF EXISTS (fallback for older databases)
    try {
      const userWithFreePoints = await prisma.user.findUnique({
        where: { id: userId },
        select: { planFreePoints: true } as any
      })
      if (userWithFreePoints && (userWithFreePoints as any).planFreePoints !== undefined) {
        (user as any).planFreePoints = (userWithFreePoints as any).planFreePoints || 0
      } else {
        (user as any).planFreePoints = 0 // Default if field doesn't exist
      }
    } catch (fieldError) {
      // Field might not exist in older databases
      (user as any).planFreePoints = 0
    }

    let updateField = 'pointsBalance' // Default to general balance for free tier

    switch (planTier) {
      case 'business':
        if (user.planBusinessPoints <= 0) {
          return {
            success: false,
            pointsRemaining: {
              business: user.planBusinessPoints,
              standard: user.planStandardPoints,
              basic: user.planBasicPoints,
              free: user.planFreePoints, // 🔥 ADDED: Include free points
              total: user.pointsBalance
            },
            error: 'No business plan points available'
          }
        }
        updateField = 'planBusinessPoints'
        break

      case 'standard':
        if (user.planStandardPoints <= 0) {
          return {
            success: false,
            pointsRemaining: {
              business: user.planBusinessPoints,
              standard: user.planStandardPoints,
              basic: user.planBasicPoints,
              free: user.planFreePoints, // 🔥 ADDED: Include free points
              total: user.pointsBalance
            },
            error: 'No standard plan points available'
          }
        }
        updateField = 'planStandardPoints'
        break

      case 'basic':
        if (user.planBasicPoints <= 0) {
          return {
            success: false,
            pointsRemaining: {
              business: user.planBusinessPoints,
              standard: user.planStandardPoints,
              basic: user.planBasicPoints,
              free: user.planFreePoints, // 🔥 ADDED: Include free points
              total: user.pointsBalance
            },
            error: 'No basic plan points available'
          }
        }
        updateField = 'planBasicPoints'
        break

      case 'free':
      default:
        if (user.planFreePoints <= 0) { // 🔥 FIXED: Check planFreePoints instead of pointsBalance
          return {
            success: false,
            pointsRemaining: {
              business: user.planBusinessPoints,
              standard: user.planStandardPoints,
              basic: user.planBasicPoints,
              free: user.planFreePoints, // 🔥 ADDED: Include free points
              total: user.pointsBalance
            },
            error: 'No free points available'
          }
        }
        updateField = 'planFreePoints' // 🔥 FIXED: Use planFreePoints field for free tier
        break
    }

    // Deduct 1 point from the specified plan tier
    const updateData: any = {
      [updateField]: { decrement: 1 }
    }

    // Only decrement general pointsBalance when using free tier
    // Plan-specific deductions should NOT affect the general balance
    if (updateField === 'pointsBalance') {
      // Free tier: only decrement general balance
      updateData.pointsBalance = { decrement: 1 }
    }
    // Plan-specific tiers: only decrement their specific balance, leave general balance unchanged

    await prisma.user.update({
      where: { id: userId },
      data: updateData
    })

    // Get updated balances
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        planBusinessPoints: true,
        planStandardPoints: true,
        planBasicPoints: true,
        planFreePoints: true, // 🔥 ADDED: Include planFreePoints
        pointsBalance: true
      }
    })

    return {
      success: true,
      pointsRemaining: {
        business: updatedUser?.planBusinessPoints || 0,
        standard: updatedUser?.planStandardPoints || 0,
        basic: updatedUser?.planBasicPoints || 0,
        free: updatedUser?.planFreePoints || 0, // 🔥 ADDED: Include free points
        total: (updatedUser?.planBusinessPoints || 0) +
              (updatedUser?.planStandardPoints || 0) +
              (updatedUser?.planBasicPoints || 0) +
              (updatedUser?.planFreePoints || 0) // 🔥 ADDED: Include in total
      }
    }
  }

  /**
   * Consumes points according to plan isolation hierarchy
   */
  private async consumeFromHierarchy(
    userId: string,
    planId: string,
    user: any
  ): Promise<{ success: boolean; planUsed?: string; error?: string }> {

    switch (planId) {
      case 'business':
        return this.consumeBusinessUserPoints(userId, user)

      case 'standard':
        return this.consumeStandardUserPoints(userId, user)

      case 'basic':
      default:
        return this.consumeBasicUserPoints(userId, user)
    }
  }

  /**
   * Business plan consumption rules:
   * 1. Use business points first (130₦)
   * 2. Use standard points if no business points (100₦)
   * 3. NEVER use basic points (prevents downgrade abuse)
   * 4. Force business purchase if no points available
   */
  private async consumeBusinessUserPoints(userId: string, user: any) {
    // Priority 1: Use business tier points (130₦)
    if (user.planBusinessPoints > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          planBusinessPoints: { decrement: 1 },
          pointsBalance: { decrement: 1 } // Update legacy balance for compatibility
        }
      })
      return { success: true, planUsed: 'business' }
    }

    // Priority 2: Use standard tier points if available (100₦)
    if (user.planStandardPoints > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          planStandardPoints: { decrement: 1 },
          pointsBalance: { decrement: 1 } // Update legacy balance for compatibility
        }
      })
      return { success: true, planUsed: 'standard' }
    }

    // Priority 3: No lower tier fallback - business tier enforced
    return {
      success: false,
      error: 'No points available. Business plan users must purchase at business tier pricing (130₦ per point).'
    }
  }

  /**
   * Standard plan consumption rules:
   * 1. Use standard points first (100₦)
   * 2. Use basic points if no standard points (75₦)
   * 3. Force standard purchase if no points available
   */
  private async consumeStandardUserPoints(userId: string, user: any) {
    // Priority 1: Use standard tier points (100₦)
    if (user.planStandardPoints > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          planStandardPoints: { decrement: 1 },
          pointsBalance: { decrement: 1 } // Update legacy balance for compatibility
        }
      })
      return { success: true, planUsed: 'standard' }
    }

    // Priority 2: Use basic tier points if available (75₦)
    if (user.planBasicPoints > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          planBasicPoints: { decrement: 1 },
          pointsBalance: { decrement: 1 } // Update legacy balance for compatibility
        }
      })
      return { success: true, planUsed: 'basic' }
    }

    // No points available - force standard purchase
    return {
      success: false,
      error: 'No points available. Standard plan users must purchase at standard tier pricing (100₦ per point).'
    }
  }

  /**
   * Basic plan consumption rules:
   * 1. Use basic points only (75₦)
   * 2. Force basic purchase if no points available
   * 3. Cannot consume premium points (prevents privilege abuse)
   */
  private async consumeBasicUserPoints(userId: string, user: any) {
    // Only use basic tier points (75₦)
    if (user.planBasicPoints > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          planBasicPoints: { decrement: 1 },
          pointsBalance: { decrement: 1 } // Update legacy balance for compatibility
        }
      })
      return { success: true, planUsed: 'basic' }
    }

    // No points available - force basic purchase
    return {
      success: false,
      error: 'No points available. Basic plan users must purchase at basic tier pricing (75₦ per point).'
    }
  }

  /**
   * Validates if a user can purchase points at a specific plan tier
   */
  async validatePurchaseTier(userId: string, requestedTier: string): Promise<{
    valid: boolean
    userPlanId?: string
    error?: string
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { planId: true }
    })

    if (!user) {
      return { valid: false, error: 'User not found' }
    }

    const userPlanId = user.planId || 'basic'

    // Users can purchase at their current plan tier
    if (requestedTier === userPlanId) {
      return { valid: true, userPlanId }
    }

    // Additional validation rules could be added here
    // For example, allowing upsells but not downsells

    return {
      valid: false,
      userPlanId,
      error: `Can only purchase points at your current plan tier (${userPlanId}). Purchase tier requested: ${requestedTier}.`
    }
  }

  /**
   * Adds points to the appropriate plan balance
   */
  async addPointsToPlan(userId: string, planTier: string, pointsCount: number): Promise<{
    success: boolean
    fieldUpdated?: string
    error?: string
  }> {
    const validation = await this.validatePurchaseTier(userId, planTier)

    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // Determine which field to update based on plan tier
    let updateField = 'planBasicPoints'

    switch (planTier) {
      case 'business':
        updateField = 'planBusinessPoints'
        break
      case 'standard':
        updateField = 'planStandardPoints'
        break
      case 'basic':
      default:
        updateField = 'planBasicPoints'
    }

    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          [updateField]: { increment: pointsCount },
          pointsBalance: { increment: pointsCount } // Update legacy balance for compatibility
        }
      })

      return { success: true, fieldUpdated: updateField }
    } catch (error) {
      console.error('Error adding points to plan:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add points'
      }
    }
  }

  /**
   * Gets comprehensive point balance information
   */
  async getPointBalance(userId: string): Promise<{
    success: boolean
    userPlanId: string
    balances: {
      basic: number
      standard: number
      business: number
      total: number
    }
    consumptionOrder: string[]
    canConsumeFrom: string[]
    error?: string
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        planId: true,
        planBasicPoints: true,
        planStandardPoints: true,
        planBusinessPoints: true,
        pointsBalance: true
      }
    })

    if (!user) {
      return {
        success: false,
        userPlanId: 'unknown',
        balances: { basic: 0, standard: 0, business: 0, total: 0 },
        consumptionOrder: [],
        canConsumeFrom: [],
        error: 'User not found'
      }
    }

    const planId = user.planId || 'basic'

    // Determine consumption order based on plan
    let consumptionOrder: string[]
    let canConsumeFrom: string[]

    switch (planId) {
      case 'business':
        consumptionOrder = ['business', 'standard'] // No basic tier allowed
        canConsumeFrom = ['business', 'standard']
        break

      case 'standard':
        consumptionOrder = ['standard', 'basic']
        canConsumeFrom = ['standard', 'basic']
        break

      case 'basic':
      default:
        consumptionOrder = ['basic']
        canConsumeFrom = ['basic']
        break
    }

    return {
      success: true,
      userPlanId: planId,
      balances: {
        basic: user.planBasicPoints,
        standard: user.planStandardPoints,
        business: user.planBusinessPoints,
        total: user.pointsBalance
      },
      consumptionOrder,
      canConsumeFrom
    }
  }
}

// Export singleton instance
export const pointConsumptionService = new PointConsumptionService()
