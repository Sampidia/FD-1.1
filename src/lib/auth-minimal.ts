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
        // Real database authentication for email/password users
        if (!credentials?.email || !credentials?.password) {
          console.log('🔐 Missing email or password in credentials')
          return null
        }

        try {
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
    // Native Google Sign-In provider for Capacitor Android app
    // Verifies the Google ID token issued by @capgo/capacitor-social-login
    Credentials({
      id: "google-native",
      name: "Google (Native)",
      credentials: {
        idToken: { label: "Google ID Token", type: "text" },
      },
      authorize: async (credentials: any): Promise<any> => {
        if (!credentials?.idToken) {
          console.log('🔐 [google-native] No idToken provided')
          return null
        }

        try {
          // Verify the Google ID token server-side
          const googleClientId = process.env.GOOGLE_CLIENT_ID!
          const oauthClient = new OAuth2Client(googleClientId)

          const ticket = await oauthClient.verifyIdToken({
            idToken: credentials.idToken,
            audience: googleClientId,
          })

          const payload = ticket.getPayload()
          if (!payload || !payload.email) {
            console.log('🔐 [google-native] Invalid token payload')
            return null
          }

          console.log('🔐 [google-native] Token verified for:', payload.email)

          // Upsert user in database (same as standard Google OAuth flow)
          await ensureUserExists({
            id: payload.sub,
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
            image: payload.picture || undefined,
          })

          // Fetch the user ID from DB
          const dbUser = await prisma.user.findUnique({
            where: { email: payload.email },
            select: { id: true, email: true, name: true, image: true }
          })

          if (!dbUser) {
            console.log('🔐 [google-native] User not found after upsert')
            return null
          }

          return {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            image: dbUser.image,
          }
        } catch (error) {
          console.error('🔐 [google-native] Token verification failed:', error)
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
