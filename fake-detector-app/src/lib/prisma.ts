import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Enhanced Prisma client with connection pool and retry configuration
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool configuration
  transactionOptions: {
    maxWait: 20000, // Maximum time to wait for a connection from the pool
    timeout: 10000, // Maximum time for a transaction
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Connection health check function - MongoDB compatible
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    // For MongoDB compatibility, use ping command instead of SELECT 1
    await prisma.$runCommandRaw({ ping: 1 })
    return true
  } catch (error) {
    console.error('Database connection check failed:', error)
    return false
  }
}

// Retry wrapper for database operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      // Don't retry for certain types of errors
      if (error instanceof Error) {
        // Don't retry for authentication errors or schema issues
        if (
          error.message.includes('Authentication failed') ||
          error.message.includes('relation') ||
          error.message.includes('does not exist') ||
          error.message.includes('permission denied')
        ) {
          throw error
        }

        // Log the retry attempt
        console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error.message)

        // If this is the last attempt, don't wait
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt))
        }
      }
    }
  }

  throw lastError!
}

// Graceful shutdown handler
export async function disconnectPrisma() {
  try {
    await prisma.$disconnect()
    console.log('Prisma client disconnected successfully')
  } catch (error) {
    console.error('Error disconnecting Prisma client:', error)
  }
}

// Handle process termination
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    await disconnectPrisma()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await disconnectPrisma()
    process.exit(0)
  })
}

export default prisma
