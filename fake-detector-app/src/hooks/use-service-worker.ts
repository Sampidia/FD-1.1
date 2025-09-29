import { useEffect, useState } from 'react'

interface ServiceWorkerState {
  isSupported: boolean
  isRegistered: boolean
  isInstalling: boolean
  isInstalled: boolean
  updateAvailable: boolean
  registration: ServiceWorkerRegistration | null
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isInstalling: false,
    isInstalled: false,
    updateAvailable: false,
    registration: null
  })

  useEffect(() => {
    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      console.log('🚫 Service workers not supported')
      return
    }

    setState(prev => ({ ...prev, isSupported: true }))

    // Register service worker
    const registerSW = async () => {
      try {
        console.log('🔄 Registering service worker...')

        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        })

        console.log('✅ Service worker registered:', registration.scope)

        // Set initial state
        setState(prev => ({
          ...prev,
          isRegistered: true,
          registration
        }))

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            console.log('🔄 New service worker installing...')

            setState(prev => ({ ...prev, isInstalling: true }))

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('📦 New service worker available')
                setState(prev => ({
                  ...prev,
                  isInstalling: false,
                  updateAvailable: true
                }))
              } else if (newWorker.state === 'activated') {
                console.log('✅ New service worker activated')
                window.location.reload()
              }
            })
          }
        })

        // Listen for controller change (new SW activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('🎯 Service worker controller changed')
          window.location.reload()
        })

        // Check for existing updates
        if (registration.waiting) {
          setState(prev => ({ ...prev, updateAvailable: true }))
        }

        // Mark as installed if controlling
        if (navigator.serviceWorker.controller) {
          setState(prev => ({ ...prev, isInstalled: true }))
        }

      } catch (error) {
        console.error('❌ Service worker registration failed:', error)
        setState(prev => ({
          ...prev,
          isRegistered: false,
          registration: null
        }))
      }
    }

    registerSW()

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, data } = event.data

      switch (type) {
        case 'CACHE_SCAN_RESULT':
          console.log('💾 Scan result cached by service worker')
          break
        case 'SYNC_COMPLETED':
          console.log('🔄 Background sync completed')
          break
        default:
          console.log('📨 Message from service worker:', type, data)
      }
    })

  }, [])

  const updateServiceWorker = async () => {
    if (!state.registration?.waiting) return

    // Tell the service worker to skip waiting
    state.registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  const cacheScanResult = (scanId: string, result: any) => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_SCAN_RESULT',
        data: { scanId, result }
      })
    }
  }

  return {
    ...state,
    updateServiceWorker,
    cacheScanResult
  }
}
