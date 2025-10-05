import NextAuth, { type User, type Session } from "next-auth"
import { type JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      planBasicPoints?: number;
      planStandardPoints?: number;
      planBusinessPoints?: number;
      pointsBalance?: number;
      createdAt?: Date;
    }
  }
}
import Credentials from "next-auth/providers/credentials"
import { ensureUserExists } from "@/lib/auth-db"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"

// NextAuth config for email/password only
const authOptions = {
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-change-in-production",
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        recaptchaToken: { label: "reCAPTCHA", type: "text" },
      },
      authorize: async (credentials: Record<"email" | "password" | "recaptchaToken", string> | undefined): Promise<{
        id: string;
        email: string;
        name?: string | null;
        image?: string | null;
      } | null> => {
        try {
          // Check if credentials object exists
          if (!credentials) {
            console.log('🔐 No credentials provided')
            return null
          }

          // Email/password authentication only
          if (!credentials.email || !credentials.password) {
            console.log('🔐 Missing email or password in credentials')
            return null
          }

          console.log('🔐 Attempting to authenticate user:', credentials.email)

          // Find user in database
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string }
          })

          if (!user) {
            console.log('🔐 User not found in database:', credentials.email)
            return null
          }

          if (!user.password) {
            console.log('🔐 User has no password:', credentials.email)
            return null
          }

          // Check if password matches
          const isValidPassword = await bcrypt.compare(credentials.password as string, user.password)

          if (!isValidPassword) {
            console.log('🔐 Invalid password for user:', credentials.email)
            return null
          }

          console.log('🔐 Authentication successful for:', credentials.email)

          // Return real user data
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          }
        } catch (error) {
          console.error('🔐 Auth error:', error)
          return null
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    async signIn(params: { user: User; account: any; profile?: any }) {
      try {
        const { user } = params;
        console.log('🔐 NextAuth signIn callback triggered for:', user?.email)

        // Ensure user exists in database for both Google and Credentials
        if (user) {
          await ensureUserExists({
            id: user.id,
            email: user.email!,
            name: user.name || undefined,
            image: user.image || undefined,
          });
        }

        console.log('✅ User ensured in database:', user?.email)
        return true;
      } catch (error) {
        console.error('❌ Error in signIn callback:', error);
        return false; // Reject sign-in on database error
      }
    },
    async jwt({ token, user }: { token: JWT & { id?: string; planBasicPoints?: number; planStandardPoints?: number; planBusinessPoints?: number; pointsBalance?: number; createdAt?: Date }; user: User | null }) {
      // Add ID to token for Google OAuth - Google provides sub as unique identifier
      if (user) {
        token.id = user.id;

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
        });

        if (dbUser) {
          // Add plan points to JWT token
          token.planBasicPoints = dbUser.planBasicPoints;
          token.planStandardPoints = dbUser.planStandardPoints;
          token.planBusinessPoints = dbUser.planBusinessPoints;
          token.pointsBalance = (dbUser.planBasicPoints || 0) + (dbUser.planStandardPoints || 0) + (dbUser.planBusinessPoints || 0);
          token.createdAt = dbUser.createdAt;
        }
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT & { id?: string; planBasicPoints?: number; planStandardPoints?: number; planBusinessPoints?: number; pointsBalance?: number; createdAt?: Date } }) {
      // Add ID to session from token
      if (token.id && session.user) {
        session.user.id = token.id as string;

        // Add plan points, pointsBalance and createdAt to session (extended user properties)
        session.user.planBasicPoints = token.planBasicPoints;
        session.user.planStandardPoints = token.planStandardPoints;
        session.user.planBusinessPoints = token.planBusinessPoints;
        session.user.pointsBalance = token.pointsBalance;
        session.user.createdAt = token.createdAt;
      }
      return session;
    },
  },
  debug: true,
}

// NextAuth App Router exports - THIS IS THE CORRECT PATTERN FOR NEXTAUTH v4
const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }

// Export authOptions for server-side usage in APIs
export { authOptions }

// ALTERNATIVE: If APIs need the full auth function, uncomment this:
// import { getServerSession } from "next-auth"
// export const auth = authOptions // and APIs can use getServerSession(authOptions, request)
