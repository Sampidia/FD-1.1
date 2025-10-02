import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { ensureUserExists } from "@/lib/auth-db"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { OAuth2Client } from "google-auth-library"

// ULTRA MINIMAL NextAuth config - CORRECT exports
const authOptions = {
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-change-in-production",
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials: any): Promise<any> => {
        try {
          // Check if this is mobile Google authentication (has idToken)
          if (credentials?.idToken && credentials?.googleId) {
            console.log('🔐 Mobile Google Auth attempt for:', credentials.email)

            // Verify Google ID token
            const client = new OAuth2Client(process.env.GOOGLE_ANDROID_CLIENT_ID || process.env.GOOGLE_CLIENT_ID)
            const ticket = await client.verifyIdToken({
              idToken: credentials.idToken,
              audience: process.env.GOOGLE_ANDROID_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
            })

            const payload = ticket.getPayload()
            if (!payload) {
              console.log('🔐 Invalid Google token')
              return null
            }

            // Ensure the token email matches the provided email
            if (payload.email !== credentials.email) {
              console.log('🔐 Email mismatch in token')
              return null
            }

            console.log('🔐 Google token verified for:', payload.email)

            // Ensure user exists (this will create if not exists)
            const user = await ensureUserExists({
              id: payload.sub, // Google user ID
              email: payload.email!,
              name: payload.name || credentials.name,
              image: payload.picture || credentials.image,
            })

            // Return user data
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image,
            }
          }

          // Email/password authentication
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
            console.log('🔐 User has no password (might be Google OAuth only):', credentials.email)
            return null
          }

          // Check if password matches
          const isValidPassword = await bcrypt.compare(credentials.password, user.password)

          if (!isValidPassword) {
            console.log('🔐 Invalid password for user:', credentials.email)
            return null
          }

          console.log('🔐 Authentication successful for:', credentials.email)

          // Return real user data (session callbacks will handle ID)
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
