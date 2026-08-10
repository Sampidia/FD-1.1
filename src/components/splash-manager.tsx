'use client';

import { useEffect } from 'react';

/**
 * SplashManager – hides the native Capacitor splash screen once the
 * Next.js application has fully mounted. This avoids a white flash
 * that occurs when launchAutoHide fires before the WebView is ready.
 *
 * Capacitor plugins are dynamically imported so the component is a
 * no-op when running in a regular browser (non-Capacitor) context.
 */
export default function SplashManager() {
  useEffect(() => {
    const hideSplash = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');

        // Only run inside a native Capacitor shell
        if (Capacitor.isNativePlatform()) {
          const { SplashScreen } = await import('@capacitor/splash-screen');
          // Small delay to let the first paint settle
          await new Promise((r) => setTimeout(r, 300));
          await SplashScreen.hide({ fadeOutDuration: 800 });
        }
      } catch {
        // Not in a Capacitor environment – nothing to do
      }
    };

    hideSplash();
  }, []);

  return null;
}
