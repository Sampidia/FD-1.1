"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Logo from "@/components/ui/logo"
import { XCircle, ArrowLeft, RefreshCw, HelpCircle } from "lucide-react"

export default function PaymentFailurePage() {
  const searchParams = useSearchParams()

  const provider = searchParams.get('provider') || 'unknown'
  const reference = searchParams.get('reference') || searchParams.get('transaction_id') || 'unknown'
  const error = searchParams.get('error') || 'Unknown error'

  return (
    <div className="min-h-screen bg-red-50">
      <header className="bg-white border-b">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <Logo />
            Fake Detector
          </Link>
        </div>
      </header>

      <div className="container max-w-2xl mx-auto px-4 py-8">
        {/* Failure Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Payment Failed ❌
          </h1>

          <p className="text-lg text-gray-600">
            Unfortunately, your payment could not be processed.
          </p>
        </div>

        {/* Payment Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Provider</span>
              <span className="font-medium capitalize">{provider}</span>
            </div>

            {reference !== 'unknown' && (
              <div className="flex justify-between">
                <span className="text-gray-600">Reference</span>
                <span className="font-medium text-sm font-mono">{reference}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-gray-600">Error</span>
              <Badge variant="destructive" className="text-xs">
                {error.replace(/_/g, ' ').toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Recovery Steps */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>What to do next?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-red-700">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Check your payment method</p>
                  <p className="text-xs text-gray-600">Ensure you have sufficient funds and your card/bank details are correct.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-orange-700">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Try again</p>
                  <p className="text-xs text-gray-600">Return to checkout and attempt the payment again with a different method.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-700">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Contact support</p>
                  <p className="text-xs text-gray-600">If the problem persists, contact our support team for assistance.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="text-center space-y-4">
          <div className="flex justify-center gap-4">
            <Link href="/pricing">
              <Button className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Try Again
              </Button>
            </Link>

            <Link href="/">
              <Button variant="outline" className="flex items-center gap-2">
                Home
              </Button>
            </Link>
          </div>
        </div>

        {/* Contact Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Need help? {' '}
            <Link href="/contact" className="text-blue-600 hover:underline">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
