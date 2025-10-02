import { useEffect } from 'react'

// Type declarations for Capacitor
declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
    };
  }
}

export const useSplashScreen = () => {
  useEffect(() => {
    // Hide splash screen when component mounts (app is ready)
    const hideSplashScreen = async () => {
      if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
        try {
          const { SplashScreen } = await import('@capacitor/splash-screen')
          // Wait a bit for the app to be fully rendered
          setTimeout(() => {
            SplashScreen.hide({
              fadeOutDuration: 800
            })
          }, 1000)
        } catch (error) {
          console.error('Failed to hide splash screen:', error)
        }
      }
    }

    hideSplashScreen()
  }, [])

  const showSplashScreen = async () => {
    if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen')
        await SplashScreen.show()
      } catch (error) {
        console.error('Failed to show splash screen:', error)
      }
    }
  }

  return {
    showSplashScreen
  }
}
