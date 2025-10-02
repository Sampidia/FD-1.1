import { useEffect } from 'react'

// Type declarations for Capacitor
declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
    };
  }
}

export const useEdgeToEdge = () => {
  // The edge-to-edge plugin automatically handles enabling edge-to-edge
  // when configured in capacitor.config.ts with AndroidEdgeToEdgeSupport: { enabled: true }
  // No manual API calls needed

  const setSystemBarsColor = async (color: string, darkIcons: boolean = false) => {
    if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
      try {
        // If needed in the future, system bars color can be changed via StatusBar plugin
        // const { StatusBar } = await import('@capacitor/status-bar')
        // Style is set in capacitor.config.ts in the StatusBar plugin configuration
        console.log('System bars color change not implemented - configured in capacitor.config.ts')
      } catch (error) {
        console.error('Failed to set system bars color:', error)
      }
    }
  }

  return {
    setSystemBarsColor
  }
}
