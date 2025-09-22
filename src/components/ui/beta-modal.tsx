"use client"

import { useState } from "react"
import { X, CheckCircle, Smartphone, Apple, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface BetaModalProps {
  isOpen: boolean
  onClose: () => void
}

interface BetaFormData {
  name: string
  email: string
  platform: "android" | "ios" | "both"
  whatsapp: string
}

export function BetaModal({ isOpen, onClose }: BetaModalProps) {
  const [formData, setFormData] = useState<BetaFormData>({
    name: "",
    email: "",
    platform: "android",
    whatsapp: ""
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState("")

  const handleInputChange = (field: keyof BetaFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError("Please enter your name")
      return false
    }
    if (!formData.email.trim()) {
      setError("Please enter your email")
      return false
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address")
      return false
    }
    if (!formData.whatsapp.trim()) {
      setError("Please enter your WhatsApp number")
      return false
    }
    setError("")
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)
    setError("")

    try {
      const response = await fetch('/api/beta-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setIsSubmitted(true)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to submit. Please try again.')
      }
    } catch (err) {
      console.error('Beta signup error:', err)
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetModal = () => {
    setFormData({
      name: "",
      email: "",
      platform: "android",
      whatsapp: ""
    })
    setIsSubmitted(false)
    setError("")
    setIsSubmitting(false)
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {!isSubmitted ? (
          // Beta Signup Form
          <Card className="border-0 shadow-none">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-bold">Coming Soon</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="h-8 w-8 p-0 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-gray-600 text-sm mt-2">
                Join Beta Program and download Early App Version
              </p>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium">
                    Full Name *
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Enter your full name"
                    className="mt-1"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email Address *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("email", e.target.value)}
                    placeholder="your@email.com"
                    className="mt-1"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <Label htmlFor="platform" className="text-sm font-medium">
                    Platform *
                  </Label>
                  <Select
                    value={formData.platform}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleInputChange("platform", e.target.value)}
                    disabled={isSubmitting}
                    className="mt-1"
                  >
                    <SelectItem value="android">📱 Android Only</SelectItem>
                    <SelectItem value="ios">🍎 iOS Only</SelectItem>
                    <SelectItem value="both">📱🍎 Both Android & iOS</SelectItem>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="whatsapp" className="text-sm font-medium">
                    WhatsApp Number *
                  </Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    value={formData.whatsapp}
                    onChange={(e) => handleInputChange("whatsapp", e.target.value)}
                    placeholder="+234XXXXXXXXXX"
                    className="mt-1"
                    disabled={isSubmitting}
                  />
                </div>

                {error && (
                  <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md border border-red-200">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Join Beta Program"}
                </Button>
              </form>

              <p className="text-xs text-gray-500 text-center mt-4">
                * Required fields. We'll contact you via WhatsApp for app download instructions.
              </p>
            </CardContent>
          </Card>
        ) : (
          // Success Message
          <Card className="border-0 shadow-none">
            <CardContent className="text-center py-8">
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-16 h-16 text-green-500" />
              </div>
              <h2 className="text-xl font-bold mb-2 text-gray-900">
                Thanks for joining BETA program
              </h2>
              <p className="text-gray-600 mb-6">
                We will contact you on how to download the app.
              </p>
              <Button
                onClick={handleClose}
                className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600"
              >
                Got it!
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
