"use client"

import React, { useEffect } from 'react'
import { ErrorBoundary } from './error-boundary'
import { logError, CrashlyticsUtils } from '@/lib/firebase'
import { useSession } from 'next-auth/react'

interface FirebaseCrashlyticsProviderProps {
  children: React.ReactNode
}

export function FirebaseCrashlyticsProvider({ children }: FirebaseCrashlyticsProviderProps) {
  const { data: session } = useSession()

  // Set user ID for crash reports when user is authenticated
  useEffect(() => {
    if (session?.user?.id) {
      // In a real implementation with Firebase Crashlytics web SDK:
      // firebase.crashlytics().setUserId(session.user.id)
      console.log('🔥 Crashlytics: User ID set to', session.user.id)
    }
  }, [session])

  // Global error handler for unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      CrashlyticsUtils.logJSError(
        new Error(event.reason?.message || 'Unhandled Promise Rejection'),
        {
          type: 'unhandledRejection',
          reason: event.reason,
          promise: 'Promise rejection caught globally'
        }
      )
    }

    const handleError = (event: ErrorEvent) => {
      CrashlyticsUtils.logJSError(
        new Error(event.message),
        {
          type: 'globalError',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      )
    }

    // Add global error listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
    }
  }, [])

  // Custom error boundary for API errors
  const APIErrorBoundary = ({ children }: { children: React.ReactNode }) => {
    useEffect(() => {
      // Override fetch to add crash reporting for API errors
      const originalFetch = window.fetch
      window.fetch = async (...args) => {
        try {
          const response = await originalFetch(...args)

          // Log API errors (4xx, 5xx responses)
          if (!response.ok && response.status >= 400) {
            CrashlyticsUtils.logAPIError(
              args[0] as string,
              response.status,
              {
                url: response.url,
                statusText: response.statusText,
                type: 'fetch_error'
              }
            )
          }

          return response
        } catch (error) {
          // Log network errors
          CrashlyticsUtils.logAPIError(
            args[0] as string,
            0,
            {
              error: error instanceof Error ? error.message : 'Network error',
              type: 'network_error'
            }
          )
          throw error
        }
      }

      return () => {
        window.fetch = originalFetch
      }
    }, [])

    return <>{children}</>
  }

  return (
    <ErrorBoundary>
      <APIErrorBoundary>
        {children}
      </APIErrorBoundary>
    </ErrorBoundary>
  )
}

// Hook for manual error reporting
export function useCrashlytics() {
  const reportError = (error: Error, customData?: Record<string, unknown>) => {
    CrashlyticsUtils.logJSError(error, customData)
  }

  const reportMessage = (message: string, customData?: Record<string, unknown>) => {
    logError({ message, customData })
  }

  return {
    reportError,
    reportMessage,
    utils: CrashlyticsUtils
  }
}
