"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import "@/types/nextauth"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Logo from "@/components/ui/logo"
import { MobileHeader } from "@/components/ui/mobile-header-dashboard"
import { BetaModal } from "@/components/ui/beta-modal"
import {
  CreditCard,
  Download,
  LayoutGrid,
  LogOut,
  Plus,
  Settings,
  Shield,
  Wallet,
  History,
  CheckCircle,
  XCircle,
  Eye
} from "lucide-react"

interface DashboardStats {
  totalScans: number
  genuineProducts: number
  counterfeitDetected: number
  pointsBalance: number
  canClaimDaily: boolean
  totalSpent: number
}

interface ScanHistory {
  id: string
  productCheckId: string
  productName: string
  isCounterfeit: boolean
  confidence: number
  createdAt: string
  batchNumber?: string
  alertType: string
}

interface RecentPayment {
  id: string
  transactionId: string
  amount: number
  currency: string
  status: string
  planTier: string
  planDisplayName: string
  createdAt: string
  paymentGateway: string
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalScans: 0,
    genuineProducts: 0,
    counterfeitDetected: 0,
    pointsBalance: 5,
    canClaimDaily: true,
    totalSpent: 0
  })
  const [recentScans, setRecentScans] = useState<ScanHistory[]>([])
  const [scansLoading, setScansLoading] = useState(false)
  const [recentTransactions, setRecentTransactions] = useState<RecentPayment[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [isBetaModalOpen, setIsBetaModalOpen] = useState(false)

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsBetaModalOpen(true)
  }

  // Fetch user balance and recent scans on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/user/balance')
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setStats(prev => ({
              ...prev,
              pointsBalance: data.data.totalAvailablePoints || data.data.pointsBalance,
              canClaimDaily: data.data.canClaimDailyPoints
            }))
          }
        }
      } catch (error) {
        console.error('Failed to fetch balance:', error)
      }
    }

    const fetchRecentScans = async () => {
      setScansLoading(true)
      try {
        const response = await fetch('/api/user/recent-scans')
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setRecentScans(data.scans.slice(0, 5)) // Show only 5 most recent
            // Update stats based on recent data
            const totalScans = data.scans.length
            const genuineProduct = data.scans.filter((s: any) => !s.isCounterfeit).length
            const counterfeitCount = data.scans.filter((s: any) => s.isCounterfeit).length

            setStats(prev => ({
              ...prev,
              totalScans,
              genuineProducts: genuineProduct,
              counterfeitDetected: counterfeitCount
            }))
          }
        }
      } catch (error) {
        console.error('Failed to fetch recent scans:', error)
      } finally {
        setScansLoading(false)
      }
    }

    const fetchRecentTransactions = async () => {
      setTransactionsLoading(true)
      try {
        const response = await fetch('/api/user/transactions')
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setRecentTransactions(data.transactions.slice(0, 5)) // Show only 5 most recent
          }
        }
      } catch (error) {
        console.error('Failed to fetch recent transactions:', error)
      } finally {
        setTransactionsLoading(false)
      }
    }

    if (session) {
      fetchUserData()
      fetchRecentScans()
      fetchRecentTransactions()
    }
  }, [session])

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const claimDailyPoints = async () => {
    try {
      const response = await fetch('/api/daily-points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (result.success) {
        setStats(prev => ({
          ...prev,
          pointsBalance: result.newBalance,
          canClaimDaily: false
        }))
        alert(`Daily points claimed! You now have ${result.newBalance} points.`)
      } else {
        alert(result.message || 'Failed to claim daily points')
      }
    } catch (error) {
      alert('An error occurred while claiming points')
    }
  }

  const getAccountType = () => {
    const sessionUser = session?.user as any // Type assertion to bypass TypeScript strict checking
    if (sessionUser?.planBusinessPoints && sessionUser.planBusinessPoints > 0) {
      return 'Business'
    } else if (sessionUser?.planStandardPoints && sessionUser.planStandardPoints > 0) {
      return 'Standard'
    } else if (sessionUser?.planBasicPoints && sessionUser.planBasicPoints > 0) {
      return 'Basic'
    } else {
      return 'Free'
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please sign in to access your dashboard.</p>
          <Link href="/auth/signin">
            <Button className="w-full max-w-xs">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Mobile Hamburger Menu Header */}
      <MobileHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Scans</p>
                  <p className="text-2xl font-bold">{stats.totalScans}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-xl">✓</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Genuine Products</p>
                  <p className="text-2xl font-bold">{stats.genuineProducts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-xl">⚠</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Counterfeit Detected</p>
                  <p className="text-2xl font-bold">{stats.counterfeitDetected}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Points Balance</p>
                  <p className="text-2xl font-bold">{stats.pointsBalance}</p>
                </div>
              </div>
 
            </CardContent>
          </Card>
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Scan New Product */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Scan New Product
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                Upload photos from all angles to verify product authenticity with NAFDAC database.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Camera ready</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm">4-zone upload</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span className="text-sm">NAFDAC verified</span>
                </div>
              </div>

              <Link href="/scan">
                <Button className="w-full mt-4 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 hover:bg-blue-600 hover:border-blue-600">
                  <Plus className="w-4 h-4 mr-2 transition-transform duration-300 hover:rotate-90" />
                  Start New Scan
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Daily Points */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Daily Points
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats.canClaimDaily ? (
                <div className="mb-1">
                  <p className="text-gray-600">You haven't claimed today's daily points yet!</p>
                </div>
              ) : (
                <div>
                  <p className="text-gray-600">Daily points already claimed</p>
                  <p className="text-sm text-gray-500">Come back tomorrow for 5 more points.</p>
                </div>
              )}
<div className="pt-1">
                <div className="flex justify-between text-sm">
                  <span>Current Balance:</span>
                  <span className="font-semibold">{stats.pointsBalance} points</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span>Cost per scan:</span>
                  <span>1 point</span>
                </div>
                {stats.canClaimDaily && (
                  <Button onClick={claimDailyPoints} className="w-full mt-4 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-amber-500/25 hover:bg-amber-600 hover:border-amber-600">
                    <Download className="w-4 h-4 mr-2 transition-transform duration-300 hover:translate-y-1" />
                    Claim 5 Free Points
                  </Button>
                )}
              </div>
 
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Recent Activity
            </CardTitle>
            {stats.totalScans > 3 && (
              <Link href="/search">
                <Button
                  variant="outline"
                  size="sm"
                  className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-300 hover:shadow-sm"
                >
                  <Eye className="w-4 h-4 mr-2 transition-transform duration-300 hover:scale-110" />
                  View All
                </Button>
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {scansLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex items-center justify-between p-4 border rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-200 rounded"></div>
                      <div>
                        <div className="w-32 h-4 bg-gray-200 rounded mb-1"></div>
                        <div className="w-24 h-3 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                    <div className="w-16 h-4 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : stats.totalScans === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <LayoutGrid className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="font-semibold mb-2">No scans yet</h3>
                <p className="text-gray-600 mb-4">Start your first product verification!</p>
                <Link href="/scan">
                  <Button>Verify Your First Product</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentScans.map((scan) => (
                  <div key={scan.productCheckId} className="p-4 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors">
                    {/* Mobile: Vertical Stack Layout */}
                    <div className="block md:hidden space-y-3">
                      {/* Mobile Product Info */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {scan.isCounterfeit ? (
                            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate text-base">
                            {scan.productName}
                          </h4>
                        </div>
                      </div>

                      {/* Mobile Result Info */}
                      <div className="pl-8 space-y-2">
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span>Result ID: {scan.productCheckId.slice(0, 8)}...</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <span>{new Date(scan.createdAt).toLocaleDateString()}</span>
                        </div>

                        {/* Mobile Badge - Below Date */}
                        <div className="flex items-center">
                          {scan.isCounterfeit ? (
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
                        {scan.batchNumber && (
                          <div className="flex items-center text-sm text-gray-500">
                            <span>Batch: {scan.batchNumber}</span>
                          </div>
                        )}

                        {/* Mobile Confidence and Eye Icon - Bottom */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                          <div className="text-center">
                            <div className={`text-lg font-bold ${
                              scan.confidence >= 80 ? 'text-green-600' :
                              scan.confidence >= 60 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {scan.confidence}%
                            </div>
                            <div className="text-xs text-gray-400">Confidence</div>
                          </div>
                          <Link href={`/result/${scan.id}`}>
                            <div className="p-2 hover:bg-gray-100 rounded-md transition-colors">
                              <Eye className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                            </div>
                          </Link>
                        </div>
                      </div>
                    </div>

                    {/* Desktop: Original Layout */}
                    <div className="hidden md:flex items-center justify-between">
                      <Link href={`/result/${scan.id}`} className="flex items-center gap-3 flex-1">
                        <div className="flex items-center gap-2">
                          {scan.isCounterfeit ? (
                            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900 truncate">
                              {scan.productName}
                            </h4>
                            {scan.isCounterfeit ? (
                              <Badge variant="secondary" className="text-xs bg-red-50 text-red-700 border-red-200">
                                🔴 FAKE/RECALL/EXPIRED PRODUCT DETECTED
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200">
                                🔵 PRODUCT VERIFIED
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span>Result ID: {scan.productCheckId.slice(0, 8)}...</span>
                            <span>•</span>
                            <span>{new Date(scan.createdAt).toLocaleDateString()}</span>
                            {scan.batchNumber && (
                              <>
                                <span>•</span>
                                <span>Batch: {scan.batchNumber}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </Link>

                      <div className="flex items-center gap-2 ml-4">
                        <div className="text-center">
                          <div className={`text-lg font-bold ${
                            scan.confidence >= 80 ? 'text-green-600' :
                            scan.confidence >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {scan.confidence}%
                          </div>
                          <div className="text-xs text-gray-400">Confidence</div>
                        </div>
                        <Link href={`/result/${scan.id}`}>
                          <div className="p-2 hover:bg-gray-100 rounded-md transition-colors">
                            <Eye className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-pointer" />
                          </div>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}

                {/* View More CTA */}
                {stats.totalScans > 3 && (
                  <div className="text-center pt-4 border-t border-gray-100">
                    <Link href="/search">
                      <Button variant="outline" className="w-full">
                        <Eye className="w-4 h-4 mr-2" />
                        View All Results
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="mt-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Recent Transactions
            </CardTitle>
            {recentTransactions.length > 0 && (
              <Link href="/transactions">
                <Button
                  variant="outline"
                  size="sm"
                  className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-300 hover:shadow-sm"
                >
                  <Eye className="w-4 h-4 mr-2 transition-transform duration-300 hover:scale-110" />
                  View All
                </Button>
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex items-center justify-between p-4 border rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-gray-200 rounded"></div>
                      <div>
                        <div className="w-32 h-4 bg-gray-200 rounded mb-1"></div>
                        <div className="w-24 h-3 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                    <div className="w-16 h-6 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="font-semibold mb-2">No transactions yet</h3>
                <p className="text-gray-600 mb-4">Your payment history will appear here.</p>
                <Link href="/pricing">
                  <Button>Purchase Points</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentTransactions.map((transaction, index) => (
                  <Link key={transaction.id} href={`/transaction/${transaction.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-6">
                      {/* Mobile: Vertical Stack Layout */}
                      <div className="block md:hidden space-y-3">
                        {/* Mobile Transaction Info */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {transaction.status === 'completed' ? (
                              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                            ) : transaction.status === 'failed' ? (
                              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                            ) : (
                              <CreditCard className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate text-base">
                              ₦{transaction.amount.toLocaleString()} - {transaction.planTier} Plan
                            </h3>
                            <span className="text-xs text-gray-500">#{index + 1}</span>
                          </div>
                        </div>

                        {/* Mobile Transaction Details */}
                        <div className="pl-8 space-y-2">
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span>TXN: {transaction.transactionId.slice(0, 12)}...</span>
                          </div>
                          <div className="flex items-center text-sm text-gray-500">
                            <span>{new Date(transaction.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {transaction.status === 'completed' ? (
                              <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200">
                                ✅ Completed
                              </Badge>
                            ) : transaction.status === 'failed' ? (
                              <Badge variant="secondary" className="text-xs bg-red-50 text-red-700 border-red-200">
                                ❌ Failed
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                                ⏳ Pending
                              </Badge>
                            )}
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Desktop: Horizontal Layout */}
                      <div className="hidden md:flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              {transaction.status === 'completed' ? (
                                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                              ) : transaction.status === 'failed' ? (
                                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                              ) : (
                                <CreditCard className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-gray-900">
                                  ₦{transaction.amount.toLocaleString()} - {transaction.planTier} Plan
                                </h3>
                                <span className="text-xs text-gray-500">#{index + 1}</span>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-gray-600">
                                <div className="flex items-center gap-1">
                                  <span>{new Date(transaction.createdAt).toLocaleDateString()}</span>
                                </div>
                                <span>•</span>
                                <span>TXN: {transaction.transactionId.slice(0, 12)}...</span>
                                <span>•</span>
                                <span>{transaction.paymentGateway}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {transaction.status === 'completed' ? (
                            <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                              ✅ Completed
                            </Badge>
                          ) : transaction.status === 'failed' ? (
                            <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">
                              ❌ Failed
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                              ⏳ Pending
                            </Badge>
                          )}
                          <Button variant="outline" size="sm" className="ml-2">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  </Link>
                ))}
              </div>
            )}

               {/* View All Transactions */}
               <div className="text-center pt-4 border-t border-gray-100">
                 <Link href="/transactions">
                   <Button variant="outline" className="w-full">
                     <Eye className="w-4 h-4 mr-2" />
                     View All Transactions
                   </Button>
                 </Link>
               </div>
          </CardContent>
        </Card>

        {/* Account Status */}
        <div className="mt-8 text-center">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-2">Account Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Email:</span>
                <p className="font-medium">{session.user?.email}</p>
              </div>
              <div>
                <span className="text-gray-600">Member since:</span>
                <p className="font-medium">
                  {(session.user as any)?.createdAt
                    ? new Date((session.user as any).createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                    : 'Today'
                  }
                </p>
              </div>
              <div>
                <span className="text-gray-600">Account type:</span>
                <Badge variant="secondary">{getAccountType()}</Badge>
              </div>
            </div>
          </div>
        </div>
      </main>

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
