/**
 * OCR Validation and Confidence Scoring Service
 * Validates OCR results and provides confidence scores for different data types
 */

export interface ValidationResult {
  isValid: boolean
  confidence: number
  issues: string[]
  suggestions: string[]
  validationDetails: {
    batchNumber: ValidationDetail
    productName: ValidationDetail
    expiryDate: ValidationDetail
    manufacturer: ValidationDetail
  }
}

export interface ValidationDetail {
  isValid: boolean
  confidence: number
  issues: string[]
  suggestions: string[]
}

export class OCRValidationService {
  /**
   * Validate OCR results and calculate overall confidence
   */
  validateOCRResults(ocrData: {
    productName?: string
    batchNumber?: string
    expiryDate?: string
    manufacturer?: string
    rawText: string
    strategy: string
  }): ValidationResult {
    const validationDetails = {
      batchNumber: this.validateBatchNumber(ocrData.batchNumber),
      productName: this.validateProductName(ocrData.productName),
      expiryDate: this.validateExpiryDate(ocrData.expiryDate),
      manufacturer: this.validateManufacturer(ocrData.manufacturer)
    }

    // Calculate overall confidence based on individual validations
    const weights = {
      batchNumber: 0.4, // Most important
      productName: 0.3,
      expiryDate: 0.15,
      manufacturer: 0.15
    }

    let totalConfidence = 0
    let totalWeight = 0
    const allIssues: string[] = []
    const allSuggestions: string[] = []

    Object.entries(validationDetails).forEach(([field, detail]) => {
      const weight = weights[field as keyof typeof weights]
      if (detail.confidence > 0) {
        totalConfidence += detail.confidence * weight
        totalWeight += weight
      }
      allIssues.push(...detail.issues)
      allSuggestions.push(...detail.suggestions)
    })

    // Normalize confidence
    const overallConfidence = totalWeight > 0 ? totalConfidence / totalWeight : 0

    // Determine if result is valid
    const isValid = overallConfidence >= 0.5 && validationDetails.batchNumber.isValid

    return {
      isValid,
      confidence: overallConfidence,
      issues: [...new Set(allIssues)],
      suggestions: [...new Set(allSuggestions)],
      validationDetails
    }
  }

  /**
   * Validate batch number
   */
  private validateBatchNumber(batchNumber?: string): ValidationDetail {
    const result: ValidationDetail = {
      isValid: false,
      confidence: 0,
      issues: [],
      suggestions: []
    }

    if (!batchNumber) {
      result.issues.push('No batch number detected')
      result.suggestions.push('Ensure batch number is clearly visible in the image')
      return result
    }

    const batch = batchNumber.trim().toUpperCase()

    // Check length (most pharmaceutical batch numbers are 3-15 characters)
    if (batch.length < 3 || batch.length > 15) {
      result.issues.push(`Batch number length (${batch.length}) is unusual`)
      result.confidence = 0.2
    } else {
      result.confidence = 0.6
    }

    // Check for alphanumeric characters (most common pattern)
    const alphanumericRegex = /^[A-Z0-9\-_\s]+$/
    if (!alphanumericRegex.test(batch)) {
      result.issues.push('Batch number contains invalid characters')
      result.confidence *= 0.5
    }

    // Check for common patterns
    const commonPatterns = [
      /^[A-Z]+\d+[A-Z]*$/, // Letters + numbers + optional letters (T36184B)
      /^\d+[A-Z]+$/,       // Numbers + letters
      /^[A-Z]+\d+$/,       // Letters + numbers
      /^\d+$/              // Pure numbers
    ]

    const matchesPattern = commonPatterns.some(pattern => pattern.test(batch.replace(/[\s\-_]/g, '')))
    if (matchesPattern) {
      result.confidence = Math.min(result.confidence + 0.3, 1.0)
    }

    // Check for suspicious patterns
    if (batch.includes('TEST') || batch.includes('SAMPLE')) {
      result.issues.push('Batch number appears to be a test/sample')
      result.confidence *= 0.7
    }

    result.isValid = result.confidence >= 0.6
    result.suggestions.push('Batch numbers typically follow patterns like T36184B or PCT2023002')

    return result
  }

  /**
   * Validate product name
   */
  private validateProductName(productName?: string): ValidationDetail {
    const result: ValidationDetail = {
      isValid: false,
      confidence: 0,
      issues: [],
      suggestions: []
    }

    if (!productName) {
      result.issues.push('No product name detected')
      result.suggestions.push('Ensure product name is clearly visible in the image')
      return result
    }

    const name = productName.trim()

    // Check length
    if (name.length < 2 || name.length > 100) {
      result.issues.push(`Product name length (${name.length}) is unusual`)
      result.confidence = 0.1
    } else {
      result.confidence = 0.5
    }

    // Check for pharmaceutical terms
    const pharmaTerms = [
      'tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment',
      'paracetamol', 'ibuprofen', 'amoxicillin', 'vitamin', 'antibiotic',
      'mg', 'ml', 'g', 'mcg', 'iu', 'units'
    ]

    const hasPharmaTerms = pharmaTerms.some(term =>
      name.toLowerCase().includes(term.toLowerCase())
    )

    if (hasPharmaTerms) {
      result.confidence = Math.min(result.confidence + 0.4, 1.0)
    }

    // Check for proper capitalization (should start with capital letter)
    if (/^[a-z]/.test(name)) {
      result.issues.push('Product name should start with a capital letter')
      result.confidence *= 0.9
    }

    // Check for suspicious patterns
    if (/^\d/.test(name)) {
      result.issues.push('Product name should not start with a number')
      result.confidence *= 0.8
    }

    result.isValid = result.confidence >= 0.4
    result.suggestions.push('Product names typically include dosage information like "500mg"')

    return result
  }

  /**
   * Validate expiry date
   */
  private validateExpiryDate(expiryDate?: string): ValidationDetail {
    const result: ValidationDetail = {
      isValid: false,
      confidence: 0,
      issues: [],
      suggestions: []
    }

    if (!expiryDate) {
      result.issues.push('No expiry date detected')
      result.suggestions.push('Ensure expiry date is clearly visible in the image')
      return result
    }

    const date = expiryDate.trim()

    // Common date patterns
    const datePatterns = [
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // MM/DD/YYYY or MM/DD/YY
      /^\d{1,2}-\d{1,2}-\d{2,4}$/,   // MM-DD-YYYY
      /^\d{2,4}\/\d{1,2}\/\d{1,2}$/, // YYYY/MM/DD
      /^\d{2,4}-\d{1,2}-\d{1,2}$/,   // YYYY-MM-DD
      /^EXP\s*\d{1,2}\/\d{2,4}$/i,   // EXP MM/YYYY
      /^EXP\s*\d{2,4}$/i            // EXP YYYY
    ]

    const matchesPattern = datePatterns.some(pattern => pattern.test(date))
    if (matchesPattern) {
      result.confidence = 0.7
      result.isValid = true
    } else {
      result.issues.push('Expiry date format is not standard')
      result.confidence = 0.3
      result.suggestions.push('Common formats: MM/YYYY, MM/DD/YYYY, or YYYY-MM-DD')
    }

    // Check if date is in the future (basic validation)
    try {
      const now = new Date()
      // Simple parsing - this could be enhanced
      const dateParts = date.replace(/[^\d]/g, ' ').trim().split(/\s+/)
      if (dateParts.length >= 2) {
        const year = parseInt(dateParts[dateParts.length - 1])
        const currentYear = now.getFullYear()

        if (year < currentYear - 1 || year > currentYear + 10) {
          result.issues.push(`Expiry year ${year} seems unlikely`)
          result.confidence *= 0.8
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }

    return result
  }

  /**
   * Validate manufacturer
   */
  private validateManufacturer(manufacturer?: string): ValidationDetail {
    const result: ValidationDetail = {
      isValid: false,
      confidence: 0,
      issues: [],
      suggestions: []
    }

    if (!manufacturer) {
      result.issues.push('No manufacturer detected')
      result.suggestions.push('Ensure manufacturer name is clearly visible in the image')
      return result
    }

    const mfg = manufacturer.trim()

    // Check length
    if (mfg.length < 2 || mfg.length > 100) {
      result.issues.push(`Manufacturer name length (${mfg.length}) is unusual`)
      result.confidence = 0.2
    } else {
      result.confidence = 0.5
    }

    // Check for common pharmaceutical company patterns
    const companyPatterns = [
      /\bLtd\b/i,
      /\bPlc\b/i,
      /\bPharma\b/i,
      /\bLaboratories?\b/i,
      /\bPharmaceuticals?\b/i,
      /\bMedical\b/i,
      /\bHealthcare\b/i
    ]

    const hasCompanyPattern = companyPatterns.some(pattern => pattern.test(mfg))
    if (hasCompanyPattern) {
      result.confidence = Math.min(result.confidence + 0.3, 1.0)
    }

    // Check for proper formatting
    if (/^[a-z]/.test(mfg)) {
      result.issues.push('Manufacturer name should start with a capital letter')
      result.confidence *= 0.9
    }

    result.isValid = result.confidence >= 0.4
    result.suggestions.push('Manufacturer names often include "Ltd", "Pharma", or "Laboratories"')

    return result
  }

  /**
   * Get confidence score interpretation
   */
  static getConfidenceInterpretation(confidence: number): {
    level: 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High'
    description: string
    recommendation: string
  } {
    if (confidence >= 0.9) {
      return {
        level: 'Very High',
        description: 'Excellent OCR quality with high confidence in extracted data',
        recommendation: 'Proceed with verification using extracted data'
      }
    } else if (confidence >= 0.8) {
      return {
        level: 'High',
        description: 'Good OCR quality with reliable extracted data',
        recommendation: 'Proceed with verification, minor manual review recommended'
      }
    } else if (confidence >= 0.6) {
      return {
        level: 'Medium',
        description: 'Moderate OCR quality with some uncertainty',
        recommendation: 'Review extracted data before verification'
      }
    } else if (confidence >= 0.3) {
      return {
        level: 'Low',
        description: 'Poor OCR quality with significant uncertainty',
        recommendation: 'Manual data entry recommended'
      }
    } else {
      return {
        level: 'Very Low',
        description: 'Very poor OCR quality, data unreliable',
        recommendation: 'Complete manual data entry required'
      }
    }
  }

  /**
   * Calculate composite confidence score
   */
  calculateCompositeConfidence(
    ocrConfidence: number,
    strategy: string,
    preprocessingUsed: boolean,
    attemptCount: number
  ): number {
    let compositeScore = ocrConfidence

    // Strategy-based adjustments
    const strategyMultipliers: Record<string, number> = {
      'claude_vision': 1.0,
      'gemini_vision': 0.95,
      'openai_vision': 0.9,
      'preprocessing_retry': 0.85,
      'tesseract': 0.7
    }

    const strategyMultiplier = strategyMultipliers[strategy] || 0.8
    compositeScore *= strategyMultiplier

    // Preprocessing bonus
    if (preprocessingUsed) {
      compositeScore *= 1.1
    }

    // Attempt count penalty (more attempts = lower confidence)
    const attemptPenalty = Math.max(0.8, 1 - (attemptCount - 1) * 0.1)
    compositeScore *= attemptPenalty

    return Math.min(Math.max(compositeScore, 0), 1)
  }
}

// Export singleton instance
export const ocrValidationService = new OCRValidationService()