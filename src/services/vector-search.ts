import prisma from '@/lib/prisma'
import { pipeline } from '@xenova/transformers'
import Fuse from 'fuse.js'

// Enhanced Vector Search and Matching Service
export class VectorSimilaritySearch {
  private nlpModel: any = null
  private isInitialized = false

  async initialize() {
    if (this.isInitialized) return

    try {
      console.log('🧠 Initializing vector search with HuggingFace model...')
      this.nlpModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
      this.isInitialized = true
      console.log('✅ Vector search model initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize vector search model:', error)
      throw error
    }
  }

  // Generate embedding for search query
  async generateQueryEmbedding(text: string): Promise<number[]> {
    if (!this.nlpModel) {
      throw new Error('Vector search model not initialized')
    }

    try {
      const embedding = await this.nlpModel(text, {
        pooling: 'mean',
        normalize: true
      })

      return Array.from(embedding.data)
    } catch (error) {
      console.error('Failed to generate query embedding:', error)
      return []
    }
  }

  // Calculate cosine similarity between two vectors
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (!vec1.length || !vec2.length || vec1.length !== vec2.length) {
      return 0
    }

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i]
      norm1 += vec1[i] * vec1[i]
      norm2 += vec2[i] * vec2[i]
    }

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
    return Math.max(0, Math.min(1, similarity)) // Clamp to [0, 1]
  }

  // Search for similar alerts using vector similarity
  async semanticAlertSearch(query: string, options: {
    limit?: number
    threshold?: number
    productName?: string
    batchNumber?: string
    includeInactive?: boolean
  } = {}): Promise<{
    matches: Array<{
      alertId: string
      title: string
      excerpt: string
      url: string
      similarity: number
      matchType: 'SEMANTIC' | 'EXACT' | 'BATCH' | 'HYBRID'
      confidence: number
    }>
    searchMetadata: {
      totalResults: number
      searchTime: number
      queryEmbeddingGenerated: boolean
      filtersApplied: string[]
    }
  }> {
    const {
      limit = 10,
      threshold = 0.3, // Lower threshold for broader matches
      productName,
      batchNumber,
      includeInactive = false
    } = options

    const startTime = Date.now()

    try {
      console.log(`🔍 Performing semantic search for: "${query}"`)

      // Generate query embedding
      const queryEmbedding = await this.generateQueryEmbedding(query)

      if (!queryEmbedding.length) {
        console.warn('❌ Failed to generate query embedding')
        return {
          matches: [],
          searchMetadata: {
            totalResults: 0,
            searchTime: Date.now() - startTime,
            queryEmbeddingGenerated: false,
            filtersApplied: []
          }
        }
      }

      // Get alerts from database
      const alerts = await prisma.nafdacAlert.findMany({
        where: {
          active: includeInactive ? undefined : true,
          // Apply additional filters if provided
          ...(productName && {
            productNames: {
              has: productName.toLowerCase()
            }
          }),
          ...(batchNumber && {
            batchNumbers: {
              has: batchNumber.toUpperCase()
            }
          })
        },
        select: {
          id: true,
          title: true,
          excerpt: true,
          url: true,
          scrapedAt: true,
          productNames: true,
          batchNumbers: true
        }
      })

      const matches: Array<{
        alertId: string
        title: string
        excerpt: string
        url: string
        similarity: number
        matchType: 'SEMANTIC' | 'EXACT' | 'BATCH' | 'HYBRID'
        confidence: number
      }> = []

      // Calculate similarity for each alert
      for (const alert of alerts) {
        let maxSimilarity = 0
        let matchType: 'SEMANTIC' | 'EXACT' | 'BATCH' | 'HYBRID' = 'SEMANTIC'
        let confidence = 0

        // Embedding similarity currently disabled - would require embed_title and embed_content fields
        // For now, rely on fuzzy string matching

        // Exact product name match check
        if (productName && alert.productNames.some(
          name => name.toLowerCase().includes(productName.toLowerCase()) ||
                 productName.toLowerCase().includes(name.toLowerCase())
        )) {
          matchType = 'HYBRID'
          confidence = 0.9
          maxSimilarity = Math.max(maxSimilarity, 0.9)
        }

        // Exact batch number match check
        if (batchNumber && alert.batchNumbers.some(
          batch => batch.toUpperCase().includes(batchNumber.toUpperCase()) ||
                  batchNumber.toUpperCase().includes(batch.toUpperCase())
        )) {
          matchType = maxSimilarity > 0.8 ? 'HYBRID' : 'BATCH'
          confidence = 1.0
          maxSimilarity = 1.0
        }

        // Fallback fuzzy string matching for legacy alerts without embeddings
        if (maxSimilarity < 0.1) {
          const fuse = new Fuse([alert.title, alert.excerpt], {
            threshold: 0.4,
            includeScore: true
          })
          const fuseResults = fuse.search(query)
          if (fuseResults.length > 0 && fuseResults[0].score !== undefined) {
            maxSimilarity = Math.max(maxSimilarity, 1 - fuseResults[0].score)
            matchType = 'SEMANTIC'
          }
        }

        // Calculate final confidence based on match type and similarity
        if (confidence === 0) {
          confidence = matchType === 'SEMANTIC' ? maxSimilarity * 0.8 :
                      matchType === 'BATCH' ? 0.9 : maxSimilarity
        }

        if (maxSimilarity >= threshold) {
          matches.push({
            alertId: alert.id,
            title: alert.title,
            excerpt: alert.excerpt,
            url: alert.url,
            similarity: maxSimilarity,
            matchType,
            confidence
          })
        }
      }

      // Sort by similarity and confidence
      matches.sort((a, b) => {
        // Prioritize exact/hybrid matches
        if (a.matchType !== 'SEMANTIC' && b.matchType === 'SEMANTIC') return -1
        if (b.matchType !== 'SEMANTIC' && a.matchType === 'SEMANTIC') return 1

        // Then by confidence, then by similarity
        if (Math.abs(a.confidence - b.confidence) > 0.1) {
          return b.confidence - a.confidence
        }
        return b.similarity - a.similarity
      })

      // Apply limit
      const limitedMatches = matches.slice(0, limit)

      const filtersApplied = []
      if (productName) filtersApplied.push('product')
      if (batchNumber) filtersApplied.push('batch')
      if (!includeInactive) filtersApplied.push('active_only')

      return {
        matches: limitedMatches,
        searchMetadata: {
          totalResults: matches.length,
          searchTime: Date.now() - startTime,
          queryEmbeddingGenerated: queryEmbedding.length > 0,
          filtersApplied
        }
      }

    } catch (error) {
      console.error('❌ Vector similarity search failed:', error)

      return {
        matches: [],
        searchMetadata: {
          totalResults: 0,
          searchTime: Date.now() - startTime,
          queryEmbeddingGenerated: false,
          filtersApplied: []
        }
      }
    }
  }

  // Advanced product verification with vector search
  async enhancedProductVerification(options: {
    productName: string
    description?: string
    batchNumber?: string
    userBatches?: string[]
    strictMode?: boolean
  }): Promise<{
    isCounterfeit: boolean
    riskLevel: 'SAFE' | 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' | 'CRITICAL'
    confidence: number
    matches: Array<{
      alertId: string
      title: string
      excerpt: string
      similarity: number
      matchType: string
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
      url: string
    }>
    searchSummary: {
      queryUsed: string
      totalMatchesFound: number
      searchTimeMs: number
      recommendation: string
    }
  }> {
    const {
      productName,
      description = '',
      batchNumber,
      userBatches = [],
      strictMode = false
    } = options

    const startTime = Date.now()

    try {
      console.log(`🎯 Starting enhanced product verification for: ${productName}`)

      // Create comprehensive search query
      let searchQuery = productName

      if (description) {
        searchQuery += ` ${description}`
      }

      if (batchNumber) {
        searchQuery += ` batch ${batchNumber}`
      }

      if (userBatches.length > 0) {
        searchQuery += ` ${userBatches.join(' ')}`
      }

      console.log(`🔍 Search query: "${searchQuery}"`)

      // Perform vector similarity search
      const searchResult = await this.semanticAlertSearch(searchQuery, {
        limit: 20,
        threshold: strictMode ? 0.6 : 0.3,
        productName: batchNumber ? undefined : productName, // Skip if we have batch
        batchNumber: batchNumber,
        includeInactive: false
      })

      // Get detailed alert information for matches
      const detailMatches = []

      for (const match of searchResult.matches.slice(0, 5)) {
        try {
          const alert = await prisma.nafdacAlert.findUnique({
            where: { id: match.alertId },
            select: {
              id: true,
              severity: true,
              productNames: true,
              batchNumbers: true,
              manufacturer: true
            }
          })

          if (alert) {
            detailMatches.push({
              ...match,
              severity: alert.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
              manufacturer: alert.manufacturer,
              affectedProducts: alert.productNames,
              affectedBatches: alert.batchNumbers
            })
          }
        } catch (error) {
          console.warn(`Failed to get details for alert ${match.alertId}`)
        }
      }

      // Risk assessment algorithm
      const riskAssessment = this.assessRiskLevel(searchResult.matches, {
        strictMode,
        hasExactBatchMatch: searchResult.matches.some(m =>
          m.matchType === 'BATCH' || m.matchType === 'HYBRID'),
        highestSimilarity: searchResult.matches[0]?.similarity || 0
      })

      const verificationResult = {
        isCounterfeit: riskAssessment.riskLevel === 'CRITICAL' ||
                      (strictMode && riskAssessment.riskLevel === 'HIGH_RISK'),
        riskLevel: riskAssessment.riskLevel,
        confidence: riskAssessment.confidence,
        matches: detailMatches,
        searchSummary: {
          queryUsed: searchQuery,
          totalMatchesFound: searchResult.matches.length,
          searchTimeMs: Date.now() - startTime,
          recommendation: riskAssessment.recommendation
        }
      }

      console.log(`✅ Verification complete: ${verificationResult.riskLevel} (${verificationResult.confidence * 100}%)`)

      return verificationResult

    } catch (error) {
      console.error('❌ Enhanced product verification failed:', error)

      return {
        isCounterfeit: false,
        riskLevel: 'SAFE',
        confidence: 0,
        matches: [],
        searchSummary: {
          queryUsed: productName,
          totalMatchesFound: 0,
          searchTimeMs: Date.now() - startTime,
          recommendation: 'Verification failed due to technical error. Please try again.'
        }
      }
    }
  }

  // Assess risk level based on search results
  private assessRiskLevel(matches: any[], context: {
    strictMode: boolean
    hasExactBatchMatch: boolean
    highestSimilarity: number
  }): {
    riskLevel: 'SAFE' | 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' | 'CRITICAL'
    confidence: number
    recommendation: string
  } {
    if (matches.length === 0) {
      return {
        riskLevel: 'SAFE',
        confidence: 0.95,
        recommendation: 'No matching alerts found. Product appears safe.'
      }
    }

    const { strictMode, hasExactBatchMatch, highestSimilarity } = context
    const topMatch = matches[0]

    // Critical: Exact batch match OR very high similarity with strict mode
    if (hasExactBatchMatch && topMatch.matchType === 'BATCH') {
      return {
        riskLevel: 'CRITICAL',
        confidence: 0.98,
        recommendation: 'CRITICAL ALERT: Your product batch matches a counterfeit batch. Do not use!'
      }
    }

    // Critical: High similarity in strict mode + high severity match
    if (strictMode && highestSimilarity > 0.8) {
      return {
        riskLevel: 'CRITICAL',
        confidence: 0.95,
        recommendation: 'CRITICAL ALERT: Strong match found in strict verification mode.'
      }
    }

    // High Risk: Multiple matches with high similarity
    if (matches.length >= 2 && highestSimilarity > 0.7) {
      return {
        riskLevel: 'HIGH_RISK',
        confidence: 0.85,
        recommendation: 'HIGH RISK: Multiple alert matches found. Exercise extreme caution.'
      }
    }

    // Medium Risk: Single match with moderate similarity
    if (highestSimilarity > 0.5) {
      return {
        riskLevel: 'MEDIUM_RISK',
        confidence: 0.7,
        recommendation: 'MEDIUM RISK: Related product alert found. Further investigation recommended.'
      }
    }

    // Low Risk: Weak matches only
    if (highestSimilarity > 0.3) {
      return {
        riskLevel: 'LOW_RISK',
        confidence: 0.4,
        recommendation: 'LOW RISK: Minor similarities detected but insufficient evidence.'
      }
    }

    // Safe: Very weak or no meaningful matches
    return {
      riskLevel: 'SAFE',
      confidence: 0.2,
      recommendation: 'SAFE: No significant alert matches found.'
    }
  }

  // Search by batch number only (fastest path)
  async batchLookup(batchNumbers: string[]): Promise<{
    matches: Array<{
      batchNumber: string
      alertId: string
      title: string
      url: string
      severity: string
      confidence: number
    }>
    found: boolean
    totalSearched: number
  }> {
    try {
      const matches = []
      const upperBatches = batchNumbers.map(b => b.toUpperCase())

      console.log(`🔢 Batch lookup for: ${upperBatches.join(', ')}`)

      // Direct database query for batch matches
      const alerts = await prisma.nafdacAlert.findMany({
        where: {
          active: true,
          batchNumbers: {
            hasSome: upperBatches
          }
        },
        select: {
          id: true,
          title: true,
          url: true,
          severity: true,
          batchNumbers: true,
          scrapedAt: true
        }
      })

      // Find exact matches
      for (const alert of alerts) {
        const matchingBatches = alert.batchNumbers.filter(batch =>
          upperBatches.some(search => search.includes(batch) || batch.includes(search))
        )

        if (matchingBatches.length > 0) {
          matches.push({
            batchNumber: matchingBatches[0],
            alertId: alert.id,
            title: alert.title,
            url: alert.url,
            severity: alert.severity,
            confidence: 1.0
          })
        }
      }

      return {
        matches,
        found: matches.length > 0,
        totalSearched: upperBatches.length
      }

    } catch (error) {
      console.error('Batch lookup failed:', error)
      return {
        matches: [],
        found: false,
        totalSearched: batchNumbers.length
      }
    }
  }

  // Get search statistics and health check
  async getSearchStats(): Promise<{
    databaseStats: {
      totalAlerts: number
      activeAlerts: number
      alertsWithEmbeddings: number
      lastScrape: Date | null
    }
    modelStatus: {
      modelLoaded: boolean
      modelName: string
    }
  }> {
    try {
      const [totalAlerts, activeAlerts, alertsWithEmbeddings] = await Promise.all([
        prisma.nafdacAlert.count(),
        prisma.nafdacAlert.count({ where: { active: true } }),
        // Embedding functionality not yet implemented - return 0 for now
        Promise.resolve(0)
      ])

      const lastAlert = await prisma.nafdacAlert.findFirst({
        orderBy: { scrapedAt: 'desc' },
        select: { scrapedAt: true }
      })

      return {
        databaseStats: {
          totalAlerts,
          activeAlerts,
          alertsWithEmbeddings,
          lastScrape: lastAlert?.scrapedAt || null
        },
        modelStatus: {
          modelLoaded: this.isInitialized,
          modelName: 'Xenova/all-MiniLM-L6-v2'
        }
      }

    } catch (error) {
      console.error('Failed to get search stats:', error)
      throw error
    }
  }
}

// Export singleton instance
export const vectorSearch = new VectorSimilaritySearch()
