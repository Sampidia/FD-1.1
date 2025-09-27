import { NextResponse } from 'next/server'
import { checkDatabaseConnection } from '@/lib/prisma'
import { nafdacDatabaseService } from '@/services/nafdac-database-service'

export async function GET() {
  const startTime = Date.now()

  try {
    // Check general database connection
    const isConnected = await checkDatabaseConnection()

    if (!isConnected) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          message: 'Database connection failed',
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        },
        { status: 503 }
      )
    }

    // Check NAFDAC database service health
    const nafdacHealth = await nafdacDatabaseService.healthCheck()

    // Check connection pool metrics
    const poolMetrics = {
      status: 'healthy',
      message: 'Database connection is healthy',
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      nafdacService: nafdacHealth,
      // Add any additional metrics you want to track
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    }

    // Return unhealthy if NAFDAC service is unhealthy
    if (nafdacHealth.status === 'unhealthy') {
      return NextResponse.json(
        {
          ...poolMetrics,
          status: 'unhealthy',
          message: 'NAFDAC database service is unhealthy'
        },
        { status: 503 }
      )
    }

    return NextResponse.json(poolMetrics, { status: 200 })

  } catch (error) {
    console.error('Database health check error:', error)

    return NextResponse.json(
      {
        status: 'error',
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}