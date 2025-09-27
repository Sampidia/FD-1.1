import prisma from './prisma'
import bcrypt from 'bcryptjs'
import { EmailService } from './email'
import { Logger } from './logger'

// Helper functions for auth database operations
export async function ensureUserExists(user: {
  id: string
  email: string
  name?: string
  image?: string
  planId?: string
}) {
  try {
    // Try to find existing user
    let dbUser = await prisma.user.findUnique({
      where: { email: user.email }
    })

    if (!dbUser) {
      // Create new user if doesn't exist
      dbUser = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      })
      console.log('✅ Created new user:', user.email)

      // Note: Welcome email removed for Google OAuth users per requirement
      // Keeping welcome email only for manual email/password signup
    }

    return dbUser
  } catch (error) {
    console.error('Error ensuring user exists:', error)
    throw error
  }
}

export async function getUserWithBalance(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        pointsBalance: true,
        createdAt: true,
        planBasicPoints: true,
        planStandardPoints: true,
        planBusinessPoints: true
      }
    })
    return user
  } catch (error) {
    console.error('Error getting user with balance:', error)
    return null
  }
}

// Hash password utility
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return await bcrypt.hash(password, saltRounds)
}

// Create user with email and password for signup
export async function createUserWithPassword(user: {
  email: string
  password: string
  name?: string
}) {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: user.email }
    })

    if (existingUser) {
      throw new Error('User already exists with this email')
    }

    // Hash password
    const hashedPassword = await hashPassword(user.password)

    // Create new user with password
    const newUser = await prisma.user.create({
      data: {
        email: user.email,
        password: hashedPassword,
        name: user.name,
      }
    })

    console.log('✅ Created new user with password:', user.email)

    // Send welcome email for new users (non-blocking with small delay)
    const userName = user.name || newUser.email.split('@')[0]
    setImmediate(async () => {
      try {
        // Small delay to ensure user record is committed
        await new Promise(resolve => setTimeout(resolve, 50))
        await EmailService.sendWelcomeEmail(newUser.email, userName)
        Logger.info('Welcome email sent for manual signup user', { email: newUser.email })
      } catch (emailError) {
        Logger.error('Failed to send welcome email for manual signup user', {
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
          email: newUser.email
        })
      }
    })

    return newUser
  } catch (error) {
    console.error('Error creating user with password:', error)
    throw error
  }
}

// Get user with password for authentication
export async function getUserByEmail(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    })
    return user
  } catch (error) {
    console.error('Error getting user by email:', error)
    return null
  }
}
