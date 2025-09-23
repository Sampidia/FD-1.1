import { AIProviderConfig, AIResponse, AIRequest } from './types-fixed'

export class AnthropicClaudeService {
  private apiKey: string
  private baseUrl = 'https://api.anthropic.com/v1'
  private config: AIProviderConfig

  constructor(config: AIProviderConfig) {
    this.apiKey = config.apiKey
    this.config = config
  }

  async processText(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now()

    try {
      // Generate prompt based on task type
      const prompt = this.generatePrompt(request.text, request.task)

      // Make API call to Claude
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.modelName,
          max_tokens: Math.min(request.maxTokens || 2048, this.config.maxTokens),
          temperature: request.temperature || this.config.temperature || 0.7,
          messages: [{ role: 'user', content: prompt }]
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Claude API error: ${error.error?.message || 'Unknown error'}`)
      }

      const result = await response.json()

      // Parse Claude response
      let content = result.content?.[0]?.text
      if (!content) {
        throw new Error('No content in Claude response')
      }

      const responseTime = Date.now() - startTime

      // Check for Claude's apology messages and replace them immediately
      const hasApologyMessage = /I apologize/i.test(content) ||
                               /I cannot/i.test(content) ||
                               /I'm sorry/i.test(content) ||
                               /unable to extract/i.test(content)

      if (hasApologyMessage) {
        console.log('🔍 Detected Claude apology message, replacing with user-friendly error')
        content = "Failed, upload a clear product image"
      }

      // Extract structured data based on task type
      const extractedData = this.extractStructuredData(content, request.task)

      // Calculate usage (Claude has different tokenization)
      const inputTokens = this.estimateTokens(request.text)
      const outputTokens = this.estimateTokens(content)

      return {
        content,
        extractedData,
        usage: {
          inputTokens,
          outputTokens,
          cost: this.calculateCost(inputTokens, outputTokens)
        },
        metadata: {
          model: this.config.modelName,
          provider: 'anthropic',
          responseTime,
          success: true,
          finishReason: result.stop_reason || 'completed'
        }
      }

    } catch (error) {
      console.error('Claude error:', error)

      return {
        content: '',
        extractedData: null,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          cost: 0
        },
        metadata: {
          model: this.config.modelName,
          provider: 'anthropic',
          responseTime: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          finishReason: 'error'
        }
      }
    }
  }

  private generatePrompt(text: string, task: string): string {
    const basePrompts = {
      ocr: `You are processing OCR text from a product packaging image. Extract and structure key product information with high accuracy.

OCR TEXT: ${text}

Extract these key elements and return as structured JSON:

{
  "productName": "primary product name (be specific and accurate)",
  "productNames": ["all product names found, including variants"],
  "batchNumbers": ["all batch/lot numbers found - look for patterns like ABC123, L456789, BATCH001"],
  "expiryDate": "expiry date if found (format: YYYY-MM-DD, MM/YYYY, or DD/MM/YYYY)",
  "manufacturers": ["manufacturer names found"],
  "confidence": "overall extraction confidence (0-1)",
  "additionalInfo": "other relevant details like dosage, pack size, or registration numbers"
}

INSTRUCTIONS:
- Look for product names in medicine/drug sections
- Batch numbers often follow patterns: letters + numbers, may contain hyphens/slashes
- Be precise with product names - avoid generic terms
- Only include data you can confidently extract
- Return valid JSON only
- If uncertain about a field, omit it rather than guess`,

      verification: `You are a safety expert analyzing product information to detect counterfeit, expired, or recalled products.

Here is the product information to analyze:

${text}

Please analyze this information for safety concerns and return as JSON:

{
  "isCounterfeit": "true/false - does this product show counterfeit indicators?",
  "confidence": "your confidence in the analysis (0-1)",
  "reason": "detailed explanation of why this product may be unsafe",
  "riskLevel": "HIGH/MEDIUM/LOW/CRITICAL - overall risk assessment",
  "recommendation": "clear advice to the user about next steps",
  "evidence": ["list of specific indicators found that support your assessment"]
}

Be conservative in flagging products as counterfeit. Only flag as HIGH/CRITICAL with very strong evidence.`,

      extraction: `You are analyzing an official alert from a regulatory authority about counterfeit or unsafe products.

Here is the alert text:

${text}

Please extract and structure the key information about affected products:

{
  "productNames": ["all product names mentioned in the alert"],
  "batchNumbers": ["all batch/lot numbers mentioned"],
  "reason": "detailed explanation of why the product was recalled/banned/faked",
  "category": "RECALL/COUNTERFEIT/EXPIRED/QUALITY_ISSUE/SAFETY_ALERT",
  "manufacturer": "name of the company that manufactured the product",
  "affectedRegions": ["countries, states, or regions affected"],
  "severity": "HIGH/MEDIUM/LOW - risk level of the issue",
  "regulatoryAction": "what action was taken (recall, ban, warning, etc.)",
  "contactInfo": "any contact information provided for consumers"
}

Extract the most important and specific information available in the alert.`
    }

    return basePrompts[task as keyof typeof basePrompts] ||
           `Please process this text and extract key information: ${text}. Return the analysis as structured JSON.`
  }

  private extractStructuredData(content: string, task: string) {
    try {
      // Try to parse as JSON first
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed && typeof parsed === 'object') {
          return parsed
        }
      }

      // Fallback: extract structured information using regex and patterns
      switch (task) {
        case 'ocr':
          return this.extractOCRFromText(content)
        case 'verification':
          return this.extractVerificationFromText(content)
        case 'extraction':
          return this.extractAlertFromText(content)
        default:
          return { rawResponse: content }
      }
    } catch (error) {
      console.warn('Failed to extract structured data from Claude:', error)
      return { rawResponse: content }
    }
  }

  private extractOCRFromText(text: string) {
    const result: {
      productName?: string | null
      productNames?: string[]
      batchNumbers?: string[]
      expiryDate?: string | null
      manufacturers?: string[]
      confidence?: number
      additionalInfo?: string
      [key: string]: string | string[] | number | boolean | null | undefined
    } = {}

    // Extract batch numbers with comprehensive patterns (improved from Gemini)
    const batchPatterns = [
      /(?:batch|lot|serial|production)\s*(?:number|num|no\.?)?\s*:?\s*([A-Z0-9\-\/\.\s]{3,25})/gi,
      /([A-Z]\d+[A-Z]?\d*[A-Z]?)/g,  // Patterns like A123B, AB123
      /(?:batch|lot)\s*([A-Z0-9\-\/\.]{6,15})/gi  // Direct batch numbers
    ]

    const batchNumbers: string[] = []
    batchPatterns.forEach(pattern => {
      const matches = Array.from(text.matchAll(pattern), m => m[1]?.trim()).filter(Boolean)
      batchNumbers.push(...matches)
    })

    if (batchNumbers.length > 0) {
      result.batchNumbers = [...new Set(batchNumbers)]
    }

    // Extract primary product name (more specific than Gemini)
    const primaryProductPatterns = [
      /(?:product|medicine|drug)\s*:?\s*([^&\n\r]{4,40})/i,
      /(?:contains|for|about)\s*:?\s*([^&\n\r]{4,40})/i,
      /([A-Z][a-z\s]{3,30})(?:\s+(?:tablet|capsule|syrup|injection|cream|ointment))/i
    ]

    primaryProductPatterns.forEach(pattern => {
      const match = text.match(pattern)
      if (match && match[1] && !result.productName) {
        result.productName = match[1].trim()
      }
    })

    // Extract all product names (variants and alternatives)
    const allProductPatterns = [
      /(?:product|medicine|drug)[s]?[:\s]*([^&\n\r]{4,35})/gi,
      /(?:active ingredient|contains)[:\s]*([^&\n\r]{3,30})/gi
    ]

    const productNames: string[] = []
    allProductPatterns.forEach(pattern => {
      const matches = Array.from(text.matchAll(pattern), m => m[1]?.trim()).filter(Boolean)
      productNames.push(...matches)
    })

    if (productNames.length > 0) {
      result.productNames = [...new Set(productNames)]
    }

    // Extract expiry dates with better patterns
    const expiryPatterns = [
      /(?:exp(?:iry)?|best before|use before)\s*(?:date)?\s*:?\s*([\d\/\-\.\s]{5,12})/gi,
      /(?:exp|expires)\s*:?\s*([a-z]{3}\s+\d{4})/gi,
      /([a-z]{3}[\/\-]\d{4})/gi,
      /(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g  // DD/MM/YYYY patterns
    ]

    expiryPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches && !result.expiryDate) {
        result.expiryDate = matches[0].trim()
      }
    })

    // Extract manufacturers with more patterns
    const manufacturerPatterns = [
      /(?:manufactured by|made by|produced by|marketed by|distributed by)\s*:?\s*([^&\n\r]{3,30})/i,
      /(?:company|manufacturer|producer|mfg\.?|mfd\.?)\s*:?\s*([^&\n\r]{3,30})/i,
      /(?:by|from)\s+([A-Z][a-z\s]{3,25}(?:Ltd|Limited|Inc|Corp|Pharma|Laboratories))/i
    ]

    const manufacturers: string[] = []
    manufacturerPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches && matches[1]) {
        manufacturers.push(matches[1].trim())
      }
    })

    if (manufacturers.length > 0) {
      result.manufacturers = [...new Set(manufacturers)]
    }

    // Extract additional info (dosage, pack size, registration)
    const additionalPatterns = [
      /(?:dosage|strength)[:\s]*([^&\n\r]{3,20})/i,
      /(?:pack size|quantity)[:\s]*([^&\n\r]{3,15})/i,
      /(?:reg\.?\s*(?:no\.?|number)|nafdac|registration)[:\s]*([A-Z0-9\-\/\.\s]{5,20})/i
    ]

    const additionalInfo: string[] = []
    additionalPatterns.forEach(pattern => {
      const match = text.match(pattern)
      if (match && match[1]) {
        additionalInfo.push(`${pattern.source.includes('dosage') ? 'Dosage' :
                            pattern.source.includes('pack') ? 'Pack Size' :
                            'Registration'}: ${match[1].trim()}`)
      }
    })

    if (additionalInfo.length > 0) {
      result.additionalInfo = additionalInfo.join('; ')
    }

    // Calculate confidence based on extraction quality and data completeness
    const extractionScore = [
      !!result.productName,
      (result.productNames?.length ?? 0) > 0,
      (result.batchNumbers?.length ?? 0) > 0,
      !!result.expiryDate,
      (result.manufacturers?.length ?? 0) > 0
    ].filter(Boolean).length

    result.confidence = Math.min(extractionScore / 5, 1)

    // Detect complete extraction failure and return user-friendly error message
    const hasNoData = !result.productName && (result.batchNumbers?.length ?? 0) === 0 && !result.expiryDate && (result.manufacturers?.length ?? 0) === 0
    const hasVeryLowConfidence = result.confidence < 0.3
    const hasApologyMessage = /I apologize/i.test(text) || /I cannot/i.test(text) || /I'm sorry/i.test(text) || /unable to extract/i.test(text)

    if ((hasNoData || hasVeryLowConfidence) && hasApologyMessage) {
      return {
        productName: null,
        batchNumbers: [],
        expiryDate: null,
        manufacturers: [],
        confidence: 0.1,
        extractedText: text,
        warnings: ['Image quality too poor for automatic text extraction'],
        recommendations: ['Upload a clearer image of your product packaging', 'Ensure the product name and batch number are clearly visible', 'Ensure text is well-lit and readable'],
        errorMessage: "Failed, upload a clear product image",
        additionalInfo: "Failed, upload a clear product image"
      }
    }

    return result
  }

  private extractVerificationFromText(text: string) {
    const result: {
      isCounterfeit?: boolean
      riskLevel?: string
      confidence?: number
      reason?: string
      recommendation?: string
      evidence?: string[]
      [key: string]: string | boolean | number | string[] | undefined
    } = {}

    // Analyze for counterfeit/safety indicators
    const riskPatterns = {
      high: /(?:counterfeit|fake|falsified|spurious|adulterated|dangerous|toxic)/i,
      medium: /(?:recall|withdraw|contaminated|expired|suspected)/i,
      low: /(?:warning|caution|advisory)/i
    }

    const trustPatterns = /(?:genuine|authentic|verified|registered|approved)/i

    const hasRiskHigh = riskPatterns.high.test(text)
    const hasRiskMedium = riskPatterns.medium.test(text)
    const hasRiskLow = riskPatterns.low.test(text)
    const hasTrust = trustPatterns.test(text)

    // Determine if counterfeit
    result.isCounterfeit = (hasRiskHigh || hasRiskMedium) && !hasTrust

    // Set risk level
    if (hasRiskHigh && !hasTrust) {
      result.riskLevel = 'CRITICAL'
    } else if (hasRiskMedium && !hasTrust) {
      result.riskLevel = 'HIGH'
    } else if (hasRiskLow) {
      result.riskLevel = 'MEDIUM'
    } else if (hasTrust) {
      result.riskLevel = 'LOW'
    } else {
      result.riskLevel = 'LOW'
    }

    // Set confidence
    result.confidence = result.isCounterfeit ? 0.9 : 0.85

    // Extract reason
    result.reason = this.extractReasonFromText(text, result.riskLevel)

    // Set recommendation
    result.recommendation = this.getRecommendation(result.riskLevel, hasTrust)

    // Extract evidence
    result.evidence = this.extractEvidenceFromText(text)

    return result
  }

  private extractAlertFromText(text: string) {
    const result: {
      productNames?: string[]
      batchNumbers?: string[]
      affectedRegions?: string[]
      manufacturer?: string
      category?: string
      reason?: string
      severity?: string
      regulatoryAction?: string
      contactInfo?: string
      [key: string]: string | string[] | undefined
    } = {
      productNames: [],
      batchNumbers: [],
      affectedRegions: []
    }

    // Extract product names
    const productRegex = /(?:product|medicine|drug|batch)[s]?[:\s]*([^\n\r]{6,50})/gi
    const productMatches = Array.from(text.matchAll(productRegex), m => m[1]?.trim()).filter(Boolean)
    result.productNames = [...new Set(productMatches)]

    // Extract batch numbers
    const batchRegex = /(?:batch|lot|serial)\s*(?:number|num)?\s*:?\s*([A-Z0-9\-\/\.]{3,})/gi
    const batchMatches = Array.from(text.matchAll(batchRegex), m => m[1]?.trim()).filter(Boolean)
    result.batchNumbers = [...new Set(batchMatches)]

    // Extract manufacturer
    const manufacturerMatch = text.match(/(?:manufacturer|producer|company)[^\n\r]*([^\n\r]{4,30})/i)
    if (manufacturerMatch) {
      result.manufacturer = manufacturerMatch[1].trim()
    }

    // Determine category and reason
    if (/(?:counterfeit|fake|falsified|spurious)/i.test(text)) {
      result.category = 'COUNTERFEIT'
      result.reason = 'Product found to be counterfeit or falsified'
      result.severity = 'HIGH'
      result.regulatoryAction = 'Ban from market'
    } else if (/(?:recall|withdraw)/i.test(text)) {
      result.category = 'RECALL'
      result.reason = text.match(/(?:recall|withdraw)[^\n\r]{20,}/i)?.[0] || 'Product recalled due to safety concerns'
      result.severity = 'HIGH'
      result.regulatoryAction = 'Recall from consumers'
    } else if (/(?:expired|adulterated)/i.test(text)) {
      result.category = 'EXPIRED'
      result.reason = text.match(/(?:expired|adulterated)[^\n\r]{20,}/i)?.[0] || 'Product found to be expired or adulterated'
      result.severity = 'MEDIUM'
      result.regulatoryAction = 'Removal from market'
    } else {
      result.category = 'QUALITY_ISSUE'
      result.reason = text.match(/(?:quality|issue|concern)[^\n\r]{20,}/i)?.[0] || 'Quality or regulatory concern detected'
      result.severity = 'MEDIUM'
      result.regulatoryAction = 'Investigation ongoing'
    }

    // Extract regions
    const regions: string[] = []
    const regionPatterns = [
      /(?:in|across|affecting)\s+(Nigeria|nationwide|nationally|all states)/gi,
      /(?:state|region)[s]?\s*:?\s*([A-Z][a-z\s]{2,20})/gi
    ]

    regionPatterns.forEach(pattern => {
      const matches = Array.from(text.matchAll(pattern), m => m[1])
      regions.push(...matches.filter(Boolean))
    })

    if (regions.length > 0) {
      result.affectedRegions = [...new Set(regions)]
    }

    // Extract contact info
    const contactMatch = text.match(/(?:contact|phone|call|reach us)[^\n\r]{10,}/i)
    if (contactMatch) {
      result.contactInfo = contactMatch[0].trim()
    }

    return result
  }

  private extractReasonFromText(text: string, riskLevel: string): string {
    const reasonPatterns = [
      /(?:because|due to|reason|concern)[^\n\r]{15,80}(?:\n|$|\.)/gi,
      /(?:problem|issue|defect)[^\n\r]{15,80}/gi
    ]

    for (const pattern of reasonPatterns) {
      const match = text.match(pattern)
      if (match) {
        return match[0].trim()
      }
    }

    // Default reasons based on risk level
    switch (riskLevel) {
      case 'CRITICAL': return 'Strong counterfeit or safety indicators detected'
      case 'HIGH': return 'Product shows concerning safety characteristics'
      case 'MEDIUM': return 'Product has some irregularities requiring attention'
      default: return 'Unable to determine specific reason from available information'
    }
  }

  private getRecommendation(riskLevel: string, hasTrust: boolean): string {
    if (hasTrust && riskLevel === 'LOW') {
      return 'Product appears safe. Continue normal usage but monitor for any changes.'
    }

    switch (riskLevel) {
      case 'CRITICAL':
        return 'CEASE USE IMMEDIATELY. Do not use this product. Contact healthcare facility immediately. Report to regulatory authorities.'
      case 'HIGH':
        return 'STOP USING THIS PRODUCT. Return to point of purchase if possible. Consult pharmacist or doctor immediately.'
      case 'MEDIUM':
        return 'Exercise caution with this product. Verify with manufacturer before use. Consider alternative products if concerned.'
      default:
        return 'Product appears acceptable, but always verify expiration dates and storage conditions.'
    }
  }

  private extractEvidenceFromText(text: string): string[] {
    const evidence: string[] = []

    const indicatorPatterns = [
      /(counterfeit|fake|falsified)/gi,
      /(recall|withdraw|remove)/gi,
      /(expired|adulterated|contaminated)/gi,
      /(unsafe|dangerous|harmful)/gi,
      /(unauthorized|unapproved)/gi
    ]

    indicatorPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => evidence.push(`Found: "${match}"`))
      }
    })

    return evidence.length > 0 ? evidence : ['Analysis based on available information']
  }

  private estimateTokens(text: string): number {
    // Claude uses different tokenization, approximate based on characters
    // Roughly 4 characters per token, similar to other models
    return Math.ceil(text.length / 4)
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    // Claude Sonnet pricing (as of 2024)
    const inputCost = (inputTokens / 1000000) * 3    // $3 per million input tokens
    const outputCost = (outputTokens / 1000000) * 15  // $15 per million output tokens

    return inputCost + outputCost
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.modelName,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hello' }]
        })
      })
      return response.ok
    } catch {
      return false
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      // Claude models are well-known, return supported ones
      return [
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        'claude-3-5-sonnet-20240620'
      ]
    } catch {
      return ['claude-3-sonnet-20240229']
    }
  }
}
