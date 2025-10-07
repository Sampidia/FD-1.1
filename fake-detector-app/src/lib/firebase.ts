// Firebase Crashlytics utilities for Capacitor apps
// This provides a unified interface for both web and mobile crash reporting

export interface CrashlyticsError {
  message: string
  stack?: string
  userId?: string
  customData?: Record<string, unknown>
}

// Global error handler for web
export function logError(error: CrashlyticsError): void {
  console.error('🚨 Crashlytics Error:', error)

  // In a real implementation, you would send this to your crash reporting service
  // For now, we'll log it and could integrate with services like Sentry, LogRocket, etc.

  // Example integration points:
  // - Sentry: Sentry.captureException(new Error(error.message))
  // - LogRocket: LogRocket.captureException(error.message)
  // - Firebase Crashlytics (web): firebase.crashlytics().recordError(error.message)

  // For development, we'll store in localStorage for debugging
  if (typeof window !== 'undefined') {
    const crashLogs = JSON.parse(localStorage.getItem('crashLogs') || '[]')
    crashLogs.push({
      ...error,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    })

    // Keep only last 50 errors
    if (crashLogs.length > 50) {
      crashLogs.splice(0, crashLogs.length - 50)
    }

    localStorage.setItem('crashLogs', JSON.stringify(crashLogs))
  }
}

// Utility functions for common error scenarios
export const CrashlyticsUtils = {
  // Log JavaScript errors
  logJSError: (error: Error, customData?: Record<string, unknown>) => {
    logError({
      message: error.message,
      stack: error.stack,
      customData
    })
  },

  // Log API errors
  logAPIError: (endpoint: string, status: number, response?: unknown) => {
    logError({
      message: `API Error: ${status} on ${endpoint}`,
      customData: { endpoint, status, response }
    })
  },

  // Log authentication errors
  logAuthError: (action: string, error: string) => {
    logError({
      message: `Auth Error during ${action}: ${error}`,
      customData: { action, authError: error }
    })
  },

  // Log payment errors
  logPaymentError: (step: string, error: string, amount?: number) => {
    logError({
      message: `Payment Error at ${step}: ${error}`,
      customData: { step, paymentError: error, amount }
    })
  },

  // Log scan errors
  logScanError: (step: string, error: string, productInfo?: unknown) => {
    logError({
      message: `Scan Error at ${step}: ${error}`,
      customData: { step, scanError: error, productInfo }
    })
  }
}
