"use client"

import { useState, useEffect } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Logo from "@/components/ui/logo"
import { AlertTriangle, Loader2, Eye, EyeOff } from "lucide-react"
import { Turnstile } from "@marsidev/react-turnstile"
import { useRecaptcha } from "@/hooks/use-recaptcha"

export default function SignInPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  })
  const { data: session, status } = useSession()
  const router = useRouter()

  // Turnstile hook
  const { executeRecaptcha, resetRecaptcha, handleSuccess, handleError, getSiteKey } = useRecaptcha()

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard")
    }
  }, [status, router])



  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // Execute invisible reCAPTCHA
      const recaptchaToken = await executeRecaptcha()

      if (!recaptchaToken) {
        setError("reCAPTCHA verification failed. Please try again.")
        resetRecaptcha() // Reset reCAPTCHA on error
        return
      }

      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        recaptchaToken,
        redirect: false
      })

      if (result?.error) {
        setError("Invalid email or password. Please try again.")
        resetRecaptcha() // Reset reCAPTCHA on auth error
      } else if (result?.ok) {
        router.push("/dashboard")
      }
    } catch (error: unknown) {
      console.error("Sign-in error:", error)
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred during sign in. Please try again."
      setError(errorMessage)
      resetRecaptcha() // Reset reCAPTCHA on error
    } finally {
      setIsLoading(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (status === "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    )
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
            <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
            <p className="text-gray-600">Sign in to verify products and protect your health</p>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-red-800 font-medium">Sign in failed</p>
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleCredentialsSignIn} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="your@email.com"
                  disabled={isLoading}
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter your password"
                    disabled={isLoading}
                    className="pr-10"
                    required
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
              </div>

              <Turnstile
                siteKey={getSiteKey()}
                onSuccess={handleSuccess}
                onError={handleError}
                className="flex justify-center"
              />

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <div className="text-center">
              <p className="text-sm text-gray-500 mt-6">
                By signing in, you'll get <strong>5 daily points</strong> to start scanning products
              </p>
            </div>

            <div className="text-center pt-4 border-t">
              <p className="text-sm text-gray-600">
                Don't have an account?{" "}
                <Link href="/auth/signup" className="text-blue-600 hover:underline font-medium">
                  Sign up
                </Link>
              </p>
              <p className="text-sm text-gray-600 mt-2">
                <Link href="/" className="text-blue-600 hover:underline">← Back to home</Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-white/80 rounded-lg">
            <div className="text-2xl mb-2">🔍</div>
            <p className="text-sm font-medium">Scan Products</p>
            <p className="text-xs text-gray-600">Verify authenticity</p>
          </div>
          <div className="p-4 bg-white/80 rounded-lg">
            <div className="text-2xl mb-2">💰</div>
            <p className="text-sm font-medium">Earn Points</p>
            <p className="text-xs text-gray-600">Daily bonus available</p>
          </div>
          <div className="p-4 bg-white/80 rounded-lg">
            <div className="text-2xl mb-2">📧</div>
            <p className="text-sm font-medium">Get Alerts</p>
            <p className="text-xs text-gray-600">NAFDAC notifications</p>
          </div>
        </div>
      </div>
    </div>
  )
}
