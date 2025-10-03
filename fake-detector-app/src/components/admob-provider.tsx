'use client'

import { useEffect } from 'react'
import { initializeMobileAdMob } from '@/lib/mobile-admob'

export function AdMobProvider() {
  useEffect(() => {
    // Initialize AdMob when app loads
    const initAdMob = async () => {
      try {
        await initializeMobileAdMob()
      } catch (error) {
        console.error('Failed to initialize AdMob:', error)
        // AdMob not critical for app function, so we don't throw
      }
    }

    initAdMob()
  }, [])

  return null // This component only manages AdMob initialization
}
