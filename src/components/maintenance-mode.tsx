'use client'

import { useEffect, useState } from 'react'

interface MaintenanceData {
  isScraping: boolean
  lastScrapedAt: string | null
  lastError: string | null
  lastUpdated: string
}

export function MaintenanceModeProvider({ children }: { children: React.ReactNode }) {
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkMaintenanceStatus = async () => {
      try {
        const response = await fetch('/api/scraper/cron')
        const data = await response.json()
        setMaintenanceData(data)
      } catch (error) {
        console.error('Failed to check maintenance status:', error)
      } finally {
        setIsLoading(false)
      }
    }

    // Check status on mount
    checkMaintenanceStatus()

    // Check status every 30 seconds
    const interval = setInterval(checkMaintenanceStatus, 30000)

    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (maintenanceData?.isScraping) {
    return <MaintenanceModeScreen />
  }

  return <>{children}</>
}

function MaintenanceModeScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* NAFDAC Logo/Icon */}
        <div className="mx-auto mb-6 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
          <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
            <span className="text-blue-600 font-bold text-lg">NA</span>
          </div>
        </div>

        {/* Maintenance Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          System Maintenance
        </h1>

        <p className="text-gray-600 mb-6">
          We&#39;re currently updating our counterfeit medicine database to ensure you have the most accurate information.
        </p>

        {/* Progress Indicator */}
        <div className="space-y-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse w-3/4"></div>
          </div>
          <p className="text-sm text-gray-500">
            Updating product safety alerts...
          </p>
        </div>

        {/* Last Update Info */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Last updated: {new Date().toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Check back in a few minutes
          </p>
        </div>
      </div>
    </div>
  )
}

// Hook for manual status checking
export function useMaintenanceStatus() {
  const [data, setData] = useState<MaintenanceData | null>(null)
  const [loading, setLoading] = useState(false)

  const checkStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/scraper/cron')
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Failed to check status:', error)
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, checkStatus }
}
