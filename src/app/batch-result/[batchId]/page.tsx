"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MobileHeader } from "@/components/ui/mobile-header"
import { BetaModal } from "@/components/ui/beta-modal"
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Shield,
  Eye,
  Package,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react"

interface ScanResult {
  isCounterfeit: boolean
  confidence: number
  summary: string
  resultId?: string
  // Add other properties that might be present in the result
  [key: string]: unknown
}

interface BatchScanResult {
  batchId: string
  totalScans: number
  successfulScans: number
  failedScans: number
  results: Array<{
    slotId: string
    result?: ScanResult
    error?: string
    success: boolean
    // ✅ NEW: Input data contains original OCR/product details for display
    input?: {
      productName: string
      userBatchNumber: string
      ocrConfidence: number
    }
  }>
  createdAt: string
}

interface PageProps {
  params: {
    batchId: string
  }
}

export default function BatchResultPage({ params }: PageProps) {
  const { batchId } = params
  const router = useRouter()
  const [batchResult, setBatchResult] = useState<BatchScanResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())
  const [isBetaModalOpen, setIsBetaModalOpen] = useState(false)

  useEffect(() => {
    const loadBatchResult = () => {
      try {
        const storedResult = localStorage.getItem(`batch-result-${batchId}`)
        if (storedResult) {
          const parsedResult = JSON.parse(storedResult)
          console.log(`📊 [BATCH RESULT] Loaded batch data for ${batchId}:`, {
            total: parsedResult.totalScans,
            successful: parsedResult.successfulScans,
            resultsLength: parsedResult.results?.length
          })

          // 🔍 DEBUG: Log the first result's structure
          if (parsedResult.results && parsedResult.results.length > 0) {
            const firstResult = parsedResult.results[0]
            console.log(`🔍 [DEBUG] First result structure:`, {
              slotId: firstResult.slotId,
              success: firstResult.success,
              hasResult: !!firstResult.result,
              resultKeys: firstResult.result ? Object.keys(firstResult.result) : [],
              sampleResultData: firstResult.result ? JSON.stringify(firstResult.result).slice(0, 200) + '...' : null
            })
          }

          setBatchResult(parsedResult)
        } else {
          console.warn(`⚠️ [BATCH RESULT] No stored result found for ${batchId}`)
          setError("Batch result not found. It may have expired.")
        }
      } catch (err) {
        console.error(`❌ [BATCH RESULT] Failed to load result for ${batchId}:`, err)
        setError("Failed to load batch result.")
      } finally {
        setIsLoading(false)
      }
    }

    if (batchId) {
      loadBatchResult()
    }
  }, [batchId])

  const toggleResultExpansion = (slotId: string) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev)
      if (newSet.has(slotId)) {
        newSet.delete(slotId)
      } else {
        newSet.add(slotId)
      }
      return newSet
    })
  }

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsBetaModalOpen(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <MobileHeader />
        <div className="flex items-center justify-center min-h-[70vh] px-4">
          <div className="text-center max-w-md mx-auto">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm">Loading batch results...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !batchResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <MobileHeader />
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-md mx-auto text-center">
            <CardHeader>
              <CardTitle>Batch Result Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-6">
                {error || "The batch result you're looking for doesn't exist or has expired."}
              </p>
              <div className="space-y-3">
                <Link href="/batch-scan">
                  <Button className="w-full">
                    Start New Batch Scan
                  </Button>
                </Link>
                <Link href="/scan">
                  <Button variant="outline" className="w-full">
                    Single Product Scan
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const successRate = batchResult.totalScans > 0
    ? Math.round((batchResult.successfulScans / batchResult.totalScans) * 100)
    : 0

  const genuineProducts = batchResult.results.filter((r: BatchScanResult['results'][0]) =>
    r.success && r.result?.isCounterfeit === false
  ).length

  const counterfeitProducts = batchResult.results.filter((r: BatchScanResult['results'][0]) =>
    r.success && r.result?.isCounterfeit === true
  ).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <MobileHeader />

      {/* Back Button */}
      <div className="container mx-auto px-4 py-4">
        <Link href="/batch-scan">
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Batch Scan
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4 gradient-text">Batch Scan Results</h1>
          <p className="text-gray-600">Batch ID: <code className="px-2 py-1 bg-gray-100 rounded text-sm">{batchId}</code></p>
          <p className="text-sm text-gray-500 mt-2">
            Completed on {new Date(batchResult.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Scans</p>
                  <p className="text-2xl font-bold">{batchResult.totalScans}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Successful</p>
                  <p className="text-2xl font-bold text-green-600">{batchResult.successfulScans}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{batchResult.failedScans}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  successRate >= 80 ? 'bg-green-100' :
                  successRate >= 60 ? 'bg-yellow-100' : 'bg-red-100'
                }`}>
                  {successRate >= 80 ? (
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  ) : successRate >= 60 ? (
                    <Minus className="w-6 h-6 text-yellow-600" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Success Rate</p>
                  <p className={`text-2xl font-bold ${
                    successRate >= 80 ? 'text-green-600' :
                    successRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {successRate}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Product Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Genuine Products</p>
                  <p className="text-2xl font-bold text-green-600">{genuineProducts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Counterfeit Detected</p>
                  <p className="text-2xl font-bold text-red-600">{counterfeitProducts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Individual Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Individual Scan Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {batchResult.results.map((scanResult, index) => (
                <div key={scanResult.slotId} className="border border-gray-200 rounded-lg">
                  {/* Result Header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleResultExpansion(scanResult.slotId)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {scanResult.success ? (
                          scanResult.result?.isCounterfeit ? (
                            <XCircle className="w-5 h-5 text-red-500" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          )
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium">Product {index + 1}</h4>
                        <p className="text-sm text-gray-500">
                          {scanResult.success ? (
                            scanResult.result?.isCounterfeit ? 'Counterfeit detected' : 'Product verified'
                          ) : 'Scan failed'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {scanResult.success && scanResult.result && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(scanResult.result.confidence || 0)}% confidence
                        </Badge>
                      )}
                      {expandedResults.has(scanResult.slotId) ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Result Details */}
                  {expandedResults.has(scanResult.slotId) && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      {scanResult.success && scanResult.result ? (
                        <div className="mt-4 space-y-4">
                          {/* Product Info */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h5 className="font-medium mb-2">Product Information</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Product Name:</span>
                                {/* 🔍 DEBUG: Show debug info first */}
                                <p className="font-medium">
                                  {scanResult.input?.productName ||
                                   '❌ N/A (Input data not available - check debug console)'
                                  }
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-600">Batch Number:</span>
                                <p className="font-medium font-mono">
                                  {scanResult.input?.userBatchNumber ||
                                   '❌ N/A (Input data not available - check debug console)'
                                  }
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Scan Result */}
                          <div className={`rounded-lg p-4 ${
                            scanResult.result.isCounterfeit
                              ? 'bg-red-50 border border-red-200'
                              : 'bg-green-50 border border-green-200'
                          }`}>
                            <div className="flex items-center gap-2 mb-2">
                              {scanResult.result.isCounterfeit ? (
                                <>
                                  <XCircle className="w-4 h-4 text-red-600" />
                                  <span className="font-medium text-red-800">Counterfeit/Recall/Expired Product Detected</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                  <span className="font-medium text-green-800">Product Verified - Genuine</span>
                                </>
                              )}
                            </div>
                            <p className="text-sm text-gray-700">{scanResult.result.summary}</p>
                          </div>

                          {/* Confidence Meter */}
                          <div className="bg-blue-50 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium">Analysis Confidence</span>
                              <span className="font-bold">
                                {Math.round(scanResult.result.confidence || 0)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-1000 ${
                                  (scanResult.result.confidence || 0) >= 80 ? 'bg-green-500' :
                                  (scanResult.result.confidence || 0) >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(scanResult.result.confidence || 0, 100)}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* View Full Result Button */}
                          {scanResult.result.resultId && (
                            <div className="text-center">
                              <Link href={`/result/${scanResult.result.resultId}`}>
                                <Button variant="outline" size="sm">
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Full Result
                                </Button>
                              </Link>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-4">
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-center gap-2">
                              <XCircle className="w-4 h-4 text-red-600" />
                              <span className="font-medium text-red-800">Scan Failed</span>
                            </div>
                            <p className="text-sm text-red-700 mt-1">{scanResult.error}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="text-center space-y-4 mt-8">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/batch-scan">
              <Button size="lg">
                🔄 Start New Batch Scan
              </Button>
            </Link>
            <Link href="/scan">
              <Button variant="outline" size="lg">
                📱 Single Product Scan
              </Button>
            </Link>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
            <p className="text-blue-800 text-sm">
              <strong>📊 Batch Processing Complete:</strong> All results have been securely stored in your account.
              You can revisit these results anytime from your dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-4 sm:py-6 px-4 mt-12">
        <div className="container mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-6 w-full">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-sm sm:text-base font-bold text-white">Fake Detector</div>
            </div>
            <div className="text-xs sm:text-sm text-gray-400 text-center lg:text-right">
              Batch processing powered by NAFDAC database
            </div>
          </div>
        </div>
      </footer>

      <BetaModal
        isOpen={isBetaModalOpen}
        onClose={() => setIsBetaModalOpen(false)}
      />
    </div>
  )
}
