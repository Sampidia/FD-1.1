'use client'

import { useEdgeToEdge } from '@/hooks/use-edge-to-edge'

export function EdgeToEdgeSupport() {
  useEdgeToEdge()
  return null // This component only manages edge-to-edge, no UI
}
