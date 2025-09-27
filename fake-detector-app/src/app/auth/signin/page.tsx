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
import { useRecaptcha } from "@/hooks/use-recaptcha"
import Head from "next/head"

export default function SignInPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [emailMethod, setEmailMethod] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  })
  const { data: session, status } = useSession()
  const router = useRouter()

  // reCAPTCHA hook
  const { executeRecaptcha, resetRecaptcha, handleRecaptchaLoad } = useRecaptcha()

  // Load reCAPTCHA script and initialize
  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_SITE_KEY_PLACEHOLDER

    // Load reCAPTCHA script dynamically
    if (siteKey && typeof document !== 'undefined') {
      const script = document.createElement('script')
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
      script.async = true
      script.defer = true
      document.head.appendChild(script)

      script.onload = () => handleRecaptchaLoad()
    }
  }, [handleRecaptchaLoad])

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard")
    }
  }, [status, router])

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await signIn("google", {
        callbackUrl: "/dashboard",
        redirect: true
      })
    } catch (error: unknown) {
      console.error("Sign-in error:", error)
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred during sign in. Please try again."
      setError(errorMessage)
      setIsLoading(false)
    }
  }

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

            <div className="space-y-3">
              <Button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 h-auto"
                variant="outline"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-3" />
                    Signing in...
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            {emailMethod ? (
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

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
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

                  <Button
                    type="button"
                    onClick={() => {
                      setEmailMethod(false)
                      setError(null)
                    }}
                    disabled={isLoading}
                    variant="outline"
                  >
                    Back
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                onClick={() => setEmailMethod(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 h-auto"
              >
                Continue with Email
              </Button>
            )}

            {!emailMethod && (
              <div className="text-center">
                <p className="text-sm text-gray-500 mt-6">
                  By signing in, you'll get <strong>5 daily points</strong> to start scanning products
                </p>
              </div>
            )}

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
