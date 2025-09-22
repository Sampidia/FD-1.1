"use client"

import { useSession } from "next-auth/react"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import Logo from "@/components/ui/logo"
import PriceTable from "@/components/price-table"
import { BetaModal } from "@/components/ui/beta-modal"
import { ChevronLeft } from "lucide-react"

export default function PricingPage() {
  const { data: session } = useSession()
  const [isBetaModalOpen, setIsBetaModalOpen] = useState(false)

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsBetaModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-xl"
          >
            <Logo />
            Fake Detector
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" className="flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" />
                Back to Home
              </Button>
            </Link>

            {session ? (
              <Link href="/dashboard">
                <Button>Go to Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/auth/signin">
                  <Button variant="ghost">Sign in</Button>
                </Link>
                <Link href="/auth/signup">
                  <Button>Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8">
        <div className="container px-4 mx-auto max-w-7xl">
          {/* Breadcrumb */}
          <nav className="flex mb-8" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-3">
              <li className="inline-flex items-center">
                <Link
                  href="/"
                  className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600"
                >
                  Home
                </Link>
              </li>
              <li>
                <div className="flex items-center">
                  <span className="mx-1 text-gray-400">/</span>
                  <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2">
                    Pricing Plans
                  </span>
                </div>
              </li>
            </ol>
          </nav>

          {/* Page Title */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Choose Your Perfect Plan
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Select the AI detection plan that best fits your verification needs.
              All plans include free daily points and NAFDAC integration.
            </p>
          </div>

          {/* Pricing Table */}
          <PriceTable
            showUpgradeButtons={true}
            currentPlan={null} // TODO: Implement dynamic current plan from API
          />

          {/* FAQ Section */}
          <section className="mt-16 bg-white rounded-xl shadow-sm border p-8">
            <h2 className="text-2xl font-bold text-center mb-8 text-gray-900">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6 max-w-3xl mx-auto">
              <div>
                <h3 className="text-lg font-semibold mb-2">What are AI Detection Points?</h3>
                <p className="text-gray-600">
                  Each scan consumes AI detection points. Different plans offer different AI intelligence
                  (Google Gemini, Anthropic Claude, or OpenAI GPT) with varying costs per point.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Do I get free points every day?</h3>
                <p className="text-gray-600">
                  Yes! All plans include 5 free daily points that reset every 24 hours. Premium plans
                  offer more capabilities and better AI processing.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Can I change plans anytime?</h3>
                <p className="text-gray-600">
                  Absolutely! You can upgrade to a higher-tier plan at any time. Your remaining points
                  will remain valid, and you'll have access to better AI immediately.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">What's included in each plan?</h3>
                <p className="text-gray-600">
                  Each plan includes a different AI provider, varying monthly scan limits, different
                  response times, and dedicated customer support levels.
                </p>
              </div>
            </div>
          </section>
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
