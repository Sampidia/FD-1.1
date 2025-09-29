"use client"

import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Logo from "@/components/ui/logo"
import {
  ArrowLeft,
  CreditCard,
  CheckCircle,
  XCircle,
  Calendar,
  DollarSign,
  Clock,
  ExternalLink,
  Receipt,
  Trash2
} from "lucide-react"

interface TransactionDetail {
  id: string
  transactionId: string
  amount: number
  currency: string
  status: string
  pointsPurchased?: number
  planTier: string
  paymentGateway: string
  gatewayResponse?: Record<string, unknown>
  processedAt?: string
  pointsAddedTo?: string
  createdAt: string
}

export default function TransactionDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { transactionId } = useParams() as { transactionId: string }

  const [transaction, setTransaction] = useState<TransactionDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session && transactionId) {
      fetchTransactionDetail()
    }
  }, [session, transactionId])

  const fetchTransactionDetail = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/transaction/${transactionId}`)
      const data = await response.json()

      if (response.ok && data.success) {
        setTransaction(data.transaction)
      } else {
        setError(data.message || 'Failed to load transaction details')
      }
    } catch (err) {
      setError('Error loading transaction details')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading transaction details...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    router.push('/auth/signin')
    return null
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading transaction...</p>
        </div>
      </div>
    )
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <header className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Logo />
                <Badge variant="secondary" className="text-xs">
                  Transaction Details
                </Badge>
              </div>
              <Link href="/transactions">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Transactions
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card className="text-center p-8">
              <CardContent>
                <Receipt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Transaction Not Found</h3>
                <p className="text-gray-600 mb-6">{error || 'This transaction does not exist or you do not have access to view it.'}</p>
                <Link href="/transactions">
                  <Button>View All Transactions</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-500" />
      case 'failed':
        return <XCircle className="w-6 h-6 text-red-500" />
      default:
        return <Clock className="w-6 h-6 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200'
      default:
        return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    }
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
                Transaction Details
              </Badge>
            </div>
            <Link href="/transactions">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Transactions
              </Button>
            </Link>
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
                <h1 className="text-3xl font-bold mb-2">Transaction Details</h1>
                <p className="text-gray-600">
                  Detailed information about this transaction
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  {getStatusIcon(transaction.status)}
                  <Badge variant="secondary" className={getStatusColor(transaction.status)}>
                    {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Details Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Transaction Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <span className="text-gray-600 font-medium">Transaction ID:</span>
                  <div className="flex-1 min-w-0 max-w-full">
                    <div className="font-mono text-sm bg-gray-100 px-3 py-2 rounded-lg border overflow-x-auto whitespace-nowrap break-all">
                      {transaction.transactionId}
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(transaction.transactionId)}
                      className="mt-1 text-xs text-blue-600 hover:text-blue-800 md:hidden"
                    >
                      Tap to copy
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-semibold text-lg">
                    ₦{transaction.amount.toLocaleString()} {transaction.currency}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Plan Tier:</span>
                  <Badge variant="outline">
                    {transaction.planTier} Plan
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Payment Gateway:</span>
                  <span className="font-medium">{transaction.paymentGateway}</span>
                </div>
                {transaction.pointsPurchased && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Points Purchased:</span>
                    <span className="font-semibold text-green-600">
                      {transaction.pointsPurchased.toLocaleString()} points
                    </span>
                  </div>
                )}
                {transaction.pointsAddedTo && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Added to Balance:</span>
                    <span className="text-sm text-gray-500">{transaction.pointsAddedTo}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timeline & Dates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium">
                    {new Date(transaction.createdAt).toLocaleString()}
                  </span>
                </div>
                {transaction.processedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Processed:</span>
                    <span className="font-medium">
                      {new Date(transaction.processedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Status:</span>
                  <Badge variant="secondary" className={getStatusColor(transaction.status)}>
                    {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gateway Response (if available) */}
          {transaction.gatewayResponse && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="w-5 h-5" />
                  Gateway Response
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
                  {JSON.stringify(transaction.gatewayResponse, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Mobile Action Buttons - Main actions */}
          <div className="mt-8 md:hidden">
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/transactions" className="flex-1">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Transactions
                </Button>
              </Link>
              <Link href="/dashboard" className="flex-1">
                <Button variant="outline" className="w-full">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
            <Link href="/pricing" className="block mt-3">
              <Button className="w-full">
                Purchase More Points
              </Button>
            </Link>
          </div>

          {/* Desktop Action Buttons */}
          <div className="mt-8 hidden md:flex gap-4">
            <Link href="/transactions">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Transactions
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline">
                Go to Dashboard
              </Button>
            </Link>
            <Link href="/pricing">
              <Button>
                Purchase More Points
              </Button>
            </Link>
          </div>

          {/* Delete Transaction Button - Bottom only */}
          {(transaction.status === 'failed' || transaction.status === 'cancelled') && (
            <div className="fixed bottom-20 left-4 right-4 md:static md:bottom-auto md:left-auto md:right-auto md:mt-8">
              <Button
                variant="destructive"
                className="w-full md:w-auto shadow-lg md:shadow-none"
                onClick={() => {
                  if (confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
                    // TODO: Implement delete transaction API
                    alert('Delete transaction functionality would be implemented here');
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Transaction
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-4 sm:py-6 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-6 w-full">
            <div className="flex items-center gap-2 sm:gap-3">
              <Logo />
              <span className="text-sm sm:text-base font-bold text-white">Fake Detector</span>
            </div>
            <div className="text-xs sm:text-sm text-gray-400 text-center lg:text-right">
              Secure transaction processing • Protected by industry standards
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
