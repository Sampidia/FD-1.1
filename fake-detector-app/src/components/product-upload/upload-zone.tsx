"use client"

import { useRef, useState } from "react"
import { Camera, Upload, X, AlertCircle } from "lucide-react"
import Image from "next/image"
import { validateImageForOCR, getOCRErrorMessage } from "@/lib/file-validation"

interface UploadZoneProps {
  zone: 'front' | 'back' | 'left' | 'right'
  label: string
  image?: string
  onImageSelect: (file: File) => void
  className?: string
}

export function UploadZone({
  zone,
  label,
  image,
  onImageSelect,
  className = ""
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(image || null)
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File) => {
    if (!file) return

    setIsValidating(true)
    setValidationError(null)

    try {
      // Validate file for OCR compatibility
      const validation = await validateImageForOCR(file)

      if (!validation.valid) {
        const userFriendlyError = getOCRErrorMessage(validation.error || 'Unknown error')
        setValidationError(userFriendlyError)
        setIsValidating(false)
        return
      }

      // File is valid for OCR processing
      onImageSelect(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)

    } catch (error) {
      console.error('File validation error:', error)
      setValidationError('Failed to validate image. Please try again.')
    } finally {
      setIsValidating(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find(file => file.type.startsWith('image/'))

    if (imageFile) {
      handleFileSelect(imageFile)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleCameraCapture = () => {
    // Trigger camera capture
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment' // Use back camera by default
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) handleFileSelect(file)
    }
    input.click()
  }

  const getZoneIcon = (zone: string) => {
    switch (zone) {
      case 'front': return '👆'
      case 'back': return '👇'
      case 'left': return '👈'
      case 'right': return '👉'
      default: return '📷'
    }
  }

  if (preview) {
    return (
      <div className={`upload-zone relative ${className}`}>
        <div className="aspect-square relative">
          <Image
            src={preview}
            alt={`${label} preview`}
            fill
            className="object-cover rounded-lg"
          />
          <div className="absolute inset-0 bg-black/20 rounded-lg opacity-0 hover:opacity-100 transition-opacity">
            <div className="absolute top-2 right-2 flex gap-1">
              <button
                onClick={() => {
                  setPreview(null)
                  setValidationError(null) // Clear any validation errors
                }}
                className="bg-white/80 hover:bg-white p-1.5 rounded-full"
                title="Remove image"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="absolute top-2 left-2">
              <div className="bg-white/80 px-2 py-1 rounded text-xs font-medium">
                {getZoneIcon(zone)} {label}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`upload-zone border-2 border-dashed rounded-lg transition-all duration-200 ${
        isDragging ? 'border-blue-500 bg-blue-50' :
        validationError ? 'border-red-300 bg-red-50' :
        isValidating ? 'border-yellow-300 bg-yellow-50' :
        'border-gray-300 hover:border-blue-500'
      } ${className}`}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onClick={() => !isValidating && fileInputRef.current?.click()}
    >
      <div className="flex flex-col items-center justify-center p-6 text-center h-full">
        {/* Validation States */}
        {isValidating && (
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            <div className="text-sm text-yellow-700 font-medium">Validating image...</div>
            <div className="text-xs text-yellow-600 mt-1">Checking OCR compatibility</div>
          </div>
        )}

        {/* Error State */}
        {validationError && (
          <div className="flex flex-col items-center">
            <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
            <div className="text-sm text-red-700 font-medium">Upload Failed</div>
            <div className="text-xs text-red-600 mt-1 max-w-48">{validationError}</div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setValidationError(null)
              }}
              className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Default Upload UI */}
        {!isValidating && !validationError && (
          <>
            <div className="text-4xl mb-2">{getZoneIcon(zone)}</div>
            <div className="font-medium text-gray-900 mb-1">{label}</div>
            <div className="text-sm text-gray-500 mb-4">Tap to upload or drag & drop</div>

            <div className="flex flex-col gap-2 mb-2">
              <button
                type="button"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
                className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded border w-full"
              >
                <Upload className="w-3 h-3" />
                Browse
              </button>
              <button
                type="button"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation()
                  handleCameraCapture()
                }}
                className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded w-full"
              >
                <Camera className="w-3 h-3" />
                Camera
              </button>
            </div>

            <div className="text-xs text-gray-400">JPG, PNG up to 5MB</div>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  )
}
