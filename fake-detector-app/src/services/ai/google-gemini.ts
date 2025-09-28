import { AIProviderConfig, AIResponse, AIRequest } from './types-fixed'

// Setup axios for API calls
let axios: any = null

const loadAxios = async () => {
  if (!axios) {
    const axiosModule = await import('axios')
    axios = axiosModule.default
    console.log('✅ [Google AI] Axios loaded for API calls')
  }
}

// BUILD-TIME SAFE STUB - No Google Cloud code executed during Vercel build
class GeminiServiceStub {
  private config: AIProviderConfig
  private vertexAI: any = null
  private project: string = 'build-stub'
  private location: string = 'build-stub'

  constructor(config: AIProviderConfig) {
    this.config = config
    console.log('[BUILD-STUB] Gemini service initialized in safe build mode - no Google Cloud')
  }

  async processVision(request: AIRequest): Promise<AIResponse> {
    console.log(`[BUILD-STUB] Processing OCR request safely during build - ${request.images?.length || 0} images`)

    return {
      content: 'Service unavailable during build process',
      extractedData: null,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cost: 0
      },
      metadata: {
        model: this.config.modelName || 'gemini-2.0-flash',
        provider: 'google',
        responseTime: 0,
        success: true,
        finishReason: 'completed'
      }
    }
  }

  async processText(request: AIRequest): Promise<AIResponse> {
    console.log(`[BUILD-STUB] Processing text request safely during build`)

    return {
      content: 'Service unavailable during build process',
      extractedData: null,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cost: 0
      },
      metadata: {
        model: this.config.modelName || 'gemini-2.0-flash',
        provider: 'google',
        responseTime: 0,
        success: true,
        finishReason: 'completed'
      }
    }
  }

  async checkHealth(): Promise<boolean> {
    console.log('[BUILD-STUB] Health check - safe during build')
    return false // Indicate unavailable during build
  }
}

class GeminiServiceReal {
  private config: AIProviderConfig
  private project: string
  private location: string
  private storedCredentials?: string
  private storedProjectId?: string

  constructor(config: AIProviderConfig & {
    storedCredentials?: string | null
    storedProjectId?: string | null
  }) {
    this.config = config
    // Destructure stored credentials from config FIRST
    const { storedCredentials, storedProjectId } = config

    // PRODUCTION RUNTIME DETECTION
    const hasProductionEnvironment =
      process.env.NODE_ENV === 'production' &&
      process.env.DATABASE_URL &&
      (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || storedCredentials)

    // Set instance properties
    this.storedCredentials = storedCredentials || undefined
    this.storedProjectId = storedProjectId || undefined

    // Extract project and location from config or use defaults
    this.project = this.storedProjectId || process.env.GOOGLE_CLOUD_PROJECT || 'fake-detector-449119'
    this.location = 'us-central1' // Default Google Cloud region

    if (!hasProductionEnvironment) {
      console.log('[BUILD-ENV] Skipping Google Cloud initialization - not production environment')
      return
    }

    // No library-based initialization needed for raw HTTP approach
  }

  // Check if API key is available
  private getApiKey(): string | null {
    return process.env.GOOGLE_AI_API_KEY || null
  }

  async processVision(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now()

    console.log(`🤖 [Gemini Vision] Processing OCR request with raw HTTP - ${request.images?.length || 0} images`)

    try {
      await loadAxios()

      // Get API key from environment
      const apiKey = this.getApiKey()
      if (!apiKey) {
        throw new Error('Google AI API key not found in GOOGLE_AI_API_KEY environment variable')
      }

      // Generate prompt based on task type
      const prompt = this.generatePrompt(request.text, request.task)
      console.log(`💬 [Gemini Vision] Generated prompt: ${prompt.substring(0, 200)}...`)

      // Prepare content parts array
      const parts: any[] = [
        { text: prompt }
      ]

      // Convert images to Gemini format for inline data
      if (request.images && request.images.length > 0) {
        request.images.forEach(image => {
          let mimeType = 'image/png' // Default to PNG
          let imageData = image

          if (image.startsWith('data:')) {
            const dataUrlType = image.split('data:')[1].split(';')[0]
            // Convert common formats to Gemini-supported ones
            if (dataUrlType === 'image/jpeg' || dataUrlType === 'image/jpg') {
              mimeType = 'image/jpeg'
            } else if (dataUrlType === 'image/png') {
              mimeType = 'image/png'
            } else if (dataUrlType === 'image/gif') {
              mimeType = 'image/gif'
            } else if (dataUrlType === 'image/webp') {
              mimeType = 'image/webp'
            } else {
              // For unrecognized formats, default to PNG and let Gemini handle it
              mimeType = 'image/png'
            }
            imageData = image.split(',')[1] // Extract base64 data from data URL
            console.log(`🔧 [Gemini Vision] Detected format: ${dataUrlType} → Using: ${mimeType}`)
          }

          parts.push({
            inlineData: {
              mimeType: mimeType,
              data: imageData
            }
          })
        })
      }

      console.log(`🏗️ [Gemini Vision] Formatted ${request.images?.length || 0} image parts`)

      // Prepare the VertexAI API request payload
      const requestBody = {
        contents: [{
          role: 'user',
          parts: parts
        }],
        generationConfig: {
          temperature: this.config.temperature || 0.1, // Lower temperature for OCR accuracy
          maxOutputTokens: Math.min(request.maxTokens || 2048, this.config.maxTokens || 2048),
          topK: 32,
          topP: 1,
        }
      }

      // FORCE CORRECT MODEL: Always use gemini-2.0-flash (ignore database config)
      const modelName = 'gemini-2.0-flash'
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`

      console.log(`🌐 [Gemini Vision] Calling Google AI Gemini API: ${modelName}`)

      // Make raw HTTP call to Google AI Gemini API
      const response = await axios.post(
        endpoint,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey
          },
          timeout: 30000 // 30 second timeout
        }
      )

      console.log(`✅ [Gemini Vision] Raw HTTP API call successful`)

      // Process streaming response
      let content = ''
      if (response.data && Array.isArray(response.data)) {
        // Handle streaming response
        for (const chunk of response.data) {
          if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
            for (const part of chunk.candidates[0].content.parts) {
              if (part.text) {
                content += part.text
              }
            }
          }
        }
      } else if (response.data && response.data.candidates && response.data.candidates[0]) {
        // Handle non-streaming response
        const candidate = response.data.candidates[0]
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) {
              content += part.text
            }
          }
        }
      }

      if (!content) {
        throw new Error('No content in Gemini Vision response')
      }

      const responseTime = Date.now() - startTime

      // Extract structured data based on task type
      const extractedData = this.extractStructuredData(content, request.task)

      return {
        content,
        extractedData,
        usage: {
          inputTokens: Math.ceil(request.text.length / 4) + (request.images?.length || 0) * 85, // Approximate tokens
          outputTokens: Math.ceil(content.length / 4),
          cost: this.calculateCost(request.text.length, content.length, request.images?.length || 0)
        },
        metadata: {
          model: modelName,
          provider: 'google',
          responseTime,
          success: true,
          finishReason: 'completed'
        }
      }
    } catch (error: any) {
      console.error('Google Gemini Vision error:', error.response?.data || error.message)

      return {
        content: '',
        extractedData: null,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          cost: 0
        },
        metadata: {
          model: this.config.modelName || 'gemini-2.0-flash',
          provider: 'google',
          responseTime: Date.now() - startTime,
          success: false,
          error: error.response?.data?.error?.message || error.message || 'Unknown error',
          finishReason: 'error'
        }
      }
    }
  }

  async processText(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now()

    console.log(`🤖 [Gemini Text] Processing text request with raw HTTP`)

    try {
      await loadAxios()

      // Get API key from environment
      const apiKey = this.getApiKey()
      if (!apiKey) {
        throw new Error('Google AI API key not found in GOOGLE_AI_API_KEY environment variable')
      }

      // Generate prompt based on task type
      const prompt = this.generatePrompt(request.text, request.task)

      // Prepare the Google AI API request payload for text-only
      const requestBody = {
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: this.config.temperature || 0.7,
          maxOutputTokens: Math.min(request.maxTokens || 2048, this.config.maxTokens || 2048),
          topK: 40,
          topP: 0.95,
        }
      }

      // FORCE CORRECT MODEL: Always use gemini-2.0-flash (ignore database config)
      const modelName = 'gemini-2.0-flash'
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`

      console.log(`🌐 [Gemini Text] Calling Google AI Gemini API: ${modelName}`)

      // Make raw HTTP call to Google AI Gemini API
      const response = await axios.post(
        endpoint,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey
          },
          timeout: 30000
        }
      )

      console.log(`✅ [Gemini Text] Raw HTTP API call successful`)

      // Process streaming response
      let content = ''
      if (response.data && Array.isArray(response.data)) {
        for (const chunk of response.data) {
          if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
            for (const part of chunk.candidates[0].content.parts) {
              if (part.text) {
                content += part.text
              }
            }
          }
        }
      } else if (response.data && response.data.candidates && response.data.candidates[0]) {
        const candidate = response.data.candidates[0]
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) {
              content += part.text
            }
          }
        }
      }

      if (!content) {
        throw new Error('No content in Gemini Text response')
      }

      const responseTime = Date.now() - startTime

      // Extract structured data based on task type
      const extractedData = this.extractStructuredData(content, request.task)

      return {
        content,
        extractedData,
        usage: {
          inputTokens: Math.ceil(request.text.length / 4),
          outputTokens: Math.ceil(content.length / 4),
          cost: this.calculateCost(request.text.length, content.length)
        },
        metadata: {
          model: modelName,
          provider: 'google',
          responseTime,
          success: true,
          finishReason: 'completed'
        }
      }

    } catch (error: any) {
      console.error('Google Gemini Text error:', error.response?.data || error.message)

      return {
        content: '',
        extractedData: null,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          cost: 0
        },
        metadata: {
          model: 'gemini-2.0-flash',
          provider: 'google',
          responseTime: Date.now() - startTime,
          success: false,
          error: error.response?.data?.error?.message || error.message || 'Unknown error',
          finishReason: 'error'
        }
      }
    }
  }

  private generatePrompt(text: string, task: string): string {
    const basePrompts = {
      ocr: `ENHANCED PHARMACEUTICAL OCR ANALYSIS - MULTI-IMAGE SYNTHESIS PROTOCOL

MISSION: Extract COMPLETE product name AND batch number from multiple images, intelligently combining information split across packaging views.

PHASE 1 - POSITION-SPECIFIC IMAGE ANALYSIS:
🖼️ IMAGE 1 (FRONT/LABEL FACE):
   - PRIMARY SEEK: Large branding text, main drug name, dosage information
   - TYPICALLY CONTAINS: "AMOXICILLIN 500mg", "VITAMIN C 1000mg TABLETS"
   - RARELY CONTAINS: Batch numbers are usually NOT on front face

�️ IMAGE 2 (BACK/INFORMATION PANEL):
   - PRIMARY SEEK: Manufacturing details, regulatory compliance info
   - TYPICALLY CONTAINS: Batch numbers, expiry dates, manufacturing codes
   - LOOK FOR: "AS123456", "BT78901", "EXP: 2025/12/31")

�️ IMAGE 3+ (SIDE/SIDE PANELS):
   - SCAN FOR: Additional batch codes, supplementary product info
   - COMBINE WITH: Main information from primary images

PHASE 2 - REAL-WORLD SCENARIO DETECTION:
🔍 ANALYZE PACKAGING PATTERNS:
   - IF Front has "VITAMIN C 1000mg" but no batch → Expect batch on back
   - IF Back has "BT56321" but no product name → Expect name on front
   - IF Side labels exist → Check for additional regulatory info

PHASE 2 - TARGETED EXTRACTION BY IMAGE:
🏷️ PRODUCT NAME: Main medicine name, dosage, strength (e.g., "Vitamin C 1000mg", "Amoxicillin Capsules")
    - Look for largest/most prominent text on packaging
    - Include strength/dosage (mg, ml, IU, mcg)
    - May be on front, back, or side of packaging
🇦🇹 BATCH NUMBER: Manufacturing codes - ALWAYS EXTRACT (e.g., "ASCORBIC2023", "T36184B", "UI4004", "PCT2023002")
    - Look for patterns: Letters + numbers, numbers only (up to 12 chars)
    - Associated with "Batch", "Lot", "BN", "BL", "Lot No"
    - Never skip batch numbers - they're critical for verification

PHASE 3 - INTELLIGENT CROSS-IMAGE SYNTHESIS:
🔄 SCENARIO A - Product on Front, Batch on Back:
   - Front: "VITAMIN C 1000mg" (no batch)
   - Back: "Batch: VC20241502" (batch only)
   - RESULT: productName="VITAMIN C 1000mg", batchNumbers=["VC20241502"]

🔄 SCENARIO B - Batch on Front, Product Details on Back:
   - Front: "ASCORBIC404" (batch number only)
   - Back: "Ascorbic Acid Tablets USP" (product details)
   - RESULT: productName="Ascorbic Acid Tablets USP", batchNumbers=["ASCORBIC404"]

🔄 SCENARIO C - Information Split Across Multiple Views:
   - Image 1: Product name incomplete ("AMOXICILLIN...")
   - Image 2: Complete name + batch ("...500mg CAPSULES", "Batch: AMX500")
   - RESULT: Combine for complete information

🔄 SCENARIO D - Regulatory Info Spread Across Labels:
   - Front/Side: Brand name, dosage
   - Back: Batch numbers, manufacturing codes
   - COMBINE: All critical verification information

PHASE 4 - VALIDATION & CORRECTION:
✅ Ensure productName is NOT empty ("Product Name" or similar defaults are invalid)
✅ Ensure batchNumbers array is NOT empty (must have at least 1 entry)
✅ If missing either → explicitly re-scan with focused questions
✅ Confidence calculation must reflect completeness of data

SMART DISTRIBUTION DETECTION:
🎯 Single Image Has All: Extract normally
🎯 Split Information: Map and extract from appropriate sources
🎯 Missing Critical Data: Trigger secondary pass analysis

BATCH NUMBER SUPER-PRIORITY (MANDATORY):
- Text like "ASCORBIC2023" → BATCH NUMBER
- Text like "T36184B" → BATCH NUMBER
- Text like "UI4004" → BATCH NUMBER
- Text like "PCT2023002" → BATCH NUMBER
- Numbers like "39090439" → POTENTIAL BATCH NUMBER
- NEVER skip batch numbers - they're verification-critical

PRODUCT NAME INTELLIGENT EXTRACTION:
- Look for drug/medication names in large text
- Include dosage: "Amoxicillin 500mg", "Vitamin C 1000 Tablets"
- Capture brand names, generic names, full specifications
- NEVER use generic placeholders - must be specific to product

MULTI-IMAGE RESPONSE REQUIREMENT:
{
  "productName": "EXACT NAME FROM ANY IMAGE",
  "batchNumbers": ["EXACT BATCH FROM ANY IMAGE"],
  "extractionSource": {
    "productFromImage": 1 or 2,
    "batchFromImage": 1 or 2
  },
  "confidence": 0.85
}

MANDATORY: Both productName and batchNumbers must be populated with real extracted data.`,

      verification: `
        You are checking if a product matches known counterfeit/recall databases.

        PRODUCT INFORMATION: ${text}

        Analyze for counterfeit indicators and return JSON:
        {
          "isCounterfeit": boolean,
          "confidence": number (0-1),
          "reason": "why this product may be counterfeit/recalled",
          "riskLevel": "LOW/MEDIUM/HIGH/CRITICAL",
          "recommendation": "what user should do"
        }

        Be conservative - only flag as counterfeit with strong evidence.
        Return valid JSON only.
      `,

      extraction: `
        Extract structured product information from the following alert text.

        ALERT TEXT: ${text}

        Extract and structure:
        {
          "productNames": ["list of all product names mentioned"],
          "batchNumbers": ["list of all batch numbers mentioned"],
          "reason": "why this product was recalled/banned/faked",
          "category": "RECALL/COUNTERFEIT/EXPIRED/QUALITY_ISSUE",
          "manufacturer": "company that made the product",
          "affectedRegions": ["geographical areas affected"],
          "severity": "HIGH/MEDIUM/LOW"
        }

        Focus on accuracy over completeness. Return valid JSON only.
      `
    }

    return basePrompts[task as keyof typeof basePrompts] ||
           `Process this text and extract key information: ${text}`
  }

  private extractStructuredData(content: string, task: string): {
    productName?: string
    batchNumbers?: string[]
    manufacturers?: string[]
    expiryDate?: string
    confidence?: number
    isCounterfeit?: boolean
    riskLevel?: 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL'
    reason?: string
    recommendation?: string
    productNames?: string[]
    category?: 'COUNTERFEIT' | 'RECALL' | 'EXPIRED' | 'QUALITY_ISSUE'
    severity?: 'HIGH' | 'MEDIUM' | 'LOW'
    manufacturer?: string
    affectedRegions?: string[]
    [key: string]: string | string[] | number | boolean | 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL' | 'COUNTERFEIT' | 'RECALL' | 'EXPIRED' | 'QUALITY_ISSUE' | undefined
  } {
    try {
      // Try to parse as JSON first
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }

      // Fallback: extract structured information from text response
      switch (task) {
        case 'authentication':
          return this.extractOCRFromText(content)
        case 'verification':
          return this.extractVerificationFromText(content)
        case 'extraction':
          return this.extractAlertFromText(content)
        default:
          return { rawResponse: content }
      }
    } catch (error) {
      console.warn('Failed to extract structured data:', error)
      return { rawResponse: content }
    }
  }

  private extractOCRFromText(text: string): {
    productName?: string
    batchNumbers?: string[]
    manufacturers?: string[]
    expiryDate?: string
    confidence?: number
    [key: string]: string | string[] | number | undefined
  } {
    const result: {
      productName?: string
      batchNumbers?: string[]
      manufacturers?: string[]
      expiryDate?: string
      confidence?: number
      [key: string]: string | string[] | number | undefined
    } = {}

    // Enhanced batch number extraction for multi-image scenario
    const batchPatterns = [
      // JSON field extraction (from new multi-image prompt)
      /\bbatchNumbers?:?\s*[\[{]\s*["']([A-Z0-9\-_\s]+)["']\s*[}\]]/gi,
      /(?:batch|lot)\s*(?:number|no\.?)?\s*:?\s*["']([A-Z0-9\-_\s]+)["']/gi,

      // Standard patterns
      /(?:batch|lot)\s*(?:number|no\.?)?\s*:?\s*([A-Z0-9\-\/\.\s]+)/gi,
      /\bbatchNumbers?:\s*\[\s*["']([A-Z0-9\-_\s]+)["']\s*\]/gi,

      // Multi-image patterns
      /["']([A-Z]+\d{4,12}[A-Z]*)["']\s*,?\s*"batchNumber"/gi,
      /["']([A-Z]{1,3}\d{4,8}[A-Z]*)["']\s*["']?\s*,?\s*\]/gi,

      // Fallback: any alphanumeric pattern that looks like batch
      /\b([A-Z]{1,4}\d{4,8}[A-Z]*)\b/g
    ]

    const uniqueBatches = new Set<string>()
    for (const pattern of batchPatterns) {
      const matches = Array.from(text.matchAll(pattern), match => match[1])
      matches.forEach(batch => {
        if (batch && batch.trim().length >= 4 && batch.trim().length <= 20) {
          uniqueBatches.add(batch.trim().toUpperCase())
        }
      })
    }

    if (uniqueBatches.size > 0) {
      result.batchNumbers = Array.from(uniqueBatches)
      console.log(`✅ Extracted batch numbers from text: ${result.batchNumbers.join(', ')}`)
    }

    // Enhanced product name extraction for multi-image scenario
    const productPatterns = [
      // JSON field extraction (from new multi-image prompt)
      /\bproductName"?\s*:\s*"([^"]+)"/i,
      `"productName":\s*"([^"]+)"`,

      // Standard patterns
      /(?:product|medicine|drug)\s*:?\s*([^&\n\r]{3,})/i,
      `"name":\s*"([^"]+)"`,

      // Multi-image patterns - look for main medicine names
      /(?:amoxicillin|paracetamol|vitamin|aspirin|ibuprofen)[^\n]+(?:capsules?|tablets?|syrup?|mg|ml)/i,
      /([A-Z][a-zA-Z]{3,20}(?:\s+[A-Z][a-zA-Z]{2,15})*\s+\d+(?:mg|ml|g|mcg|IU))/g,

      // Additional pharmaceutical patterns
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Inj|Inj\.|Injection|Tab|Tab\.|Tablet|Cap|Cap\.|Capsule|Syrup|Susp|Susp\.|Suspension|Cream|Oint|Oint\.|Ointment|Gel|Lotion))\s*\d*/i
    ]

    for (const pattern of productPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const potentialName = match[1].trim()
        // Define invalid placeholder names that should be IGNORED entirely
        const invalidNames = ['unknown', 'product name', 'n/a', 'not found', 'missing', 'none', 'placeholder', 'dummy']

        // Validate it looks like a proper pharmaceutical name and isn't a placeholder
        if (potentialName.length >= 3 && potentialName.length <= 100
            && !potentialName.toLowerCase().includes('batch')
            && !potentialName.toLowerCase().includes('expiry')
            && !/^\d+$/.test(potentialName)
            && !invalidNames.some(invalid => potentialName.toLowerCase().includes(invalid))) {

          // IGNORE APPROACH: Never store invalid names - if we have an invalid existing name,
          // clear it so valid names can take priority
          const hasInvalidExistingName = result.productName && invalidNames.some(invalid => result.productName!.toLowerCase().includes(invalid))

          if (!result.productName || hasInvalidExistingName) {
            // No existing valid name, or existing name is invalid - set the new valid name
            result.productName = potentialName
            console.log(`✅ Extracted product name from text: "${potentialName}" (ignored invalid existing name: ${hasInvalidExistingName ? 'yes' : 'no'})`)
            break
          } else {
            // If we already have a valid product name, only replace if this one is clearly better
            const currentIsPharma = /[mg|ml|g|mcg|iu|tablet|capsule|injection|syrup]/i.test(result.productName!)
            const newIsPharma = /[mg|ml|g|mcg|iu|tablet|capsule|injection|syrup]/i.test(potentialName)

            if (newIsPharma && !currentIsPharma) {
              console.log(`🔄 Upgrading product name: "${result.productName}" → "${potentialName}"`)
              result.productName = potentialName
              break
            }
          }
        }
      }
    }

    // Enhanced manufacturer extraction
    const manufacturerPatterns = [
      /\bmanufacturers?:?\s*[\[{]\s*["']([^"']+)["']\s*[}\]]/gi,
      /(?:manufactured\s+by|producer|company)[:\s]*([^&\n\r]{3,})/i
    ]

    for (const pattern of manufacturerPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const manufacturer = match[1].trim()
        if (manufacturer.length >= 3 && manufacturer.length <= 100) {
          if (!result.manufacturers) result.manufacturers = []
          if (!result.manufacturers.includes(manufacturer)) {
            result.manufacturers.push(manufacturer)
          }
        }
      }
    }

    // Extract expiry date
    const expiryRegex = /(?:expiry|exp)\s*(?:date)?\s*:?\s*([\d\/\-\.]+)/i
    const expiryMatch = text.match(expiryRegex)
    if (expiryMatch) result.expiryDate = expiryMatch[1]

    // Enhanced confidence calculation for multi-image Gemini
    let confidence = 0.5 // Higher base confidence for multi-image

    if (result.batchNumbers && result.batchNumbers.length > 0) {
      confidence += 0.25 // +25% for having batch numbers (crucial for verification)
    }

    if (result.productName) {
      confidence += 0.2 // +20% for having product name
    }

    if (result.manufacturers && result.manufacturers.length > 0) {
      confidence += 0.1 // +10% for having manufacturer
    }

    if (expiryMatch) {
      confidence += 0.05 // +5% for having expiry date
    }

    // Cap at 95% for multi-image extraction (higher than single image)
    result.confidence = Math.min(confidence, 0.95)

    // Add validation warnings
    const warnings = []
    if (!result.productName) {
      warnings.push('Product name not detected - critical for verification')
    }
    if (!result.batchNumbers || result.batchNumbers.length === 0) {
      warnings.push('Batch number not detected - critical for verification')
    }

    if (warnings.length > 0) {
      console.warn(`⚠️ Multi-image extraction warnings: ${warnings.join(', ')}`)
    }

    return result
  }

  private extractVerificationFromText(text: string): {
    isCounterfeit?: boolean
    confidence?: number
    riskLevel?: 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL'
    reason?: string
    recommendation?: string
    [key: string]: string | number | boolean | 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL' | undefined
  } {
    const result: {
      isCounterfeit?: boolean
      confidence?: number
      riskLevel?: 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL'
      reason?: string
      recommendation?: string
      [key: string]: string | number | boolean | 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL' | undefined
    } = {}

    // Check for counterfeit indicators
    const counterfeitIndicators = /(?:fake|counterfeit|falsified|spurious|adulterated)/i
    const recallIndicators = /(?:recall|withdraw|seizure|ban)/i

    const isCounterfeit = counterfeitIndicators.test(text) || recallIndicators.test(text)
    result.isCounterfeit = isCounterfeit

    // Determine risk level
    if (isCounterfeit) {
      result.riskLevel = text.includes('adulterated') ? 'CRITICAL' : 'HIGH'
      result.reason = text.match(/(?:because|due to|reason)[^\n\r]{10,}/i)?.[0] || 'Product matches suspicious activity'
      result.recommendation = 'Do not use this product. Contact manufacturer or regulatory authority.'
    } else {
      result.riskLevel = 'LOW'
      result.reason = 'No counterfeit indicators found'
      result.recommendation = 'Product appears safe, but verify with manufacturer if concerned.'
    }

    // Enhanced confidence for verification results
    if (isCounterfeit) {
      result.confidence = 0.85 // High confidence for counterfeit detection
    } else {
      result.confidence = 0.75 // Moderate confidence for genuine products
    }

    return result
  }

  private extractAlertFromText(text: string): {
    productNames?: string[]
    batchNumbers?: string[]
    affectedRegions?: string[]
    reason?: string
    category?: 'RECALL' | 'COUNTERFEIT' | 'EXPIRED' | 'QUALITY_ISSUE'
    manufacturer?: string
    severity?: 'HIGH' | 'MEDIUM' | 'LOW'
    confidence?: number
    [key: string]: string | string[] | 'RECALL' | 'COUNTERFEIT' | 'EXPIRED' | 'QUALITY_ISSUE' | 'HIGH' | 'MEDIUM' | 'LOW' | number | undefined
  } {
    const result: {
      productNames?: string[]
      batchNumbers?: string[]
      affectedRegions?: string[]
      reason?: string
      category?: 'RECALL' | 'COUNTERFEIT' | 'EXPIRED' | 'QUALITY_ISSUE'
      manufacturer?: string
      severity?: 'HIGH' | 'MEDIUM' | 'LOW'
      confidence?: number
      [key: string]: string | string[] | 'RECALL' | 'COUNTERFEIT' | 'EXPIRED' | 'QUALITY_ISSUE' | 'HIGH' | 'MEDIUM' | 'LOW' | number | undefined
    } = { productNames: [], batchNumbers: [], affectedRegions: [] }

    // Extract product names
    const productPatterns = [
      /(?:product|medicine|drug)[s]?[:\s]*([^\n\r]{3,30})/gi,
      /(?:recall|withdraw)[^\n\r]*([^\n\r]{3,30})/gi
    ]

    productPatterns.forEach(pattern => {
      const matches = Array.from(text.matchAll(pattern), m => m[1]?.trim()).filter(Boolean)
      if (!result.productNames) result.productNames = []
      result.productNames.push(...matches)
    })
    if (result.productNames) {
      result.productNames = [...new Set(result.productNames)]
    }

    // Extract batch numbers
    const batchPatterns = [
      /(?:batch|lot)\s*(?:number|no\.?)?\s*:?\s*([A-Z0-9\-\/\.\s]{15})/gi,
      /([A-Z]\d+[A-Z]?\d*[A-Z]?)/g
    ]

    batchPatterns.forEach(pattern => {
      const matches = Array.from(text.matchAll(pattern), m => m[1]?.trim()).filter(Boolean)
      if (!result.batchNumbers) result.batchNumbers = []
      result.batchNumbers.push(...matches)
    })
    if (result.batchNumbers) {
      result.batchNumbers = [...new Set(result.batchNumbers)]
    }

    // Determine reason
    if (/(?:fake|counterfeit|falsified)/i.test(text)) {
      result.reason = 'Product found to be counterfeit or falsified'
      result.category = 'COUNTERFEIT'
      result.severity = 'HIGH'
    } else if (/(?:recall|withdraw)/i.test(text)) {
      result.reason = 'Product recalled due to safety concerns'
      result.category = 'RECALL'
      result.severity = 'HIGH'
    } else if (/(?:expired|adulterated)/i.test(text)) {
      result.reason = 'Product expired or found to be adulterated'
      result.category = 'EXPIRED'
      result.severity = 'MEDIUM'
    } else {
      result.reason = 'Quality or safety concern detected'
      result.category = 'QUALITY_ISSUE'
      result.severity = 'MEDIUM'
    }

    // Extract manufacturer
    const manufacturerMatch = text.match(/(?:manufacturer|producer|company)[^\n\r]*([^\n\r]{3,25})/i)
    if (manufacturerMatch) result.manufacturer = manufacturerMatch[1].trim()

    // Add confidence score for alert extraction
    result.confidence = Math.min((result.productNames?.length || 0) * 0.1 + (result.batchNumbers?.length || 0) * 0.15 + 0.5, 0.9)

    return result
  }

  private calculateCost(inputChars: number, outputChars: number, imageCount: number = 0): number {
    // Google Gemini pricing (approximate)
    const inputCostPerChar = 0.00000025 // $0.15 per 1M chars
    const outputCostPerChar = 0.000001 // $0.60 per 1M chars
    const imageCostPerImage = 0.0025 // $0.0025 per image for Gemini Vision

    const inputCost = inputChars * inputCostPerChar
    const outputCost = outputChars * outputCostPerChar
    const imageCost = imageCount * imageCostPerImage

    return inputCost + outputCost + imageCost
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Health check - check if API key is available
      const apiKey = this.getApiKey()
      return apiKey !== null && apiKey.length > 0
    } catch {
      return false
    }
  }
}

// FACTORY FUNCTION APPROACH - Clean Runtime Service Selection
// This ensures NO Google Cloud code is imported/executed during Vercel builds
export function createGeminiService(config: AIProviderConfig & {
  storedCredentials?: string | null
  storedProjectId?: string | null
}) {
  const { storedCredentials, storedProjectId, ...baseConfig } = config

  // PRODUCTION DETECTION: Check if running in production
  const hasProductionEnvironment =
    process.env.NODE_ENV === 'production' &&
    process.env.DATABASE_URL &&
    process.env.GOOGLE_AI_API_KEY

  if (hasProductionEnvironment) {
    // Create real service and pass stored credentials if available
    const realService = new GeminiServiceReal(baseConfig)

    // If we have stored credentials, set them on the service for future use
    if (storedCredentials && realService) {
      // @ts-expect-error - setting internal property for credential persistence
      realService._storedJsonCredentials = storedCredentials
      if (storedProjectId) {
        // @ts-expect-error - we'll use these stored credentials in the service
        realService._storedProjectId = storedProjectId
      }
      console.log('🔄 [Gemini Factory] Copied stored credentials to real service instance')
    }

    return realService
  } else {
    return new GeminiServiceStub(baseConfig)
  }
}

// Type alias for interface compatibility - use the stub's interface for all cases
export type GeminiServiceType = GeminiServiceStub
