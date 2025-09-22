import { create } from 'zustand'

interface User {
  id: string
  email: string
  name?: string | null
  image?: string | null
  pointsBalance?: number
}

interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
  login: (email: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  updatePoints: (newBalance: number) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,

  login: async (email: string) => {
    set({ isLoading: true, error: null })
    try {
      // This will be integrated with NextAuth.js
      console.log('Login with email:', email)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Login failed' })
    } finally {
      set({ isLoading: false })
    }
  },

  logout: () => {
    set({ user: null, error: null })
  },

  checkAuth: async () => {
    set({ isLoading: true })
    try {
      // Check current auth status
      // This will be handled by NextAuth.js session
    } catch (error) {
      console.error('Auth check failed:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  updatePoints: (newBalance: number) => {
    const user = get().user
    if (user) {
      set({ user: { ...user, pointsBalance: newBalance } })
    }
  }
}))

export type { AuthState }