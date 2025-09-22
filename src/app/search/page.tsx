"use client"

import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Logo from "@/components/ui/logo"
import { BetaModal } from "@/components/ui/beta-modal"
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Eye,
  Search,
  Calendar,
  Hash,
  Scan
} from "lucide-react"

interface ScanResult {
  id: string
  productName: string
  isCounterfeit: boolean
  confidence: number
  createdAt: string
  batchNumber?: string
  alertType: string
}

export default function SearchPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [results, setResults] = useState<ScanResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isBetaModalOpen, setIsBetaModalOpen] = useState(false)

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsBetaModalOpen(true)
  }

  useEffect(() => {
    if (session) {
      fetchAllScans()
    }
  }, [session])

  const fetchAllScans = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/user/recent-scans')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Remove the slice to show all results
          setResults(data.allScans || [])
        }
      } else {
        setError('Failed to load results')
      }
    } catch (err) {
      setError('Error loading results')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    router.push('/auth/signin')
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Logo />
              <Badge variant="secondary" className="text-xs">
                All Verification Results
              </Badge>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Your Verification History</h1>
                <p className="text-gray-600">
                  All your product verification results in one place
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">{results.length}</p>
                <p className="text-sm text-gray-500">Total Scans</p>
              </div>
            </div>
          </div>

          {/* Graphical Stats Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-6 text-center">Verification Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Verified Products Card */}
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Verified Products</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {results.filter(r => !r.isCounterfeit).length}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar for Verified Products */}
                  <div className="space-y-2">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-1000"
                        style={{
                          width: results.length > 0 ? `${(results.filter(r => !r.isCounterfeit).length / results.length) * 100}%` : '0%'
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0</span>
                      <span>{results.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Counterfeit Detection Card */}
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <XCircle className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Detected Counterfeit</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {results.filter(r => r.isCounterfeit).length}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar for Counterfeit */}
                  <div className="space-y-2">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-red-400 to-red-600 h-3 rounded-full transition-all duration-1000"
                        style={{
                          width: results.length > 0 ? `${(results.filter(r => r.isCounterfeit).length / results.length) * 100}%` : '0%'
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0</span>
                      <span>{results.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Average Confidence Card */}
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <Eye className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Average Confidence</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {results.length > 0
                            ? Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Circular Progress for Confidence */}
                  <div className="flex justify-center">
                    <div className="relative w-20 h-20">
                      <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#E5E7EB"
                          strokeWidth="2"
                        />
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke={results.length > 0 && Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length) >= 80 ? '#10B981' :
                                  results.length > 0 && Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length) >= 60 ? '#F59E0B' : '#EF4444'}
                          strokeWidth="2"
                          strokeDasharray={`${results.length > 0 ? (Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length) / 100) * 100 : 0}, 100`}
                          className="transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-lg font-bold ${
                          results.length > 0 && Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length) >= 80 ? 'text-green-600' :
                          results.length > 0 && Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length) >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {results.length > 0
                            ? Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length)
                            : 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-center mt-2">
                    <span className="text-xs text-gray-500">out of 100%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Results List */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-gray-200 rounded"></div>
                        <div>
                          <div className="w-48 h-4 bg-gray-200 rounded mb-1"></div>
                          <div className="w-32 h-3 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                      <div className="w-16 h-6 bg-gray-200 rounded"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card className="text-center p-8">
              <CardContent>
                <p className="text-gray-600">{error}</p>
                <Button onClick={fetchAllScans} className="mt-4">
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : results.length === 0 ? (
            <Card className="text-center p-12">
              <CardContent>
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No results yet</h3>
                <p className="text-gray-600 mb-6">Start your first product verification to see results here.</p>
                <Link href="/scan">
                  <Button>Start Scanning</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {results.map((result, index) => (
                <Card key={result.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    {/* Mobile: Vertical Stack Layout */}
                    <div className="block md:hidden space-y-3">
                      {/* Mobile Product Info */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {result.isCounterfeit ? (
                            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate text-base">
                            {result.productName}
                          </h3>
                          <span className="text-xs text-gray-500">#{index + 1}</span>
                        </div>
                      </div>

                      {/* Mobile Result Info */}
                      <div className="pl-8 space-y-2">
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span>Result ID: {result.id.slice(0, 8)}...</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <span>{new Date(result.createdAt).toLocaleDateString()}</span>
                        </div>

                        {/* Mobile Badge - Below Date */}
                        <div className="flex items-center">
                          {result.isCounterfeit ? (
                            <Badge variant="secondary" className="text-xs bg-red-50 text-red-700 border-red-200 w-full justify-center">
                              🔴 FAKE/RECALL/EXPIRED PRODUCT DETECTED
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200 w-full justify-center">
                              🔵 PRODUCT VERIFIED
                            </Badge>
                          )}
                        </div>

                        {/* Mobile Batch Number - Below Badge */}
                        {result.batchNumber && (
                          <div className="flex items-center text-sm text-gray-500">
                            <span>Batch: {result.batchNumber}</span>
                          </div>
                        )}

                        {/* Mobile Confidence and Eye Icon - Bottom */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                          <div className="text-center">
                            <div className={`text-lg font-bold ${
                              result.confidence >= 80 ? 'text-green-600' :
                              result.confidence >= 60 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {result.confidence}%
                            </div>
                            <div className="text-xs text-gray-400">Confidence</div>
                          </div>
                          <Link href={`/result/${result.id}`}>
                            <div className="p-2 hover:bg-gray-100 rounded-md transition-colors">
                              <Eye className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                            </div>
                          </Link>
                        </div>
                      </div>
                    </div>

                    {/* Desktop: Original Layout */}
                    <div className="hidden md:flex items-center justify-between">
                      <Link
                        href={`/result/${result.id}`}
                        className="flex items-center gap-4 flex-1 hover:bg-gray-50 -m-4 p-4 rounded transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {result.isCounterfeit ? (
                              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                            ) : (
                              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">
                                {result.productName}
                              </h3>
                              <span className="text-xs text-gray-500">#{index + 1}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(result.createdAt).toLocaleDateString()}</span>
                              </div>
                              {result.batchNumber && (
                                <div className="flex items-center gap-1">
                                  <Hash className="w-3 h-3" />
                                  <span>{result.batchNumber}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>

                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className={`text-sm font-bold ${
                            result.confidence >= 80 ? 'text-green-600' :
                            result.confidence >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {result.confidence}%
                          </div>
                          <div className="text-xs text-gray-400">Confidence</div>
                        </div>

                        <div className="flex items-center gap-2">
                          {result.isCounterfeit ? (
                            <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">
                              🔴 FAKE/RECALL/EXPIRED PRODUCT DETECTED
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                              🔵 PRODUCT VERIFIED
                            </Badge>
                          )}
                        </div>

                        <Link href={`/result/${result.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Start New Verification CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-700 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="mb-8">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Scan className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Ready to Verify Another Product?
              </h2>
              <p className="text-blue-100 text-lg">
                Protect yourself and your loved ones with our advanced product verification system
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/scan">
                <Button
                  size="lg"
                  className="bg-white text-blue-600 hover:bg-gray-100 font-semibold px-8 py-3 text-lg transition-all duration-200 hover:scale-105 shadow-lg"
                >
                  <Scan className="w-5 h-5 mr-2" />
                  Start New Verification
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white text-blue-600 hover:bg-white hover:text-blue-600 font-semibold px-8 py-3 text-lg transition-all duration-200"
                >
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

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
