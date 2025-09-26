import prisma, { withRetry } from '@/lib/prisma'

export interface NafdacSearchResult {
  id: string
  title: string
  excerpt: string
  url: string
  batchNumbers: string[]
  manufacturer: string | null
  alertType: string
  severity: string
  scrapedAt: Date
  productNames: string[]
}

export class NafdacDatabaseService {
  private static instance: NafdacDatabaseService

  static getInstance(): NafdacDatabaseService {
    if (!NafdacDatabaseService.instance) {
      NafdacDatabaseService.instance = new NafdacDatabaseService()
    }
    return NafdacDatabaseService.instance
  }

  /**
   * Search for active NAFDAC alerts with retry logic
   */
  async searchAlerts(
    searchCriteria: {
      productNames?: string[]
      batchNumber?: string
      keywords?: string[]
      limit?: number
    }
  ): Promise<NafdacSearchResult[]> {
    return withRetry(async () => {
      const { productNames, batchNumber, keywords, limit = 10 } = searchCriteria

      const whereClause: any = {
        active: true,
      }

      // Build search conditions
      const OR: any[] = []

      // Batch number search - check both original and AI-extracted batch numbers
      if (batchNumber && batchNumber.trim()) {
        OR.push({
          batchNumbers: {
            hasSome: [batchNumber.trim().toUpperCase(), batchNumber.trim()]
          }
        })
        OR.push({
          aiBatchNumbers: {
            hasSome: [batchNumber.trim().toUpperCase(), batchNumber.trim()]
          }
        })
      }

      // Product name search - check both original and AI-extracted product names
      if (productNames && productNames.length > 0) {
        // Original product names
        OR.push({
          productNames: {
            hasSome: productNames.map(name => name.toLowerCase().trim())
          }
        })
        // AI-extracted product names
        OR.push({
          aiProductNames: {
            hasSome: productNames.map(name => name.toLowerCase().trim())
          }
        })
      }

      // Keyword search in title and excerpt
      if (keywords && keywords.length > 0) {
        keywords.forEach(keyword => {
          OR.push({
            title: {
              contains: keyword,
              mode: 'insensitive'
            }
          })
          OR.push({
            excerpt: {
              contains: keyword,
              mode: 'insensitive'
            }
          })
        })
      }

      // Only add OR conditions if we have any
      if (OR.length > 0) {
        whereClause.OR = OR
      }

      const alerts = await prisma.nafdacAlert.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          excerpt: true,
          url: true,
          batchNumbers: true,
          manufacturer: true,
          alertType: true,
          severity: true,
          scrapedAt: true,
          productNames: true
        },
        orderBy: {
          scrapedAt: 'desc'
        },
        take: limit
      })

      return alerts.map((alert: {
        id: string;
        title: string;
        excerpt: string;
        url: string;
        batchNumbers: string[];
        manufacturer: string | null;
        alertType: string;
        severity: string;
        scrapedAt: Date;
        productNames: string[];
      }) => ({
        ...alert,
        scrapedAt: alert.scrapedAt
      }))
    }, 3, 1000) // 3 retries, 1 second delay
  }

  /**
   * Get alert details by ID with retry logic
   */
  async getAlertById(alertId: string): Promise<NafdacSearchResult | null> {
    return withRetry(async () => {
      const alert = await prisma.nafdacAlert.findUnique({
        where: {
          id: alertId,
          active: true
        },
        select: {
          id: true,
          title: true,
          excerpt: true,
          url: true,
          batchNumbers: true,
          manufacturer: true,
          alertType: true,
          severity: true,
          scrapedAt: true,
          productNames: true,
          fullContent: true
        }
      })

      if (!alert) return null

      return {
        ...alert,
        scrapedAt: alert.scrapedAt
      }
    }, 3, 1000)
  }

  /**
   * Count active alerts with retry logic
   */
  async countActiveAlerts(): Promise<number> {
    return withRetry(async () => {
      return await prisma.nafdacAlert.count({
        where: { active: true }
      })
    }, 3, 1000)
  }

  /**
   * Get alerts for AI analysis with retry logic
   */
  async getAlertsForAIAnalysis(alertIds: string[]): Promise<any[]> {
    return withRetry(async () => {
      return await prisma.nafdacAlert.findMany({
        where: {
          id: { in: alertIds },
          active: true
        },
        select: {
          id: true,
          title: true,
          fullContent: true,
          productNames: true,
          batchNumbers: true,
          manufacturer: true,
          alertType: true,
          severity: true,
          aiExtracted: true,
          aiProductNames: true,
          aiBatchNumbers: true,
          aiReason: true,
          aiConfidence: true
        }
      })
    }, 3, 1000)
  }

  /**
   * Update alert with AI analysis results with retry logic
   */
  async updateAlertWithAIAnalysis(
    alertId: string,
    aiData: {
      aiExtracted: boolean
      aiProductNames: string[]
      aiBatchNumbers: string[]
      aiReason: string
      aiConfidence: number
    }
  ): Promise<void> {
    return withRetry(async () => {
      await prisma.nafdacAlert.update({
        where: { id: alertId },
        data: aiData
      })
    }, 3, 1000)
  }

  /**
   * Health check for NAFDAC database operations
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy'
    message: string
    details?: any
  }> {
    try {
      const startTime = Date.now()

      // Test basic count query
      const count = await this.countActiveAlerts()
      const queryTime = Date.now() - startTime

      return {
        status: 'healthy',
        message: 'NAFDAC database connection is healthy',
        details: {
          activeAlerts: count,
          queryTime: `${queryTime}ms`
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `NAFDAC database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.message : String(error) }
      }
    }
  }
}

// Export singleton instance
export const nafdacDatabaseService = NafdacDatabaseService.getInstance()
