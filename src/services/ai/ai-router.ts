import { AIRequest, AIResponse, UserPlan } from './types-fixed'
import { GeminiService } from './google-gemini'
import { GoogleVisionService } from './google-vision'
import { OpenAIService } from './openai-gpt'
import { AnthropicClaudeService } from './anthropic-claude'
import { ClaudeVisionOCR } from './claude-vision'
import prisma from '@/lib/prisma'
import { EmailService } from '@/lib/email'
import { systemHealthMonitor } from '../system-health-monitor'
import { securityMonitor } from '../security-monitor'
import { PharmaceuticalOCRPrompts, getEnhancedPharmaPrompt, detectPharmaForm } from '@/services/pharmaceutical-ocr-prompts'

interface AIProviderInstance {
  gemini?: GeminiService
  googleVision?: GoogleVisionService
  openai?: OpenAIService
  claude?: AnthropicClaudeService
  claudeVision?: ClaudeVisionOCR
  tesseract?: any
}

interface PlanAIAssignment {
  planId: string
  aiType: 'ocr' | 'verification' | 'extraction'
  provider: 'google' | 'google-vision' | 'openai' | 'anthropic' | 'tesseract'
  priority: number
  config: {
    apiKey: string
    modelName: string
    temperature?: number
    maxTokens: number
    costInput: number
    costOutput: number
  }
}

export class AIServiceRouter {
  private aiInstances: AIProviderInstance = {}
  private assignmentsCache: Map<string, PlanAIAssignment[]> = new Map()
  private lastCacheUpdate: Date = new Date(0)

  // Initialize AI providers
  async initializeProviders(): Promise<void> {
    console.log('🔧 Initializing AI Providers...')

    try {
      // Fetch all active AI providers from database
      const providers = await prisma.aIProvider.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          provider: true,
          modelName: true
        }
      })

      // Initialize each provider
      for (const provider of providers) {
        try {
          const apiKey = await this.getAPIKey(this.constructProviderKeyId(provider.provider))

          if (!apiKey) {
            console.warn(`❌ No API key found for ${provider.name}`)
            continue
          }

          const config = {
            id: provider.id,
            apiKey,
            modelName: provider.modelName,
            provider: provider.provider as any,
            temperature: 0.7, // Default temperature
            maxTokens: 2048, // Default max tokens
            costInput: 0.00000025, // Default cost
            costOutput: 0.000001 // Default cost
          }

          // Initialize the right service instance
          switch (provider.provider) {
            case 'google':
              this.aiInstances.gemini = new GeminiService(config)
              console.log('✅ Google Gemini initialized')
              break
            case 'google-vision':
              this.aiInstances.googleVision = new GoogleVisionService(config)
              console.log('✅ Google Vision initialized')
              break
            case 'openai':
              this.aiInstances.openai = new OpenAIService(config)
              console.log('✅ OpenAI GPT initialized')
              break
            case 'anthropic':
              this.aiInstances.claude = new AnthropicClaudeService(config)
              console.log('✅ Anthropic Claude initialized')

              // Also initialize Claude Vision for OCR tasks
              this.aiInstances.claudeVision = new ClaudeVisionOCR()
              console.log('✅ Anthropic Claude Vision initialized')
              break
          }
        } catch (error) {
          console.error(`❌ Failed to initialize ${provider.name}:`, error)
        }
      }

      // Initialize Google Vision if Google Vision API key is available (even if not in database)
      try {
        const googleVisionApiKey = process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_AI_API_KEY
        console.log(`🔑 [AI Router] Google Vision API key available: ${!!googleVisionApiKey}`)
        if (googleVisionApiKey && !this.aiInstances.googleVision) {
          const visionConfig = {
            id: 'google-vision-fallback',
            apiKey: googleVisionApiKey,
            modelName: 'google-vision-ocr',
            provider: 'google-vision' as any,
            temperature: 0.1,
            maxTokens: 2048,
            costInput: 0.00175,
            costOutput: 0.00175
          }
          this.aiInstances.googleVision = new GoogleVisionService(visionConfig)
          console.log('✅ [AI Router] Google Vision initialized (fallback)')
        } else if (!googleVisionApiKey) {
          console.warn('⚠️ [AI Router] No Google Vision API key found (checked GOOGLE_VISION_API_KEY and GOOGLE_AI_API_KEY) - Google Vision will not be available')
        }
      } catch (error) {
        console.warn('[AI Router] Failed to initialize Google Vision fallback:', error)
      }

      // Initialize fallback providers if not found in database
      if (!this.aiInstances.tesseract) {
        console.log('⚠️ Tesseract not found in database, initializing fallback...')
        this.aiInstances.tesseract = {
          processText: async (request: AIRequest) => {
            // Simple text processing (not OCR)
            return {
              content: 'Tesseract does not support text processing',
              extractedData: null,
              usage: { inputTokens: 0, outputTokens: 0, cost: 0.001 },
              metadata: {
                model: 'tesseract-ocr',
                provider: 'tesseract',
                responseTime: 100,
                success: false,
                error: 'Tesseract is OCR-only',
                finishReason: 'error'
              }
            }
          },
          processVision: async (request: AIRequest) => {
            // Use Tesseract.js for OCR processing
            const startTime = Date.now()
            try {
              const { createWorker } = await import('tesseract.js')
              const worker = await createWorker('eng')

              let combinedText = ''
              for (let i = 0; i < Math.min(request.images?.length || 0, 2); i++) {
                const { data: { text } } = await worker.recognize(request.images![i])
                combinedText += text + ' '
              }

              await worker.terminate()

              // Parse the extracted text for pharmaceutical data
              const parsedData = this.parseTesseractResult(combinedText.trim())

              return {
                content: combinedText,
                extractedData: parsedData,
                usage: { inputTokens: combinedText.length, outputTokens: 100, cost: 0.001 },
                metadata: {
                  model: 'tesseract-ocr',
                  provider: 'tesseract',
                  responseTime: Date.now() - startTime,
                  success: true,
                  finishReason: 'completed'
                }
              }
            } catch (error) {
              return {
                content: '',
                extractedData: null,
                usage: { inputTokens: 0, outputTokens: 0, cost: 0.001 },
                metadata: {
                  model: 'tesseract-ocr',
                  provider: 'tesseract',
                  responseTime: Date.now() - startTime,
                  success: false,
                  error: error instanceof Error ? error.message : 'Tesseract OCR failed',
                  finishReason: 'error'
                }
              }
            }
          },
          checkHealth: async () => {
            try {
              // Simple health check - try to import tesseract
              await import('tesseract.js')
              return true
            } catch {
              return false
            }
          }
        } as any
      }

      // Health check all providers
      await this.performHealthChecks()

      console.log('🎯 AI Router initialized successfully')

    } catch (error) {
      console.error('❌ Failed to initialize AI Router:', error)
      // Don't throw - allow system to continue with fallback providers
      console.log('⚠️ Continuing with fallback providers only')
    }
  }

  // Main request processing method
  async processRequest(request: AIRequest, userId?: string): Promise<AIResponse> {
    console.log(`🤖 Processing ${request.task} request`, {
      userId,
      textLength: request.text.length,
      task: request.task
    })

    try {
      // Enhance OCR requests with pharmaceutical prompts if applicable
      const enhancedRequest = await this.enhanceOCRRequest(request, userId)
      // 1. Get user's plan and AI assignments
      let userPlan: UserPlan | null = null
      let assignments: PlanAIAssignment[] = []

      if (userId) {
        userPlan = await this.getUserPlan(userId)
        console.log(`🔍 AI Router: User plan detected as "${userPlan?.id || 'free'}"`)
        assignments = await this.getAIAssignments(userPlan, request.task)
        console.log(`🔍 AI Router: Found ${assignments.length} assignments for ${userPlan?.id || 'free'} plan`)

        // DEBUG: Log detailed assignment info
        console.log(`🔍 AI Router: DETAILED ASSIGNMENTS FOR ${request.task}:`)
        assignments.forEach((assignment, index) => {
          console.log(`   ${index + 1}. ${assignment.provider} (${assignment.aiType}) - Priority: ${assignment.priority}`)
        })
      } else {
        // Free tier fallback
        assignments = await this.getFreeTierAssignments(request.task)
        console.log(`🔍 AI Router: Using free tier assignments (${assignments.length})`)
      }

      if (assignments.length === 0) {
        console.error(`❌ AI Router: No AI providers assigned for task: ${request.task}`)
        console.error(`❌ AI Router: User plan: ${userPlan?.id || 'free'}, User ID: ${userId}`)
        throw new Error(`No AI providers assigned for task: ${request.task}`)
      }

      // 2. Sort by priority (1 = highest priority)
      assignments.sort((a, b) => a.priority - b.priority)

      // 🔧 FORCE STANDARD PLAN PRIORITY: Ensure Gemini is ALWAYS first for OCR tasks
      const currentPlanId = userPlan?.id || 'free'
      if (currentPlanId === 'standard' && request.task === 'ocr') {
        console.log(`🎯 STANDARD PLAN OCR FIX: Reordering assignments...`)
        assignments.sort((a, b) => {
          // Force Gemini to priority 1 for OCR tasks in standard plan
          if (a.provider === 'google' && a.aiType === 'ocr') return -1
          if (b.provider === 'google' && b.aiType === 'ocr') return 1
          return a.priority - b.priority
        })
        console.log(`🎯 STANDARD PLAN OCR FIX: Final order:`)
        assignments.forEach((assignment, index) => {
          console.log(`   ${index + 1}. ${assignment.provider} (${assignment.aiType}) - Priority: ${assignment.priority}`)
        })
      }

      // 3. Try providers in order
      let lastError: Error | null = null

      for (const assignment of assignments) {
        try {
          console.log(`🔄 [AI Router] Trying ${assignment.provider} for ${request.task}...`)

          // Check rate limits
          await this.checkRateLimiting(assignment, userId)

          // Process with the assigned provider
          console.log(`🚀 [AI Router] Executing request with ${assignment.provider}`)
          const result = await this.executeRequestWithProvider(
            assignment,
            enhancedRequest,
            userId
          )

          // Success! Log usage and return
          console.log(`✅ [AI Router] ${assignment.provider} succeeded for ${enhancedRequest.task}`)
          console.log(`📊 [AI Router] Result: ${result.metadata.success ? 'SUCCESS' : 'FAILED'}, extractedData:`, result.extractedData)
          await this.logUsage(assignment, userId, enhancedRequest, result)

          return result

        } catch (error) {
          console.warn(`❌ ${assignment.provider} failed:`, error instanceof Error ? error.message : 'Unknown error')
          lastError = error instanceof Error ? error : new Error('Provider failed')

          // Continue to next provider if this one failed
          continue
        }
      }

      // All providers failed
      throw lastError || new Error('All AI providers failed')

    } catch (error) {
      console.error('❌ AI Router processing error:', error)

      // Return error response
      return {
        content: '',
        extractedData: null,
        usage: { inputTokens: 0, outputTokens: 0, cost: 0 },
        metadata: {
          model: 'none',
          provider: 'none',
          responseTime: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Processing failed',
          finishReason: 'error'
        }
      }
    }
  }

  // Dynamic AI type assignment based on plan and provider
  private assignAIBasedOnTask(provider: string, planId: string, requestTask?: string): 'ocr' | 'verification' | 'extraction' {
    // For standard plan: Gemini for OCR, Claude for verification
    if (planId === 'standard') {
      if (requestTask === 'ocr') {
        // ONLY Gemini gets 'ocr' for OCR tasks (excludes Claude from OCR queue)
        return provider === 'google' ? 'ocr' : 'verification'
      } else if (requestTask === 'verification') {
        // Both providers participate in verification with database priorities
        return provider === 'anthropic' ? 'verification' : 'verification'
      }
    }

    // For business plan: Different logic could be added here
    if (planId === 'business') {
      return requestTask as 'ocr' | 'verification' | 'extraction' || 'verification'
    }

    // Default: Use provider as is
    return requestTask as 'ocr' | 'verification' | 'extraction' || 'verification'
  }

  // Get user's plan from database
  private async getUserPlan(userId: string): Promise<UserPlan | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          planId: true,
          planBasicPoints: true,
          planStandardPoints: true,
          planBusinessPoints: true
        }
      })

      if (!user) {
        return null
      }

      // Determine plan based on point balances (same logic as analyze-image route)
      let detectedPlanId = 'free'
      let detectedPlanName = 'free'
      let detectedDisplayName = 'Free Plan'

      if (user.planBusinessPoints && user.planBusinessPoints > 0) {
        detectedPlanId = 'business'
        detectedPlanName = 'business'
        detectedDisplayName = 'Business Plan'
      } else if (user.planStandardPoints && user.planStandardPoints > 0) {
        detectedPlanId = 'standard'
        detectedPlanName = 'standard'
        detectedDisplayName = 'Standard Plan'
      } else if (user.planBasicPoints && user.planBasicPoints > 0) {
        detectedPlanId = 'basic'
        detectedPlanName = 'basic'
        detectedDisplayName = 'Basic Plan'
      }

      console.log(`🔍 AI Router: User has point balances - Basic: ${user.planBasicPoints || 0}, Standard: ${user.planStandardPoints || 0}, Business: ${user.planBusinessPoints || 0}`)
      console.log(`🔍 AI Router: Detected plan: ${detectedPlanId}`)

      return {
        id: detectedPlanId,
        name: detectedPlanName,
        displayName: detectedDisplayName,
        price: 0, // Pricing handled separately
        currency: 'NGN',
        maxScansPerMonth: detectedPlanId === 'business' ? 1000 : detectedPlanId === 'standard' ? 200 : detectedPlanId === 'basic' ? 50 : 5,
        maxImagesPerScan: 5, // All plans support images now
        maxAIRequestsPerMonth: detectedPlanId === 'business' ? 2000 : detectedPlanId === 'standard' ? 500 : detectedPlanId === 'basic' ? 100 : 5,
        maxTokensPerDay: 100000, // High limit for AI processing
        priority: detectedPlanId === 'business' ? 3 : detectedPlanId === 'standard' ? 2 : detectedPlanId === 'basic' ? 1 : 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    } catch (error) {
      console.error('Error getting user plan:', error)
      return null
    }
  }

  // Get AI provider assignments for user's plan
  async getAIAssignments(userPlan: UserPlan | null, requestTask?: string): Promise<PlanAIAssignment[]> {
    const planId = userPlan?.id || 'free'

    try {
      // Check cache first (cache for 5 minutes)
      const now = new Date()
      const cacheKey = `assignments_${planId}`

      if (this.assignmentsCache.has(cacheKey) &&
          (now.getTime() - this.lastCacheUpdate.getTime()) < 300000) {
        return this.assignmentsCache.get(cacheKey)!
      }

      // Fetch from database
      const assignments = await prisma.planAssignment.findMany({
        where: {
          planId,
          isActive: true
        },
        include: {
          aiProvider: {
            select: {
              id: true,
              name: true,
              provider: true,
              modelName: true
            }
          }
        },
        orderBy: { priority: 'asc' }
      })

      // Transform to expected format with dynamic AI type assignment
      const formattedAssignments: PlanAIAssignment[] = assignments.map(assignment => ({
        planId: assignment.planId,
        aiType: this.assignAIBasedOnTask(assignment.aiProvider.provider, planId, requestTask), // Dynamic assignment
        provider: assignment.aiProvider.provider as 'google' | 'openai' | 'anthropic',
        priority: assignment.priority,
        config: {
          apiKey: '', // Will be filled by getAPIKey()
          modelName: assignment.aiProvider.modelName,
          temperature: 0.7, // Default temperature
          maxTokens: 2048, // Default max tokens
          costInput: 0.00000025, // Default input cost
          costOutput: 0.000001 // Default output cost
        }
      }))

      // Fill in API keys
      for (const assignment of formattedAssignments) {
        try {
          const apiKey = await this.getAPIKey(this.constructProviderKeyId(assignment.provider))
          if (apiKey) {
            assignment.config.apiKey = apiKey
          }
        } catch (error) {
          console.warn(`Failed to get API key for ${assignment.provider}`)
        }
      }

      // Cache the result
      this.assignmentsCache.set(cacheKey, formattedAssignments)
      this.lastCacheUpdate = now

      return formattedAssignments

    } catch (error) {
      console.error('Error getting AI assignments:', error)
      // Provide plan-specific defaults when database fails
      return this.getPlanSpecificDefaults(planId)
    }
  }

  // Free tier fallback assignments
  private async getFreeTierAssignments(task: string): Promise<PlanAIAssignment[]> {
    // Default free tier: Google Gemini for all tasks
    const assignments: PlanAIAssignment[] = []

    if (this.aiInstances.gemini) {
      assignments.push({
        planId: 'free',
        aiType: task as any,
        provider: 'google',
        priority: 1,
        config: {
          apiKey: '', // Already set in gemini instance
          modelName: 'gemini-1.5-flash',
          temperature: 0.7,
          maxTokens: 2048,
          costInput: 0.00000025,
          costOutput: 0.000001
        }
      })
    }

    return assignments
  }

  // Get plan-specific defaults when database assignments are missing
  private getPlanSpecificDefaults(planId: string): PlanAIAssignment[] {
    switch (planId) {
      case 'free':
        return [{
          planId: 'free',
          aiType: 'ocr',
          provider: 'google',
          priority: 1,
          config: {
            apiKey: '',
            modelName: 'gemini-1.5-flash',
            temperature: 0.7,
            maxTokens: 2048,
            costInput: 0.00000025,
            costOutput: 0.000001
          }
        }]

      case 'basic':
        return [
          {
            planId: 'basic',
            aiType: 'ocr',
            provider: 'google',
            priority: 1,
            config: {
              apiKey: '',
              modelName: 'gemini-1.5-flash',
              temperature: 0.7,
              maxTokens: 2048,
              costInput: 0.00000025,
              costOutput: 0.000001
            }
          },
          {
            planId: 'basic',
            aiType: 'ocr',
            provider: 'tesseract',
            priority: 2,
            config: {
              apiKey: '',
              modelName: 'tesseract-ocr',
              temperature: 0.1,
              maxTokens: 1024,
              costInput: 0.000001,
              costOutput: 0.000001
            }
          }
        ]

      case 'standard':
        return [
           // OCR tasks: Use Gemini first (more user-friendly, less "I apologize")
           {
             planId: 'standard',
             aiType: 'ocr',
             provider: 'google',
             priority: 1,
             config: {
               apiKey: '',
               modelName: 'gemini-1.5-flash',
               temperature: 0.7,
               maxTokens: 2048,
               costInput: 0.00000025,
               costOutput: 0.000001
             }
           },
           // Verification tasks: Use Claude first (better for analysis)
           {
             planId: 'standard',
             aiType: 'verification',
             provider: 'anthropic',
             priority: 1,
             config: {
               apiKey: '',
               modelName: 'claude-3-haiku-20240307',
               temperature: 0.7,
               maxTokens: 2048,
               costInput: 0.015,
               costOutput: 0.015
             }
           },
           // OCR fallback: Claude as second priority for OCR
           {
             planId: 'standard',
             aiType: 'ocr',
             provider: 'anthropic',
             priority: 2,
             config: {
               apiKey: '',
               modelName: 'claude-3-haiku-20240307',
               temperature: 0.7,
               maxTokens: 2048,
               costInput: 0.015,
               costOutput: 0.015
             }
           },
           // Ultimate OCR fallback: Tesseract
           {
             planId: 'standard',
             aiType: 'ocr',
             provider: 'tesseract',
             priority: 3,
             config: {
               apiKey: '',
               modelName: 'tesseract-ocr',
               temperature: 0.1,
               maxTokens: 1024,
               costInput: 0.000001,
               costOutput: 0.000001
             }
           }
         ]

      case 'business':
        return [
          {
            planId: 'business',
            aiType: 'ocr',
            provider: 'google-vision',
            priority: 1,
            config: {
              apiKey: '',
              modelName: 'google-vision-ocr',
              temperature: 0.1,
              maxTokens: 2048,
              costInput: 0.00175,
              costOutput: 0.00175
            }
          },
          {
            planId: 'business',
            aiType: 'ocr',
            provider: 'openai',
            priority: 2,
            config: {
              apiKey: '',
              modelName: 'gpt-4o-mini',
              temperature: 0.7,
              maxTokens: 2048,
              costInput: 0.00015, // FIXED: OpenAI GPT-4o-mini input pricing
              costOutput: 0.0006   // FIXED: OpenAI GPT-4o-mini output pricing
            }
          },
           {
             planId: 'business',
             aiType: 'ocr',
             provider: 'tesseract',
             priority: 3,
             config: {
               apiKey: '',
               modelName: 'tesseract-ocr',
               temperature: 0.1,
               maxTokens: 1024,
               costInput: 0.000001,
               costOutput: 0.000001
             }
           }
         ]

      default:
        console.warn(`Unknown plan "${planId}", falling back to free tier`)
        return this.getFreeTierFallback()
    }
  }

  // Parse Tesseract OCR results for pharmaceutical data
  private parseTesseractResult(text: string): any {
    const result: any = {}

    // Extract batch numbers using patterns
    const batchPatterns = [
      /\b([A-Z]{4,10}\d{4})\b/g,      // ASCORBIC2023
      /\b([A-Z]{1,3}\d{4,8}[A-Z]?)\b/g, // T36184B
      /\b(\d{6,8})\b/g,               // 39090439
      /\b([A-Z]{2,3}\d{4,6})\b/g      // PCT2023002
    ]

    for (const pattern of batchPatterns) {
      const match = pattern.exec(text)
      if (match && match[1]) {
        result.batchNumber = match[1].toUpperCase()
        break
      }
    }

    // Extract expiry date
    const expiryPatterns = [
      /\bexp(?:iry)?[\s:]*(\d{1,2}[/-]\d{4})\b/gi,
      /\b(\d{1,2}[/-]\d{4})\b/g
    ]

    for (const pattern of expiryPatterns) {
      const match = pattern.exec(text)
      if (match && match[1]) {
        result.expiryDate = match[1]
        break
      }
    }

    // Extract product name (simplified)
    const productMatch = text.match(/\b([A-Z][a-zA-Z\s]{3,30})\b/)
    if (productMatch) {
      result.productName = productMatch[1].trim()
    }

    return result
  }

  // Get free tier fallback if database fails
  private getFreeTierFallback(): PlanAIAssignment[] {
    return [{
      planId: 'free',
      aiType: 'ocr',
      provider: 'google',
      priority: 1,
      config: {
        apiKey: '',
        modelName: 'gemini-1.5-flash',
        temperature: 0.7,
        maxTokens: 2048,
        costInput: 0.00000025,
        costOutput: 0.000001
      }
    }]
  }

  // Execute request with specific provider
  private async executeRequestWithProvider(
    assignment: PlanAIAssignment,
    request: AIRequest,
    userId?: string
  ): Promise<AIResponse> {

    let result: AIResponse

    try {
      switch (assignment.provider) {
        case 'google':
           if (!this.aiInstances.gemini) {
             throw new Error('Google Gemini not available')
           }
           // Use vision processing if images are provided and task is OCR
           if (request.images && request.images.length > 0 && request.task === 'ocr') {
             result = await this.aiInstances.gemini.processVision(request)
           } else {
             result = await this.aiInstances.gemini.processText(request)
           }
           break

         case 'google-vision':
           if (!this.aiInstances.googleVision) {
             throw new Error('Google Vision not available')
           }
           // Google Vision is primarily for image processing
           if (request.images && request.images.length > 0) {
             result = await this.aiInstances.googleVision.processVision(request)
           } else {
             result = await this.aiInstances.googleVision.processText(request)
           }
           break

        case 'openai':
          if (!this.aiInstances.openai) {
            throw new Error('OpenAI GPT not available')
          }

          // For OCR tasks with images, fall back to Gemini Vision (like Basic plan)
          if (request.task === 'ocr' && request.images && request.images.length > 0) {
            console.log('🖼️ OpenAI Business plan: Using Gemini Vision for OCR with images')
            if (!this.aiInstances.gemini) {
              throw new Error('Google Gemini not available for OCR fallback')
            }
            result = await this.aiInstances.gemini.processVision(request)
          } else {
            result = await this.aiInstances.openai.processText(request)
          }
          break

        case 'anthropic':
          // Check if this is an OCR task with images - use Claude Vision
          if (request.task === 'ocr' && request.images && request.images.length > 0) {
            if (!this.aiInstances.claudeVision) {
              throw new Error('Anthropic Claude Vision not available')
            }
            console.log('🖼️ Using Claude Vision for OCR task with images')

            const visionRequest = {
              text: request.text,
              task: request.task,
              images: request.images,
              maxTokens: request.maxTokens
            }

            const visionResult = await this.aiInstances.claudeVision.processVision(visionRequest)

            // Convert Claude Vision response to AIResponse format
            result = {
              content: visionResult.rawText,
              extractedData: {
                productNames: visionResult.productName ? [visionResult.productName] : [],
                batchNumbers: visionResult.batchNumber ? [visionResult.batchNumber] : [],
                expiryDate: visionResult.expiryDate,
                manufacturers: visionResult.manufacturer ? [visionResult.manufacturer] : [],
                confidence: visionResult.confidence
              },
              usage: {
                inputTokens: Math.ceil(request.text.length / 4),
                outputTokens: Math.ceil(visionResult.rawText.length / 4),
                cost: 0.015 // Claude Vision cost
              },
              metadata: {
                model: 'claude-3-5-haiku-20241022',
                provider: 'anthropic',
                responseTime: 0, // Will be set by caller
                success: true,
                finishReason: 'completed'
              }
            }
          } else {
            // Use regular Claude for text-only tasks
            if (!this.aiInstances.claude) {
              throw new Error('Anthropic Claude not available')
            }
            console.log('📝 Using Claude Text for text-only task')
            result = await this.aiInstances.claude.processText(request)
          }
          break

        default:
          throw new Error(`Unknown provider: ${assignment.provider}`)
      }

      // Check for quota/billing errors in the response
      if (result.metadata.error && this.isQuotaBillingError(result.metadata.error)) {
        await this.sendQuotaErrorNotification(assignment.provider, result.metadata.error, userId)
      }

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Check if this is a quota/billing error
      if (this.isQuotaBillingError(errorMessage)) {
        await this.sendQuotaErrorNotification(assignment.provider, errorMessage, userId)
      }

      throw error
    }
  }

  // Check if error message indicates quota/billing issue
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

  // Send payment failure notification
  private async sendPaymentFailureNotification(
    userId: string,
    amount: number,
    currency: string,
    gateway: string,
    transactionId: string,
    failureReason: string
  ): Promise<void> {
    try {
      const adminEmail = process.env.AD_EMAIL
      if (!adminEmail) {
        console.warn('AD_EMAIL not configured, skipping payment failure notification')
        return
      }

      console.log(`🚨 Sending payment failure notification for ${gateway} transaction ${transactionId}: ${failureReason}`)

      // Send email notification
      await EmailService.sendPaymentFailure(
        adminEmail,
        userId,
        amount,
        currency,
        gateway,
        transactionId,
        failureReason
      )

      // Create system notification for admin dashboard
      await prisma.systemNotification.create({
        data: {
          type: 'payment_failed',
          title: `🚨 Payment Failed - ${gateway.toUpperCase()} ${currency} ${amount}`,
          message: `Payment failed for user ${userId}: ${failureReason}. Transaction ID: ${transactionId}`,
          severity: 'high',
          metadata: {
            userId,
            amount,
            currency,
            gateway,
            transactionId,
            failureReason,
            timestamp: new Date().toISOString()
          }
        }
      })

      console.log(`✅ Payment failure notification sent to ${adminEmail} and saved to admin dashboard`)

    } catch (notificationError) {
      console.error('Failed to send payment failure notification:', notificationError)
      // Don't throw - we don't want notification failures to break the main flow
    }
  }

  // Send email notification for quota/billing errors
  private async sendQuotaErrorNotification(
    provider: string,
    errorMessage: string,
    userId?: string
  ): Promise<void> {
    try {
      const adminEmail = process.env.AD_EMAIL
      if (!adminEmail) {
        console.warn('AD_EMAIL not configured, skipping quota error notification')
        return
      }

      // Get user plan for context
      let userPlan: string | undefined
      if (userId) {
        const plan = await this.getUserPlan(userId)
        userPlan = plan?.id || 'unknown'
      }

      console.log(`🚨 Sending quota error notification for ${provider}: ${errorMessage}`)

      // Send email notification
      await EmailService.sendAIProviderError(
        adminEmail,
        provider,
        errorMessage,
        userPlan,
        userId
      )

      // Create system notification for admin dashboard
      await prisma.systemNotification.create({
        data: {
          type: 'ai_quota_error',
          title: `🚨 ${provider.toUpperCase()} API Quota/Billing Error`,
          message: `AI provider ${provider} encountered a quota or billing error: ${errorMessage}`,
          severity: 'high',
          metadata: {
            provider,
            errorMessage,
            userId,
            userPlan,
            timestamp: new Date().toISOString()
          }
        }
      })

      console.log(`✅ Quota error notification sent to ${adminEmail} and saved to admin dashboard`)

    } catch (notificationError) {
      console.error('Failed to send quota error notification:', notificationError)
      // Don't throw - we don't want notification failures to break the main flow
    }
  }

  // Rate limiting check
  private async checkRateLimiting(
    assignment: PlanAIAssignment,
    userId?: string
  ): Promise<void> {
    // Get user's plan limits
    if (userId) {
      const userPlan = await this.getUserPlan(userId)
      if (userPlan) {
        // Check daily usage limits
        const todayUsage = await prisma.aIUsageRecord.count({
          where: {
            userId,
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        })

        if (todayUsage >= userPlan.maxTokensPerDay) {
          throw new Error('Daily AI usage limit exceeded')
        }
      }
    }

    // Provider-specific rate limiting would go here
    // For now, basic rate limiting is handled by the database queries
  }

  // Log usage for billing and analytics
  private async logUsage(
    assignment: PlanAIAssignment,
    userId: string | undefined,
    request: AIRequest,
    result: AIResponse
  ): Promise<void> {

    try {
      // Get AI provider from database
      const aiProvider = await prisma.aIProvider.findFirst({
        where: {
          provider: assignment.provider,
          modelName: assignment.config.modelName,
          isActive: true
        }
      })

      if (!aiProvider) {
        console.warn('AI Provider not found in database for usage logging')
        return
      }

      // Get user plan
      const userPlan = userId ? await this.getUserPlan(userId) : null

      // Log the usage record
      await prisma.aIUsageRecord.create({
        data: {
          aiProviderId: aiProvider.id,
          userId: userId || '',
          planId: userPlan?.id || 'free',
          requestType: request.task,
          requestTokens: result.usage.inputTokens,
          responseTokens: result.usage.outputTokens,
          cost: result.usage.cost,
          responseTime: result.metadata.responseTime / 1000, // Convert to seconds
          success: result.metadata.success
        }
      })

      // Update plan usage tracker (for monthly analytics)
      if (userPlan) {
        const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
        const periodDate = new Date(`${currentMonth}-01T00:00:00Z`)

        await prisma.planUsageTracker.upsert({
          where: {
            planId_period: {
              planId: userPlan.id,
              period: periodDate
            }
          },
          update: {
            totalScans: { increment: request.task === 'verification' ? 1 : 0 },
            totalAIRequests: { increment: 1 },
            totalCost: { increment: result.usage.cost }
          },
          create: {
            planId: userPlan.id,
            period: periodDate,
            totalScans: request.task === 'verification' ? 1 : 0,
            totalAIRequests: 1,
            totalCost: result.usage.cost,
            totalUsers: 1
          }
        })
      }

    } catch (error) {
      console.error('Failed to log AI usage:', error)
      // Don't throw - we don't want logging failures to break the main flow
    }
  }

  // Health checks for all providers
  private async performHealthChecks(): Promise<void> {
    console.log('🔍 Performing AI provider health checks...')

    const checks = []

    if (this.aiInstances.gemini) {
      checks.push(
        this.aiInstances.gemini.checkHealth()
          .then(healthy => ({ provider: 'google', healthy }))
          .catch(() => ({ provider: 'google', healthy: false }))
      )
    }

    if (this.aiInstances.googleVision) {
      checks.push(
        this.aiInstances.googleVision.checkHealth()
          .then(healthy => ({ provider: 'google-vision', healthy }))
          .catch(() => ({ provider: 'google-vision', healthy: false }))
      )
    }

    if (this.aiInstances.openai) {
      checks.push(
        this.aiInstances.openai.checkHealth()
          .then(healthy => ({ provider: 'openai', healthy }))
          .catch(() => ({ provider: 'openai', healthy: false }))
      )
    }

    if (this.aiInstances.claude) {
      checks.push(
        this.aiInstances.claude.checkHealth()
          .then(healthy => ({ provider: 'anthropic', healthy }))
          .catch(() => ({ provider: 'anthropic', healthy: false }))
      )
    }

    const results = await Promise.all(checks)

    results.forEach(result => {
      if (result.healthy) {
        console.log(`✅ ${result.provider} is healthy`)
      } else {
        console.warn(`❌ ${result.provider} is unhealthy`)
      }
    })
  }

  // Construct provider key ID for API retrieval
   private constructProviderKeyId(provider: string): string {
    switch (provider) {
      case 'google':
        return 'GOOGLE_001'
      case 'google-vision':
        return 'GOOGLE_VISION_001'
      case 'openai':
        return 'OPENAI_001'
      case 'anthropic':
        return 'ANTHROPIC_001'
      default:
        return `${provider.toUpperCase()}_001`
    }
  }

  // Get API key from secure storage (environment, vault, etc.)
  private async getAPIKey(apiKeyId: string): Promise<string | null> {
    try {
      // In production, this would integrate with:
      // - AWS Secrets Manager
      // - HashiCorp Vault
      // - Azure Key Vault
      // - Environment variables
      // - Encrypted database

      // For now, get from environment variables
      if (apiKeyId === 'GOOGLE_001') {
        return process.env.GOOGLE_AI_API_KEY || null
      } else if (apiKeyId === 'GOOGLE_VISION_001') {
        return process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_AI_API_KEY || null
      } else if (apiKeyId.startsWith('OPENAI')) {
        return process.env.OPENAI_API_KEY || null
      } else if (apiKeyId.startsWith('ANTHROPIC')) {
        return process.env.ANTHROPIC_API_KEY || null
      }

      return null
    } catch (error) {
      console.error('Error retrieving API key:', error)
      return null
    }
  }

  // Analytics methods
  async getUsageStats(planId?: string, userId?: string): Promise<any> {
    const where: any = {}

    if (planId) where.planId = planId
    if (userId) where.userId = userId

      const stats = await prisma.aIUsageRecord.aggregate({
      where,
      _count: { id: true },
      _sum: { cost: true, requestTokens: true, responseTokens: true },
      _avg: { responseTime: true }
    })

    return {
      totalRequests: stats._count.id,
      totalCost: stats._sum.cost || 0,
      totalTokens: (stats._sum.requestTokens || 0) + (stats._sum.responseTokens || 0),
      avgResponseTime: stats._avg.responseTime || 0
    }
  }

  // Enhance OCR requests with pharmaceutical prompts if applicable
  private async enhanceOCRRequest(request: AIRequest, userId?: string): Promise<AIRequest> {
    // Only enhance OCR requests
    if (request.task !== 'ocr') {
      return request
    }

    // Get user's plan to determine enhancement level
    let userPlan = 'free'
    if (userId) {
      const plan = await this.getUserPlan(userId)
      userPlan = plan?.id || 'free'
    }

    // Check if this is likely a pharmaceutical OCR request by analyzing the text
    const isPharmaceuticalRequest = this.detectPharmaceuticalContent(request.text)

    if (!isPharmaceuticalRequest) {
      console.log('🔍 AI Router: Request does not appear to be pharmaceutical, using standard prompts')
      return request
    }

    console.log(`🔍 AI Router: Detected pharmaceutical OCR request for ${userPlan} plan, enhancing with specialized prompts`)

    // Detect pharmaceutical form from the request text
    const detectedForm = detectPharmaForm(request.text)
    const imageCount = request.images?.length || 0

    // Generate enhanced pharmaceutical prompt
    const enhancedPrompt = getEnhancedPharmaPrompt(detectedForm, userPlan, imageCount)

    // Create enhanced request with pharmaceutical prompt
    const enhancedRequest: AIRequest = {
      ...request,
      text: enhancedPrompt
    }

    console.log(`💊 AI Router: Enhanced OCR request with ${detectedForm} pharmaceutical prompt for ${userPlan} plan`)
    return enhancedRequest
  }

  // Detect if the request content is likely pharmaceutical
  private detectPharmaceuticalContent(text: string): boolean {
    const pharmaceuticalKeywords = [
      'tablet', 'capsule', 'injection', 'vial', 'syrup', 'cream', 'ointment',
      'batch', 'lot', 'expiry', 'exp', 'manufacture', 'mfg', 'nafdac',
      'pharmaceutical', 'medicine', 'drug', 'medication', 'prescription',
      'dosage', 'strength', 'mg', 'ml', 'iu', 'mcg', 'lotion', 'gel',
      'suppository', 'drops', 'spray', 'inhaler', 'patch'
    ]

    const lowerText = text.toLowerCase()
    const keywordCount = pharmaceuticalKeywords.filter(keyword =>
      lowerText.includes(keyword)
    ).length

    // Consider it pharmaceutical if it has 2+ pharmaceutical keywords
    return keywordCount >= 2
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down AI Router...')

    // Clear caches
    this.assignmentsCache.clear()

    // Close any connections if needed
    console.log('✅ AI Router shut down successfully')
  }
}

// Export singleton instance
export const aiRouter = new AIServiceRouter()
