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
  CreditCard,
  Eye,
  CheckCircle,
  XCircle,
  Calendar,
  DollarSign
} from "lucide-react"

interface Transaction {
  id: string
  transactionId: string
  amount: number
  currency: string
  status: string
  pointsPurchased?: number
  planTier: string
  paymentGateway: string
  createdAt: string
}

export default function TransactionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isBetaModalOpen, setIsBetaModalOpen] = useState(false)

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsBetaModalOpen(true)
  }

  useEffect(() => {
    if (session) {
      fetchAllTransactions()
    }
  }, [session])

  const fetchAllTransactions = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/user/transactions')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setTransactions(data.transactions || [])
        }
      } else {
        setError('Failed to load transactions')
      }
    } catch (err) {
      setError('Error loading transactions')
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

  const totalSpent = transactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0)

  const completedTransactions = transactions.filter(t => t.status === 'completed').length
  const pendingTransactions = transactions.filter(t => t.status === 'pending').length
  const failedTransactions = transactions.filter(t => t.status === 'failed').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Logo />
              <Badge variant="secondary" className="text-xs">
                All Payment Transactions
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
                <h1 className="text-3xl font-bold mb-2">Your Payment History</h1>
                <p className="text-gray-600">
                  All your payment transactions in one place
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">{transactions.length}</p>
                <p className="text-sm text-gray-500">Total Transactions</p>
              </div>
            </div>
          </div>

          {/* Graphical Stats Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-6 text-center">Transaction Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Spent Card */}
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Spent</p>
                        <p className="text-2xl font-bold text-gray-900">
                          ₦{totalSpent.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Completed Transactions Card */}
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Completed</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {completedTransactions}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pending/Failed Card */}
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Pending/Failed</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {pendingTransactions + failedTransactions}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Transactions List */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-gray-200 rounded"></div>
                        <div>
                          <div className="w-32 h-4 bg-gray-200 rounded mb-1"></div>
                          <div className="w-24 h-3 bg-gray-200 rounded"></div>
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
                <Button onClick={fetchAllTransactions} className="mt-4">
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : transactions.length === 0 ? (
            <Card className="text-center p-12">
              <CardContent>
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No transactions yet</h3>
                <p className="text-gray-600 mb-6">Your payment history will appear here.</p>
                <Link href="/pricing">
                  <Button>Purchase Points</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction, index) => (
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
                                <Calendar className="w-3 h-3" />
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