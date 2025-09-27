"use client"

import { useEffect } from "react"

export default function VerifyEmailPage() {
  useEffect(() => {
    // Check if user is already verified every 2 seconds
    const checkVerification = setInterval(() => {
      // This will trigger a page refresh when the user clicks the verification link
      // The middleware will redirect verified users to dashboard
      window.location.reload()
    }, 2000)

    return () => clearInterval(checkVerification)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.9a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Check Your Email</h1>
        </div>

        <div className="bg-white shadow-xl rounded-xl p-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Created Successfully!</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              We've sent a verification link to your email address. Click the link in the email to verify your account and access the dashboard.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-blue-900 mb-1">Need Help?</h3>
                <p className="text-xs text-blue-700">
                  The verification link expires in 24 hours. If you didn't receive the email, check your spam folder or try signing up again.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              I've Verified My Email
            </button>

            <a
              href="/auth/signup"
              className="block text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Need to sign up again?
            </a>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            Protected by NextAuth.js • Account verification required for security
          </p>
        </div>
      </div>
    </div>
  )
}
