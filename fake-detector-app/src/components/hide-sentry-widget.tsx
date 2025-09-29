'use client'

import { useEffect } from 'react'

export function HideSentryWidget() {
  useEffect(() => {
    // Check if we're on mobile
    const isMobile = window.innerWidth <= 768

    if (!isMobile) return // Only hide on mobile

    // Inject CSS after everything loads to override Sentry widget
    const style = document.createElement('style')
    style.id = 'hide-sentry-widget'
    style.innerHTML = `
      .sentry-feedback,
      .widget__actor,
      [data-sentry-feedback-widget],
      button[aria-label*="Report"],
      .sentry-report-dialog,
      div[class*="sentry-feedback"],
      button[class*="sentry-feedback"],
      div[id*="sentry-feedback"],
      button[id*="sentry-feedback"] {
        position: fixed !important;
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        height: 0 !important;
        width: 0 !important;
        overflow: hidden !important;
        z-index: -9999 !important;
      }
    `

    // Append to head so it loads after everything
    document.head.appendChild(style)

    // Cleanup on unmount
    return () => {
      const existingStyle = document.getElementById('hide-sentry-widget')
      if (existingStyle) {
        existingStyle.remove()
      }
    }
  }, [])

  return null // This component doesn't render anything
}
