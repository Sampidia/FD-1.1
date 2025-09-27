import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Fetch recent alerts excluding "no alert" results
    const recentAlerts = await prisma.checkResult.findMany({
      where: {
        AND: [
          { isCounterfeit: true },
          { alertType: { not: null } },
          { alertType: { not: '' } }
        ]
      },
      select: {
        id: true,
        productCheck: {
          select: {
            productName: true
          }
        },
        alertType: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    })

    // Transform the data for the frontend
    const alerts = recentAlerts.map((alert: any) => ({
      id: alert.id,
      productName: alert.productCheck.productName,
      alertType: alert.alertType,
      createdAt: alert.createdAt.toISOString()
    }))

    return NextResponse.json({
      success: true,
      alerts
    })

  } catch (error) {
    console.error('Failed to fetch recent alerts:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch recent alerts',
        alerts: []
      },
      { status: 500 }
    )
  }
}
