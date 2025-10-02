import NextAuth from "next-auth"
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
      authorize: async (credentials: any): Promise<any> => {
        try {
          // Email/password authentication only
          if (!credentials?.email || !credentials?.password) {
            console.log('🔐 Missing email or password in credentials')
            return null
          }

          console.log('🔐 Attempting to authenticate user:', credentials.email)

          // Find user in database
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
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
          const isValidPassword = await bcrypt.compare(credentials.password, user.password)

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
    async signIn(params: { user: any; account: any; profile?: any }) {
      try {
        const { user } = params;
        console.log('🔐 NextAuth signIn callback triggered for:', user?.email)

        // Ensure user exists in database for both Google and Credentials
        if (user) {
          await ensureUserExists({
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          });
        }

        console.log('✅ User ensured in database:', user?.email)
        return true;
      } catch (error) {
        console.error('❌ Error in signIn callback:', error);
        return false; // Reject sign-in on database error
      }
    },
    async jwt({ token, user }: { token: any, user: any }) {
      // Add ID to token for Google OAuth - Google provides sub as unique identifier
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: any, token: any }) {
      // Add ID to session from token
      if (token.id && session.user) {
        session.user.id = token.id as string;
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
