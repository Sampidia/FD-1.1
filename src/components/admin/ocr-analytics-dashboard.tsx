'use client'

import { useState, useEffect } from 'react'

interface AnalyticsData {
  summary?: {
    totalRequests?: number
    successRate?: number
    successfulAICount?: number
    averageProcessingTime?: number
    averageConfidence?: number
    totalErrors?: number
    // AI Usage Record fields
    totalTokens?: number
    totalCost?: number
    avgCostPerRequest?: number
    successfulRequests?: number
  }
  topErrors?: Array<{
    strategy: string
    errorType: string
    errorMessage: string
    timestamp: Date
  }>
  strategyPerformance?: Record<string, {
    requests: number
    successRate: number
    averageTime: number
    averageCost: number
    totalCost: number
  }>
  // AI Usage Record fields
  dateRange?: string
  records?: Array<{
    id: string
    dateTime: Date
    totalTokens: number
    cost: number
    success: boolean
    responseTime: number
    modelUsed?: string
    provider: string
  }>
}

export default function OCRAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('24h')
  const [activeTab, setActiveTab] = useState('overview')
  const [showRecordsModal, setShowRecordsModal] = useState(false)
  const [recordsData, setRecordsData] = useState<AnalyticsData | null>(null)

  const fetchAnalytics = async (range: string, metric: string = 'overview') => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/ocr-analytics?timeRange=${range}&metric=${metric}`)
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
    fetchAnalytics(timeRange, activeTab === 'errors' ? 'success' : 'overview')
  }

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId)
    // Load appropriate metric data based on tab
    if (tabId === 'errors') {
      // Success Rate tab needs both overview and success metrics
      fetchOverviewAndSuccess(timeRange)
    } else {
      fetchAnalytics(timeRange, 'overview')
    }
  }

  const fetchOverviewAndSuccess = async (range: string) => {
    try {
      setLoading(true)
      const [overviewRes, successRes] = await Promise.all([
        fetch(`/api/admin/ocr-analytics?timeRange=${range}&metric=overview`),
        fetch(`/api/admin/ocr-analytics?timeRange=${range}&metric=success`)
      ])

      const overviewResult = await overviewRes.json()
      const successResult = await successRes.json()

      if (overviewResult.success && successResult.success) {
        // Combine both data sources for Success Rate tab with proper summary merging
        // Avoid overwriting OCR totalRequests with AI totalRequests
        const { totalRequests: aiTotalRequests, ...successSummary } = successResult.data.summary
        setData({
          ...overviewResult.data,  // Header cards data structure (with OCR totalRequests preserved)
          ...successResult.data,   // Success metrics data (totalTokens, records[])
          // Explicitly merge summary objects, keeping OCR totalRequests from overview
          summary: {
            ...overviewResult.data.summary,   // OCR metrics (totalRequests, successRate, avgProcessingTime, totalErrors)
            ...successSummary,                // AI metrics without totalRequests (totalTokens, totalCost, successfulRequests)
            aiTotalRequests                   // Store AI count separately if needed
          }
        })
      }
    } catch (error) {
      console.error('Failed to fetch combined data:', error)
    } finally {
      setLoading(false)
    }
  }

  const openRecordsModal = async () => {
    try {
      const response = await fetch(`/api/admin/ocr-analytics?timeRange=${timeRange}&metric=success`)
      const result = await response.json()
      if (result.success) {
        setRecordsData(result.data)
        setShowRecordsModal(true)
      }
    } catch (error) {
      console.error('Failed to fetch records:', error)
    }
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
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTimeRange(e.target.value)}
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
              <p className="text-2xl font-bold">{data.summary?.totalRequests}</p>
              <p className="text-xs text-gray-500">in selected time range</p>
            </div>
            <div className="text-green-500">✓</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold">
                {data.summary?.successRate?.toFixed(1)}%
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({(data.summary?.successfulAICount || 0).toLocaleString()} successful)
                </span>
              </p>
              <p className="text-xs text-gray-500">OCR accuracy from AI calls</p>
            </div>
            <div className="text-blue-500">📈</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Processing Time</p>
              <p className="text-2xl font-bold">{data.summary?.averageProcessingTime}ms</p>
              <p className="text-xs text-gray-500">per request</p>
            </div>
            <div className="text-yellow-500">⏱️</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Errors</p>
              <p className="text-2xl font-bold">{data.summary?.totalErrors}</p>
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
            { id: 'strategies', name: 'Error Rates' },
{ id: 'errors', name: 'Success Rate' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
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
              {data.topErrors?.length ? (
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
            <h2 className="text-xl font-semibold mb-4">OCR Error Rates</h2>
            <p className="text-gray-600 mb-6">Error rates and costs by OCR provider</p>

            <div className="space-y-4">
              {Object.entries(data.strategyPerformance || {}).map(([strategy, stats]) => (
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Success Rate Analysis</h2>
              <button
                onClick={openRecordsModal}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                📋 View Individual Records
              </button>
            </div>
            <p className="text-gray-600 mb-6">AIUsageRecord Summary ({data.dateRange})</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {data.summary?.totalTokens?.toLocaleString() || 0}
                </div>
                <p className="text-blue-700 font-medium">Total Tokens</p>
              </div>

              <div className="bg-green-50 p-6 rounded-lg text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  ${((0.005 * (data.summary?.totalRequests || 0)).toFixed(4))}
                </div>
                <p className="text-green-700 font-medium">Average Total Request Cost</p>
              </div>

              <div className="bg-purple-50 p-6 rounded-lg text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  {data.summary?.totalRequests?.toLocaleString() || 0}
                </div>
                <p className="text-purple-700 font-medium">Total Requests</p>
                <p className="text-sm text-purple-600">AI calls in date range</p>
              </div>
            </div>

            {/* Additional success metrics */}
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="bg-yellow-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-yellow-600 mb-1">
                  {data.summary?.successfulAICount?.toLocaleString() || 0}
                </div>
                <p className="text-yellow-700 font-medium text-sm">Successful Requests</p>
              </div>
              <div className="bg-cyan-50 p-4 rounded-lg text-center">
                <div className="text-xl font-bold text-cyan-600 mb-1">
                  {(data.summary?.successRate || 0).toFixed(1)}%
                </div>
                <p className="text-cyan-700 font-medium text-sm">Success Rate</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AIUsageRecord Modal */}
      {showRecordsModal && recordsData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Individual AIUsageRecord Entries</h3>
              <button
                onClick={() => setShowRecordsModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                Showing individual AIUsageRecord entries for OCR requests ({recordsData.dateRange})
              </p>
              <div className="overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date/Time
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Tokens
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cost
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Success
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Response Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recordsData.records && recordsData.records.length > 0 ? (
                      recordsData.records.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                            {new Date(record.dateTime).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                            {record.totalTokens.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                            ${record.cost.toFixed(4)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {record.success ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                ✅ Success
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                ❌ Failed
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                            {record.responseTime.toFixed(2)}s
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                          No AIUsageRecord entries found for the selected time range
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowRecordsModal(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
