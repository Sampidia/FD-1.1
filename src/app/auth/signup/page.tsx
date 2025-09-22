"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Logo from "@/components/ui/logo"
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react"
import { signIn } from "next-auth/react"
import { useRecaptcha } from "@/hooks/use-recaptcha"

export default function SignUpPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const router = useRouter()

  // reCAPTCHA hook
  const { executeRecaptcha, resetRecaptcha, handleRecaptchaLoad } = useRecaptcha()

  // Initialize reCAPTCHA on mount
  useEffect(() => {
    handleRecaptchaLoad()
  }, [handleRecaptchaLoad])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Name is required"
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email"
    }

    if (!formData.password) {
      newErrors.password = "Password is required"
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters"
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    setErrors({})

    try {
      // Execute invisible reCAPTCHA
      const recaptchaToken = await executeRecaptcha()

      if (!recaptchaToken) {
        setErrors({ general: "reCAPTCHA verification failed. Please try again." })
        return
      }

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          recaptchaToken
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          setErrors({ email: data.error })
        } else {
          setErrors({ general: data.error })
        }
        // Reset reCAPTCHA on error
        resetRecaptcha()
        return
      }

      // Account created successfully
      setErrors({
        general: "Account created successfully! You can now sign in."
      })
      // Clear form and reset reCAPTCHA
      setFormData({
        name: "",
        email: "",
        password: "",
        confirmPassword: ""
      })
      resetRecaptcha()
    } catch (error: unknown) {
      console.error("Signup error:", error)
      setErrors({ general: "Network error. Please check your connection and try again." })
      resetRecaptcha()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-4 px-6 py-4 rounded-lg bg-white/80 hover:bg-white transition-all duration-300 hover:shadow-lg"
          >
            <Logo />
            <span className="text-xl font-bold text-gray-800">Fake Detector</span>
          </Link>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
            <p className="text-gray-600">Join to start verifying products</p>
          </CardHeader>

          <CardContent className="space-y-4">
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-red-800 text-sm">{errors.general}</p>
              </div>
            )}

            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className={errors.name ? "border-red-500" : ""}
                  placeholder="John Doe"
                  disabled={isLoading}
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className={errors.email ? "border-red-500" : ""}
                  placeholder="john@example.com"
                  disabled={isLoading}
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className={errors.password ? "border-red-500 pr-10" : "pr-10"}
                    placeholder="Minimum 6 characters"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                  className={errors.confirmPassword ? "border-red-500" : ""}
                  placeholder="Confirm your password"
                  disabled={isLoading}
                />
                {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 h-auto"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-3" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="w-full bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 h-auto"
              disabled={isLoading}
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="text-center pt-4 border-t">
              <p className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link href="/auth/signin" className="text-blue-600 hover:underline font-medium">
                  Sign in
                </Link>
              </p>
              <p className="text-sm text-gray-500 mt-4">
                By creating an account, you'll get <strong>5 daily points</strong> to start scanning products
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
