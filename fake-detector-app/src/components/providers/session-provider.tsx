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
      refetchInterval={30}
      refetchOnWindowFocus={true}
    >
      {children}
    </SessionProvider>
  )
}
