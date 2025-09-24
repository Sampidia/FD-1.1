import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

// Force dynamic rendering for NextAuth routes
export const dynamic = 'force-dynamic'

const handler = NextAuth(authOptions)

async function handleCORSResponse(response: NextResponse) {
  // Add CORS headers
  response.headers.set('Access-Control-Allow-Origin', process.env.NEXTAUTH_URL || 'https://scan.sampidia.com')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

async function authHandler(request: NextRequest) {
  try {
    // Handle preflight OPTIONS requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': process.env.NEXTAUTH_URL || 'https://scan.sampidia.com',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      })
    }

    // Handle actual auth requests
    const authResponse = await handler(request.method === 'POST' ? request : request)

    // Add CORS headers to the response
    if (authResponse instanceof Response) {
      return handleCORSResponse(NextResponse.json(await authResponse.json(), { status: authResponse.status }))
    } else {
      return handleCORSResponse(NextResponse.json(authResponse))
    }
  } catch (error) {
    console.error('NextAuth route error:', error)
    return new NextResponse(JSON.stringify({ error: 'Authentication error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.NEXTAUTH_URL || 'https://scan.sampidia.com',
        'Access-Control-Allow-Credentials': 'true',
      }
    })
  }
}

export { authHandler as GET, authHandler as POST }
