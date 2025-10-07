"use client"

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'

export interface CameraOptions {
  quality?: number
  allowEditing?: boolean
  resultType?: CameraResultType
  source?: CameraSource
  width?: number
  height?: number
  format?: 'jpeg' | 'png'
  saveToGallery?: boolean
}

export interface CameraResult {
  success: boolean
  file?: File
  error?: string
  dataUrl?: string
}

export class CameraService {
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'Capacitor' in window
  }

  static async takePhoto(options: CameraOptions = {}): Promise<CameraResult> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: 'Camera not supported on this platform'
      }
    }

    try {
      // Check permissions first
      const permission = await Camera.checkPermissions()
      if (permission.camera !== 'granted') {
        const requestResult = await Camera.requestPermissions()
        if (requestResult.camera !== 'granted') {
          return {
            success: false,
            error: 'Camera permission denied'
          }
        }
      }

      const cameraOptions = {
        quality: options.quality || 90,
        allowEditing: options.allowEditing || false,
        resultType: options.resultType || CameraResultType.Uri,
        source: options.source || CameraSource.Camera,
        width: options.width || 1920,
        height: options.height || 1080,
        format: options.format || 'jpeg',
        saveToGallery: options.saveToGallery || false
      }

      const image = await Camera.getPhoto(cameraOptions)

      if (image.webPath) {
        // Convert URI to File object
        const response = await fetch(image.webPath)
        const blob = await response.blob()

        const file = new File([blob], `camera-photo-${Date.now()}.${options.format || 'jpeg'}`, {
          type: `image/${options.format || 'jpeg'}`
        })

        // Also get data URL for immediate use
        const dataUrl = await this.convertUriToDataUrl(image.webPath)

        return {
          success: true,
          file,
          dataUrl
        }
      }

      return {
        success: false,
        error: 'Failed to capture image'
      }
    } catch (error) {
      console.error('Camera error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown camera error'
      }
    }
  }

  static async selectFromGallery(options: CameraOptions = {}): Promise<CameraResult> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: 'Gallery not supported on this platform'
      }
    }

    try {
      // Check permissions first
      const permission = await Camera.checkPermissions()
      if (permission.photos !== 'granted') {
        const requestResult = await Camera.requestPermissions()
        if (requestResult.photos !== 'granted') {
          return {
            success: false,
            error: 'Gallery permission denied'
          }
        }
      }

      const cameraOptions = {
        quality: options.quality || 90,
        allowEditing: options.allowEditing || false,
        resultType: options.resultType || CameraResultType.Uri,
        source: CameraSource.Photos,
        width: options.width || 1920,
        height: options.height || 1080,
        format: options.format || 'jpeg'
      }

      const image = await Camera.getPhoto(cameraOptions)

      if (image.webPath) {
        // Convert URI to File object
        const response = await fetch(image.webPath)
        const blob = await response.blob()

        const file = new File([blob], `gallery-photo-${Date.now()}.${options.format || 'jpeg'}`, {
          type: `image/${options.format || 'jpeg'}`
        })

        // Also get data URL for immediate use
        const dataUrl = await this.convertUriToDataUrl(image.webPath)

        return {
          success: true,
          file,
          dataUrl
        }
      }

      return {
        success: false,
        error: 'Failed to select image'
      }
    } catch (error) {
      console.error('Gallery selection error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown gallery error'
      }
    }
  }

  private static async convertUriToDataUrl(uri: string): Promise<string> {
    try {
      const response = await fetch(uri)
      const blob = await response.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error('Error converting URI to data URL:', error)
      return uri // Fallback to original URI
    }
  }

  static async savePhotoToGallery(dataUrl: string, filename?: string): Promise<boolean> {
    if (!this.isSupported()) {
      return false
    }

    try {
      // Convert data URL to blob
      const response = await fetch(dataUrl)
      const blob = await response.blob()

      // Write to filesystem
      const fileName = filename || `photo-${Date.now()}.jpeg`
      await Filesystem.writeFile({
        path: fileName,
        data: blob,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      })

      return true
    } catch (error) {
      console.error('Error saving photo to gallery:', error)
      return false
    }
  }
}

// React hook for camera functionality
export function useCamera() {
  const takePhoto = async (options?: CameraOptions): Promise<CameraResult> => {
    return CameraService.takePhoto(options)
  }

  const selectFromGallery = async (options?: CameraOptions): Promise<CameraResult> => {
    return CameraService.selectFromGallery(options)
  }

  const isSupported = CameraService.isSupported()

  return {
    takePhoto,
    selectFromGallery,
    isSupported
  }
}
