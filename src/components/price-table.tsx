"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Zap, Crown, Star } from "lucide-react"
import { PaymentService } from "@/services/payment-service"

// Initialize payment service
const paymentService = new PaymentService()

interface Plan {
  id: 'basic' | 'standard' | 'business'
  name: string
  displayName: string
  aiProvider: string
  pricePerPoint: number
  description: string
  features: string[]
  monthlyScans: number
  monthlyAIRequests: number
  icon: React.ReactNode
  popular?: boolean
}

const plans: Plan[] = [
  {
    id: 'basic',
    name: 'basic',
    displayName: 'Basic Plan',
    aiProvider: 'Google Gemini',
    pricePerPoint: parseInt(process.env.NEXT_PUBLIC_BASIC_POINTS_PRICE || '75'),
    description: 'Perfect for individual users getting started with product verification',
    features: [
      '🌟 Google Gemini AI Detection',
      '📱 Mobile-optimized scanning',
      '📊 Basic analytics',
      '⚡ Fast verification (15-5secs)',
      '🎯 Utilize NAFDAC Database'
    ],
    monthlyScans: 50,
    monthlyAIRequests: 100,
    icon: <Zap className="w-5 h-5 text-blue-600" />,
  },
  {
    id: 'standard',
    name: 'standard',
    displayName: 'Standard Plan',
    aiProvider: 'Anthropic Claude',
    pricePerPoint: parseInt(process.env.NEXT_PUBLIC_STANDARD_POINTS_PRICE || '100'),
    description: 'For businesses needing reliable counterfeit detection with advanced AI',
    features: [
      '🤖 Anthropic Claude AI Detection',
      '⚛️ Gemini fallback support',
      '📊 Advanced analytics',
      '⚡ Ultra-fast verification (6-4secs)',
      '🎯 Priority NAFDAC scanning',
      '📱 Enhanced mobile features',
      '🔄 Batch processing'
    ],
    monthlyScans: 200,
    monthlyAIRequests: 500,
    popular: true,
    icon: <Star className="w-5 h-5 text-purple-600" />,
  },
  {
    id: 'business',
    name: 'business',
    displayName: 'Business Plan',
    aiProvider: 'OpenAI GPT-4',
    pricePerPoint: parseInt(process.env.NEXT_PUBLIC_BUSINESS_POINTS_PRICE || '130'),
    description: 'Enterprise-grade counterfeit detection with the most powerful AI',
    features: [
      '🚀 OpenAI GPT-4 AI Detection',
      '🤖 Claude fallback support',
      '⚛️ Gemini backup integration',
      '📊 Enterprise analytics',
      '⚡ Lightning-fast verification (3-2secs)',
      '🎯 Premium NAFDAC scanning',
      '🔄 Advanced batch processing',
      '👨‍💼 Priority customer support'
    ],
    monthlyScans: 1000,
    monthlyAIRequests: 2000,
    icon: <Crown className="w-5 h-5 text-gold-600" />,
  }
]

interface PriceTableProps {
  showUpgradeButtons?: boolean
  currentPlan?: string | null
  excludePlans?: string[]
  upgradeMode?: boolean
}

export default function PriceTable({
  showUpgradeButtons = true,
  currentPlan = null,
  excludePlans = [],
  upgradeMode = false
}: PriceTableProps) {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [isUpgrading, setIsUpgrading] = useState(false)

  const handleUpgradeClick = async (planId: string) => {
    setSelectedPlan(planId)
    setIsUpgrading(true)

    try {
      // Navigate to checkout page for the selected plan
      router.push(`/checkout/${planId}`)
    } catch (error) {
      console.error('Navigation error:', error)
      alert('There was an error navigating to checkout. Please try again.')
    } finally {
      setIsUpgrading(false)
      setSelectedPlan(null)
    }
  }

  const getPricing = () => {
    return paymentService.getPlanPricing()
  }

  const pricing = getPricing()

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Choose Your AI Detection Plan
        </h2>
        <p className="text-xl text-gray-600 mb-8">
          Pay only for the AI points you use. All plans include free daily scanning.
        </p>

        {/* Plan Overview Cards */}
        <div className={`grid gap-6 mb-12 ${
          upgradeMode || excludePlans.length > 0
            ? 'grid-cols-1 md:grid-cols-2'  // 2 columns when filtering
            : 'grid-cols-1 md:grid-cols-3'   // 3 columns normally
        }`}>
          {plans
            .filter(plan => {
              // Exclude plans that are in the excludePlans array
              if (excludePlans.includes(plan.id) || excludePlans.includes(plan.name)) {
                return false
              }
              // In upgrade mode, exclude the current plan
              if (upgradeMode && currentPlan === plan.name) {
                return false
              }
              return true
            })
            .map((plan) => (
            <Card
              key={plan.id}
              className={`relative transition-all duration-300 ${
                plan.popular
                  ? 'scale-105 border-2 border-blue-500 shadow-xl'
                  : 'hover:shadow-lg hover:scale-[1.02]'
              } ${currentPlan === plan.name ? 'ring-2 ring-green-500' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-600 text-white px-4 py-1 text-sm font-semibold">
                    MOST POPULAR
                  </Badge>
                </div>
              )}

              {currentPlan === plan.name && (
                <div className="absolute -top-4 right-4">
                  <Badge variant="secondary" className="bg-green-600 text-white">
                    CURRENT PLAN
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-3">
                  {plan.icon}
                </div>
                <CardTitle className="text-xl mb-2">{plan.displayName}</CardTitle>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-gray-900">
                    ₦{plan.pricePerPoint}
                    <span className="text-sm font-normal text-gray-600"> per point</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {plan.aiProvider}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <p className="text-sm text-gray-600 mb-6">{plan.description}</p>

                {/* Plan Limits */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Monthly Scans:</span>
                    <strong>{plan.monthlyScans}</strong>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Monthly AI Requests:</span>
                    <strong>{plan.monthlyAIRequests}</strong>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-2 mb-6">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Action Button */}
                {showUpgradeButtons && (
                  <Button
                    onClick={() => handleUpgradeClick(plan.id)}
                    disabled={isUpgrading && selectedPlan === plan.id}
                    className={`w-full ${
                      plan.popular
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-900 hover:bg-gray-800 text-white'
                    } disabled:opacity-50`}
                    size="lg"
                  >
                    {isUpgrading && selectedPlan === plan.id ? (
                      'Processing...'
                    ) : currentPlan === plan.name ? (
                      'Current Plan'
                    ) : (
                      `Get ${plan.displayName}`
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Information */}
        <div className="bg-blue-50 rounded-xl p-6 text-left">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">💰 How Points Work</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">✨ Free Daily Points</h4>
              <p className="text-sm text-gray-700 mb-4">
                All plans include <strong>5 free points daily</strong> for product verification.
                Points reset at midnight every day.
              </p>

              <h4 className="font-medium text-gray-900 mb-2">💳 Pay-as-You-Go</h4>
              <p className="text-sm text-gray-700">
                Simply buy more points when needed. Payonly for what you use with
                Paystack or Flutterwave integration.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">🔄 Plan Flexibility</h4>
              <p className="text-sm text-gray-700 mb-4">
                Upgrade or change plans anytime. Higher-tier plans give you better AI
                intelligence and priority processing.
              </p>

              <h4 className="font-medium text-gray-900 mb-2">🎯 Usage Examples</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Basic scan: 1 point</li>
                <li>• Detailed analysis: 2 points</li>
                <li>• Batch processing: 3-5 points</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
