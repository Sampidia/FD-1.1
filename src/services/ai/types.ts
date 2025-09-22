// AI Service Types
export interface AIProviderConfig {
  id: string
  apiKey: string
  modelName: string
  provider: 'google' | 'openai' | 'anthropic'
  temperature?: number
  maxTokens: number
  costInput: number
  costOutput: number
}

export interface AIRequest {
  text: string
  task: 'ocr' | 'verification' | 'extraction'
  maxTokens?: number
  temperature?: number
  options?: Record<string, unknown>
}

export interface AIResponse {
  content: string
  extractedData?: ExtractionResult | null
  usage: UsageInfo
  metadata: ResponseMetadata
}

export interface ExtractionResult {
  productNames?: string[]
  batchNumbers?: string[]
  expiryDate?: string
  manufacturers?: string[]
  confidence?: number
  isCounterfeit?: boolean
  reason?: string
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  recommendation?: string
  category?: 'RECALL' | 'COUNTERFEIT' | 'EXPIRED' | 'QUALITY_ISSUE'
  manufacturer?: string
  affectedRegions?: string[]
  severity?: 'LOW' | 'MEDIUM' | 'HIGH'
  rawResponse?: string
}

export interface UsageInfo {
  inputTokens: number
  outputTokens: number
  cost: number
}

export interface ResponseMetadata {
  model: string
  provider: string
  responseTime: number
  success: boolean
  error?: string
  finishReason?: string
  rateLimited?: boolean
}

// Plan and User Types
export interface UserPlan {
  id: string
  name: string
  displayName: string
  price: number
  currency: string
  maxScansPerMonth: number
  maxImagesPerScan: number
  maxAIRequestsPerMonth: number
  maxTokensPerDay: number
  priority: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Payment Types
export interface CurrencyConversion {
  fromCurrency: string
  toCurrency: string
  exchangeRate: number
  markup: number
  effectiveRate: number
  lastUpdated: Date
  updatedBy: string
}

export interface PaymentConfig {
  provider: 'paystack' | 'flutterwave' | 'paypal'
  apiKey: string
  apiSecret?: string
  webhookSecret?: string
  webhookUrl?: string
  minAmount: number
  maxAmount: number
  fixedFee: number
  transactionFee: number
  vatRate: number
  currency: string
}

// Error Types
export interface APIError {
  code: string
  message: string
  provider?: string
  timestamp: Date
  retryable: boolean
}

export interface RateLimit {
  requests: number
  window: number // minutes
  remaining: number
  resetTime: Date
}

// Analytics Types
export interface AIUsageStats {
  totalRequests: number
  totalCost: number
  avgResponseTime: number
  successRate: number
  costByProvider: Record<string, number>
  costByTask: Record<string, number>
  usageTrends: Array<{ date: string, requests: number, cost: number }>
}

export interface PaymentAnalytics {
  totalRevenue: number
  conversionCount: number
  avgTransaction: number
  revenueByProvider: Record<string, number>
  revenueByPlan: Record<string, number>
  failedPayments: number
  successRate: number
  currencyBreakdown: Record<string, number>
}

// Dashboard Types
export interface DashboardData {
  aiStats: AIUsageStats
  paymentStats: PaymentAnalytics
  topUsers: Array<{ userId: string, name: string, usage: number }>
  recentActivity: Array<{ type: string, userId: string, amount?: number, timestamp: Date }>
  alerts: Array<{ type: 'warning' | 'error' | 'info', message: string, timestamp: Date }>
}
