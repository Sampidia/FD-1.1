import NextAuth, { type Session } from "next-auth"
import type { JWT } from "next-auth/jwt"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import "@/types/nextauth"
import Google from "next-auth/providers/google"
import Email from "next-auth/providers/email"
import Credentials from "next-auth/providers/credentials"
import { ensureUserExists, getUserWithBalance } from "./auth-db"
import { verifyRecaptchaForSignIn } from "./recaptcha"
import prisma from "./prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { securityMonitor } from "../services/security-monitor"

// Cache the basic plan ID to avoid repeated database queries
let basicPlanId: string | null = null

async function getBasicPlanId(): Promise<string> {
  if (basicPlanId) return basicPlanId

  try {
    // Find the basic plan by name (not ID)
    const basicPlan = await prisma.userPlan.findFirst({
      where: { name: 'basic' }
    })

    if (basicPlan) {
      basicPlanId = basicPlan.id
      console.log('🔍 Found basic plan ID:', basicPlanId)
      return basicPlanId as string
    }
  } catch (error) {
    console.warn('⚠️ Failed to fetch basic plan from database:', error)
  }

  // Fallback to default plan ID when database is unseeded
  const fallbackId = 'basic'
  console.log('⚠️ Using fallback basic plan ID:', fallbackId)
  return fallbackId
}

const authOptions = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Email({
      server: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT ?? "587"),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        secure: false,
        tls: {
          ciphers: "SSLv3",
          rejectUnauthorized: false,
        },
      },
      from: process.env.SMTP_FROM_EMAIL,
      async sendVerificationRequest({
        identifier: email,
        url,
        provider: { server, from },
      }) {
        const { sendEmail, emailTemplates } = await import('@/lib/email')

        const verificationTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to Fake Product Detector</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #FFD700 0%, #1E40AF 100%); padding: 30px; border-radius: 10px; margin-bottom: 20px;">
      <h1 style="color: white; text-align: center; margin: 0;">🔍 Fake Product Detector</h1>
    </div>

    <div style="background: #f9f9f9; padding: 30px; border-radius: 10px;">
      <h2 style="color: #1E40AF; margin-top: 0;">Welcome!</h2>
      <p style="margin-bottom: 20px;">Click the button below to sign in to your account:</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${url}" style="background: #1E40AF; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Sign In</a>
      </div>

      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e0e0e0;">
        <p style="margin: 0; font-size: 14px; color: #666;">
          <strong>Alternatively, copy and paste this link into your browser:</strong>
        </p>
        <p style="margin: 10px 0; word-break: break-all; font-size: 12px; color: #888;">
          ${url}
        </p>
      </div>

      <p style="color: #666; font-size: 14px;">
        This link will expire in 24 hours for security reasons. If you didn't request this email, you can safely ignore it.
      </p>
    </div>

    <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
      <p>Protect your health with verified products</p>
      <p>© 2025 Fake Product Detector</p>
    </div>
  </div>
</body>
</html>`

        await sendEmail({
          to: email,
          subject: "Sign in to Fake Product Detector",
          html: verificationTemplate,
        })
      },
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        recaptchaToken: { label: "reCAPTCHA Token", type: "text" }
      },
      authorize: async (credentials, request) => {
        try {
          const { email, password, recaptchaToken } = z.object({
            email: z.string().email(),
            password: z.string().min(6),
            recaptchaToken: z.string().min(1, "reCAPTCHA verification required")
          }).parse(credentials)

          // Verify reCAPTCHA for sign-in attempts
          const recaptchaResult = await verifyRecaptchaForSignIn(recaptchaToken, email)
          if (!recaptchaResult.success) {
            throw new Error(recaptchaResult.error || "reCAPTCHA verification failed")
          }

          // Extract IP address and user agent for security monitoring
          const ipAddress = request?.headers?.get('x-forwarded-for') ||
                           request?.headers?.get('x-real-ip') ||
                           'unknown'
          const userAgent = request?.headers?.get('user-agent') || 'unknown'

          // Find user by email
          const user = await prisma.user.findUnique({
            where: { email }
          })

          if (!user) {
            // User not found - record failed login attempt
            await securityMonitor.recordFailedLogin(email, ipAddress, userAgent)
            return null // User not found
          }

          // Check if user has a password (i.e., registered via email)
          if (!user.password) {
            // User registered via OAuth, no password set - record failed login attempt
            await securityMonitor.recordFailedLogin(email, ipAddress, userAgent)
            return null // User registered via OAuth, no password set
          }

          // Verify password
          const isValidPassword = await bcrypt.compare(password, user.password)
          if (!isValidPassword) {
            // Invalid password - record failed login attempt
            await securityMonitor.recordFailedLogin(email, ipAddress, userAgent)
            return null // Invalid password
          }

          // Successful login - return user object for session (must match NextAuth User type)
          return {
            id: user.id,
            email: user.email,
            name: user.name || undefined,
            image: user.image || undefined,
          }
        } catch (error) {
          console.error("Credentials auth error:", error)
          return null
        }
      }
    }),
  ],

  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours - refresh token daily
  },

  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: any }) {
      if (user) {
        // Get the actual basic plan ID from database
        const actualBasicPlanId = await getBasicPlanId()

        // Ensure user exists in database (new users get basic plan)
        await ensureUserExists({
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          planId: actualBasicPlanId // Use actual plan ID, not hardcoded string
        })
        token.id = user.id || token.sub
      }
      return token
    },

    async session({ session, token }: { session: Session; token: JWT }) {
      // Type assertion to access our extended session user properties
      const customSession = session as typeof session & {
        user: {
          id: string
          email: string
          name?: string | null
          image?: string | null
          pointsBalance: number
          createdAt?: string
          planBasicPoints?: number
          planStandardPoints?: number
          planBusinessPoints?: number
          planFreePoints?: number
        }
      }

      if (customSession.user && token && token.id && typeof token.id === 'string') {
        customSession.user.id = token.id

        // Get actual user data from database
        const dbUser = await getUserWithBalance(token.id)
        if (dbUser) {
          customSession.user.pointsBalance = dbUser.pointsBalance
          customSession.user.createdAt = dbUser.createdAt.toISOString() // Add createdAt to session
          customSession.user.planBasicPoints = dbUser.planBasicPoints
          customSession.user.planStandardPoints = dbUser.planStandardPoints
          customSession.user.planBusinessPoints = dbUser.planBusinessPoints
        } else {
          // Fallback to default
          customSession.user.pointsBalance = 5
          customSession.user.createdAt = new Date().toISOString() // Fallback to current date
          customSession.user.planBasicPoints = 5
          customSession.user.planStandardPoints = 0
          customSession.user.planBusinessPoints = 0
        }
      }
      return customSession
    },
  },

  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },

  secret: process.env.AUTH_SECRET,
})

export { authOptions }

// Also export auth function for API route usage
export const auth = NextAuth(authOptions)
