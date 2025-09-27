"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Logo from "@/components/ui/logo"
import { AlertTriangle, ArrowLeft, HelpCircle } from "lucide-react"

export default function PaymentErrorPage() {
  const searchParams = useSearchParams()

  const provider = searchParams.get('provider') || 'unknown'
  const error = searchParams.get('error') || 'Unknown error'

  return (
    <div className="min-h-screen bg-yellow-50">
      <header className="bg-white border-b">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <Logo />
            Fake Detector
          </Link>
        </div>
      </header>

      <div className="container max-w-2xl mx-auto px-4 py-8">
        {/* Error Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
            <AlertTriangle className="w-10 h-10 text-yellow-600" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Payment Error ⚠️
          </h1>

          <p className="text-lg text-gray-600">
            There was an issue processing your {provider} payment.
          </p>
        </div>

        {/* Error Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              Error Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {provider !== 'unknown' && (
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Provider</span>
                <span className="font-medium capitalize">{provider}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-gray-600">Error Type</span>
              <Badge variant="outline" className="text-xs border-yellow-600 text-yellow-700">
                {error.replace(/_/g, ' ').toUpperCase()}
              </Badge>
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

          <div className="pt-4">
            <Link href="/contact">
              <Button variant="ghost" size="sm" className="flex items-center gap-2 mx-auto">
                <HelpCircle className="w-4 h-4" />
                Get Support
              </Button>
            </Link>
          </div>
        </div>

        {/* Contact Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Need help? Our support team is here to assist you.
          </p>
        </div>
      </div>
    </div>
  )
}
