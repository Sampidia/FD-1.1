"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import Logo from "@/components/ui/logo"
import { BetaModal } from "@/components/ui/beta-modal"
import { Separator } from "@/components/ui/separator"
import {
  Check,
  Star,
  CreditCard,
  ArrowLeft,
  Shield,
  Lock,
  Phone,
  Banknote,
  Smartphone
} from "lucide-react"
import { PaymentService } from "@/services/payment-service"

const paymentService = new PaymentService()

type PaymentMethod = 'paystack' | 'flutterwave'

export default function StandardCheckoutPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('paystack')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string>('')
  const [pointsToBuy, setPointsToBuy] = useState(200) // Default 200 points for standard plan
  const [isBetaModalOpen, setIsBetaModalOpen] = useState(false)

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsBetaModalOpen(true)
  }

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`)
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const planData = {
    id: 'standard',
    name: 'Standard Plan',
    aiProvider: 'Anthropic Claude',
    pricePerPoint: parseInt(process.env.NEXT_PUBLIC_STANDARD_POINTS_PRICE || '100'),
    description: 'For businesses needing reliable counterfeit detection with advanced AI',
    features: [
      '🤖 Anthropic Claude AI Detection',
      '⚛️ Google Gemini fallback support',
      '📊 Advanced analytics',
      '⚡ Ultra-fast verification (6-4secs)',
      '🎯 Priority NAFDAC scanning',
      '📱 Enhanced mobile features',
      '🔄 Batch processing'
    ],
    monthlyScans: 200,
    monthlyAIRequests: 500,
    icon: Star,
    color: 'purple'
  }

  const totalAmount = paymentService.calculatePointsAmountForPlan(pointsToBuy, 'standard')
  const discountRate = (1 - (planData.pricePerPoint / 100)) * 100

  const handlePayment = async () => {
    if (!session.user?.email || !session.user?.name) {
      setError('Please update your profile with name and email')
      return
    }

    setIsProcessing(true)
    setError('')

    try {
      const paymentData = {
        amount: totalAmount,
        email: session.user.email,
        name: session.user.name,
        phone: '',
        pointsCount: pointsToBuy,
        planId: 'standard'
      }

      // Call our server-side API instead of client-side payment service
      const apiEndpoint = selectedMethod === 'paystack'
        ? '/api/payments/paystack/initialize'
        : '/api/payments/flutterwave/initialize'

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      })

      const result = await response.json()

      if (result.success && result.paymentUrl) {
        // Store payment details in localStorage for callback handling
        localStorage.setItem('paymentMethod', selectedMethod)
        localStorage.setItem('pointsToBuy', pointsToBuy.toString())
        localStorage.setItem('totalAmount', totalAmount.toString())
        localStorage.setItem('planId', 'standard')

        // Redirect to payment gateway
        window.location.href = result.paymentUrl
      } else {
        setError(result.error || 'Payment initialization failed')
      }
    } catch (error) {
      console.error('Payment error:', error)
      setError('Failed to initialize payment. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/pricing" className="flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" />
            Back to Pricing
          </Link>

          <Link href="/" className="flex items-center gap-2 font-bold">
            <Logo />
            Fake Detector
          </Link>

          <div className="flex items-center gap-4">
            {session ? (
              <Link href="/dashboard">
                <Button>Dashboard</Button>
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <Badge variant="outline" className="mb-4">
            ⭐ Upgrade to Premium AI Detection
          </Badge>
          <h1 className="text-3xl font-bold text-gray-900">
            Complete Your Standard Plan Purchase
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            Get advanced Claude AI verification with priority processing and batch support
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-purple-100">
                    <Star className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-xl">{planData.name}</h3>
                    <p className="text-sm font-normal text-gray-600">{planData.aiProvider}</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Monthly Scans</div>
                    <div className="text-2xl font-bold">{planData.monthlyScans}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Monthly Requests</div>
                    <div className="text-2xl font-bold">{planData.monthlyAIRequests}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {planData.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Select AI Detection Points</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[100, 200, 400].map((points) => (
                    <button
                      key={points}
                      onClick={() => setPointsToBuy(points)}
                      className={`p-4 border-2 rounded-lg text-center transition-colors ${
                        pointsToBuy === points
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-bold text-lg">{points}</div>
                      <div className="text-sm text-gray-600">points</div>
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  value={pointsToBuy}
                  onChange={(e) => setPointsToBuy(Math.max(10, Number(e.target.value)))}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="Custom amount"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Choose Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={selectedMethod}
                  onValueChange={(value: string) => setSelectedMethod(value as PaymentMethod)}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer">
                    <RadioGroupItem value="paystack" id="paystack" />
                    <Label htmlFor="paystack" className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Paystack</div>
                          <div className="text-sm text-gray-600 flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <CreditCard className="w-4 h-4" /> Card
                            </span>
                            <span className="flex items-center gap-1">
                              <Banknote className="w-4 h-4" /> Bank Transfer
                            </span>
                            <span className="flex items-center gap-1">
                              <Smartphone className="w-4 h-4" /> Mobile Money
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="mb-1">Most Popular</Badge>
                          <div className="text-sm text-gray-600">1.5% fee</div>
                        </div>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-purple-300 cursor-pointer">
                    <RadioGroupItem value="flutterwave" id="flutterwave" />
                    <Label htmlFor="flutterwave" className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Flutterwave</div>
                          <div className="text-sm text-gray-600 flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <CreditCard className="w-4 h-4" /> Card
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="w-4 h-4" /> USSD
                            </span>
                            <span className="flex items-center gap-1">
                              <Banknote className="w-4 h-4" /> Bank Transfer
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">2.0% fee</div>
                        </div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>AI Detection Points</span>
                  <span>{pointsToBuy} points</span>
                </div>

                <div className="flex justify-between">
                  <span>Price per point</span>
                  <span>₦{planData.pricePerPoint}</span>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>₦{totalAmount.toLocaleString()}</span>
                </div>

                <Button
                  onClick={handlePayment}
                  disabled={isProcessing}
                  className="w-full mt-6 h-12 bg-purple-600 hover:bg-purple-700"
                  size="lg"
                >
                  {isProcessing ? (
                    'Processing...'
                  ) : (
                    <>
                      <Lock className="mr-2 w-4 h-4" />
                      Pay with {selectedMethod === 'paystack' ? 'Paystack' : 'Flutterwave'}
                    </>
                  )}
                </Button>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700">
                      <Shield className="w-4 h-4" />
                      <span className="text-sm">{error}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <Shield className="w-4 h-4" />
                  <span>Secure checkout with SSL encryption</span>
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <p>• Your payment information is secure and encrypted</p>
                  <p>• Points will be added to your account instantly</p>
                  <p>• Cancel anytime, no hidden fees</p>
                  <p>• 24/7 priority customer support included</p>
                </div>
              </CardContent>
            </Card>
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
