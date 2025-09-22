import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 px-4">
      <div className="w-full max-w-md">
        <Card className="text-center">
          <CardHeader className="space-y-2">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <CardTitle className="text-xl font-semibold text-gray-900">
              Authentication Error
            </CardTitle>
            <CardDescription className="text-gray-600">
              There was a problem signing you in with Google.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-left">
              <p className="text-sm font-medium text-red-800 mb-1">
                Possible Issues:
              </p>
              <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                <li>Google OAuth configuration error</li>
                <li>Database connection issues</li>
                <li>Missing environment variables</li>
                <li>User authentication sync problems</li>
              </ul>
            </div>

            <div className="space-y-3">
              <Link href="/auth/signin">
                <Button className="w-full" size="lg">
                  Try Signing In Again
                </Button>
              </Link>

              <Link href="/">
                <Button variant="outline" className="w-full" size="lg">
                  Return to Home
                </Button>
              </Link>
            </div>

            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">
                Need help? Contact our support team
              </p>
              <Link href="/contact">
                <Button variant="ghost" size="sm" className="text-xs">
                  Contact Support
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
