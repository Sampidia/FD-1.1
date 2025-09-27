"use client"

import { Suspense, useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Logo from "@/components/ui/logo"
import { MobileHeader } from "@/components/ui/mobile-header"
import { BetaModal } from "@/components/ui/beta-modal"
import { Plus, ArrowLeft, Package, Shield } from "lucide-react"
import { BatchUploadForm } from "@/components/batch-upload/batch-upload-form"

interface ScanStats {
  pointsBalance: number
  canClaimDaily: boolean
}

interface UserPlan {
  planType: 'basic' | 'standard' | 'business'
  maxBatchSlots: number
}

// Loading component - Mobile Optimized
function BatchUploadFormSkeleton() {
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="animate-pulse space-y-6 sm:space-y-8">
        <div className="text-center px-4">
          <div className="h-6 sm:h-8 bg-gray-200 rounded w-2/3 sm:w-1/3 mx-auto mb-3 sm:mb-4"></div>
          <div className="h-3 sm:h-4 bg-gray-200 rounded w-full sm:w-1/2 mx-auto"></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
          ))}
        </div>

        <div className="px-4">
          <div className="h-12 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    </div>
  )
}

export default function BatchScanPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const isAuthenticated = status === "authenticated"
  const [stats, setStats] = useState<ScanStats>({
    pointsBalance: 0,
    canClaimDaily: false
  })
  const [userPlan, setUserPlan] = useState<UserPlan>({
    planType: 'basic',
    maxBatchSlots: 1
  })
  const [isBetaModalOpen, setIsBetaModalOpen] = useState(false)

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsBetaModalOpen(true)
  }

  // Fetch user balance and plan on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Fetch balance
        const balanceResponse = await fetch('/api/user/balance')
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json()
          if (balanceData.success) {
            setStats(prev => ({
              ...prev,
              pointsBalance: balanceData.data.pointsBalance,
              canClaimDaily: balanceData.data.canClaimDailyPoints
            }))
          }
        }

        // Fetch plan info
        const planResponse = await fetch('/api/user/plan')
        if (planResponse.ok) {
          const planData = await planResponse.json()
          if (planData.success) {
            const planInfo = planData.data

            // Determine plan type and slots
            let planType: UserPlan['planType'] = 'basic'
            let maxBatchSlots = 1

            if (planInfo.planBusinessPoints && planInfo.planBusinessPoints > 0) {
              planType = 'business'
              maxBatchSlots = 9 // Start with 5, can add up to 9
            } else if (planInfo.planStandardPoints && planInfo.planStandardPoints > 0) {
              planType = 'standard'
              maxBatchSlots = 3
            } else if (planInfo.planBasicPoints && planInfo.planBasicPoints > 0) {
              planType = 'basic'
              maxBatchSlots = 1
            }

            setUserPlan({
              planType,
              maxBatchSlots
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error)
      }
    }

    if (session) {
      fetchUserData()
    }
  }, [session])

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" }).catch(console.error)
  }

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <MobileHeader />
        <div className="flex items-center justify-center min-h-[70vh] px-4">
          <div className="text-center max-w-md mx-auto">
            <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm sm:text-base">Verifying your session...</p>
          </div>
        </div>
      </div>
    )
  }

  // STRICT AUTHENTICATION REQUIREMENT - Block unauthenticated users
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 px-4">
        <div className="text-center w-full max-w-md">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please sign in to access batch scanning.</p>
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

      {/* Back Button */}
      <div className="container mx-auto px-4 py-4">
        <Link href="/scan">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Single Scan
          </Button>
        </Link>
      </div>

      {/* Main Content */}
      <main className="flex-1">
        {/* Header with Plan Info */}
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold mb-4 gradient-text">Batch Product Scan</h1>
              <p className="text-gray-600 mb-4">Scan multiple products efficiently</p>

              {/* Plan Badge */}
              <div className="flex justify-center items-center gap-4 mb-4">
                <Badge variant="outline" className={`px-4 py-2 text-sm font-semibold ${
                  userPlan.planType === 'business' ? 'bg-purple-50 text-purple-700 border-purple-300' :
                  userPlan.planType === 'standard' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                  'bg-gray-50 text-gray-700 border-gray-300'
                }`}>
                  <Package className="w-4 h-4 mr-2" />
                  {userPlan.planType.charAt(0).toUpperCase() + userPlan.planType.slice(1)} Plan
                </Badge>
                <Badge variant="outline" className="px-4 py-2 text-sm">
                  Max {userPlan.maxBatchSlots} Products
                </Badge>
              </div>

              {/* Plan-specific messaging */}
              {userPlan.planType === 'business' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 max-w-2xl mx-auto">
                  <p className="text-purple-800 text-sm">
                    <strong>Business Plan:</strong> Start with 5 slots, add up to 9 total products
                  </p>
                </div>
              )}

              {userPlan.planType === 'standard' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
                  <p className="text-blue-800 text-sm">
                    <strong>Standard Plan:</strong> Scan up to 3 products per batch
                  </p>
                </div>
              )}

              {userPlan.planType === 'basic' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-2xl mx-auto">
                  <p className="text-yellow-800 text-sm">
                    <strong>Basic Plan:</strong> Upgrade to Standard or Business plan for batch scanning
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <Suspense fallback={<BatchUploadFormSkeleton />}>
          <BatchUploadForm
            userPlan={userPlan}
            userBalance={stats.pointsBalance}
          />
        </Suspense>
      </main>

      {/* Mobile-Optimized Footer */}
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
