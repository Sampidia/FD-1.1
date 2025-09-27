"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Logo from "@/components/ui/logo"
import { CheckCircle, ArrowRight, Home, Receipt, Zap } from "lucide-react"
import { useSession } from "next-auth/react"

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Get payment details from URL params
  const provider = searchParams.get('provider') || 'unknown'
  const reference = searchParams.get('reference') || searchParams.get('transaction_id') || 'unknown'
  const amount = searchParams.get('amount') || '0'
  const points = searchParams.get('points') || ''

  // Auto-redirect back to dashboard after 30 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsRedirecting(true)
      if (session) {
        router.push('/dashboard')
      } else {
        router.push('/')
      }
    }, 30000) // 30 seconds

    return () => clearTimeout(timer)
  }, [session, router])

  const formatAmount = (amount: string) => {
    const numAmount = parseInt(amount)
    return `₦${numAmount.toLocaleString()}`
  }

  return (
    <div className="min-h-screen bg-green-50">
      <header className="bg-white border-b">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <Logo />
            Fake Detector
          </Link>

          <div className="flex items-center gap-4">
            {session ? (
              <Link href="/dashboard">
                <Button>Go to Dashboard</Button>
              </Link>
            ) : (
              <Link href="/auth/signin">
                <Button variant="outline">Sign In</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="container max-w-4xl mx-auto px-4 py-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Payment Successful! 🎉
          </h1>

          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Thank you for your purchase! Your {provider === 'paystack' ? 'Paystack' : 'Flutterwave'} payment has been processed successfully.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Payment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Provider</span>
                <span className="font-medium capitalize">{provider}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Reference</span>
                <span className="font-medium text-sm font-mono">{reference}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Amount Paid</span>
                <span className="font-bold text-lg text-green-600">
                  {formatAmount(amount)}
                </span>
              </div>

              {points && (
                <div className="flex justify-between">
                  <span className="text-gray-600">AI Points Added</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    {points} points
                  </Badge>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <Badge className="bg-green-500 text-white">
                  ✅ Completed
                </Badge>
              </div>

              <div className="pt-4 border-t">
                <div className="text-sm text-gray-500 text-center">
                  Paid on {new Date().toLocaleDateString()} at {' '}
                  {new Date().toLocaleTimeString()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-600" />
                  Start Using Your Points
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Your points have been added to your account. Here's what you can do next:
                </p>

                {points && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-purple-600" />
                      <span className="font-medium text-purple-700">
                        {points} AI Detection Points Added
                      </span>
                    </div>
                    <p className="text-xs text-purple-600">
                      Use these points for product verification scans powered by AI.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Link href="/scan">
                    <Button className="w-full" size="sm">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Scan a Product Now
                    </Button>
                  </Link>

                  <Link href="/dashboard">
                    <Button variant="outline" className="w-full" size="sm">
                      <Home className="w-4 h-4 mr-2" />
                      View Dashboard
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* What's Next */}
            <Card>
              <CardHeader>
                <CardTitle>What happens next?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-green-700">1</span>
                  </div>
                  <p>Your points are instantly available for AI-powered product verification</p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-700">2</span>
                  </div>
                  <p>Use advanced artificial intelligence to detect fake and counterfeit products</p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-purple-700">3</span>
                  </div>
                  <p>Get detailed reports with authenticity scores and NAFDAC verification</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Auto-redirect Notice */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-blue-700 mb-2">
                <strong>Redirecting automatically...</strong>
              </p>
              <p className="text-xs text-blue-600">
                You'll be taken to your dashboard in 30 seconds, or you can click the buttons above to continue.
              </p>

              {isRedirecting && (
                <div className="mt-3 flex justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Questions about your purchase? {' '}
            <Link href="/contact" className="text-blue-600 hover:underline">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
