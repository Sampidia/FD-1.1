import type { DefaultSession } from "next-auth"

// NextAuth v4 Global Type Augmentation (safer approach)
declare global {
  namespace NextAuth {
    interface Session extends DefaultSession {
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

    interface User {
      id: string
      email: string
      name?: string | null
      image?: string | null
      password?: string
      pointsBalance?: number
      createdAt?: Date
      planBasicPoints?: number
      planStandardPoints?: number
      planBusinessPoints?: number
      planFreePoints?: number
    }
  }
}
