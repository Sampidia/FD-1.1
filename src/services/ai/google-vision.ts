import { AIProviderConfig, AIResponse, AIRequest } from './types-fixed'

export class GoogleVisionService {
  private apiKey: string
  private baseUrl = 'https://vision.googleapis.com/v1'
  private config: AIProviderConfig

  constructor(config: AIProviderConfig) {
    this.apiKey = config.apiKey
    this.config = config
  }

  async processVision(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now()
    console.log(`🔍 [Google Vision] Starting OCR processing for ${request.images?.length || 0} images`)

    try {
      // Convert images to Google Vision format
      const imageRequests = request.images?.map((image, index) => {
        const content = image.startsWith('data:') ? image.split(',')[1] : image
        console.log(`📸 [Google Vision] Processing image ${index + 1}, content length: ${content.length}`)
        return {
          image: { content },
          features: [{
            type: 'TEXT_DETECTION',
            maxResults: 50
          }]
        }
      }) || []

      console.log(`🚀 [Google Vision] Making API call to ${this.baseUrl}/images:annotate`)

      // Make API call to Google Vision API
      const response = await fetch(
        `${this.baseUrl}/images:annotate?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: imageRequests
          })
        }
      )

      if (!response.ok) {
        const error = await response.json()
        console.error(`❌ [Google Vision] API error:`, error)
        throw new Error(`Google Vision API error: ${error.error?.message || 'Unknown error'}`)
      }

      const result = await response.json()
      console.log(`📄 [Google Vision] API response received:`, {
        responsesCount: result.responses?.length || 0,
        hasTextAnnotations: result.responses?.some((r: any) => r.textAnnotations?.length > 0)
      })

      // Extract text from all images
      let combinedText = ''
      const textAnnotations: Array<{
        description?: string
        boundingPoly?: any
        [key: string]: unknown
      }> = []

      result.responses?.forEach((response: {
        textAnnotations?: Array<{
          description?: string
          boundingPoly?: any
          [key: string]: unknown
        }>
      }, index: number) => {
        console.log(`🔤 [Google Vision] Processing response ${index + 1}:`, {
          hasTextAnnotations: !!response.textAnnotations,
          annotationCount: response.textAnnotations?.length || 0
        })

        if (response.textAnnotations && response.textAnnotations.length > 0) {
          // First annotation contains all text
          const text = response.textAnnotations[0].description || ''
          console.log(`📝 [Google Vision] Extracted text from image ${index + 1}: "${text.substring(0, 100)}..."`)
          combinedText += text + ' '
          textAnnotations.push(...response.textAnnotations)
        } else {
          console.warn(`⚠️ [Google Vision] No text annotations found for image ${index + 1}`)
        }
      })

      const extractedText = combinedText.trim()
      console.log(`📋 [Google Vision] Combined extracted text (${extractedText.length} chars): "${extractedText.substring(0, 200)}..."`)

      if (!extractedText) {
        throw new Error('No text detected in images')
      }

      const responseTime = Date.now() - startTime

      // Process extracted text with AI for structured data
      const structuredData = await this.processExtractedText(extractedText, request)
      console.log(`🎯 [Google Vision] Structured data extracted:`, structuredData)

      return {
        content: extractedText,
        extractedData: structuredData,
        usage: {
          inputTokens: Math.ceil(request.text.length / 4) + (request.images?.length || 0) * 85, // Approximate tokens
          outputTokens: Math.ceil(extractedText.length / 4),
          cost: this.calculateCost(request.images?.length || 0)
        },
        metadata: {
          model: 'google-vision-ocr',
          provider: 'google-vision',
          responseTime,
          success: true,
          finishReason: 'completed'
        }
      }

    } catch (error) {
      console.error('Google Vision error:', error)

      return {
        content: '',
        extractedData: null,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          cost: 0
        },
        metadata: {
          model: 'google-vision-ocr',
          provider: 'google-vision',
          responseTime: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          finishReason: 'error'
        }
      }
    }
  }

  async processText(request: AIRequest): Promise<AIResponse> {
    // Google Vision is primarily for image processing
    // Fall back to basic text processing
    const startTime = Date.now()

    return {
      content: request.text,
      extractedData: { rawResponse: request.text },
      usage: {
        inputTokens: Math.ceil(request.text.length / 4),
        outputTokens: Math.ceil(request.text.length / 4),
        cost: 0.0001 // Minimal cost for text processing
      },
      metadata: {
        model: 'google-vision-text',
        provider: 'google-vision',
        responseTime: Date.now() - startTime,
        success: true,
        finishReason: 'completed'
      }
    }
  }

  private async processExtractedText(extractedText: string, request: AIRequest): Promise<{
    productNames?: string[]
    batchNumbers?: string[]
    expiryDate?: string
    manufacturers?: string[]
    confidence?: number
    extractedText?: string
    warnings?: string[]
    [key: string]: string | string[] | number | undefined
  }> {
    console.log(`📝 [Google Vision] Processing extracted text (${extractedText.length} chars): "${extractedText.substring(0, 200)}..."`)

    const result: {
      productNames?: string[]
      batchNumbers?: string[]
      expiryDate?: string
      manufacturers?: string[]
      confidence?: number
      extractedText?: string
      warnings?: string[]
      [key: string]: string | string[] | number | undefined
    } = {
      productNames: [],
      batchNumbers: [],
      manufacturers: [],
      confidence: 0.5,
      extractedText: extractedText
    }

    try {
      // Normalize the text for better extraction
      const normalizedText = extractedText
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/[^\w\s\-\/\.]/g, ' ') // Replace special chars with spaces (keep hyphens, slashes, dots)
        .trim()

      console.log(`🔤 [Google Vision] Normalized text: "${normalizedText.substring(0, 200)}..."`)

      // Extract batch numbers using comprehensive patterns (more permissive)
      const batchPatterns = [
        /\b([A-Z]{2,10}\d{2,8}[A-Z0-9]*)\b/g, // More flexible batch patterns
        /\b(\d{6,10})\b/g,                     // Pure numeric batches
        /\bbatch[\s:]*([A-Z0-9\-]{4,15})\b/gi,
        /\blot[\s:]*([A-Z0-9\-]{4,15})\b/gi,
        /\bno\.?\s*([A-Z0-9\-]{4,15})\b/gi
      ]

      const uniqueBatches = new Set<string>()
      for (const pattern of batchPatterns) {
        let match
        while ((match = pattern.exec(normalizedText)) !== null) {
          const batch = match[1]?.trim().toUpperCase()
          if (batch && batch.length >= 4 && batch.length <= 15) {
            // Filter out obvious non-batch patterns (like years, phone numbers, etc.)
            if (!batch.match(/^(19|20)\d{2}$/) && // Not years
                !batch.match(/^\d{10,}$/) &&     // Not long numbers
                !batch.match(/^\d{3,5}$/)) {     // Not short numbers
              uniqueBatches.add(batch)
              console.log(`🔢 [Google Vision] Found potential batch: ${batch}`)
            }
          }
        }
      }

      result.batchNumbers = Array.from(uniqueBatches).slice(0, 3)
      console.log(`📋 [Google Vision] Final batch numbers: ${result.batchNumbers.join(', ')}`)

      // Extract product name (more flexible patterns)
      const productPatterns = [
        /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})+(?:\s+\d+(?:\.\d+)?\s*(?:mg|g|ml|IU|mcg|%))?)\b/g, // Multi-word product names
        /\b([A-Z][a-z]{3,}(?:\s+[A-Z][a-z]{3,})*)\b/g, // Simpler multi-word names
        /\b([A-Z][a-z]{4,})\b/g // Single long words as fallback
      ]

      const potentialProducts: string[] = []
      for (const pattern of productPatterns) {
        let match
        while ((match = pattern.exec(normalizedText)) !== null) {
          const product = match[1]?.trim()
          if (product && product.length > 3 && product.length < 50) {
            // Filter out common non-product words
            const lowerProduct = product.toLowerCase()
            if (!['batch', 'expiry', 'manufactured', 'tablet', 'capsule', 'syrup', 'cream'].includes(lowerProduct)) {
              potentialProducts.push(product)
              console.log(`💊 [Google Vision] Found potential product: ${product}`)
            }
          }
        }
      }

      // Choose the best product name (prefer longer, more specific names)
      if (potentialProducts.length > 0) {
        potentialProducts.sort((a, b) => b.length - a.length) // Sort by length descending
        if (!result.productNames) result.productNames = []
        result.productNames = [potentialProducts[0]]
        console.log(`✅ [Google Vision] Selected product name: ${result.productNames[0]}`)
      }

      // Extract expiry date
      const datePatterns = [
        /\bexp(?:iry)?[\s:]*([\d\/\-\.]{6,10})\b/gi,
        /\bbest\s*before[\s:]*([\d\/\-\.]{6,10})\b/gi,
        /\buse\s*by[\s:]*([\d\/\-\.]{6,10})\b/gi,
        /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g,
        /\b(\d{2,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g
      ]

      for (const pattern of datePatterns) {
        const match = pattern.exec(normalizedText)
        if (match && match[1]) {
          result.expiryDate = match[1].trim()
          console.log(`📅 [Google Vision] Found expiry date: ${result.expiryDate}`)
          break
        }
      }

      // Extract manufacturer
      const manufacturerPatterns = [
        /\b(?:manufactured\s*by|mfg|maker|made\s*by)[\s:]*([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*(?:\s+(?:Ltd|PLC|Pharma|Labs?|Inc|Corp|Co\.))?)\b/gi,
        /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\s+(?:Ltd|PLC|Pharma|Labs?|Inc|Corp|Co\.))\b/g
      ]

      for (const pattern of manufacturerPatterns) {
        let match
        while ((match = pattern.exec(normalizedText)) !== null) {
          const manufacturer = match[1]?.trim()
        if (manufacturer && manufacturer.length > 3) {
          if (!result.manufacturers) result.manufacturers = []
          result.manufacturers.push(manufacturer)
          console.log(`🏭 [Google Vision] Found manufacturer: ${manufacturer}`)
        }
        }
      }

      // Remove duplicates from manufacturers
      result.manufacturers = [...new Set(result.manufacturers)].slice(0, 2)

      // Calculate confidence score based on extraction quality
      let confidenceScore = 0.4 // Base confidence for Vision API extraction

      if (result.productNames && result.productNames.length > 0) confidenceScore += 0.25
      if (result.batchNumbers && result.batchNumbers.length > 0) confidenceScore += 0.25
      if (result.expiryDate) confidenceScore += 0.15
      if (result.manufacturers && result.manufacturers.length > 0) confidenceScore += 0.15

      // Bonus for having multiple data points
      if ((result.productNames && result.productNames.length > 0 && result.batchNumbers && result.batchNumbers.length > 0) ||
          (result.productNames && result.productNames.length > 0 && result.expiryDate) ||
          (result.batchNumbers && result.batchNumbers.length > 0 && result.expiryDate)) {
        confidenceScore += 0.1
      }

      result.confidence = Math.min(confidenceScore, 0.95) // Cap at 95% for Vision API

      console.log(`🎯 [Google Vision] Extraction results: product="${result.productNames?.[0] || 'none'}", batches=[${result.batchNumbers?.join(',') || 'none'}], expiry="${result.expiryDate || 'none'}", manufacturers=[${result.manufacturers?.join(',') || 'none'}], confidence=${result.confidence}`)

      // Add warnings for low confidence
      if (result.confidence < 0.5) {
        result.warnings = ['Low confidence in extracted data - please verify manually']
      }

      return result

    } catch (error) {
      console.error('[Google Vision] Error processing extracted text:', error)
      result.confidence = 0.1
      result.warnings = ['Failed to process extracted text']
    }

    return result
  }

  private calculateCost(imageCount: number): number {
    // Google Vision API pricing (as of 2024)
    // TEXT_DETECTION: $0.0015 per image for first 1000 images/month, then $0.002 per image
    // Using average cost of $0.00175 per image
    return imageCount * 0.00175
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Simple health check using a small test image (base64 encoded 1x1 pixel)
      const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

      const response = await fetch(
        `${this.baseUrl}/images:annotate?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [{
              image: { content: testImage },
              features: [{ type: 'TEXT_DETECTION' }]
            }]
          })
        }
      )

      return response.ok
    } catch {
      return false
    }
  }
}
