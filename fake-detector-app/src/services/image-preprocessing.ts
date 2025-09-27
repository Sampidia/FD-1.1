/**
 * Image Preprocessing Service for OCR Enhancement
 * Uses Canvas API to optimize images for better AI text recognition
 */

export interface PreprocessingOptions {
  maxWidth: number
  maxHeight: number
  quality: number
  enhanceContrast: boolean
  sharpenText: boolean
  format: 'jpeg' | 'webp'
}

export interface PreprocessingResult {
  originalSize: number
  processedSize: number
  processingTime: number
  dataUrl: string
  dimensions: {
    original: { width: number; height: number }
    processed: { width: number; height: number }
  }
  enhancements: string[]
}

export class ImagePreprocessingService {
  private static readonly DEFAULT_OPTIONS: PreprocessingOptions = {
    maxWidth: 1200,
    maxHeight: 1600,
    quality: 0.95,
    enhanceContrast: true,
    sharpenText: true,
    format: 'jpeg'
  }

  /**
   * Process a single image for OCR optimization
   */
  async preprocessImage(
    imageFile: File,
    options: Partial<PreprocessingOptions> = {}
  ): Promise<PreprocessingResult> {
    const startTime = Date.now()
    const opts = { ...ImagePreprocessingService.DEFAULT_OPTIONS, ...options }

    try {
      // Load image into canvas
      const { canvas, ctx, img } = await this.loadImageToCanvas(imageFile)

      // Track original dimensions
      const originalDimensions = { width: img.width, height: img.height }

      // Apply preprocessing pipeline
      const enhancements = await this.applyPreprocessingPipeline(canvas, ctx, img, opts)

      // Export processed image
      const processedDimensions = { width: canvas.width, height: canvas.height }
      const dataUrl = this.exportCanvasToDataUrl(canvas, opts)

      const processingTime = Date.now() - startTime

      return {
        originalSize: imageFile.size,
        processedSize: Math.round(dataUrl.length * 0.75), // Approximate base64 to binary size
        processingTime,
        dataUrl,
        dimensions: {
          original: originalDimensions,
          processed: processedDimensions
        },
        enhancements
      }
    } catch (error) {
      console.error('Image preprocessing failed:', error)
      // Return original image as fallback
      return this.createFallbackResult(imageFile, startTime)
    }
  }

  /**
   * Process multiple images in batch for better performance
   */
  async preprocessImages(
    imageFiles: File[],
    options: Partial<PreprocessingOptions> = {}
  ): Promise<PreprocessingResult[]> {
    const results = await Promise.all(
      imageFiles.map(file => this.preprocessImage(file, options))
    )

    console.log(`✅ Preprocessed ${results.length} images in ${results.reduce((sum, r) => sum + r.processingTime, 0)}ms total`)
    return results
  }

  /**
   * Load image file into HTML5 Canvas
   */
  private async loadImageToCanvas(imageFile: File): Promise<{
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    img: HTMLImageElement
  }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }

      img.onload = () => {
        resolve({ canvas, ctx, img })
      }

      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }

      img.src = URL.createObjectURL(imageFile)
    })
  }

  /**
   * Apply the complete preprocessing pipeline
   */
  private async applyPreprocessingPipeline(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    options: PreprocessingOptions
  ): Promise<string[]> {
    const enhancements: string[] = []

    try {
      // Step 1: Smart resize for OCR optimization
      const resized = this.smartResize(canvas, ctx, img, options)
      if (resized) enhancements.push('resized')

      // Step 2: Contrast enhancement for better text recognition
      if (options.enhanceContrast) {
        this.enhanceContrast(canvas, ctx)
        enhancements.push('contrast-enhanced')
      }

      // Step 3: Text sharpening using unsharp mask
      if (options.sharpenText) {
        this.sharpenText(canvas, ctx)
        enhancements.push('text-sharpened')
      }

      // Step 4: Final quality optimization
      enhancements.push('quality-optimized')

    } catch (error) {
      console.warn('Some preprocessing steps failed, continuing with available enhancements:', error)
    }

    return enhancements
  }

  /**
   * Smart resize algorithm optimized for OCR
   */
  private smartResize(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    options: PreprocessingOptions
  ): boolean {
    const { width: imgWidth, height: imgHeight } = img
    const { maxWidth, maxHeight } = options

    // Calculate optimal dimensions for OCR
    let targetWidth = imgWidth
    let targetHeight = imgHeight

    // If image is too large, scale down while maintaining aspect ratio
    if (imgWidth > maxWidth || imgHeight > maxHeight) {
      const widthRatio = maxWidth / imgWidth
      const heightRatio = maxHeight / imgHeight
      const scale = Math.min(widthRatio, heightRatio)

      targetWidth = Math.floor(imgWidth * scale)
      targetHeight = Math.floor(imgHeight * scale)
    }

    // If image is too small for good OCR, scale up (but not too much)
    const minOCRSize = 600
    if (Math.min(targetWidth, targetHeight) < minOCRSize) {
      const scale = Math.min(minOCRSize / Math.min(targetWidth, targetHeight), 2.0) // Max 2x scaling
      targetWidth = Math.floor(targetWidth * scale)
      targetHeight = Math.floor(targetHeight * scale)
    }

    // Only resize if dimensions actually changed
    if (targetWidth !== imgWidth || targetHeight !== imgHeight) {
      canvas.width = targetWidth
      canvas.height = targetHeight

      // Use high-quality image smoothing
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
      return true
    }

    // Even if no resize, set canvas dimensions to original
    canvas.width = imgWidth
    canvas.height = imgHeight
    ctx.drawImage(img, 0, 0)
    return false
  }

  /**
   * Enhance contrast using adaptive histogram equalization
   */
  private enhanceContrast(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // Calculate histogram
    const histogram = new Array(256).fill(0)
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
      histogram[gray]++
    }

    // Calculate cumulative distribution function (CDF)
    const cdf = new Array(256)
    cdf[0] = histogram[0]
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i]
    }

    // Apply histogram equalization
    const totalPixels = data.length / 4
    const cdfMin = cdf.find(val => val > 0) || 0

    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
      const equalized = Math.round(((cdf[gray] - cdfMin) / (totalPixels - cdfMin)) * 255)

      // Apply to RGB channels with slight boost for text clarity
      data[i] = Math.min(255, equalized * 1.1)     // Red
      data[i + 1] = Math.min(255, equalized * 1.1) // Green
      data[i + 2] = Math.min(255, equalized * 1.1) // Blue
      // Alpha channel unchanged
    }

    ctx.putImageData(imageData, 0, 0)
  }

  /**
   * Sharpen text using unsharp masking algorithm
   */
  private sharpenText(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const output = new Uint8ClampedArray(data)

    // Unsharp masking parameters optimized for text
    const amount = 0.8  // Sharpening amount (0-1)
    const threshold = 10 // Minimum difference to apply sharpening

    // Simple 3x3 unsharp mask
    for (let y = 1; y < canvas.height - 1; y++) {
      for (let x = 1; x < canvas.width - 1; x++) {
        const idx = (y * canvas.width + x) * 4

        // Get center pixel brightness
        const center = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]

        // Get surrounding pixels average
        let sum = 0
        let count = 0

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue // Skip center
            const nidx = ((y + dy) * canvas.width + (x + dx)) * 4
            sum += 0.299 * data[nidx] + 0.587 * data[nidx + 1] + 0.114 * data[nidx + 2]
            count++
          }
        }

        const average = sum / count
        const diff = center - average

        // Apply sharpening only if difference is significant
        if (Math.abs(diff) > threshold) {
          const sharpen = diff * amount

          for (let c = 0; c < 3; c++) { // RGB channels only
            output[idx + c] = Math.max(0, Math.min(255, data[idx + c] + sharpen))
          }
        }
      }
    }

    // Create new image data with sharpened result
    const sharpenedData = new ImageData(output, canvas.width, canvas.height)
    ctx.putImageData(sharpenedData, 0, 0)
  }

  /**
   * Export canvas to optimized data URL
   */
  private exportCanvasToDataUrl(canvas: HTMLCanvasElement, options: PreprocessingOptions): string {
    return canvas.toDataURL(`image/${options.format}`, options.quality)
  }

  /**
   * Create fallback result when preprocessing fails
   */
  private async createFallbackResult(imageFile: File, startTime: number): Promise<PreprocessingResult> {
    // Convert original file to data URL as fallback
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.readAsDataURL(imageFile)
    })

    return {
      originalSize: imageFile.size,
      processedSize: imageFile.size,
      processingTime: Date.now() - startTime,
      dataUrl,
      dimensions: {
        original: { width: 0, height: 0 }, // Unknown for fallback
        processed: { width: 0, height: 0 }
      },
      enhancements: ['fallback-original']
    }
  }

  /**
   * Check if browser supports required Canvas features
   */
  static isSupported(): boolean {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      return !!ctx && typeof ctx.getImageData === 'function'
    } catch {
      return false
    }
  }
}

// Export singleton instance
export const imagePreprocessing = new ImagePreprocessingService()