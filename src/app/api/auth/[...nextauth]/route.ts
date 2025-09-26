import { GET, POST } from "@/lib/auth-minimal"

// Force dynamic rendering for NextAuth routes
export const dynamic = 'force-dynamic'

// Re-export the NextAuth handlers
export { GET, POST }
