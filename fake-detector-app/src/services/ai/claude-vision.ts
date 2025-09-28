import Anthropic from '@anthropic-ai/sdk'
import type { TextBlock, ImageBlockParam } from '@anthropic-ai/sdk/resources/messages'

export class ClaudeVisionOCR {
  private anthropic: Anthropic
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CLAUDE_API_KEY || ''
    this.anthropic = new Anthropic({
      apiKey: this.apiKey
    })
  }

  async processImage(imageBase64: string, task: string = 'ocr'): Promise<{
    productName?: string
    batchNumber?: string
    expiryDate?: string
    manufacturer?: string
    confidence: number
    rawText: string
  }> {
    // For backward compatibility
    return this.processVision({
      text: '',
      task,
      images: [imageBase64],
      maxTokens: 2048
    })
  }

  async processVision(request: {
    text: string
    task: string
    images: string[]
    maxTokens?: number
  }): Promise<{
    productName?: string
    batchNumber?: string
    expiryDate?: string
    manufacturer?: string
    confidence: number
    rawText: string
  }> {
    const startTime = Date.now()

    console.log('🔍 CLAUDE VISION DEBUG - Starting processVision')
    console.log('🔍 Request details:', {
      task: request.task,
      imagesCount: request.images.length,
      maxTokens: request.maxTokens,
      textLength: request.text.length
    })

    try {
      console.log('🤖 Starting Claude Vision API processing...')
      console.log('🔑 API Key configured:', !!this.apiKey)
      console.log('🔧 Using model: claude-3-5-haiku-20241022')

      // Process multiple images - include all images in the request
      const imageBlocks: ImageBlockParam[] = request.images.map((imageBase64, index) => {
        console.log(`🖼️ Processing image ${index + 1}/${request.images.length}, original length:`, imageBase64.length)

        // Extract media type and base64 data properly
        const mediaTypeMatch = imageBase64.match(/^data:image\/([^;]+);base64,/)
        const mediaType = mediaTypeMatch ? `image/${mediaTypeMatch[1]}` : 'image/png' // Default to PNG if can't detect
        const base64Data = imageBase64.replace(/^data:image\/[^;]+;base64,/, '')

        console.log(`🖼️ Image ${index + 1} detected media type: ${mediaType}, cleaned base64 length:`, base64Data.length)

        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: base64Data
          }
        }
      })

      // Generate optimized pharmaceutical OCR prompt for multi-image processing
      const ocrPrompt = this.generateMultiImageOCRPrompt(request.images.length)
      console.log('📝 Generated multi-image OCR prompt length:', ocrPrompt.length)
      console.log('📝 OCR prompt preview:', ocrPrompt.substring(0, 100) + '...')

      // Make API call to Claude Vision with multiple images
      console.log('🌐 Making Claude Vision API call with', request.images.length, 'images...')
      const content: (TextBlock | ImageBlockParam)[] = [
        {
          type: 'text',
          text: ocrPrompt,
          citations: []  // Required by Anthropic SDK TextBlock type
        },
        ...imageBlocks
      ]

      const apiRequest = {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        temperature: 0.1,
        messages: [{
          role: 'user' as const,
          content
        }]
      }

      console.log('📤 Claude API Request structure:', {
        model: apiRequest.model,
        max_tokens: apiRequest.max_tokens,
        temperature: apiRequest.temperature,
        messageCount: apiRequest.messages.length,
        contentTypes: apiRequest.messages[0].content.map((c: TextBlock | ImageBlockParam) => c.type)
      })

      const response = await this.anthropic.messages.create(apiRequest)
      console.log('📥 Claude API Response received')

      if (!response.content || response.content.length === 0) {
        console.error('🚨 Claude Vision API: Empty response')
        throw new Error('No content in Claude Vision response')
      }

      console.log('📦 Claude response content length:', response.content.length)
      console.log('📦 Claude response structure:', {
        contentLength: response.content.length,
        firstContentType: response.content[0]?.type,
        finishReason: response.stop_reason
      })

      console.log('📊 Multi-image processing:', request.images.length, 'images provided')

      const responseTime = Date.now() - startTime
      console.log(`✅ Claude Vision processing completed in ${responseTime}ms`)

      // Extract text from Claude's response
      const rawText = response.content[0]?.type === 'text' ? response.content[0].text : ''
      console.log('📄 Claude Vision Raw Response:', rawText)
      console.log('📄 Claude response length:', rawText.length)
      console.log('📄 Claude response preview:', rawText.substring(0, 500) + (rawText.length > 500 ? '...' : ''))

      // Debug: Look for any potential product names in raw response
      const potentialProductMatches = rawText.match(/([A-Z][a-zA-Z\s]{3,30}(?:\d+(?:mg|ml|g|mcg|IU|%))?)/g)
      console.log('🔍 Potential product names found in raw response:', potentialProductMatches)

      if (!rawText || rawText.trim().length === 0) {
        console.error('🚨 Claude returned empty text response')
        throw new Error('Claude Vision returned empty text')
      }

      // Parse the JSON response
      console.log('🔍 Starting JSON parsing...')
      console.log('📄 Raw Claude response for parsing:', rawText)
      const extractedData = this.parseClaudeResponse(rawText)
      console.log('🔍 Parsed data result:', extractedData)

      // Calculate confidence based on extraction results
      const confidence = this.calculateConfidence(extractedData)

      console.log('🎯 Claude Vision Extracted Data:', {
        productName: extractedData.productName,
        batchNumber: extractedData.batchNumber,
        expiryDate: extractedData.expiryDate,
        manufacturer: extractedData.manufacturer,
        confidence: confidence,
        hasProduct: !!extractedData.productName,
        hasBatch: !!extractedData.batchNumber,
        rawTextLength: rawText.length
      })

      return {
        ...extractedData,
        confidence,
        rawText: rawText || extractedData.rawText || ''
      }

    } catch (error) {
      console.error('🚨 CLAUDE VISION API ERROR - Detailed analysis:')
      console.error('❌ Error type:', error instanceof Error ? 'Error object' : typeof error)
      console.error('❌ Error message:', error instanceof Error ? error.message : String(error))

      if (error instanceof Error) {
        console.error('❌ Error stack:', error.stack)
      }

      // Log additional error details if available
      if (typeof error === 'object' && error !== null) {
        console.error('❌ Error object keys:', Object.keys(error))
        if ('status' in error) console.error('❌ HTTP Status:', (error as { status?: number }).status)
        if ('code' in error) console.error('❌ Error Code:', (error as { code?: string }).code)
        if ('type' in error) console.error('❌ Error Type:', (error as { type?: string }).type)
      }

      console.error('⏱️ Total processing time before error:', Date.now() - startTime + 'ms')

      return {
        productName: undefined,
        batchNumber: undefined,
        expiryDate: undefined,
        manufacturer: undefined,
        confidence: 0,
        rawText: `CLAUDE_ERROR: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      }
    }
  }

  private generateOCRPrompt(): string {
    return `EXTRACT PHARMACEUTICAL PRODUCT INFORMATION FROM THIS PACKAGING IMAGE.

FIRST AND MOST IMPORTANT: Find the PRODUCT NAME (the main medicine name on the packaging).

PRODUCT NAME RULES:
- Look for the LARGEST, MOST PROMINENT text on the packaging
- This is usually the medicine/drug name in big letters
- Examples: "Postinor 2", "Amoxicillin 500mg", "Paracetamol Tablets"
- May include dosage like "500mg" or form like "Tablets"
- IGNORE smaller text, batch numbers, expiry dates, manufacturer names

THEN extract:
- BATCH NUMBER (like "LOT123456" or "BATCH ABC123")
- EXPIRY DATE (like "2025-12" or "EXP 2025")
- MANUFACTURER (company name like "Pfizer" or "GSK")

CRITICAL: Product name is the MOST IMPORTANT field. Look for the biggest, most prominent text first.

RESPONSE FORMAT (JSON only):
{
  "productName": "MAIN PRODUCT NAME HERE",
  "batchNumber": "BATCH/LOT NUMBER",
  "expiryDate": "EXPIRY DATE",
  "manufacturer": "MANUFACTURER NAME"
}`
  }

  private generateMultiImageOCRPrompt(imageCount: number): string {
    return `EXTRACT PHARMACEUTICAL PRODUCT INFORMATION FROM THESE ${imageCount} PACKAGING IMAGES.

YOU ARE PROVIDED WITH MULTIPLE IMAGES OF THE SAME PRODUCT PACKAGING. ANALYZE ALL IMAGES TOGETHER TO EXTRACT COMPLETE INFORMATION.

FIRST AND MOST IMPORTANT: Find the PRODUCT NAME (the main medicine name on the packaging).
Look through ALL images to find the most complete product name:
- Look for the LARGEST, MOST PROMINENT text on any packaging
- This is usually the medicine/drug name in big letters
- Examples: "Postinor 2", "Amoxicillin 500mg", "Paracetamol Tablets"
- May include dosage like "500mg" or form like "Tablets"
- IGNORE smaller text, batch numbers, expiry dates, manufacturer names

THEN extract from ALL images:
- BATCH NUMBER (like "LOT123456" or "BATCH ABC123") - may be on different images
- EXPIRY DATE (like "2025-12" or "EXP 2025") - may be on different images
- MANUFACTURER (company name like "Pfizer" or "GSK") - may be on different images

CRITICAL: Product name is the MOST IMPORTANT field. Look across all images for the complete product name.

INFORMATION MAY BE DISTRIBUTED ACROSS MULTIPLE IMAGES:
- Product name on one image
- Batch number on another image
- Expiry date on a third image
- Manufacturer on a fourth image

ANALYZE EACH IMAGE SYSTEMATICALLY AND COMBINE INFORMATION FROM ALL IMAGES.

RESPONSE FORMAT (JSON only):
{
  "productName": "MAIN PRODUCT NAME HERE",
  "batchNumber": "BATCH/LOT NUMBER",
  "expiryDate": "EXPIRY DATE",
  "manufacturer": "MANUFACTURER NAME",
  "imagesAnalyzed": ${imageCount},
  "extractionNotes": "Brief note about which information came from which image"
}`
  }

  private parseClaudeResponse(responseText: string): {
    productName?: string
    batchNumber?: string
    expiryDate?: string
    manufacturer?: string
    rawText?: string
    extractionNotes?: string
  } {
    try {
      console.log('🔍 Parsing Claude response for pharmaceutical data...')

      // Try to find JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          console.log('✅ Successfully parsed Claude JSON:', parsed)

          // Clean up the extracted data
          return {
            productName: parsed.productName && parsed.productName.trim() ? parsed.productName.trim() : undefined,
            batchNumber: parsed.batchNumber && parsed.batchNumber.trim() ? parsed.batchNumber.trim().toUpperCase() : undefined,
            expiryDate: parsed.expiryDate && parsed.expiryDate.trim() ? parsed.expiryDate.trim() : undefined,
            manufacturer: parsed.manufacturer && parsed.manufacturer.trim() ? parsed.manufacturer.trim() : undefined,
            rawText: responseText,
            extractionNotes: parsed.extractionNotes || 'Single image processing'
          }
        } catch (parseError) {
          console.warn('⚠️ JSON parse failed, attempting text extraction')
        }
      }

      // Try aggressive product name extraction from raw response
      const aggressiveExtraction = this.aggressiveProductNameExtraction(responseText)
      if (aggressiveExtraction.productName) {
        console.log('🎯 Aggressive extraction found product name:', aggressiveExtraction.productName)
        return {
          ...aggressiveExtraction,
          extractionNotes: 'Aggressive extraction from multi-image response'
        }
      }

      // Final fallback: Extract information from text response
      console.log('📝 Falling back to text-based extraction')
      const fallbackResult = this.extractFromClaudeText(responseText)
      return {
        ...fallbackResult,
        extractionNotes: 'Fallback text extraction from multi-image response'
      }

    } catch (error) {
      console.error('🚨 Claude response parsing error:', error)
      return {
        productName: undefined,
        batchNumber: undefined,
        expiryDate: undefined,
        manufacturer: undefined,
        rawText: responseText
      }
    }
  }

  private extractFromClaudeText(text: string): {
    productName?: string
    batchNumber?: string
    expiryDate?: string
    manufacturer?: string
    rawText?: string
  } {
    console.log('🔤 Extracting pharmaceutical information from Claude text...')

    const result: {
      productName?: string
      batchNumber?: string
      expiryDate?: string
      manufacturer?: string
      rawText?: string
    } = {}

    // Enhanced batch number extraction for pharmaceutical products
    const batchPatterns = [
      /(?:batch|bn|lot)[:\s]*([A-Z]+\d+[A-Z0-9]*)/gi, // T36184B, PCT2023002
      /(?:batch|bn|lot)[:\s]*([A-Z0-9]{6,})/gi,       // T36184B, 123ABC123
      /([A-Z]+\d{4,}[A-Z]*)/g,                         // Letter + numbers + optional letters
      /(?:batch\s*number|bn|lot\s*no)[:\s]*([^,\n\r]+)/gi // "BATCH: T36184B"
    ]

    for (const pattern of batchPatterns) {
      const match = pattern.exec(text)
      if (match && match[1]) {
        const batch = match[1].trim().toUpperCase()
        // Validate batch looks plausible
        if (batch.length >= 5 && batch.length <= 20 && !batch.includes(' ')) {
          result.batchNumber = batch
          console.log('🔢 Extracted batch number:', batch)
          break
        }
      }
    }

    // Enhanced product name extraction with more aggressive patterns
    const productPatterns = [
      // JSON field extraction (most reliable)
      /"productName"\s*:\s*"([^"]+)"/i,
      /productName["\s]*:[\s"]*([^",\n}\s]+)/i,

      // Direct product name mentions in text
      /(?:product name|medicine name|drug name)[:\s]*(?:is|was)?[:\s]*([A-Z][a-zA-Z\s&\d]+?)(?=\s|$|,|\n|\.|!|\?|")/i,
      /(?:the product|the medicine|the drug)[:\s]*(?:is|was)?[:\s]*([A-Z][a-zA-Z\s&\d]+?)(?=\s|$|,|\n|\.|!|\?|")/i,

      // Explicit product name patterns
      /(?:product|medicine|drug|name)[:\s]*([A-Z][a-zA-Z\s&\d]+?)(?=\s|$|,|\n|:|"}|\.)/i,
      /(?:productName|product_name)[:\s]*([A-Z][a-zA-Z\s&\d]+?)(?=\s|$|,|\n|:|"}|\.)/i,

      // Pharmaceutical naming patterns - more aggressive
      /^([A-Z][A-Z\s&\d]{3,30}?(?:\s\d+(?:mg|ml|g|mcg|IU|%))?)$/m, // Main product line
      /(?:named?|called?)[:\s]*([A-Z][a-zA-Z\s&\d]+?)(?=\s|$|,|\n|:|"}|\.)/i,

      // Generic product extraction from any text
      /([A-Z][a-zA-Z\s]{3,30}(?:\d+(?:mg|ml|g|mcg|IU|%))?(?:\s+[A-Z][a-zA-Z]{2,})*)/g,
      /([A-Z][a-zA-Z]{2,}\s+[A-Z][a-zA-Z]{2,})/g, // Two-word products

      // Specific pharmaceutical patterns - more inclusive
      /([A-Z][a-zA-Z\s]{3,30}(?:tablets?|capsules?|syrup|injection|cream|ointment|solution))/i,
      /([A-Z][a-zA-Z\s]{3,30}(?:\s\d+\w+))/i, // Product with dosage
      /([A-Z][a-zA-Z]{3,}\s*\d+(?:mg|ml|g|mcg|IU|%))/i, // Product + dosage

      // Fallback: any capitalized phrase that looks like a product name
      /\b([A-Z][a-z]{3,}\s+[A-Z][a-z]{2,})\b/g
    ]

    console.log('🔍 Looking for product names in response...')

    for (const pattern of productPatterns) {
      const matches = Array.from(text.matchAll(pattern))
      for (const match of matches) {
        if (match && match[1]) {
          const product = match[1].trim().replace(/["}]+$/, '') // Clean up JSON artifacts

          // Validate it looks like a pharmaceutical product
          if (product.length >= 3 && product.length <= 50
              && !/^\d+$/.test(product)  // Not just numbers
              && !product.toLowerCase().includes('batch')
              && !product.toLowerCase().includes('expiry')
              && !product.toLowerCase().includes('manufactured')
              && !product.toLowerCase().includes('company')
              && product !== 'null'
              && product !== 'undefined') {

            result.productName = product
            console.log('🏷️ Extracted product name:', product)
            console.log('🏷️ Using pattern:', pattern.source)
            break
          }
        }
      }
      if (result.productName) break // Stop at first valid match
    }

    // Additional validation - make sure it's not a manufacturer or other field
    if (result.productName) {
      const lowerName = result.productName.toLowerCase()
      if (lowerName.includes('ltd') || lowerName.includes('limited') ||
          lowerName.includes('pharma') || lowerName.includes('laboratories') ||
          lowerName.includes('manufacturers')) {
        console.log('⚠️ Product name appears to be manufacturer, clearing...')
        result.productName = undefined
      }
    }

    // Expiry date patterns
    const expiryPatterns = [
      /(?:exp|expiry|expdate)[:\s]*([\d\/\-\.]{4,})/gi,
      /expires?\s*([A-Z\d\/\-\.]{4,})/gi
    ]

    for (const pattern of expiryPatterns) {
      const match = pattern.exec(text)
      if (match && match[1]) {
        result.expiryDate = match[1].trim()
        console.log('📅 Extracted expiry date:', result.expiryDate)
        break
      }
    }

    // Manufacturer extraction
    const manufacturerPatterns = [
      /(?:made by|produced by|manufacturer|company)[:\s]*([A-Z][a-zA-Z\s&\.\-&\/]+?)(?=\s|$|,|\n|:)/i,
      /(?:by\s+)([A-Z][a-zA-Z\s&\.\-&\/]{3,30}?)(?=[\s|$|,|\n:])/mi
    ]

    for (const pattern of manufacturerPatterns) {
      const match = pattern.exec(text)
      if (match && match[1]) {
        const manufacturer = match[1].trim()
        if (manufacturer.length >= 3 && manufacturer.length <= 50) {
          result.manufacturer = manufacturer
          console.log('🏭 Extracted manufacturer:', manufacturer)
          break
        }
      }
    }

    return {
      ...result,
      rawText: text
    }
  }

  private calculateConfidence(extractedData: {
    productName?: string
    batchNumber?: string
    expiryDate?: string
    manufacturer?: string
  }): number {
    let confidence = 0

    // Base confidence for Claude Vision accuracy (decimal)
    confidence += 0.85

    // Batch number presence is most important
    if (extractedData.batchNumber) {
      confidence += 0.10 // +10% for having batch
      // Check if batch looks valid
      if (extractedData.batchNumber.length >= 6) {
        confidence += 0.05 // +5% for plausible batch format
      }
    }

    // Product name is very important
    if (extractedData.productName) {
      confidence += 0.08 // +8% for having product name
    }

    // Manufacturer presence
    if (extractedData.manufacturer) {
      confidence += 0.05 // +5% for having manufacturer
    }

    // Expiry date presence
    if (extractedData.expiryDate) {
      confidence += 0.02 // +2% for having expiry
    }

    // Limit confidence cap to 95% for single image
    return Math.min(confidence, 0.95)
  }

  // Aggressive product name extraction for verbose Claude responses
  private aggressiveProductNameExtraction(text: string): {
    productName?: string
    batchNumber?: string
    expiryDate?: string
    manufacturer?: string
    rawText?: string
  } {
    console.log('🔍 Running aggressive product name extraction...')

    const result: {
      productName?: string
      batchNumber?: string
      expiryDate?: string
      manufacturer?: string
      rawText?: string
    } = { rawText: text }

    // Look for any capitalized phrases that could be product names
    const capitalizedPhrases = text.match(/([A-Z][a-zA-Z\s]{3,30}(?:\d+(?:mg|ml|g|mcg|IU|%))?)/g)

    console.log('🔍 Found capitalized phrases:', capitalizedPhrases)

    if (capitalizedPhrases) {
      // Filter out obvious non-product names
      const potentialProducts = capitalizedPhrases.filter(phrase => {
        const lower = phrase.toLowerCase()
        return !lower.includes('batch') &&
               !lower.includes('expiry') &&
               !lower.includes('manufactur') &&
               !lower.includes('company') &&
               !lower.includes('ltd') &&
               !lower.includes('limited') &&
               !lower.includes('pharma') &&
               !lower.includes('laboratories') &&
               phrase.length >= 4 && phrase.length <= 50
      })

      console.log('🔍 Filtered potential products:', potentialProducts)

      // Take the first potential product as the most likely candidate
      if (potentialProducts.length > 0) {
        result.productName = potentialProducts[0].trim()
        console.log('🎯 Aggressive extraction found product:', result.productName)
      }
    }

    // Also try to extract batch numbers aggressively
    const batchMatch = text.match(/(?:batch|lot|bn)[:\s]*([A-Z0-9]{5,})/i)
    if (batchMatch && batchMatch[1]) {
      result.batchNumber = batchMatch[1].toUpperCase()
      console.log('🔢 Aggressive extraction found batch:', result.batchNumber)
    }

    return result
  }

  // Health check for Claude Vision API
  async checkHealth(): Promise<boolean> {
    try {
      // Simple health check - could send a minimal image request
      // For now, just check if API key is configured
      return !!this.apiKey && this.apiKey.length > 0
    } catch (error) {
      console.error('Claude Vision API health check failed:', error)
      return false
    }
  }
}
