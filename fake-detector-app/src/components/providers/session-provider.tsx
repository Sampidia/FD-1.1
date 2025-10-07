"use client"

import { SessionProvider } from "next-auth/react"

interface Props {
  children: React.ReactNode
  session?: any // Use any to match NextAuth's expected session type
}

export default function AuthProvider({ children, session }: Props) {
  return (
    <SessionProvider
      session={session}
      refetchInterval={300}        // Increased from 30s to 5 minutes to prevent form clearing
      refetchOnWindowFocus={false} // Disabled to prevent unwanted re-renders
    >
      {children}
    </SessionProvider>
  )
}
