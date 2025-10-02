'use client'

import { useSplashScreen } from '@/hooks/use-splash-screen'

export function SplashScreenManager() {
  useSplashScreen()
  return null // This component only manages splash screen, no UI
}
