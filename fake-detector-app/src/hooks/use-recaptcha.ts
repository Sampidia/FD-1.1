import { useState } from 'react'

export const useRecaptcha = () => {
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)

  // Handle successful Turnstile verification
  const handleSuccess = (token: string) => {
    setRecaptchaToken(token)
  }

  // Handle Turnstile error
  const handleError = () => {
    console.error('Turnstile verification failed')
    setRecaptchaToken(null)
  }

  // Get Turnstile site key
  const getSiteKey = () => {
    return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'
  }

  // Execute verification (for Turnstile, this is automatic)
  const executeRecaptcha = (): Promise<string | null> => {
    return new Promise((resolve) => {
      const siteKey = getSiteKey()

      // For development/placeholder, return a mock token
      if (siteKey === '1x00000000000000000000AA') {
        resolve('placeholder-token-for-development')
        return
      }

      // Wait for token or timeout
      const checkToken = () => {
        if (recaptchaToken) {
          resolve(recaptchaToken)
        } else {
          // Wait a bit for user interaction
          setTimeout(checkToken, 1000)
        }
      }

      checkToken()

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!recaptchaToken) {
          console.warn('Turnstile timeout - no token received')
          resolve(null)
        }
      }, 30000)
    })
  }

  // Reset Turnstile state
  const resetRecaptcha = () => {
    setRecaptchaToken(null)
  }

  return {
    recaptchaToken,
    executeRecaptcha,
    resetRecaptcha,
    handleSuccess,
    handleError,
    getSiteKey
  }
}
