import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Force dynamic rendering for this route (required for auth)
export const dynamic = 'force-dynamic'

// Type definitions for Prisma query results
interface ProductCheckItem {
  id: string;
  productName: string | null;
  batchNumber: string | null;
  createdAt: Date;
  images: string[] | null;
  productDescription: string | null;
}

interface CheckResultItem {
  productCheckId: string;
  isCounterfeit: boolean;
  confidence: number;
  alertType: string | null;
  batchNumber: string | null;
  scrapedAt: Date | null;
}

interface ScanResult {
  id: string;
  productCheckId: string;
  productName: string;
  batchNumber?: string;
  createdAt: string;
  isCounterfeit: boolean;
  confidence: number;
  alertType: string;
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      )
    }

    // Fetch user scans - get all user's ProductCheck records
    const productChecks = await prisma.productCheck.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        id: true,
        productName: true,
        batchNumber: true,
        createdAt: true,
        images: true,
        productDescription: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 25
    })

    // Fetch corresponding CheckResults for the user's scans
    const productCheckIds = productChecks.map((pc: { id: string }) => pc.id)
    const checkResults = await prisma.checkResult.findMany({
      where: {
        productCheckId: {
          in: productCheckIds
        }
      },
      select: {
        productCheckId: true,
        isCounterfeit: true,
        confidence: true,
        alertType: true,
        batchNumber: true,
        scrapedAt: true
      },
      orderBy: {
        scrapedAt: 'desc'
      }
    })

    // Transform data for frontend consumption - combine ProductCheck and CheckResult data
    const scans = productChecks.map((productCheck: ProductCheckItem) => {
      // Find the latest CheckResult for this ProductCheck
      const latestResult = checkResults
        .filter((cr: CheckResultItem) => cr.productCheckId === productCheck.id)
        .sort((a: CheckResultItem, b: CheckResultItem) => new Date(b.scrapedAt || new Date(0)).getTime() - new Date(a.scrapedAt || new Date(0)).getTime())[0]

      return {
        id: productCheck.id,
        productCheckId: productCheck.id,
        productName: productCheck.productName || 'Unknown Product',
        batchNumber: productCheck.batchNumber || latestResult?.batchNumber || undefined,
        createdAt: productCheck.createdAt.toISOString(),
        // Use CheckResult data (if available)
        isCounterfeit: latestResult?.isCounterfeit || false,
        confidence: latestResult?.confidence || 0,
        alertType: latestResult?.alertType || 'No Result Yet'
      }
    })

    // Calculate basic stats
    const stats = {
      totalScans: scans.length,
      recentScans: scans.slice(0, 5), // Latest 5 for dashboard
      genuineProducts: scans.filter((s: ScanResult) => !s.isCounterfeit).length,
      counterfeitDetected: scans.filter((s: ScanResult) => s.isCounterfeit).length
    }

    console.log(`🏠 Dashboard: ${session.user.email} has ${stats.totalScans} scans`)

    return NextResponse.json({
      success: true,
      scans: stats.recentScans,
      allScans: scans,
      stats: {
        totalScans: stats.totalScans,
        genuineProducts: stats.genuineProducts,
        counterfeitDetected: stats.counterfeitDetected
      }
    })

  } catch (error) {
    console.error('Error fetching recent scans:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch recent scans',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
