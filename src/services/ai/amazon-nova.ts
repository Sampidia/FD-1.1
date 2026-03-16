import axios from 'axios'
import { AIRequest, AIResponse, ExtractionResult } from './types-fixed'

export class AmazonNovaService {
  private readonly apiKey: string
  private readonly modelName: string

  constructor() {
    this.apiKey = process.env.AWS_NOVA_AI || ''
    this.modelName = 'nova-2-lite-v1' // Switch to proxy-supported model name
  }

  async processVision(imageDataUrl: string): Promise<AIResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('AWS_NOVA_AI API key not configured')
      }

      // Ensure the image has a proper data URL format
      let finalDataUrl = imageDataUrl
      if (!imageDataUrl.startsWith('data:')) {
        // Raw base64 without data URL prefix - add a default
        finalDataUrl = `data:image/png;base64,${imageDataUrl}`
      }

      console.log(`🔍 [Nova Vision] Image data URL prefix: ${finalDataUrl.substring(0, 40)}...`)

      const response = await axios.post(
        'https://api.nova.amazon.com/v1/chat/completions',
        {
          model: this.modelName,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: finalDataUrl
                  }
                },
                {
                  type: 'text',
                  text: `Analyze this product/medicine packaging image carefully. Extract ALL visible text and identify key pharmaceutical details.

Return your response as a JSON object with these fields:
{
  "productNames": ["the main product/drug name found on the packaging"],
  "batchNumbers": ["any batch numbers, lot numbers, or manufacturing codes"],
  "nafdacNumbers": ["any NAFDAC registration numbers"],
  "expiryDate": "the expiration/expiry date if visible",
  "manufacturers": ["the manufacturer or company name"]
}

IMPORTANT RULES:
- Look carefully at ALL text in the image including small print
- Product name is usually the largest/most prominent text
- Batch numbers often appear as alphanumeric codes (e.g., "BN: ABC123", "Lot: 12345")
- Include dosage info with product name (e.g., "Amoxicillin 500mg")
- If a field is not found, use an empty array [] or empty string ""
- Return ONLY the JSON object, no other text`
                }
              ]
            }
          ],
          max_tokens: 2000,
          temperature: 0.1
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      )

      const extractedText = response.data.choices[0]?.message?.content || ''
      console.log(`📝 [Nova Vision] Raw API response (first 500 chars): ${extractedText.substring(0, 500)}`)
      
      const extractionResult = this.parseNovaResult(extractedText)
      
      // Calculate confidence based on what was actually extracted
      let confidence = 0.4 // Base
      if (extractionResult.productNames && extractionResult.productNames.length > 0) confidence += 0.25
      if (extractionResult.batchNumbers && extractionResult.batchNumbers.length > 0) confidence += 0.2
      if (extractionResult.nafdacNumbers && extractionResult.nafdacNumbers.length > 0) confidence += 0.1
      if (extractionResult.expiryDate) confidence += 0.1
      if (extractionResult.manufacturers && extractionResult.manufacturers.length > 0) confidence += 0.1
      extractionResult.confidence = Math.min(confidence, 0.95)

      console.log(`🎯 [Nova Vision] Extracted: products=${JSON.stringify(extractionResult.productNames)}, batches=${JSON.stringify(extractionResult.batchNumbers)}, confidence=${extractionResult.confidence}`)

      return {
        content: extractedText,
        extractedData: extractionResult,
        usage: { inputTokens: 0, outputTokens: 0, cost: 0 },
        metadata: {
          model: this.modelName,
          provider: 'amazon-nova',
          responseTime: 0, 
          success: true
        }
      }
    } catch (error: any) {
      console.error('Nova Vision Error:', error.response?.data || error.message)
      throw new Error(`Nova Vision failed: ${error.message}`)
    }
  }

  async processText(textOrRequest: string | AIRequest): Promise<AIResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('AWS_NOVA_AI API key not configured')
      }

      const text = typeof textOrRequest === 'string' ? textOrRequest : textOrRequest.text

      const prompt = `Analyze this extracted text from a product package and identify key details in JSON format.
      Fields needed:
      - productNames: list of likely product names
      - batchNumbers: list of batch or lot numbers
      - nafdacNumbers: list of NAFDAC registration numbers
      - expiryDate: the expiration date if found
      - manufacturers: list of manufacturing companies
      
      Text: "${text}"
      
      Return ONLY JSON.`

      const response = await axios.post(
        'https://api.nova.amazon.com/v1/chat/completions',
        {
          model: this.modelName,
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: prompt }]
            }
          ],
          max_tokens: 1000,
          temperature: 0
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      )

      const resultText = response.data.choices[0]?.message?.content || '{}'
      const extractionResult = this.parseNovaResult(resultText)
      extractionResult.confidence = 0.9
      
      return {
        content: resultText,
        extractedData: extractionResult,
        usage: { inputTokens: 0, outputTokens: 0, cost: 0 },
        metadata: {
          model: this.modelName,
          provider: 'amazon-nova',
          responseTime: 0, 
          success: true
        }
      }
    } catch (error: any) {
      console.error('Nova Text Error:', error.response?.data || error.message)
      throw new Error(`Nova Text failed: ${error.message}`)
    }
  }

  public parseNovaResult(text: string): ExtractionResult {
    const result: ExtractionResult = {
      productNames: [],
      batchNumbers: [],
      nafdacNumbers: [],
      expiryDate: '',
      manufacturers: []
    }

    if (!text || text.trim().length === 0) {
      console.warn('⚠️ [Nova Parse] Empty text received')
      return result
    }

    try {
      // Strip markdown code fences if present (```json ... ```)
      let cleanText = text.replace(/```(?:json)?\s*\n?/gi, '').replace(/```\s*$/gi, '').trim()
      
      // Look for JSON block
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        console.log(`✅ [Nova Parse] Successfully parsed JSON response`)
        
        // Handle both "productName" (string) and "productNames" (array)
        let productNames: string[] = []
        if (parsed.productNames && Array.isArray(parsed.productNames)) {
          productNames = parsed.productNames.filter((n: string) => n && n.trim().length > 0)
        } else if (parsed.productName && typeof parsed.productName === 'string') {
          productNames = [parsed.productName]
        }

        // Handle both "batchNumber" (string) and "batchNumbers" (array)
        let batchNumbers: string[] = []
        if (parsed.batchNumbers && Array.isArray(parsed.batchNumbers)) {
          batchNumbers = parsed.batchNumbers.filter((n: string) => n && n.trim().length > 0)
        } else if (parsed.batchNumber && typeof parsed.batchNumber === 'string') {
          batchNumbers = [parsed.batchNumber]
        }

        // Handle both "nafdacNumber" (string) and "nafdacNumbers" (array)
        let nafdacNumbers: string[] = []
        if (parsed.nafdacNumbers && Array.isArray(parsed.nafdacNumbers)) {
          nafdacNumbers = parsed.nafdacNumbers.filter((n: string) => n && n.trim().length > 0)
        } else if (parsed.nafdacNumber && typeof parsed.nafdacNumber === 'string') {
          nafdacNumbers = [parsed.nafdacNumber]
        }

        // Handle manufacturers
        let manufacturers: string[] = []
        if (parsed.manufacturers && Array.isArray(parsed.manufacturers)) {
          manufacturers = parsed.manufacturers.filter((n: string) => n && n.trim().length > 0)
        } else if (parsed.manufacturer && typeof parsed.manufacturer === 'string') {
          manufacturers = [parsed.manufacturer]
        }

        return {
          productNames,
          batchNumbers,
          nafdacNumbers,
          expiryDate: parsed.expiryDate || parsed.expiry_date || '',
          manufacturers
        }
      }
    } catch (e) {
      console.warn('⚠️ [Nova Parse] Failed to parse JSON, falling back to regex:', e)
    }

    console.log(`🔄 [Nova Parse] Using regex fallback on text: "${text.substring(0, 200)}..."`)

    // Fallback regex logic - broader patterns
    const namePatterns = [
      /(?:Product\s*(?:Name)?|Drug|Medicine|Brand)\s*[:=]\s*["']?([^"'\n\r,]+)["']?/i,
      /(?:Name)\s*[:=]\s*["']?([^"'\n\r,]+)["']?/i
    ]
    for (const pattern of namePatterns) {
      const match = text.match(pattern)
      if (match && match[1]?.trim()) {
        result.productNames = [match[1].trim()]
        break
      }
    }

    const batchPatterns = [
      /(?:Batch|Lot|B\.?N\.?|Batch\s*(?:No|Number|#))\s*[:=]\s*["']?([A-Z0-9\-\/]+)["']?/i,
      /\b([A-Z]{2,4}\d{4,8}[A-Z0-9]*)\b/
    ]
    for (const pattern of batchPatterns) {
      const match = text.match(pattern)
      if (match && match[1]?.trim()) {
        result.batchNumbers = [match[1].trim()]
        break
      }
    }

    const nafdacMatch = text.match(/(?:NAFDAC|Reg\.?\s*(?:No|Number)?)\s*[:=]\s*["']?([A-Z0-9\-\/]+)["']?/i)
    if (nafdacMatch) result.nafdacNumbers = [nafdacMatch[1].trim()]

    const expiryMatch = text.match(/(?:Exp(?:iry)?|Expires?|Expiry\s*Date|Best\s*Before|Use\s*By)\s*[:=]\s*["']?([^"'\n\r,]+)["']?/i)
    if (expiryMatch) result.expiryDate = expiryMatch[1].trim()

    const mfrMatch = text.match(/(?:Mf[dg]\.?|Manufactur(?:er|ed\s*by)|Produced\s*by|Company)\s*[:=]\s*["']?([^"'\n\r,]+)["']?/i)
    if (mfrMatch) result.manufacturers = [mfrMatch[1].trim()]

    return result
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.post(
        'https://api.nova.amazon.com/v1/chat/completions',
        {
          model: this.modelName,
          messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }],
          max_tokens: 10
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 5000
        }
      )
      return !!response.data.choices
    } catch {
      return false
    }
  }
}
