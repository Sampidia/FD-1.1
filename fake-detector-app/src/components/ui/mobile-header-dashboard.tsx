"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Logo from "@/components/ui/logo"
import {
  LayoutGrid,
  LogOut,
  Menu,
  X,
  Wallet,
  Home,
  Camera,
  Search,
  User,
  MessageCircle,
  CreditCard,
  Facebook,
  Twitter,
  Instagram
} from "lucide-react"

interface MobileHeaderProps {
  showDashboardButton?: boolean
  showSearchButton?: boolean
  showBackToHome?: boolean
}

export function MobileHeader({
  showDashboardButton = true,
  showSearchButton = false,
  showBackToHome = false
}: MobileHeaderProps) {
  const { data: session, status } = useSession()
  const isAuthenticated = status === "authenticated"
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [totalPoints, setTotalPoints] = useState<number>(0)
  const [pointsLoading, setPointsLoading] = useState(false)

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" }).catch(console.error)
  }

  // Fetch user's total available points
  useEffect(() => {
    const fetchUserPoints = async () => {
      if (!isAuthenticated) return

      try {
        setPointsLoading(true)
        const response = await fetch('/api/user/balance')
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setTotalPoints(data.data.totalAvailablePoints || 0)
          }
        }
      } catch (error) {
        console.error('Failed to fetch user points:', error)
        // Fallback to session pointsBalance if API fails
        const sessionUser = session?.user as any // Type assertion for custom properties
        setTotalPoints(sessionUser?.pointsBalance || 0)
      } finally {
        setPointsLoading(false)
      }
    }

    fetchUserPoints()
  }, [isAuthenticated, session])

  return (
    <header className="bg-white shadow-sm border-b relative">
      {/* Main Header */}
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left Side */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Logo />
              <span className="text-lg font-bold text-gray-900">Fake Detector</span>
            </Link>
          </div>

          {/* Right Side - User Actions */}
          <div className="flex items-center gap-2">
            {/* Points Display */}
            {isAuthenticated && (
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-full">
                <Wallet className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold">
                  {pointsLoading ? '...' : totalPoints}
                </span>
                <span className="text-xs text-blue-600">pts</span>
              </div>
            )}

            {/* Google Profile Avatar - Now on Right */}
            {isAuthenticated && session.user?.image && (
              <img
                src={session.user.image}
                alt={`${session.user.name}'s profile`}
                className="w-6 sm:w-8 h-6 sm:h-8 rounded-full border-2 border-blue-300 hover:border-blue-400 transition-colors"
                title={`Welcome, ${session.user.name}`}
              />
            )}

            {/* Welcome Message (Desktop only) */}
            {isAuthenticated && (
              <span className="hidden sm:inline-block text-sm font-medium text-gray-900 truncate max-w-[120px]">
                Welcome, {session.user?.name || session.user?.email}!
              </span>
            )}

            {/* Hamburger Menu */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="h-8 w-8 p-0"
            >
              {isMenuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <div className={`fixed inset-0 z-50 bg-black bg-opacity-50 transition-opacity ${
        isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <div className={`fixed top-0 right-0 h-full w-64 bg-white shadow-xl transform transition-transform ${
          isMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
          <div className="p-6">
            {/* Drawer Header with Brand */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                {/* Logo and Brand */}
                <Link href="/" className="flex items-center gap-2" onClick={() => setIsMenuOpen(false)}>
                  <Logo />
                  <span className="text-base font-semibold text-gray-900">Fake Detector</span>
                </Link>
              </div>

              {/* Close Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMenuOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* User Info */}
            {isAuthenticated ? (
              <div className="mb-6 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm font-medium text-gray-900 mb-1">
                  {session.user?.name || session.user?.email}
                </div>
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold">
                    {pointsLoading ? '...' : totalPoints} points
                  </span>
                </div>
              </div>
            ) : null}

            {/* Navigation Links */}
            <div className="space-y-2">
              <Link href="/" onClick={() => setIsMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start h-10">
                  <Home className="w-4 h-4 mr-3" />
                  Home
                </Button>
              </Link>

              {isAuthenticated ? (
                <>
                  <Link href="/scan" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start h-10">
                      <Camera className="w-4 h-4 mr-3" />
                      Scan Product
                    </Button>
                  </Link>

                  <Link href="/dashboard" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start h-10">
                      <LayoutGrid className="w-4 h-4 mr-3" />
                      Dashboard
                    </Button>
                  </Link>

                  <Link href="/pricing" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start h-10">
                      <CreditCard className="w-4 h-4 mr-3" />
                      Pricing
                    </Button>
                  </Link>

                  {showSearchButton && (
                    <Link href="/search" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start h-10">
                        <Search className="w-4 h-4 mr-3" />
                        Search Results
                      </Button>
                    </Link>
                  )}

                  <hr className="my-4 border-gray-200" />

                  <Link href="/contact" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start h-10">
                      <MessageCircle className="w-4 h-4 mr-3" />
                      Contact Us
                    </Button>
                  </Link>

                  <Button
                    variant="ghost"
                    onClick={() => {
                      handleSignOut()
                      setIsMenuOpen(false)
                    }}
                    className="w-full justify-start h-10 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/pricing" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start h-10">
                      <CreditCard className="w-4 h-4 mr-3" />
                      Pricing
                    </Button>
                  </Link>

                  <Link href="/auth/signin" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start h-10">
                      <User className="w-4 h-4 mr-3" />
                      Sign In
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Brand Footer */}
            <div className="mt-8 pt-4 border-t border-gray-200 text-center space-y-3">
              <div className="text-xs text-gray-500">
                Utilize NAFDAC Official Database
              </div>
              {/* Social Media Icons */}
              <div className="flex justify-center gap-4">
                <a href="https://www.facebook.com/share/1K8Xn4efku/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href="https://mobile.x.com/detect1fake" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400 transition-colors">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="https://www.instagram.com/detect1fake?igsh=cTVpNXVoc2FwcnQw" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-pink-500 transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
