import { Capacitor } from '@capacitor/core'

// Type declarations for Capacitor Browser
declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
    };
  }
}

/**
 * Opens payment URLs in an in-app browser for better mobile UX
 */
export class PaymentBrowser {
  /**
   * Opens a payment URL in an in-app browser (mobile) or new tab (web)
   */
  static async openPaymentUrl(
    url: string,
    options: {
      title?: string;
      onClosed?: () => void;
    } = {}
  ): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      // Use in-app browser on mobile
      const { Browser } = await import('@capacitor/browser');

      await Browser.open({
        url,
        presentationStyle: 'fullscreen', // or 'popover' on iOS
        toolbarColor: '#2563eb'
      });

      // Note: Browser close event listening removed to avoid @capacitor/app dependency
      // The onClosed callback can be handled differently if needed
    } else {
      // Open in new tab on web
      window.open(url, '_blank');
    }
  }

  /**
   * Closes the in-app browser programmatically
   */
  static async closeBrowser(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import('@capacitor/browser');
      await Browser.close();
    }
  }

  /**
   * Prefetches and warms up browser for faster payment loading
   */
  static async preloadBrowser(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import('@capacitor/browser');
      // Browser prefetch if supported
      // Some browsers support prefetching for performance
    }
  }
}

/**
 * React hook for easy payment browser management
 */
export function usePaymentBrowser() {
  const openPaymentUrl = (
    url: string,
    options?: { title?: string; onClosed?: () => void }
  ) => {
    return PaymentBrowser.openPaymentUrl(url, options);
  };

  const closeBrowser = () => {
    return PaymentBrowser.closeBrowser();
  };

  const preloadBrowser = () => {
    return PaymentBrowser.preloadBrowser();
  };

  return {
    openPaymentUrl,
    closeBrowser,
    preloadBrowser,
    isNative: Capacitor.isNativePlatform()
  };
}
