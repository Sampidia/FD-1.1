import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    // Check environment variables (without exposing secrets)
    const envCheck = {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ? '✅ Set' : '❌ Missing',
      AUTH_SECRET: process.env.AUTH_SECRET ? '✅ Set' : '❌ Missing',
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing',
      PRISMA_DATABASE_URL: process.env.PRISMA_DATABASE_URL ? '✅ Set' : '❌ Missing',
    }

    // Test database connection
    let dbConnection = '❌ Failed'
    try {
      await prisma.$connect()
      await prisma.user.count()
      dbConnection = '✅ Connected'
      await prisma.$disconnect()
    } catch (error) {
      console.error('Database test failed:', error)
      dbConnection = '❌ Failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    }

    // Test NextAuth setup
    let authStatus = '❌ Failed'
    try {
      const session = await auth()
      authStatus = '✅ Working'
    } catch (error) {
      authStatus = '❌ Failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    }

    return NextResponse.json({
      success: true,
      environment: envCheck,
      database: dbConnection,
      authentication: authStatus,
      timestamp: new Date().toISOString(),
      serverUrl: process.env.NEXTAUTH_URL
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Force dynamic rendering for this debug route
export const dynamic = 'force-dynamic'
