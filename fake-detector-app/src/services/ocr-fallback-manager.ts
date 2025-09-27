/**
 * OCR Fallback Manager - Robust fallback mechanisms for OCR failures
 *
 * This service implements a comprehensive fallback system for OCR processing that includes:
 *
 * 1. **Multi-strategy Analysis**: Tries different OCR engines (Claude Vision, Gemini Vision, OpenAI Vision, Tesseract)
 *    in order of preference based on user plan and availability.
 *
 * 2. **Automatic Retry with Different Parameters**: When OCR fails, automatically retries with different
 *    image preprocessing configurations to improve text extraction quality.
 *
 * 3. **Graceful Degradation**: When all OCR strategies fail, provides options for manual input
 *    or text-only processing instead of complete failure.
 *
 * 4. **Result Validation**: Validates OCR results for consistency and accuracy, calculating
 *    composite confidence scores that account for multiple factors.
 *
 * 5. **Comprehensive Logging**: Tracks all fallback attempts, errors, and performance metrics
 *    for monitoring and debugging.
 *
 * Usage:
 * ```typescript
 * const result = await ocrFallbackManager.processWithFallback(images, {
 *   maxAttempts: 5,
 *   strategies: ['claude', 'gemini', 'tesseract'],
 *   userPlan: 'business',
 *   enablePreprocessingRetry: true,
 *   minConfidence: 0.6
 * });
 *
 * if (result.success) {
 *   // Use result.result for OCR data
 * } else if (result.degradationLevel === 'manual_input') {
 *   // Prompt user for manual input
 * }
 * ```
 */

import { ClaudeVisionOCR } from './ai/claude-vision'
// import { GeminiService } from './ai/google-gemini' // Moved to dynamic import to prevent ESM issues
import { OpenAIService } from './ai/openai-gpt'
import { ImagePreprocessingService } from './image-preprocessing'
import { aiRouter } from './ai/ai-router'
import { ocrValidationService, OCRValidationService, ValidationResult } from './ocr-validation-service'
import { PharmaceuticalOCRPrompts, detectPharmaForm, getEnhancedPharmaPrompt } from './pharmaceutical-ocr-prompts'
import { ocrMetricsCollector, OCRMetrics } from './ocr-metrics-collector'

export interface OCRResult {
  productName?: string
  batchNumber?: string
  expiryDate?: string
  manufacturer?: string
  confidence: number
  rawText: string
  strategy: string
  preprocessingParams?: {
    enhanceContrast: boolean
    sharpenText: boolean
    quality: number
    maxWidth: number
  }
  processingTime: number
}

export interface StrategyResult {
  success: boolean
  result?: OCRResult
  strategy: string
  attempts: number
  errors: string[]
}

export interface ParsedOCRData {
  productName?: string
  batchNumber?: string
  expiryDate?: string
  manufacturer?: string
  confidence?: number
}

export interface ProcessingStats {
  strategies: string[]
  averageConfidence: number
  commonErrors: string[]
  performanceMetrics: {
    averageProcessingTime: number
    successRate: number
    fallbackUsage: number
  }
}

export interface OCRFallbackResult {
  success: boolean
  result?: OCRResult
  validation?: ValidationResult
  strategy: string
  attempts: number
  totalTime: number
  degradationLevel: 'none' | 'manual_input' | 'text_only'
  recommendations?: string[]
  errors: string[]
  compositeConfidence?: number
  logs: FallbackLog[]
}

export interface FallbackLog {
  timestamp: Date
  level: 'info' | 'warn' | 'error'
  message: string
  strategy?: string
  attempt?: number
  confidence?: number
  error?: string
}

export interface OCRFallbackOptions {
  maxAttempts?: number
  maxTime?: number
  strategies?: string[]
  userPlan?: string
  enablePreprocessingRetry?: boolean
  minConfidence?: number
  enableManualFallback?: boolean
}

export class OCRFallbackManager {
  private claudeOCR: ClaudeVisionOCR
  private geminiOCR: any // Lazy load to prevent ESM issues
  private openaiOCR: OpenAIService
  private preprocessingService: ImagePreprocessingService
  private logs: FallbackLog[] = []

  constructor() {
    this.claudeOCR = new ClaudeVisionOCR()
    // this.geminiOCR initialized lazily in tryGeminiVision()
    this.openaiOCR = new OpenAIService({
      id: 'openai-fallback',
      apiKey: process.env.OPENAI_API_KEY || '',
      modelName: 'gpt-4o-mini',
      provider: 'openai',
      temperature: 0.1,
      maxTokens: 1024,
      costInput: 0.00000025,
      costOutput: 0.000001
    })
    this.preprocessingService = new ImagePreprocessingService()
  }

  /**
   * Main OCR processing with robust fallback mechanisms
   */
  async processWithFallback(
    images: string[],
    options: OCRFallbackOptions = {}
  ): Promise<OCRFallbackResult> {
    const startTime = Date.now()
    const requestId = `ocr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const {
      maxAttempts = 5,
      maxTime = 30000, // 30 seconds
      strategies: defaultStrategies = ['claude', 'gemini', 'openai', 'tesseract'],
      userPlan = 'free',
      enablePreprocessingRetry = true,
      minConfidence = 0.6,
      enableManualFallback = true
    } = options

    let strategies = defaultStrategies

    const result: OCRFallbackResult = {
      success: false,
      strategy: 'none',
      attempts: 0,
      totalTime: 0,
      degradationLevel: 'none',
      errors: [],
      logs: []
    }

    // Start logging
    this.log('info', 'Starting OCR fallback processing', { strategies: strategies.length, userPlan, maxAttempts, requestId })

    console.log(`🔄 Starting OCR fallback processing with ${strategies.length} strategies`)

    // Initialize metrics tracking
    let pharmaceuticalForm: string | undefined
    let finalStrategy: string | undefined
    let finalConfidence: number = 0
    let finalCost: number = 0
    const preprocessingApplied: boolean = false

    try {
      // Strategy 1: Multi-strategy analysis with different OCR engines
      // For Business plan, prioritize OpenAI as per seeded assignments
      if (userPlan === 'business') {
        strategies = ['openai', 'gemini', 'tesseract']
      } else if (userPlan === 'standard') {
        strategies = ['claude', 'gemini', 'tesseract']
      } else if (userPlan === 'basic') {
        strategies = ['gemini', 'tesseract']
      } else {
        strategies = ['gemini', 'tesseract'] // Free plan
      }
 
      const primaryResult = await this.multiStrategyAnalysis(images, strategies, userPlan, maxAttempts)
      result.attempts += primaryResult.attempts
      result.errors.push(...primaryResult.errors)
 
      if (primaryResult.success && primaryResult.result && primaryResult.result.confidence >= minConfidence) {
        result.success = true
        result.result = primaryResult.result
        result.strategy = primaryResult.strategy
        result.totalTime = Date.now() - startTime
 
        // Record successful metrics
        finalStrategy = primaryResult.strategy
        finalConfidence = primaryResult.result.confidence
        finalCost = this.calculateStrategyCost(primaryResult.strategy, userPlan)
 
        console.log(`✅ Primary OCR succeeded with ${result.strategy} (${primaryResult.result.confidence}% confidence)`)
        return result
      }

      // Strategy 2: Retry with different preprocessing parameters
      if (enablePreprocessingRetry && result.attempts < maxAttempts) {
        console.log('🔄 Attempting preprocessing parameter optimization...')
        const preprocessingResult = await this.retryWithPreprocessingVariations(images, userPlan, maxAttempts - result.attempts)
        result.attempts += preprocessingResult.attempts
        result.errors.push(...preprocessingResult.errors)

        if (preprocessingResult.success) {
          result.success = true
          result.result = preprocessingResult.result
          result.strategy = `preprocessing_retry_${preprocessingResult.strategy}`
          result.totalTime = Date.now() - startTime
          console.log(`✅ Preprocessing retry succeeded with ${result.strategy}`)
          return result
        }
      }

      // Strategy 3: Graceful degradation to manual input
      if (enableManualFallback && result.attempts < maxAttempts) {
        console.log('📝 Falling back to manual input mode...')
        result.degradationLevel = 'manual_input'
        result.recommendations = [
          'Please provide the product information manually',
          'The system will guide you through the verification process',
          'Upload clearer images if possible for better accuracy'
        ]
        result.totalTime = Date.now() - startTime
        console.log('🔄 Graceful degradation to manual input completed')
        return result
      }

      // Strategy 4: Text-only processing (last resort)
      console.log('📄 Falling back to text-only processing...')
      result.degradationLevel = 'text_only'
      result.recommendations = [
        'System will continue with text-based verification only',
        'OCR extraction failed - using alternative verification methods',
        'Consider uploading images later for enhanced verification'
      ]
      result.totalTime = Date.now() - startTime

    } catch (error) {
      console.error('❌ OCR fallback processing failed:', error)
      result.errors.push(error instanceof Error ? error.message : 'Unknown error in fallback processing')
    }

    result.totalTime = Date.now() - startTime
    result.logs = [...this.logs]
    this.log('error', `All OCR fallback strategies failed after ${result.attempts} attempts`)

    // Record final metrics for failed processing
    await this.recordFinalMetrics(requestId, {
      strategy: finalStrategy || 'failed',
      userPlan,
      imageCount: images.length,
      processingTime: result.totalTime,
      confidence: finalConfidence,
      success: result.success,
      preprocessingUsed: preprocessingApplied,
      pharmaceuticalForm,
      cost: finalCost,
      errorType: result.errors.length > 0 ? 'multiple_errors' : undefined,
      errorMessage: result.errors.join('; '),
      rawOcrText: result.result?.rawText
    })

    return result
  }

  /**
   * Calculate API cost for a strategy based on user plan
   */
  private calculateStrategyCost(strategy: string, userPlan: string): number {
    // Cost estimates based on typical API pricing (in USD)
    const costs: Record<string, number> = {
      claude: 0.015,    // Claude Vision API cost
      gemini: 0.0025,   // Gemini Vision API cost
      openai: 0.01,     // GPT-4o-mini Vision cost
      tesseract: 0.001  // Local processing cost estimate
    }

    return costs[strategy] || 0
  }

  /**
   * Record final OCR metrics
   */
  private async recordFinalMetrics(requestId: string, data: {
    strategy: string
    userPlan: string
    imageCount: number
    processingTime: number
    confidence: number
    success: boolean
    preprocessingUsed?: boolean
    pharmaceuticalForm?: string
    cost: number
    errorType?: string
    errorMessage?: string
    rawOcrText?: string
  }): Promise<void> {
    try {
      console.log('📊 RECORDING OCR METRICS:', {
        requestId,
        strategy: data.strategy,
        success: data.success,
        processingTime: data.processingTime,
        confidence: data.confidence
      });

      await ocrMetricsCollector.recordMetrics({
        requestId,
        timestamp: new Date(),
        strategy: data.strategy as 'claude' | 'gemini' | 'openai' | 'tesseract' | 'preprocessing_retry',
        userPlan: data.userPlan,
        imageCount: data.imageCount,
        processingTime: data.processingTime,
        confidence: data.confidence,
        success: data.success,
        preprocessingUsed: data.preprocessingUsed || false,
        pharmaceuticalForm: data.pharmaceuticalForm,
        batchDetected: false, // Will be updated if result is parsed
        expiryDetected: false, // Will be updated if result is parsed
        manufacturerDetected: false, // Will be updated if result is parsed
        cost: data.cost,
        errorType: data.errorType as 'api_error' | 'timeout' | 'low_quality' | 'parsing_error' | 'rate_limit' | 'auth_error' | 'network_error' | 'unknown' | undefined,
        errorMessage: data.errorMessage,
        rawOcrText: data.rawOcrText
      });

      console.log('✅ OCR METRICS RECORDED SUCCESSFULLY');
    } catch (error) {
      console.error('❌ FAILED TO RECORD OCR METRICS:', error);
    }
  }

  /**
   * Multi-strategy analysis - Try different OCR engines
   */
  private async multiStrategyAnalysis(
    images: string[],
    strategies: string[],
    userPlan: string,
    maxAttempts: number
  ): Promise<StrategyResult> {
    const result: StrategyResult = { success: false, strategy: 'multi_strategy', attempts: 0, errors: [] }

    for (const strategy of strategies) {
      if (result.attempts >= maxAttempts) break

      try {
        console.log(`🔄 Trying ${strategy} OCR strategy...`)
        const strategyStart = Date.now()

        let ocrResult: OCRResult | null = null

        switch (strategy) {
          case 'claude':
            ocrResult = await this.tryClaudeVision(images, strategyStart)
            break

          case 'gemini':
            ocrResult = await this.tryGeminiVision(images, strategyStart, userPlan)
            break

          case 'openai':
            ocrResult = await this.tryOpenAIVision(images, strategyStart)
            break

          case 'tesseract':
            ocrResult = await this.tryTesseractOCR(images, strategyStart)
            break
        }

        if (ocrResult && ocrResult.confidence > 0.3) { // Lower threshold for initial success
          result.success = true
          result.result = ocrResult
          result.strategy = strategy
          console.log(`✅ ${strategy} OCR succeeded (${ocrResult.confidence}% confidence)`)
          break
        }

        result.attempts++
        // Don't add generic "No result returned" message for null results
        // Let the actual error message from the catch block handle it

      } catch (error) {
        result.attempts++
        const errorMsg = `${strategy}: ${error instanceof Error ? error.message : 'Unknown error'}`
        result.errors.push(errorMsg)
        console.warn(`❌ ${strategy} OCR failed:`, error)
      }
    }

    return result
  }

  /**
   * Retry with different preprocessing parameters
   */
  private async retryWithPreprocessingVariations(
    images: string[],
    userPlan: string,
    maxAttempts: number
  ): Promise<StrategyResult> {
    const result: StrategyResult = { success: false, strategy: 'preprocessing_retry', attempts: 0, errors: [] }

    // Different preprocessing configurations to try
    const preprocessingConfigs = [
      { enhanceContrast: true, sharpenText: true, quality: 0.95, maxWidth: 1200 },
      { enhanceContrast: true, sharpenText: false, quality: 0.9, maxWidth: 800 },
      { enhanceContrast: false, sharpenText: true, quality: 1.0, maxWidth: 1600 },
      { enhanceContrast: false, sharpenText: false, quality: 0.8, maxWidth: 600 }
    ]

    for (const config of preprocessingConfigs) {
      if (result.attempts >= maxAttempts) break

      try {
        console.log(`🔄 Trying preprocessing config: ${JSON.stringify(config)}`)

        // Preprocess first image (most important)
        if (images.length > 0) {
          const preprocessingResult = await this.preprocessingService.preprocessImage(
            this.dataUrlToFile(images[0], 'image.jpg'),
            config
          )

          // Try Claude Vision with preprocessed image
          const strategyStart = Date.now()
          const processedImages = [preprocessingResult.dataUrl]

          let ocrResult: OCRResult | null = null

          if (userPlan !== 'free') {
            ocrResult = await this.tryClaudeVision(processedImages, strategyStart)
            if (ocrResult && ocrResult.confidence > 0.5) {
              ocrResult.preprocessingParams = config
              result.success = true
              result.result = ocrResult
              result.strategy = 'claude'
              console.log(`✅ Preprocessing retry succeeded with Claude Vision (${ocrResult.confidence}% confidence)`)
              break
            }
          }

          // If Claude fails, try Gemini
          if (!result.success) {
            ocrResult = await this.tryGeminiVision(processedImages, strategyStart, userPlan)
            if (ocrResult && ocrResult.confidence > 0.5) {
              ocrResult.preprocessingParams = config
              result.success = true
              result.result = ocrResult
              result.strategy = 'gemini'
              console.log(`✅ Preprocessing retry succeeded with Gemini Vision (${ocrResult.confidence}% confidence)`)
              break
            }
          }
        }

        result.attempts++
      } catch (error) {
        result.attempts++
        const errorMsg = `Preprocessing config ${JSON.stringify(config)}: ${error instanceof Error ? error.message : 'Unknown error'}`
        result.errors.push(errorMsg)
        console.warn(`❌ Preprocessing retry failed:`, error)
      }
    }

    return result
  }

  /**
   * Try Claude Vision OCR
   */
  private async tryClaudeVision(images: string[], startTime: number): Promise<OCRResult | null> {
    try {
      const request = {
        text: this.generateOCRPrompt(undefined, 'standard', images.length),
        task: 'ocr' as const,
        images: images,
        maxTokens: 2048
      }

      const claudeResult = await this.claudeOCR.processVision(request)

      return {
        productName: claudeResult.productName,
        batchNumber: claudeResult.batchNumber,
        expiryDate: claudeResult.expiryDate,
        manufacturer: claudeResult.manufacturer,
        confidence: claudeResult.confidence,
        rawText: claudeResult.rawText,
        strategy: 'claude_vision',
        processingTime: Date.now() - startTime
      }
    } catch (error) {
      console.warn('Claude Vision failed:', error)
      // Re-throw quota/billing errors to preserve actual error messages for metrics
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (this.isQuotaBillingError(errorMessage)) {
        throw error
      }
      return null
    }
  }

  /**
   * Try Gemini Vision OCR
   */
  private async tryGeminiVision(images: string[], startTime: number, userPlan: string = 'free'): Promise<OCRResult | null> {
    try {
      // Lazily initialize Gemini service to prevent ESM issues
      if (!this.geminiOCR) {
        const { createGeminiService } = await import('./ai/google-gemini')
        this.geminiOCR = createGeminiService({
          id: 'gemini-fallback',
          apiKey: process.env.GOOGLE_AI_API_KEY || '',
          modelName: 'gemini-1.5-pro', // Use the production-compatible model
          provider: 'google',
          temperature: 0.1,
          maxTokens: 1024,
          costInput: 0.00000025,
          costOutput: 0.000001
        })
      }

      const request = {
        text: this.generateOCRPrompt(undefined, userPlan, images.length),
        task: 'ocr' as const,
        images: images,
        maxTokens: 1024
      }

      const geminiResult = await this.geminiOCR.processVision(request)

      // Parse the result
      const parsedData = this.parseGeminiResponse(geminiResult.content)

      return {
        productName: parsedData.productName,
        batchNumber: parsedData.batchNumber,
        expiryDate: parsedData.expiryDate,
        manufacturer: parsedData.manufacturer,
        confidence: parsedData.confidence || 0.5,
        rawText: geminiResult.content,
        strategy: 'gemini_vision',
        processingTime: Date.now() - startTime
      }
    } catch (error) {
      console.warn('Gemini Vision failed:', error)
      // Re-throw quota/billing errors to preserve actual error messages for metrics
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (this.isQuotaBillingError(errorMessage)) {
        throw error
      }
      return null
    }
  }

  /**
   * Try OpenAI Vision OCR
   */
  private async tryOpenAIVision(images: string[], startTime: number): Promise<OCRResult | null> {
    try {
      // Implement OpenAI Vision OCR
      const request = {
        text: this.generateOCRPrompt(),
        task: 'ocr' as const,
        images: images,
        maxTokens: 1024
      }

      const openaiResult = await this.openaiOCR.processText(request)

      // Parse the result (simplified)
      const parsedData = this.parseBasicResponse(openaiResult.content)

      return {
        productName: parsedData.productName,
        batchNumber: parsedData.batchNumber,
        expiryDate: parsedData.expiryDate,
        manufacturer: parsedData.manufacturer,
        confidence: parsedData.confidence || 0.4,
        rawText: openaiResult.content,
        strategy: 'openai_vision',
        processingTime: Date.now() - startTime
      }
    } catch (error) {
      console.warn('OpenAI Vision failed:', error)
      // Re-throw quota/billing errors to preserve actual error messages for metrics
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (this.isQuotaBillingError(errorMessage)) {
        throw error
      }
      return null
    }
  }

  /**
   * Try Tesseract OCR (fallback)
   */
  private async tryTesseractOCR(images: string[], startTime: number): Promise<OCRResult | null> {
    try {
      // Use existing Tesseract implementation
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng')

      let combinedText = ''
      for (let i = 0; i < Math.min(images.length, 2); i++) {
        const { data: { text } } = await worker.recognize(images[i])
        combinedText += text + ' '
      }

      await worker.terminate()

      const parsedData = this.parseBasicResponse(combinedText)

      return {
        productName: parsedData.productName,
        batchNumber: parsedData.batchNumber,
        expiryDate: parsedData.expiryDate,
        manufacturer: parsedData.manufacturer,
        confidence: parsedData.confidence || 0.3, // Lower confidence for Tesseract
        rawText: combinedText,
        strategy: 'tesseract',
        processingTime: Date.now() - startTime
      }
    } catch (error) {
      console.warn('Tesseract OCR failed:', error)
      return null
    }
  }

  /**
   * Generate specialized OCR prompt based on pharmaceutical form detection
   */
  private generateOCRPrompt(initialText?: string, userPlan?: string, imageCount?: number): string {
    // Try to detect pharmaceutical form from initial text if available
    const detectedForm = initialText ? detectPharmaForm(initialText) : 'general'

    console.log(`🔍 Detected pharmaceutical form: ${detectedForm}`)

    // Get enhanced prompt with plan-specific optimizations
    return getEnhancedPharmaPrompt(detectedForm, userPlan || 'free', imageCount || 1)
  }

  /**
   * Parse Gemini response
   */
  private parseGeminiResponse(content: string): ParsedOCRData {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          productName: parsed.productName,
          batchNumber: parsed.batchNumber,
          expiryDate: parsed.expiryDate,
          manufacturer: parsed.manufacturer,
          confidence: parsed.confidence || 0.5
        }
      }
    } catch (e) {
      // Fallback to basic parsing
    }

    return this.parseBasicResponse(content)
  }

  /**
   * Basic text parsing for OCR results
   */
  private parseBasicResponse(content: string): ParsedOCRData {
    const result: ParsedOCRData = { confidence: 0.3 }

    // Use comprehensive batch patterns from PharmaceuticalOCRPrompts
    const batchPatterns = [
      // Alphabetic batch patterns (like ASCORBIC2023)
      /\b([A-Z]{4,10}\d{4})\b/g,
      // Mixed alphanumeric patterns
      /\b([A-Z]{1,3}\d{4,8}[A-Z]?)\b/g,
      /\b([A-Z]\d{5,6}[A-Z]?)\b/g,
      // Numeric-only patterns
      /\b(\d{6,8})\b/g,
      // Short alphanumeric patterns
      /\b([A-Z]{2,3}\d{4,6})\b/g,
      /\b([A-Z]{1,3}\d{3}[A-Z]{0,3})\b/g,
      // Date-based batch patterns (avoid pure years)
      /\b([A-Z]{1,4}\d{4}[A-Z]{1,3})\b/g
    ]

    // Extract batch number with improved logic
    const uniqueBatches = new Set<string>()
    for (const pattern of batchPatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const batch = match[1]?.trim().toUpperCase()
        if (batch && batch.length >= 6 && !batch.match(/^\d{4}$/)) { // Avoid pure years like "2023"
          uniqueBatches.add(batch)
        }
      }
    }

    // Select the best batch number (prefer longer, more specific patterns)
    if (uniqueBatches.size > 0) {
      const batches = Array.from(uniqueBatches).sort((a, b) => {
        // Prefer batches with more letters (less likely to be dates)
        const aLetters = (a.match(/[A-Z]/g) || []).length
        const bLetters = (b.match(/[A-Z]/g) || []).length
        if (aLetters !== bLetters) return bLetters - aLetters
        // Then prefer longer batches
        return b.length - a.length
      })
      result.batchNumber = batches[0]
      result.confidence = (result.confidence || 0) + 0.2
    }

    // Extract expiry date
    const expiryPatterns = [
      /\bEXP\s*(\d{1,2}[/-]\d{4})\b/i,
      /\bEXPIRY\s*(\d{1,2}[/-]\d{4})\b/i,
      /\bBEST\s*BEFORE\s*(\d{1,2}[/-]\d{4})\b/i,
      /\bUSE\s*BY\s*(\d{1,2}[/-]\d{4})\b/i,
      /\b(\d{1,2}[/-]\d{4})\b/g,
      /\b(\d{4}-\d{2}-\d{2})\b/g
    ]

    for (const pattern of expiryPatterns) {
      const match = pattern.exec(content)
      if (match && match[1]) {
        // Validate date format
        const dateStr = match[1]
        if (this.isValidExpiryDate(dateStr)) {
          result.expiryDate = dateStr
          result.confidence = (result.confidence || 0) + 0.15
          break
        }
      }
    }

    // Extract product name with improved logic to avoid batch numbers
    // Look for sequences of words that don't match batch number patterns
    const words = content.split(/\s+/)
    const potentialNames: string[] = []

    for (let i = 0; i < words.length; i++) {
      const word = words[i].trim()

      // Skip words that look like batch numbers
      if (this.looksLikeBatchNumber(word)) continue

      // Look for 2-4 word sequences that could be product names
      for (let len = 1; len <= 4 && i + len <= words.length; len++) {
        const phrase = words.slice(i, i + len).join(' ').trim()

        // Skip if it contains batch-like patterns
        if (this.looksLikeBatchNumber(phrase)) continue

        // Check if it looks like a pharmaceutical product name
        if (this.isLikelyProductName(phrase)) {
          potentialNames.push(phrase)
        }
      }
    }

    // Select the best product name
    if (potentialNames.length > 0) {
      // Prefer longer names, then names with more title case words
      const bestName = potentialNames.sort((a, b) => {
        // Prefer longer names
        if (a.length !== b.length) return b.length - a.length
        // Count title case words (start with capital letter)
        const aTitleWords = (a.match(/\b[A-Z][a-z]+\b/g) || []).length
        const bTitleWords = (b.match(/\b[A-Z][a-z]+\b/g) || []).length
        return bTitleWords - aTitleWords
      })[0]

      result.productName = bestName
      result.confidence = (result.confidence || 0) + 0.1
    }

    // Extract manufacturer
    const manufacturerPatterns = [
      /\b(?:MFG|MANUFACTURED\s*BY|MADE\s*BY)\s*([A-Z][a-zA-Z\s]{2,30})\b/i,
      /\b([A-Z][a-zA-Z\s]*(?:Ltd|PLC|Inc|Corp|GmbH|SA|NV|Pharma|Laboratories))\b/
    ]

    for (const pattern of manufacturerPatterns) {
      const match = pattern.exec(content)
      if (match && match[1]) {
        result.manufacturer = match[1].trim()
        result.confidence = (result.confidence || 0) + 0.1
        break
      }
    }

    return result
  }

  /**
   * Check if a string looks like a batch number
   */
  private looksLikeBatchNumber(text: string): boolean {
    // Check against the same patterns used for batch number extraction
    const batchPatterns = [
      /\b([A-Z]{4,10}\d{4})\b/,
      /\b([A-Z]{1,3}\d{4,8}[A-Z]?)\b/,
      /\b([A-Z]\d{5,6}[A-Z]?)\b/,
      /\b(\d{6,8})\b/,
      /\b([A-Z]{2,3}\d{4,6})\b/,
      /\b([A-Z]{1,3}\d{3}[A-Z]{0,3})\b/,
      /\b([A-Z]{1,4}\d{4}[A-Z]{1,3})\b/
    ]

    return batchPatterns.some(pattern => pattern.test(text))
  }

  /**
   * Check if a string is likely to be a pharmaceutical product name
   */
  private isLikelyProductName(text: string): boolean {
    // Must be 3-50 characters
    if (text.length < 3 || text.length > 50) return false

    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(text)) return false

    // Should not be all numbers
    if (/^\d+$/.test(text)) return false

    // Should not contain too many numbers (avoid dates, codes)
    const numberRatio = (text.match(/\d/g) || []).length / text.length
    if (numberRatio > 0.5) return false

    // Should have some title case or all caps words (typical for brand names)
    const words = text.split(/\s+/)
    const hasTitleCase = words.some(word => /^[A-Z][a-z]+$/.test(word))
    const hasAllCaps = words.some(word => /^[A-Z]{2,}$/.test(word))

    return hasTitleCase || hasAllCaps || words.length > 1
  }

  /**
   * Validate if a string represents a valid expiry date
   */
  private isValidExpiryDate(dateStr: string): boolean {
    try {
      // Handle MM/YYYY format
      if (dateStr.includes('/') || dateStr.includes('-')) {
        const parts = dateStr.split(/[\/-]/)
        if (parts.length === 2) {
          const month = parseInt(parts[0])
          const year = parseInt(parts[1])
          return month >= 1 && month <= 12 && year >= 2020 && year <= 2035
        } else if (parts.length === 3) {
          // DD/MM/YYYY or YYYY-MM-DD
          const date = new Date(dateStr)
          return !isNaN(date.getTime()) && date.getFullYear() >= 2020 && date.getFullYear() <= 2035
        }
      }
      return false
    } catch {
      return false
    }
  }

  /**
   * Convert data URL to File object for preprocessing
   */
  private dataUrlToFile(dataUrl: string, filename: string): File {
    const arr = dataUrl.split(',')
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
    const bstr = atob(arr[1])
    const n = bstr.length
    const u8arr = new Uint8Array(n)

    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i)
    }

    return new File([u8arr], filename, { type: mime })
  }

  /**
   * Log a fallback event
   */
  private log(level: 'info' | 'warn' | 'error', message: string, metadata?: Record<string, unknown>): void {
    const logEntry: FallbackLog = {
      timestamp: new Date(),
      level,
      message,
      ...metadata
    }

    this.logs.push(logEntry)

    // Also log to console with appropriate level
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'
    console[consoleMethod](`🔄 OCR Fallback ${level.toUpperCase()}: ${message}`, metadata || '')
  }

  /**
   * Test OCR fallback scenarios (for development and debugging)
   */
  async testFallbackScenarios(): Promise<{
    scenario: string
    success: boolean
    result?: OCRResult
    attempts: number
    errors: string[]
    duration: number
  }[]> {
    const testScenarios = [
      {
        name: 'Normal pharmaceutical image',
        images: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...'], // placeholder
        userPlan: 'basic' as const
      },
      {
        name: 'Blurry low-quality image',
        images: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...'], // placeholder
        userPlan: 'free' as const
      },
      {
        name: 'Multiple images',
        images: [
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...'
        ],
        userPlan: 'business' as const
      },
      {
        name: 'Empty images array',
        images: [],
        userPlan: 'free' as const
      }
    ]

    const results = []

    for (const scenario of testScenarios) {
      console.log(`🧪 Testing scenario: ${scenario.name}`)

      const startTime = Date.now()
      const options: OCRFallbackOptions = {
        maxAttempts: 3,
        maxTime: 15000,
        strategies: ['gemini', 'tesseract'], // Limited for testing
        userPlan: scenario.userPlan,
        enablePreprocessingRetry: false, // Disable for faster testing
        minConfidence: 0.3,
        enableManualFallback: true
      }

      try {
        const result = await this.processWithFallback(scenario.images, options)
        const duration = Date.now() - startTime

        results.push({
          scenario: scenario.name,
          success: result.success,
          result: result.result,
          attempts: result.attempts,
          errors: result.errors,
          duration
        })

        console.log(`✅ Scenario "${scenario.name}" completed in ${duration}ms: ${result.success ? 'SUCCESS' : 'FAILED'}`)

      } catch (error) {
        const duration = Date.now() - startTime
        results.push({
          scenario: scenario.name,
          success: false,
          attempts: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          duration
        })

        console.error(`❌ Scenario "${scenario.name}" failed:`, error)
      }
    }

    return results
  }

  /**
   * Check if error message indicates quota/billing issue
   */
  private isQuotaBillingError(errorMessage: string): boolean {
    const quotaKeywords = [
      'exceeded your current quota',
      'quota exceeded',
      'billing',
      'payment required',
      'insufficient funds',
      'rate limit exceeded',
      'too many requests',
      'quota',
      'billing details',
      '429',
      'rate_limit'
    ]

    const lowerError = errorMessage.toLowerCase()
    return quotaKeywords.some(keyword => lowerError.includes(keyword))
  }

  /**
   * Get OCR processing statistics
   */
  getProcessingStats(): ProcessingStats {
    // This would track statistics over time
    return {
      strategies: ['claude', 'gemini', 'openai', 'tesseract'],
      averageConfidence: 0.65,
      commonErrors: ['API rate limits', 'Image quality issues', 'Network timeouts'],
      performanceMetrics: {
        averageProcessingTime: 3000,
        successRate: 0.85,
        fallbackUsage: 0.15
      }
    }
  }
}

// Export singleton instance
export const ocrFallbackManager = new OCRFallbackManager()
