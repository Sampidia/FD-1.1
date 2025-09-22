'use client'

import { useState, useEffect } from 'react'

interface AnalyticsData {
  summary: {
    totalRequests: number
    successRate: number
    averageProcessingTime: number
    averageConfidence: number
    totalErrors: number
  }
  topErrors: Array<{
    strategy: string
    errorType: string
    errorMessage: string
    timestamp: Date
  }>
  strategyPerformance: Record<string, {
    requests: number
    successRate: number
    averageTime: number
    averageCost: number
    totalCost: number
  }>
}

export default function OCRAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('24h')
  const [activeTab, setActiveTab] = useState('overview')

  const fetchAnalytics = async (range: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/ocr-analytics?timeRange=${range}&metric=overview`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics(timeRange)
  }, [timeRange])

  const handleRefresh = () => {
    fetchAnalytics(timeRange)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Loading analytics...</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p>Failed to load analytics data</p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">OCR Analytics Dashboard</h1>
          <p className="text-gray-600">
            Monitor OCR performance and system health
          </p>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>

          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold">{data.summary.totalRequests}</p>
              <p className="text-xs text-gray-500">in selected time range</p>
            </div>
            <div className="text-green-500">✓</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold">{data.summary.successRate}%</p>
              <p className="text-xs text-gray-500">OCR accuracy</p>
            </div>
            <div className="text-blue-500">📈</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Processing Time</p>
              <p className="text-2xl font-bold">{data.summary.averageProcessingTime}ms</p>
              <p className="text-xs text-gray-500">per request</p>
            </div>
            <div className="text-yellow-500">⏱️</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Errors</p>
              <p className="text-2xl font-bold">{data.summary.totalErrors}</p>
              <p className="text-xs text-gray-500">failed requests</p>
            </div>
            <div className="text-red-500">⚠️</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview' },
            { id: 'strategies', name: 'Strategy Performance' },
            { id: 'errors', name: 'Error Analysis' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Errors</h2>
            <p className="text-gray-600 mb-4">Most recent OCR processing failures</p>

            <div className="space-y-3">
              {data.topErrors.length > 0 ? (
                data.topErrors.map((error, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                          {error.strategy}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                          {error.errorType}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {error.errorMessage}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(error.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No recent errors</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'strategies' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">OCR Strategy Performance</h2>
            <p className="text-gray-600 mb-6">Success rates and costs by OCR provider</p>

            <div className="space-y-4">
              {Object.entries(data.strategyPerformance).map(([strategy, stats]) => (
                <div key={strategy} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium capitalize">{strategy}</h3>
                      <span className={`px-2 py-1 text-xs rounded ${
                        stats.successRate > 80 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {stats.successRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {stats.requests} requests • {stats.averageTime.toFixed(0)}ms avg
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <span className="text-green-600">$</span>
                      <span className="font-medium">{stats.averageCost.toFixed(4)}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      per request
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'errors' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Error Analysis</h2>
            <p className="text-gray-600 mb-6">Detailed breakdown of OCR failures</p>

            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-4">📊</div>
              <p className="text-lg">Detailed error analysis coming soon</p>
              <p className="text-sm">This section will show error trends and diagnostics</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}