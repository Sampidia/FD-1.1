"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, Clock } from "lucide-react"

interface Alert {
  id: string
  productName: string
  alertType: string
  createdAt: string
}

interface RecentAlertsSliderProps {
  autoScrollInterval?: number // in milliseconds
}

export default function RecentAlertsSlider({
  autoScrollInterval = 3000
}: RecentAlertsSliderProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    fetchAlerts()
  }, [])

  useEffect(() => {
    if (alerts.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % alerts.length)
      }, autoScrollInterval)

      return () => clearInterval(interval)
    }
  }, [alerts, autoScrollInterval])

  const fetchAlerts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/public/recent-alerts')
      const data = await response.json()

      if (data.success) {
        setAlerts(data.alerts || [])
      } else {
        setError('Failed to load alerts')
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err)
      setError('Failed to load alerts')
    } finally {
      setIsLoading(false)
    }
  }

  const getAlertBadgeVariant = (alertType: string) => {
    switch (alertType?.toLowerCase()) {
      case 'fake':
      case 'counterfeit':
        return 'destructive'
      case 'recall':
        return 'destructive'
      case 'expired':
        return 'secondary'
      default:
        return 'destructive'
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) {
      return 'Just now'
    } else if (diffHours < 24) {
      return `${diffHours}h ago`
    } else {
      return `${diffDays}d ago`
    }
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="animate-pulse bg-gray-50 rounded-lg p-6">
          <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between md:items-center">
            <div className="flex flex-col items-center md:flex-row md:items-center md:gap-4">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="text-center md:text-left mt-3 md:mt-0">
                <div className="w-48 h-4 bg-gray-200 rounded mb-2"></div>
                <div className="w-24 h-3 bg-gray-200 rounded mx-auto md:mx-0"></div>
              </div>
            </div>
            <div className="flex gap-2 mt-3 md:mt-0 md:ml-4">
              <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
              <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
              <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || alerts.length === 0) {
    return (
      <Card className="w-full max-w-4xl mx-auto bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            <div>
              <p className="font-medium">No Recent Alerts</p>
              <p className="text-sm text-red-600">
                {error || 'Stay vigilant - no counterfeit products detected recently.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentAlert = alerts[currentIndex]

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Main Alert Display */}
      <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200 hover:shadow-lg transition-all duration-300">
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between md:items-center">
            {/* Mobile: Icon at top, Desktop: Icon on left */}
            <div className="flex flex-col items-center md:flex-row md:items-center md:gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>

              <div className="text-center md:text-left mt-3 md:mt-0 md:flex-1 md:min-w-0">
                <h3 className="font-semibold text-gray-900 truncate text-lg mb-1">
                  {currentAlert.productName}
                </h3>
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <Badge
                    variant={getAlertBadgeVariant(currentAlert.alertType)}
                    className="text-xs"
                  >
                    {currentAlert.alertType}
                  </Badge>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    {formatTimeAgo(currentAlert.createdAt)}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Dots - Mobile: below alert, Desktop: on right */}
            <div className="flex flex-row gap-2 mt-3 md:mt-0 md:ml-4">
              {alerts.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? 'bg-red-500 scale-125'
                      : 'bg-red-300 hover:bg-red-400'
                  }`}
                  aria-label={`Go to alert ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Indicator */}
      <div className="flex justify-center mt-4">
        <div className="text-xs text-gray-500">
          Recent Alert {currentIndex + 1} of {alerts.length}
        </div>
      </div>
    </div>
  )
}
