import axios from 'axios'
import { AIRequest, AIResponse, ExtractionResult } from './types-fixed'

export class AmazonNovaService {
  private readonly apiKey: string
  private readonly modelName: string

  constructor() {
    this.apiKey = process.env.AWS_NOVA_AI || ''
    this.modelName = 'amazon.nova-lite-v1:0' // Default to lite for cost-effectiveness
  }

  async processVision(imageBuffer: Buffer): Promise<AIResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('AWS_NOVA_AI API key not configured')
      }

      const base64Image = imageBuffer.toString('base64')

      const response = await axios.post(
        `https://bedrock-runtime.us-east-1.amazonaws.com/model/${this.modelName}/invoke`,
        {
          messages: [
            {
              role: 'user',
              content: [
                {
                  image: {
                    format: 'jpeg',
                    source: {
                      bytes: base64Image
                    }
                  }
                },
                {
                  text: 'Extract all visible text from this product image. Focus on Product Name, Batch Number, NAFDAC number, and Expiry Date if present. Return only the raw extracted text.'
                }
              ]
            }
          ],
          inferenceConfig: {
            maxTokens: 2000,
            temperature: 0.1
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.apiKey
          }
        }
      )

      const extractedText = response.data.output?.message?.content?.[0]?.text || ''
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
        `https://bedrock-runtime.us-east-1.amazonaws.com/model/${this.modelName}/invoke`,
        {
          messages: [
            {
              role: 'user',
              content: [{ text: prompt }]
            }
          ],
          inferenceConfig: {
            maxTokens: 1000,
            temperature: 0
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Amz-Bedrock-Auth-Token': this.apiKey
          }
        }
      )

      const resultText = response.data.output?.message?.content?.[0]?.text || '{}'
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
        `https://bedrock-runtime.us-east-1.amazonaws.com/model/${this.modelName}/invoke`,
        {
          messages: [{ role: 'user', content: [{ text: 'ping' }] }],
          inferenceConfig: { maxTokens: 10 }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.apiKey
          },
          timeout: 5000
        }
      )
      return !!response.data.output
    } catch {
      return false
    }
  }
}
