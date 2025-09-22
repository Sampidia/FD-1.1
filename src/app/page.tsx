"use client"

import { useSession, signIn } from "next-auth/react"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MobileHeader } from "@/components/ui/mobile-header"
import Logo from "@/components/ui/logo"
import { Badge } from "@/components/ui/badge"
import { Scan, Shield, Users, Zap, CheckCircle } from "lucide-react"
import { BetaModal } from "@/components/ui/beta-modal"
import RecentAlertsSlider from "@/components/recent-alerts-slider"

export default function HomePage() {
  const { data: session, status } = useSession()
  const [isBetaModalOpen, setIsBetaModalOpen] = useState(false)

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsBetaModalOpen(true)
  }

  return (
    <div className="min-h-screen">
      {/* Mobile Header */}
      <MobileHeader showDashboardButton={true} />

      {/* Hero Section */}
      <section className="container px-4 py-20 md:py-32">
        <div className="flex flex-col items-center text-center space-y-8">
          <div className="space-y-4">
            <Badge variant="outline" className="text-sm font-medium">
              🔍 Product Verification Made Simple
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Verify Products,<br />
              <span className="text-blue-600">Protect Your Health</span>
            </h1>
            <p className="max-w-2xl text-lg text-gray-600 leading-relaxed">
              Scan and verify pharmaceutical products using NAFDAC's comprehensive database.
              Get instant results, earn rewards, and stay protected from counterfeit medications.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {status === "authenticated" ? (
              <Link href="/scan">
                <Button size="lg" className="text-lg px-8 py-6">
                  <Scan className="w-5 h-5 mr-2" />
                  Start Scanning
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/auth/signup">
                  <Button size="lg" className="text-lg px-8 py-6">
                    <Shield className="w-5 h-5 mr-2" />
                    Get Started Free
                  </Button>
                </Link>
                <Link href="/auth/signin">
                  <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-8 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span>Get <strong>5 free points</strong> when you sign up</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-500" />
              <span>Powered by <strong>NAFDAC</strong> database</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <span>Join <strong>10,000+</strong> users</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">How It Works</h2>
          <p className="text-lg text-gray-600">
            Simple, fast, and reliable product verification in just a few steps
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📱</span>
              </div>
              <CardTitle className="text-xl">1. Sign Up</CardTitle>
              <CardDescription>
                Create your account with Google or email and get 5 free points
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Quick registration with instant access to your dashboard
              </p>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔍</span>
              </div>
              <CardTitle className="text-xl">2. Scan Product</CardTitle>
              <CardDescription>
                Upload product photos and enter details for verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Our AI analyzes the product against NAFDAC's database
              </p>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✅</span>
              </div>
              <CardTitle className="text-xl">3. Get Results</CardTitle>
              <CardDescription>
                Instant verification with detailed authenticity reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Know immediately if your product is genuine or counterfeit
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container px-4 py-20">
        <Card className="bg-gradient-to-r from-blue-600 to-blue-800 text-white text-center">
          <CardContent className="py-16">
            <h2 className="text-3xl font-bold mb-4">Ready to Verify Your First Product?</h2>
            <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
              Join thousands of users who are already protecting themselves from counterfeit products.
              Start with 5 free points and upgrade anytime.
            </p>
            {status === "authenticated" ? (
              <Link href="/dashboard">
                <Button size="lg" variant="secondary" className="text-lg px-8">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth/signup">
                  <Button size="lg" className="text-lg px-8 bg-white text-blue-600 hover:bg-gray-100">
                    Start Free Today
                  </Button>
                </Link>
                <Link href="/auth/signin">
                  <Button size="lg" variant="outline" className="text-lg px-8 border-white text-blue-600 hover:bg-white hover:text-blue-600">
                    Sign In
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Recent Alerts Section */}
      <section className="container px-4 py-20 bg-gray-50">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 bg-red-50 text-red-700 border-red-200">
            🚨 Latest Alerts
          </Badge>
          <h2 className="text-3xl font-bold mb-4">Recent Product Alerts</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Stay informed about counterfeit and recalled products detected by our community.
            These alerts help protect consumers from harmful or fake medications.
          </p>
        </div>

        <RecentAlertsSlider />
      </section>

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
