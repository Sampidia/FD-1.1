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
                  text: 'Extract all visible text from this product image. Focus on Product Name, Batch Number, NAFDAC number, and Expiry Date if present. Return only the raw extracted text.'
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
      const extractionResult = this.parseNovaResult(extractedText)
      extractionResult.confidence = 0.85

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

    try {
      // Look for JSON block
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          productNames: parsed.productNames || [],
          batchNumbers: parsed.batchNumbers || [],
          nafdacNumbers: parsed.nafdacNumbers || [],
          expiryDate: parsed.expiryDate || '',
          manufacturers: parsed.manufacturers || []
        }
      }
    } catch (e) {
      console.warn('Failed to parse Nova JSON, falling back to regex')
    }

    // Fallback regex logic if JSON fails
    const nameMatch = text.match(/(?:Product|Name):\s*([^\n\r,]+)/i)
    if (nameMatch) result.productNames = [nameMatch[1].trim()]

    const batchMatch = text.match(/(?:Batch|Lot|B\/N):\s*([^\n\r,]+)/i)
    if (batchMatch) result.batchNumbers = [batchMatch[1].trim()]

    const nafdacMatch = text.match(/(?:NAFDAC|Reg):\s*([A-Z0-9-]+)/i)
    if (nafdacMatch) result.nafdacNumbers = [nafdacMatch[1].trim()]

    const expiryMatch = text.match(/(?:Exp|Expiry|Expires|Expiry Date):\s*([^\n\r,]+)/i)
    if (expiryMatch) result.expiryDate = expiryMatch[1].trim()

    const mfrMatch = text.match(/(?:Mfd|Manufacturer|Produced by|Company):\s*([^\n\r,]+)/i)
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

  private getMimeType(buffer: Buffer): string {
    if (buffer.length < 4) return 'image/jpeg'
    
    const hex = buffer.toString('hex', 0, 4)
    if (hex.startsWith('89504e47')) return 'image/png'
    if (hex.startsWith('ffd8ff')) return 'image/jpeg'
    if (hex.startsWith('47494638')) return 'image/gif'
    if (hex.startsWith('424d')) return 'image/bmp'
    
    // WebP magic number check (RIFF....WEBP)
    if (buffer.length > 12) {
      const riff = buffer.toString('ascii', 0, 4)
      const webp = buffer.toString('ascii', 8, 12)
      if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp'
    }

    return 'image/jpeg'
  }
}
