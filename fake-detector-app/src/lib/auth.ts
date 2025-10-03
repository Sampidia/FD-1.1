import NextAuth, { type Session, type User } from "next-auth"
import type { JWT } from "next-auth/jwt"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
// Remove problematic type import that might conflict
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

// Build providers array - using function-based approach for serverless compatibility
function buildProviders() {
  const providersArray: any[] = []

  // Always add Credentials provider (always available)
  providersArray.push(
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
    })
  )

  // Add Google provider if available
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providersArray.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    )
  }

  // Add Email provider if available
  if (process.env.SMTP_HOST) {
    providersArray.push(
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
      })
    )
  }

  return providersArray
}

const authOptions = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  providers: buildProviders(),
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Fetch complete user data from database including plan points
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            planBasicPoints: true,
            planStandardPoints: true,
            planBusinessPoints: true,
            createdAt: true,
          },
        })

        if (dbUser) {
          // Add plan points to JWT token
          token.planBasicPoints = dbUser.planBasicPoints
          token.planStandardPoints = dbUser.planStandardPoints
          token.planBusinessPoints = dbUser.planBusinessPoints
          token.createdAt = dbUser.createdAt
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        // Add plan points and createdAt to session (extended user properties)
        const extendedUser = session.user as any
        extendedUser.planBasicPoints = token.planBasicPoints as number
        extendedUser.planStandardPoints = token.planStandardPoints as number
        extendedUser.planBusinessPoints = token.planBusinessPoints as number
        extendedUser.createdAt = token.createdAt as Date
      }
      return session
    },
  },
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === "development",
})

export { authOptions }

// Also export auth function for API route usage
export const auth = NextAuth(authOptions)
