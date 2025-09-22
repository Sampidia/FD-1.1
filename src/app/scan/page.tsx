"use client"

import { Suspense, useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import "@/types/nextauth"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { UploadForm } from "@/components/product-upload/upload-form"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Logo from "@/components/ui/logo"
import { MobileHeader } from "@/components/ui/mobile-header"
import { BetaModal } from "@/components/ui/beta-modal"
import { Wallet, LogOut, LayoutGrid, Shield } from "lucide-react"

interface ScanStats {
  pointsBalance: number
  canClaimDaily: boolean
}

// Loading component - Mobile Optimized
function UploadFormSkeleton() {
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="animate-pulse space-y-6 sm:space-y-8">
        <div className="text-center px-4">
          <div className="h-6 sm:h-8 bg-gray-200 rounded w-2/3 sm:w-1/3 mx-auto mb-3 sm:mb-4"></div>
          <div className="h-3 sm:h-4 bg-gray-200 rounded w-full sm:w-1/2 mx-auto"></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-4">
          <div className="h-20 sm:h-24 bg-gray-200 rounded"></div>
          <div className="h-20 sm:h-24 bg-gray-200 rounded"></div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 px-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-square bg-gray-200 rounded-lg"></div>
          ))}
        </div>

        <div className="px-4">
          <div className="h-10 sm:h-12 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    </div>
  )
}

export default function ScanPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const isAuthenticated = status === "authenticated"
  const [stats, setStats] = useState<ScanStats>({
    pointsBalance: 0,
    canClaimDaily: false
  })
  const [isBetaModalOpen, setIsBetaModalOpen] = useState(false)

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsBetaModalOpen(true)
  }

  // Fetch user balance on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/user/balance')
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setStats(prev => ({
              ...prev,
              pointsBalance: data.data.pointsBalance,
              canClaimDaily: data.data.canClaimDailyPoints
            }))
          }
        }
      } catch (error) {
        console.error('Failed to fetch balance:', error)
      }
    }

    if (session) {
      fetchUserData()
    }
  }, [session])

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" }).catch(console.error)
  }

  useEffect(() => {
    const sessionUser = session?.user as any // Type assertion for custom properties
    console.log('🔍 ScanPage session status:', status)
    console.log('🔍 ScanPage session data:', session)
    console.log('🔍 User ID:', sessionUser?.id)
    console.log('🔍 User email:', session?.user?.email)
    console.log('🔍 User points balance:', sessionUser?.pointsBalance)

    // Log authentication status for debugging
    if (status === "unauthenticated") {
      console.log('❌ User not authenticated')
    } else if (status === "authenticated") {
      console.log('✅ User authenticated:', session?.user?.email)
    }
  }, [status, session])

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
          <p className="text-gray-600 mb-6">Please sign in to scan products.</p>
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
      {/* Mobile Hamburger Menu Header with Google Profile Avatar */}
      <MobileHeader />

      {/* Main Content */}
      <main className="flex-1">
        {/* Batch Scan Button */}
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-6">
              <Link href="/batch-scan">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  📦 Batch Scan Multiple Products
                </Button>
              </Link>
              <p className="text-sm text-gray-600 mt-2">
                Scan up to 9 products at once (plan dependent)
              </p>
            </div>
          </div>
        </div>

        <Suspense fallback={<UploadFormSkeleton />}>
          <UploadForm />
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
