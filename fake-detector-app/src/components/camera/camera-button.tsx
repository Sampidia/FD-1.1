"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useCamera } from './camera-utils'
import { CameraResultType, CameraSource } from '@capacitor/camera'
import { Camera, Image as ImageIcon, Loader2 } from 'lucide-react'

interface CameraButtonProps {
  onPhotoCapture: (file: File, dataUrl: string) => void
  disabled?: boolean
  variant?: 'camera' | 'gallery'
  className?: string
}

export function CameraButton({
  onPhotoCapture,
  disabled = false,
  variant = 'camera',
  className = ''
}: CameraButtonProps) {
  const { takePhoto, selectFromGallery, isSupported } = useCamera()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCameraCapture = async () => {
    if (!isSupported) {
      setError('Camera not supported on this device')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await takePhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        format: 'jpeg'
      })

      if (result.success && result.file && result.dataUrl) {
        onPhotoCapture(result.file, result.dataUrl)
      } else {
        setError(result.error || 'Failed to capture photo')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Camera capture error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGallerySelect = async () => {
    if (!isSupported) {
      setError('Gallery not supported on this device')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await selectFromGallery({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        format: 'jpeg'
      })

      if (result.success && result.file && result.dataUrl) {
        onPhotoCapture(result.file, result.dataUrl)
      } else {
        setError(result.error || 'Failed to select photo')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Gallery selection error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isSupported) {
    return (
      <Button
        disabled
        variant="outline"
        className={`w-full ${className}`}
      >
        <Camera className="w-4 h-4 mr-2" />
        Camera not available
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={variant === 'camera' ? handleCameraCapture : handleGallerySelect}
        disabled={disabled || isLoading}
        variant="outline"
        className={`w-full ${className}`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : variant === 'camera' ? (
          <Camera className="w-4 h-4 mr-2" />
        ) : (
          <ImageIcon className="w-4 h-4 mr-2" />
        )}
        {isLoading
          ? 'Processing...'
          : variant === 'camera'
            ? '📷 Take Photo'
            : '🖼️ Choose from Gallery'
        }
      </Button>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  )
}
