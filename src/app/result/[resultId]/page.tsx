"use client"

import { Suspense, useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Clock, CheckCircle, XCircle, Zap, Shield, Database, Eye, Wallet, LogOut, LayoutGrid } from "lucide-react"
import Logo from "@/components/ui/logo"
import { MobileHeader } from "@/components/ui/mobile-header"
import { BetaModal } from "@/components/ui/beta-modal"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"

interface PageProps {
  params: {
    resultId: string
  }
}

// Enhanced Result Data Interface
interface VerificationResult {
  resultId: string
  isCounterfeit: boolean
  summary: string
  sourceUrl: string
  source: string
  batchNumber?: string
  alertType: string
  confidence: number
  newBalance: number
  timestamp: string
  verificationMethod: string
  // Enhanced fields from our advanced system
  processingTime?: number
  imagesAnalyzed?: number
  ocrConfidence?: number
  productCheckId?: string

  // 🔍 NEW AI ANALYSIS FIELDS
  aiAnalysis?: {
    productName: string
    batchNumbers: string[]
    reason: string
    confidence: number
    alertType: string
    isEnhanced: boolean
  }

  // Backward compatibility fields
  aiEnhanced?: boolean
  aiConfidence?: number
  enhancedProductName?: string
}

interface ScanStats {
  pointsBalance: number
  canClaimDaily: boolean
}

// Loading component
function ResultSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="animate-pulse space-y-6">
        <div className="text-center">
          <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto mb-8"></div>
          <div className="h-16 bg-gray-200 rounded w-full mx-auto mb-6"></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResultPage({ params }: PageProps) {
  const { resultId } = params
  const { data: session, status } = useSession()
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<ScanStats>({
    pointsBalance: 0,
    canClaimDaily: false
  })
  const [isBetaModalOpen, setIsBetaModalOpen] = useState(false)

  const isAuthenticated = status === "authenticated"

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsBetaModalOpen(true)
  }

  // Fetch enhanced result data from our advanced API
  useEffect(() => {
    fetchResultData()
  }, [resultId])

  // Fetch user balance on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/user/balance')
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setStats(prev => ({
              ...prev,
              pointsBalance: data.data.pointsBalance,
              canClaimDaily: data.data.canClaimDailyPoints
            }))
          }
        }
      } catch (error) {
        console.error('Failed to fetch balance:', error)
      }
    }

    if (session) {
      fetchUserData()
    }
  }, [session])

  const fetchResultData = async () => {
    try {
      setIsLoading(true)

      // ALWAYS fetch from database first for security and accuracy
      const response = await fetch(`/api/verify-product/result/${resultId}`)
      if (response.ok) {
        const data = await response.json()
        setResult(data)
        setIsLoading(false)
        return
      }

      // As backup, try localStorage (for immediate feedback after scans)
      const storedResult = typeof window !== 'undefined'
        ? localStorage.getItem('lastScanResult')
        : null

      if (storedResult) {
        try {
          const parsedResult = JSON.parse(storedResult)
          // Only use localStorage if the ID matches
          if (parsedResult.resultId === resultId) {
            setResult(parsedResult)
            console.warn('⚠️ Using cached localStorage result for:', resultId)
            setIsLoading(false)
            return
          }
        } catch (parseError) {
          console.warn('Failed to parse localStorage result:', parseError)
        }
      }

      // If both fail, throw error
      if (response.status === 404) {
        setError(`Result with ID "${resultId}" not found. It may have been deleted or you don't have access to it.`)
      } else {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }

    } catch (err) {
      console.error('Error fetching result:', err)
      setError(err instanceof Error
        ? err.message
        : 'Result could not be loaded. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="container mx-auto px-4 py-12">
          <ResultSkeleton />
        </div>
      </div>
    )
  }

  // Error state
  if (error || !result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-md mx-auto text-center">
            <CardHeader>
              <CardTitle>Result Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-6">
                {error || "The result you're looking for doesn't exist or has expired."}
              </p>
              <div className="space-y-3">
                <Link href="/scan">
                  <Button className="w-full">
                    Start New Scan
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline" className="w-full">
                    Go to Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Get confidence levels and colors
  const getConfidenceColors = (confidence: number) => {
    // Handle both decimal (0-1) and integer (0-100) formats
    const normalizedConfidence = confidence > 1 ? confidence : Math.round(confidence * 100)
    if (normalizedConfidence >= 80) return { bg: 'bg-green-100', text: 'text-green-800', icon: '🟢' }
    if (normalizedConfidence >= 60) return { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '🟡' }
    return { bg: 'bg-red-100', text: 'text-red-800', icon: '🔴' }
  }

  const confidenceColors = getConfidenceColors(result.confidence)

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" }).catch(console.error)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Mobile Hamburger Menu Header */}
      <MobileHeader />
      {/* Back Button */}
      <div className="container mx-auto px-4 py-4">
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      {/* Main Result Display */}
      <div className="container mx-auto px-3 sm:px-4 py-2 max-w-6xl">
        {/* Header with Advanced Stats */}
        <div className="bg-white rounded-xl shadow-lg border mb-6">
          <div className="p-4 sm:p-8">
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-4xl font-bold mb-4 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent break-words overflow-wrap-anywhere">Advanced Product Analysis</h1>
              <p className="text-gray-600 text-sm sm:text-base break-words overflow-wrap-anywhere">
                Result ID: <code className="px-2 py-1 bg-gray-100 rounded text-xs sm:text-sm">{resultId}</code>
              </p>

              {/* Advanced Processing Stats */}
              <div className="flex justify-center items-center gap-6 mt-6 text-sm text-gray-600">



              </div>
            </div>

            {/* Main Status Display */}
            <div className="text-center mb-8">
              <div className={`inline-flex items-center px-8 py-4 rounded-full text-xl font-bold mb-4 ${
                result.isCounterfeit
                  ? result.alertType === 'BATCH_MISMATCH'
                    ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-200'
                    : 'bg-red-100 text-red-800 border-2 border-red-200'
                  : 'bg-green-100 text-green-800 border-2 border-green-200'
              }`}>
                {result.isCounterfeit ? (
                  result.alertType === 'BATCH_MISMATCH' ? (
                    <>
                      <div className="text-yellow-600 mr-3">⚠️</div>
                      🟡 YOUR PRODUCT DIDN'T MATCH ALERT BATCH NUMBER
                    </>
                  ) : (
                    <>
                      <XCircle className="w-6 h-6 mr-3" />
                      🔴 FAKE/RECALL/EXPIRED PRODUCT DETECTED
                    </>
                  )
                ) : (
                  <>
                    <CheckCircle className="w-6 h-6 mr-3" />
                    🔵 PRODUCT VERIFIED
                  </>
                )}
              </div>

              {/* Enhanced Confidence Meter - AI Priority */}
              <div className="max-w-md mx-auto">
                {(() => {
                  // Priority logic: AI confidence → aiConfidence → regular confidence
                  const aiConfidence = result.aiAnalysis?.confidence || result.aiConfidence;
                  const displayConfidence = aiConfidence || result.confidence;
                  const showAIConfidence = aiConfidence !== undefined;
                  const confidenceDelta = showAIConfidence ? (aiConfidence! - result.confidence) : 0;

                  const getConfidenceColors = (conf: number) => {
                    // Handle both decimal (0-1) and integer (0-100) formats
                    const normalizedConf = conf > 1 ? conf : Math.round(conf * 100);
                    if (normalizedConf >= 80) return { bg: 'bg-green-100', text: 'text-green-800', icon: '🟢' };
                    if (normalizedConf >= 60) return { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '🟡' };
                    return { bg: 'bg-red-100', text: 'text-red-800', icon: '🔴' };
                  };

                  const colors = getConfidenceColors(displayConfidence);

                  return (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Analysis Confidence</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-lg ${colors.icon}`}>
                            {(() => {
                              // Handle both decimal (0-1) and integer (0-100) formats
                              return displayConfidence > 1 ? `${displayConfidence}%` : `${Math.round(displayConfidence * 100)}%`
                            })()}
                          </span>
                          {showAIConfidence && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                              🤖 AI
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="w-full bg-gray-200 rounded-full h-4">
                        <div
                          className={`h-4 rounded-full transition-all duration-1000 ${
                            displayConfidence >= 80 ? 'bg-gradient-to-r from-green-400 to-green-600' :
                            displayConfidence >= 60 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                            'bg-gradient-to-r from-red-400 to-red-600'
                          }`}
                          style={{
                            width: (() => {
                              // Handle both decimal (0-1) and integer (0-100) formats
                              return displayConfidence > 1 ? `${displayConfidence}%` : `${Math.round(displayConfidence * 100)}%`
                            })()
                          }}
                        ></div>
                      </div>

                      {/* Confidence Source Indicator */}
                      <div className="flex justify-center mt-2 mb-2">
                        {showAIConfidence ? (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs font-medium">
                            🤖 AI-Enhanced Analysis
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-medium">
                            📊 Standard Analysis
                          </Badge>
                        )}
                      </div>

                      {/* Confidence Delta and Quality Indicator */}
                      <div className="flex flex-col gap-2">
                        {/* Confidence Delta */}
                        {showAIConfidence && confidenceDelta !== 0 && (
                          <div className="flex justify-center">
                            <Badge
                              variant="outline"
                              className={`text-xs font-medium ${
                                confidenceDelta > 0
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}
                            >
                              {confidenceDelta > 0 ? '↗️ AI Boost' : '↘️ AI Adjustment'}
                              <span className={`ml-1 ${confidenceDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {confidenceDelta > 0 ? '+' : ''}{confidenceDelta}%
                              </span>
                            </Badge>
                          </div>
                        )}

                        {/* Quality/Reliability Indicator */}
                        <div className="flex justify-center">
                          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                            displayConfidence >= 90 ? 'bg-green-100 text-green-800' :
                            displayConfidence >= 75 ? 'bg-yellow-100 text-yellow-800' :
                            displayConfidence >= 60 ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {displayConfidence >= 90 ? '🔥 High Reliability' :
                             displayConfidence >= 75 ? '⚡ Good Reliability' :
                             displayConfidence >= 60 ? '🟡 Moderate Reliability' :
                             '⚠️ Low Reliability'}
                          </div>
                        </div>
                      </div>

                      {/* Confidence Scale Labels */}
                      <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>Low</span>
                        <span>Medium</span>
                        <span>High</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* 🔍 AI ANALYSIS BANNER - BATCH COMPARISON LOGIC */}
            {result.aiAnalysis ? (() => {
              // Extract user input from result data or API response
              const userBatch = result.batchNumber || ''
              const userProduct = result.enhancedProductName || ''

              // Compare user's batch number with AI-detected batch numbers
              const batchMatch = userBatch && result.aiAnalysis!.batchNumbers.some(
                (aiBatch: string) => aiBatch.toUpperCase() === userBatch.toUpperCase()
              )

              // Compare product names (allow for some variation)
              const productMatch = userProduct && result.aiAnalysis!.productName &&
                userProduct.toLowerCase().includes(result.aiAnalysis!.productName.toLowerCase().split(' ')[0])

              // Determine which warning to show
              const showRedWarning = batchMatch && result.isCounterfeit
              const showYellowWarning = !batchMatch && productMatch && result.isCounterfeit && userBatch.trim() !== ''

              return (
                <>
                  {/* AI BANNER - BATCH COMPARISON WARNING */}
                  {showRedWarning && (
                    <div className="bg-red-100 border border-red-300 rounded-lg p-4 text-red-800 font-semibold mb-6">
                      🔴 FAKE/RECALL/EXPIRED PRODUCT DETECTED
                    </div>
                  )}

                  {showYellowWarning && (
                    <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4 text-yellow-800 font-semibold mb-6">
                      🟡 YOUR PRODUCT DIDN'T MATCH ALERT BATCH NUMBER; DO YOUR RESEARCH BEFORE CONSUMING
                    </div>
                  )}


                </>
              )
            })() : null}

            {/* FREE TIER WARNING BANNER - ABOVE DETECTION SUMMARY */}
            {(() => {
              // Show free tier warning only for non-AI users on unsafe products
              const showFreeWarning = result.isCounterfeit && !result.aiAnalysis
              const showSafeMessage = !result.isCounterfeit

              return (
                <>
                  {showFreeWarning && (
                    <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4 text-yellow-800 font-semibold mb-3">
                      ⚠️ WARNING: THIS PRODUCT MAY BE FAKE/RECALL/EXPIRED
                    </div>
                  )}

                  {showSafeMessage && (
                    <div className="bg-green-100 border border-green-300 rounded-lg p-4 text-green-800 font-semibold mb-3">
                      ✅ SAFE PRODUCT: NO FAKE/RECALL/EXPIRED ALERTS FOUND
                    </div>
                  )}
                </>
              )
            })()}

            {/* Analysis Details Cards */}
            <div className="space-y-6 mb-6">
              {/* Detection Summary */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    Detection Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-3 sm:p-4 w-full">
                    <h4 className="font-semibold mb-2 text-sm sm:text-base break-words">Analysis Result:</h4>
                    <div className="text-gray-700 leading-relaxed break-words overflow-wrap-anywhere">
                      {result.summary.split('\n\n### ').map((part, index) => {
                        if (index === 0) {
                          return <p key={index} className="text-sm sm:text-base leading-relaxed break-words overflow-wrap-anywhere">{part}</p>
                        }
                        const [heading, ...content] = part.split('\n\n')
                        return (
                          <div key={index}>
                            <h3 className="font-extrabold text-lg sm:text-xl mt-4 sm:mt-6 mb-3 break-words overflow-wrap-anywhere">{heading.replace(':', '')}:</h3>
                            <p className="text-sm sm:text-base leading-relaxed break-words overflow-wrap-anywhere">{content.join('\n\n')}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {result.batchNumber && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <h4 className="font-medium text-blue-800 mb-1">Batch Number:</h4>
                      <p className="font-mono text-blue-700 bg-blue-100 px-2 py-1 rounded inline-block">
                        {result.batchNumber}
                      </p>
                    </div>
                  )}

                  <div className="bg-purple-50 rounded-lg p-3">
                    <h4 className="font-medium text-purple-800 mb-1">Alert Type:</h4>
                    <Badge variant="outline" className="text-purple-700 border-purple-300">
                      {result.alertType}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* 🔍 AI ANALYSIS DISPLAY - PROMINENT TOP SECTION */}
              {result.aiAnalysis && (
                <Card className="border-2 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-purple-600 p-2 rounded-lg">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-7.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L7 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd"/>
                        </svg>
                      </div>
                      <h2 className="text-2xl font-bold text-purple-800">🤖 AI Enhanced Analysis</h2>
                      <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                        {(() => {
                          const conf = result.aiAnalysis.confidence ?? 0.8;
                          return conf > 1 ? `${conf}%` : `${Math.round(conf * 100)}%`
                        })()} confidence
                      </Badge>
                    </div>

                    {/* AI Product Analysis */}
                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                      <div className="bg-white rounded-lg p-4 shadow-sm border border-purple-200">
                        <h4 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>
                          </svg>
                          AI-Identified Product
                        </h4>
                        <p className="text-lg font-bold text-gray-800">{result.aiAnalysis.productName ?? 'Processing...'}</p>
                        <p className="text-sm text-gray-600 mt-1">Enhanced extraction from user input</p>
                      </div>

                      <div className="bg-white rounded-lg p-4 shadow-sm border border-purple-200">
                        <h4 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 12a1 1 0 01-1-1V5a1 1 0 012 0v6a1 1 0 01-1 1z"/>
                          </svg>
                          AI-Detected Batches
                        </h4>
                        {result.aiAnalysis.batchNumbers && result.aiAnalysis.batchNumbers.length > 0 ? (
                          <div className="space-y-1">
                            {result.aiAnalysis.batchNumbers.map((batch, index) => (
                              <div key={index} className="font-mono text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded inline-block mr-2 mb-1">
                                {batch}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500">No batch numbers detected</p>
                        )}
                      </div>
                    </div>

                    {/* AI Reason Analysis - Detailed Explanation */}
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-purple-200 mb-4">
                      <h4 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                        </svg>
                        AI Comparative Analysis
                      </h4>
                      <div className="text-gray-700 leading-relaxed">
                        {result.aiAnalysis.reason ?
                          result.aiAnalysis.reason.split('\n').map((line, index) => (
                            <p key={index} className="mb-2">{line}</p>
                          ))
                         : <p>AI analysis in progress...</p>
                        }
                      </div>
                    </div>

                    {/* AI Alert Type */}
                    <div className="flex justify-center">
                      <Badge variant="outline" className={`text-lg px-4 py-2 ${
                        result.aiAnalysis.alertType === 'FAKE' ? 'bg-red-100 text-red-800 border-red-300' :
                        result.aiAnalysis.alertType === 'RECALL' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                        result.aiAnalysis.alertType === 'EXPIRED' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                        'bg-green-100 text-green-800 border-green-300'
                      }`}>
                        🔍 AI Classification: {result.aiAnalysis.alertType ?? 'ANALYZING'}
                      </Badge>
                    </div>

                    {/* Separator */}
                    <div className="mt-6 pt-4 border-t border-purple-200 relative">
                      <div className="absolute inset-x-0 top-0 flex justify-center">
                        <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-full px-4 py-1 text-sm text-purple-800 font-medium">
                          🔸 Technical Summary below 🔸
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Technical Details */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-green-600" />
                    Technical Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-green-50 rounded-lg p-3">
                    <h4 className="font-medium text-green-800 mb-1">Data Source:</h4>
                    <p className="text-green-700 font-medium">{result.source}</p>
                    <a
                      href={result.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-800 text-sm underline"
                    >
                      🔗 View Original Source
                    </a>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <h4 className="font-medium text-gray-800 mb-1">Verification Method:</h4>
                    <p className="text-gray-700 text-sm">{result.verificationMethod}</p>
                  </div>

                  <div className="bg-cyan-50 rounded-lg p-3">
                    <h4 className="font-medium text-cyan-800 mb-1">Processing Timestamp:</h4>
                    <p className="text-cyan-700 font-mono text-sm">
                      {new Date(result.timestamp).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Account Information */}
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-center gap-4 text-center">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-sm">1 Point Used</span>
                </div>
                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {result.newBalance} points remaining
                  </Badge>
                </div>
                <div className="w-2 h-2 bg-gray-300 rounded-full hidden sm:block"></div>
                <div className="flex items-center gap-2 hidden sm:flex">
                  <Shield className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium">Security Enhanced</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="text-center space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/scan">
              <Button size="lg" className="w-full sm:w-auto">
                🔍 Scan Another Product
              </Button>
            </Link>
            <Link href="/search">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                📊 View All Results
              </Button>
            </Link>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
            <p className="text-blue-800 text-sm">
              <strong>🛡️ Verification Completed:</strong> This analysis was performed using our enterprise-grade counterfeit/recall/expired detection system with 22 optimized database indexes for lightning-fast verification. Our scanner utilize the official NAFDAC database.
            </p>
          </div>

          <div className="text-gray-500 text-sm">
            <p>Results are securely stored in your account for 30 days</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-4 sm:py-6 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-6 w-full">
            {/* Left Section: Logo and Brand */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Logo />
              <span className="text-sm sm:text-base font-bold text-white">Fake Detector</span>
            </div>

            {/* Center Section: Download Badges */}
            <div className="flex items-center gap-4 sm:gap-6">
              <button
                onClick={handleDownloadClick}
                className="transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              >
                <img
                  src="/Google%20play.png"
                  alt="Join Beta Program - Android"
                  className="h-16 sm:h-20 w-auto hover:opacity-90"
                />
              </button>

              <button
                onClick={handleDownloadClick}
                className="transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              >
                <img
                  src="/App%20Store.png"
                  alt="Join Beta Program - iOS"
                  className="h-16 sm:h-20 w-auto hover:opacity-90"
                />
              </button>
            </div>

            {/* Right Section: Database Info */}
            <div className="text-xs sm:text-sm text-gray-400 text-center lg:text-right">
              Utilize <strong className="text-blue-400">NAFDAC</strong> Official Database
            </div>
          </div>
        </div>
      </footer>

      {/* Beta Program Modal */}
      <BetaModal
        isOpen={isBetaModalOpen}
        onClose={() => setIsBetaModalOpen(false)}
      />
    </div>
  )
}
