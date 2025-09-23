import { createUserWithPassword } from "@/lib/auth-db"
import { verifyRecaptcha } from "@/lib/recaptcha"
import { NextResponse } from "next/server"
import { z } from "zod"
import { signupRateLimit } from "@/services/signup-rate-limit"

// Force dynamic rendering since this route uses request.headers
export const dynamic = 'force-dynamic'

// Input validation schema
const signupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  recaptchaToken: z.string().min(1, "reCAPTCHA verification required")
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validatedData = signupSchema.parse(body)

    // Get user IP and User-Agent for rate limiting
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Check if signup attempts are blocked
    const attemptStatus = await signupRateLimit.isSignupBlocked(validatedData.email)

    if (attemptStatus.blocked) {
      const timeUntilUnblock = Math.ceil((attemptStatus.blockedUntil!.getTime() - Date.now()) / 60000) // minutes
      return NextResponse.json(
        {
          error: `Too many signup attempts. Try again in ${timeUntilUnblock} minutes.`,
          remainingAttempts: attemptStatus.remainingAttempts,
          blockedUntil: attemptStatus.blockedUntil
        },
        { status: 429 }
      )
    }

    // Verify reCAPTCHA token
    const isRecaptchaValid = await verifyRecaptcha(validatedData.recaptchaToken)
    if (!isRecaptchaValid) {
      // Record failed attempt due to reCAPTCHA failure
      await signupRateLimit.recordFailedSignup(validatedData.email, ipAddress, userAgent)
      return NextResponse.json(
        { error: "reCAPTCHA verification failed. Please try again." },
        { status: 400 }
      )
    }

    try {
      // Create user with password
      const user = await createUserWithPassword({
        name: validatedData.name,
        email: validatedData.email,
        password: validatedData.password
      })

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      })

    } catch (signupError: any) {
      // Record failed signup attempt
      await signupRateLimit.recordFailedSignup(validatedData.email, ipAddress, userAgent)

      // Handle specific Prisma/Duplicate errors
      if (signupError?.code === "P2002" || signupError?.message?.includes("already exists")) {
        return NextResponse.json(
          {
            error: "An account with this email already exists. Too many attempts may result in temporary restrictions.",
            remainingAttempts: attemptStatus.remainingAttempts - 1,
            isAccountConflict: true
          },
          { status: 409 }
        )
      }

      throw signupError // Re-throw for generic error handling below
    }

  } catch (error: unknown) {
    console.error("Signup error:", error)

    // Handle validation error with attempt tracking
    if (error instanceof Error && error.message.includes("reCAPTCHA")) {
      return NextResponse.json(
        { error: "reCAPTCHA verification failed. Please try again." },
        { status: 400 }
      )
    }

    // Handle generic errors
    return NextResponse.json(
      { error: "Signup failed. Please try again." },
      { status: 500 }
    )
  }
}
