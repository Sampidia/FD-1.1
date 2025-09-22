import { useRef, useState } from 'react'

// Type declarations for Google reCAPTCHA
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

export const useRecaptcha = () => {
  const recaptchaRef = useRef<HTMLDivElement | null>(null)
  const [isRecaptchaLoaded, setIsRecaptchaLoaded] = useState(false)
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)

  // Initialize reCAPTCHA when loaded
  const handleRecaptchaLoad = () => {
    if (typeof window !== 'undefined' && window.grecaptcha) {
      setIsRecaptchaLoaded(true)
    }
  }

  // Execute invisible reCAPTCHA
  const executeRecaptcha = (): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      if (!isRecaptchaLoaded || typeof window === 'undefined' || !window.grecaptcha) {
        console.error('reCAPTCHA not loaded or not available')
        // Return placeholder for development
        const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_SITE_KEY_PLACEHOLDER || 'RECAPTCHA_SITE_KEY_PLACEHOLDER'
        if (siteKey === 'RECAPTCHA_SITE_KEY_PLACEHOLDER') {
          resolve('placeholder-token-for-development')
          return
        }
        reject(new Error('reCAPTCHA not loaded'))
        return
      }

      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_SITE_KEY_PLACEHOLDER || 'RECAPTCHA_SITE_KEY_PLACEHOLDER'

      // For development/placeholder, return a mock token
      if (siteKey === 'RECAPTCHA_SITE_KEY_PLACEHOLDER') {
        resolve('placeholder-token-for-development')
        return
      }

      // Execute invisible reCAPTCHA
      try {
        window.grecaptcha.ready(() => {
          window.grecaptcha.execute(siteKey, { action: 'submit' }).then((token: string) => {
            setRecaptchaToken(token)
            resolve(token)
          }).catch((error: Error) => {
            console.error('reCAPTCHA execution failed:', error)
            reject(error)
          })
        })
      } catch (error: unknown) {
        console.error('Error executing reCAPTCHA:', error)
        reject(error instanceof Error ? error : new Error('Unknown reCAPTCHA error'))
      }
    })
  }

  // Reset reCAPTCHA state
  const resetRecaptcha = () => {
    setRecaptchaToken(null)
  }

  return {
    recaptchaRef,
    recaptchaToken,
    isRecaptchaLoaded,
    executeRecaptcha,
    resetRecaptcha,
    handleRecaptchaLoad
  }
}
