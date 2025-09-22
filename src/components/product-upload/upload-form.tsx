"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { UploadZone } from "./upload-zone"
import { Button } from "@/components/ui/button"
import { imagePreprocessing, PreprocessingResult, ImagePreprocessingService } from "@/services/image-preprocessing"

interface ProductFormData {
  productName: string
  productDescription: string
  userBatchNumber: string // Now optional when images are provided
}

interface UploadImages {
  front: File | null
  back: File | null
}

// Enhanced AI Analysis Response Interface
interface AnalysisResult {
  ocrText: string[]
  extractedBatchNumbers: string[]
  extractedDates: string[]
  extractedManufacturers: string[]
  similarityScore: number
  confidenceLevel: number
  detectedProducts: string[]
  manufacturerHints: string[]
  recommendation: string
  aiConfidence: number
  processingTime: number
}

// New Image Analysis Interface for the new API
interface ImageAnalysisResult {
  productName: string | null
  batchNumbers: string[]
  expiryDate: string | null
  manufacturers: string[]
  confidence: number
  extractedText: string
  warnings: string[]
  recommendations: string[]
}

interface ImageAnalysisResponse {
  success: boolean
  analysis: ImageAnalysisResult
  validation: {
    isValid: boolean
    hasMinimumData: boolean
    confidence: number
    missingFields: string[]
    quality: 'excellent' | 'good' | 'fair' | 'poor'
  }
  metadata: {
    analysisType: string
    userPlan: string
    imageCount: number
    processingTime: number
    aiProvider: string
    confidence: number
  }
}

interface AIAnalysisState {
  isAnalyzing: boolean
  result: AnalysisResult | null
  progress: number
  extractedText: string[]
}

// Enhanced Upload Form with AI Analysis
export function UploadForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<ProductFormData>({
    productName: '',
    productDescription: '',
    userBatchNumber: ''
  })

  const [images, setImages] = useState<UploadImages>({
    front: null,
    back: null
  })

  const [errors, setErrors] = useState<Partial<ProductFormData & { images: string }>>({})
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisState>({
    isAnalyzing: false,
    result: null,
    progress: 0,
    extractedText: []
  })

  // New state for image analysis
  const [imageAnalysis, setImageAnalysis] = useState<{
    isAnalyzing: boolean
    result: ImageAnalysisResponse | null
    progress: number
    hasAnalyzed: boolean
  }>({
    isAnalyzing: false,
    result: null,
    progress: 0,
    hasAnalyzed: false
  })

  // New state for insufficient points mode
  const [isInsufficientPointsMode, setIsInsufficientPointsMode] = useState(false)
  const [isClaimingDaily, setIsClaimingDaily] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [canClaimDaily, setCanClaimDaily] = useState(false)
  const [dailyStatusLoaded, setDailyStatusLoaded] = useState(false)
  const [pointsValidated, setPointsValidated] = useState(false)
  const [hasSufficientPoints, setHasSufficientPoints] = useState(false)
  const [lastAnalyzedImageCount, setLastAnalyzedImageCount] = useState(0)

  // 🔒 IMMEDIATE POINT VALIDATION ON COMPONENT MOUNT
  useEffect(() => {
    const validateUserPoints = async () => {
      try {
        console.log('🔒 VALIDATING USER POINTS ON LOAD...')

        const authResponse = await fetch('/api/auth/session')
        if (!authResponse.ok) {
          console.log('❌ User not authenticated')
          setPointsValidated(true)
          setHasSufficientPoints(false)
          setIsInsufficientPointsMode(true)
          return
        }

        const sessionData = await authResponse.json()
        if (!sessionData?.user?.id) {
          console.log('❌ User session not found')
          setPointsValidated(true)
          setHasSufficientPoints(false)
          setIsInsufficientPointsMode(true)
          return
        }

        const balanceResponse = await fetch('/api/user/balance')
        if (!balanceResponse.ok) {
          console.log('❌ Could not fetch balance')
          setPointsValidated(true)
          setHasSufficientPoints(false)
          setIsInsufficientPointsMode(true)
          return
        }

        const balanceData = await balanceResponse.json()

        // ✅ STRICT NO-FALLBACK FIX: Use API's pre-calculated total directly
        // (API already calculated this correctly, so just use it)
        const totalPoints = balanceData.data?.totalAvailablePoints || 0

        console.log(`🔍 POINT VALIDATION: ${totalPoints} points available (from API totalAvailablePoints)`)

        setHasSufficientPoints(totalPoints >= 1)
        setPointsValidated(true)

        if (totalPoints < 1) {
          console.log('❌ INSUFFICIENT POINTS - SHOWING MODAL IMMEDIATELY')
          setIsInsufficientPointsMode(true)
        }

      } catch (error) {
        console.error('🔒 Point validation error:', error)
        setPointsValidated(true)
        setHasSufficientPoints(false)
        setIsInsufficientPointsMode(true)
      }
    }

    validateUserPoints()
  }, [])

  // Fetch daily points status when insufficient points modal opens
  useEffect(() => {
    if (isInsufficientPointsMode && !dailyStatusLoaded) {
      fetchDailyPointsStatus()
    }
  }, [isInsufficientPointsMode, dailyStatusLoaded])

  // 🔄 SMART AUTO-OCR: Only trigger when images uploaded AND points validated as sufficient
  useEffect(() => {
    const hasAnyImage = Object.values(images).some(img => img !== null)
    const imageCount = Object.values(images).filter(img => img !== null).length
    const hasNewImages = imageCount > lastAnalyzedImageCount

    // 🚀 AUTO-TRIGGER CONDITIONS:
    // ✅ Images uploaded AND ✅ Points validated AND ✅ Sufficient points AND ✅ New images detected AND ❌ Not already analyzing
    if (hasAnyImage && pointsValidated && hasSufficientPoints && hasNewImages && !imageAnalysis.isAnalyzing) {
      console.log(`🤖 SMART AUTO-OCR: Processing ${imageCount} image(s) for validated user (new: ${imageCount - lastAnalyzedImageCount})...`)
      analyzeImagesWithNewAPI()
    }

    // ⚠️ BLOCK AUTO-OCR for insufficient points (manual button only)
    if (hasAnyImage && pointsValidated && !hasSufficientPoints && hasNewImages) {
      console.log('🛡️ OCR BLOCKED: Insufficient points - showing manual button only')
      // No auto-OCR - user must click manual button for insufficient points
    }
  }, [images, pointsValidated, hasSufficientPoints, lastAnalyzedImageCount, imageAnalysis.isAnalyzing])

  // Function to fetch daily points availability status
  const fetchDailyPointsStatus = async () => {
    try {
      const response = await fetch('/api/user/balance')
      if (response.ok) {
        const data = await response.json()
        setCanClaimDaily(data.data.canClaimDailyPoints || false)
        setDailyStatusLoaded(true)
        console.log('✅ Daily points status loaded:', data.data.canClaimDailyPoints)
      } else {
        console.error('❌ Failed to fetch daily points status')
        setCanClaimDaily(false) // Default to false on error
        setDailyStatusLoaded(true)
      }
    } catch (error) {
      console.error('❌ Network error fetching daily points status:', error)
      setCanClaimDaily(false) // Default to false on error
      setDailyStatusLoaded(true)
    }
  }

  const handleImageSelect = useCallback((zone: keyof UploadImages, file: File) => {
    setImages(prev => ({ ...prev, [zone]: file }))
    // Clear image error when an image is selected
    if (errors.images) {
      setErrors(prev => ({ ...prev, images: undefined }))
    }
  }, [errors.images])

  const handleImageRemove = useCallback((zone: keyof UploadImages) => {
    setImages(prev => ({ ...prev, [zone]: null }))
  }, [])

  // Enhanced OCR and AI Analysis
  const analyzeImagesAutomatically = async () => {
    const imageFiles = Object.values(images).filter(img => img !== null) as File[]
    if (imageFiles.length === 0) return

    setAiAnalysis(prev => ({ ...prev, isAnalyzing: true, progress: 0 }))

    try {
      // Convert images to base64 for analysis
      const imagePromises = imageFiles.map((file, index) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            setAiAnalysis(prev => ({ ...prev, progress: (index + 1) / imageFiles.length * 50 }))
            resolve(e.target?.result as string)
          }
          reader.readAsDataURL(file)
        })
      })

      const imageData = await Promise.all(imagePromises)

      setAiAnalysis(prev => ({ ...prev, progress: 60 }))

      // Enhanced OCR Analysis using optimized NAFDAC service
      const analysisResponse = await fetch('/api/test-ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: imageData,
          enhanced: true // Use our enhanced AI service
        })
      })

      if (!analysisResponse.ok) {
        throw new Error('AI analysis failed')
      }

      const analysisResult: AnalysisResult = await analysisResponse.json()

      setAiAnalysis(prev => ({
        ...prev,
        isAnalyzing: false,
        progress: 100,
        result: analysisResult,
        extractedText: analysisResult.ocrText
      }))

      // Update analyzed image count for auto-retrigger logic
      const currentImageCount = Object.values(images).filter(img => img !== null).length
      setLastAnalyzedImageCount(currentImageCount)

      // Auto-populate form with extracted data
      if (analysisResult.extractedBatchNumbers.length > 0) {
        setFormData(prev => ({
          ...prev,
          userBatchNumber: analysisResult.extractedBatchNumbers[0]
        }))
      }

      if (analysisResult.detectedProducts.length > 0) {
        setFormData(prev => ({
          ...prev,
          productName: analysisResult.detectedProducts[0],
          productDescription: analysisResult.ocrText.join(' ')
        }))
      }

      console.log('🎯 Legacy AI Analysis Complete:', analysisResult)
      console.log('⚡ Analysis took:', analysisResult.processingTime + 'ms')

    } catch (error) {
      console.error('AI Analysis failed:', error)
      setAiAnalysis(prev => ({
        ...prev,
        isAnalyzing: false,
        progress: 0,
        result: null
      }))
    }
  }

  // New Image Analysis using dedicated API
  const analyzeImagesWithNewAPI = async () => {
    const imageFiles = Object.values(images).filter(img => img !== null) as File[]
    if (imageFiles.length === 0) return

    setImageAnalysis(prev => ({ ...prev, isAnalyzing: true, progress: 0 }))

    try {
      // Check if preprocessing is supported
      const preprocessingSupported = ImagePreprocessingService.isSupported()
      console.log(`🖼️ Image preprocessing ${preprocessingSupported ? 'supported' : 'not supported'}`)

      // Step 1: Preprocess images for better OCR accuracy (20% progress)
      setImageAnalysis(prev => ({ ...prev, progress: 10 }))
      const preprocessingResults = preprocessingSupported
        ? await imagePreprocessing.preprocessImages(imageFiles, {
            maxWidth: 1000,
            maxHeight: 1200,
            quality: 0.9,
            enhanceContrast: true,
            sharpenText: true,
            format: 'jpeg'
          })
        : await Promise.all(imageFiles.map(async (file) => ({
            dataUrl: await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onload = (e) => resolve(e.target?.result as string)
              reader.readAsDataURL(file)
            }),
            enhancements: ['original'],
            processingTime: 0,
            originalSize: file.size,
            processedSize: file.size,
            dimensions: { original: { width: 0, height: 0 }, processed: { width: 0, height: 0 } }
          } as PreprocessingResult)))

      console.log(`✅ Preprocessed ${preprocessingResults.length} images:`, preprocessingResults.map(r => ({
        enhancements: r.enhancements.join(', '),
        time: `${r.processingTime}ms`,
        size: `${Math.round(r.processedSize / 1024)}KB`
      })))

      // Step 2: Extract data URLs for API
      setImageAnalysis(prev => ({ ...prev, progress: 60 }))
      const imageData = preprocessingResults.map(result => result.dataUrl)

      setImageAnalysis(prev => ({ ...prev, progress: 70 }))

      // Use new image analysis API
      const analysisResponse = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: imageData,
          analysisType: 'comprehensive'
        })
      })

      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json()
        throw new Error(errorData.message || 'Image analysis failed')
      }

      const analysisResult: ImageAnalysisResponse = await analysisResponse.json()

      const currentImageCount = Object.values(images).filter(img => img !== null).length
      setLastAnalyzedImageCount(currentImageCount) // 🔄 UPDATE: Track analyzed image count

      setImageAnalysis(prev => ({
        ...prev,
        isAnalyzing: false,
        progress: 100,
        result: analysisResult,
        hasAnalyzed: true
      }))

      // Auto-populate form with extracted data - always populate useful data regardless of overall validation
      // Only skip if user has already manually entered data
      if (analysisResult.analysis.productName && !formData.productName) {
        setFormData(prev => ({
          ...prev,
          productName: analysisResult.analysis.productName || ''
        }))
      }

      if (analysisResult.analysis.batchNumbers.length > 0 && !formData.userBatchNumber) {
        setFormData(prev => ({
          ...prev,
          userBatchNumber: analysisResult.analysis.batchNumbers[0]
        }))
      }

      // Add expiry date and manufacturer to description if available
      let enhancedDescription = formData.productDescription
      if (analysisResult.analysis.expiryDate) {
        enhancedDescription += `\nExpiry: ${analysisResult.analysis.expiryDate}`
      }
      if (analysisResult.analysis.manufacturers.length > 0) {
        enhancedDescription += `\nManufacturer: ${analysisResult.analysis.manufacturers.join(', ')}`
      }
      if (enhancedDescription !== formData.productDescription) {
        setFormData(prev => ({
          ...prev,
          productDescription: enhancedDescription.trim()
        }))
      }

      console.log('🎯 New Image Analysis Complete:', analysisResult)
      console.log('📊 Confidence:', analysisResult.analysis.confidence)

    } catch (error) {
      console.error('New Image Analysis failed:', error)
      setImageAnalysis(prev => ({
        ...prev,
        isAnalyzing: false,
        progress: 0,
        result: null,
        hasAnalyzed: false
      }))

      // Fallback to old analysis method
      console.log('🔄 Falling back to legacy analysis method')
      analyzeImagesAutomatically()
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<ProductFormData & { images: string }> = {}

    // Check for manual input
    const hasManualProductName = formData.productName.trim() !== ''
    const hasManualBatchNumber = formData.userBatchNumber.trim() !== ''

    // Check for successful image analysis data
    const hasImageAnalysis = imageAnalysis.result?.validation.isValid || false
    const hasAnalyzedImages = imageAnalysis.hasAnalyzed

    // Check if we have images uploaded
    const hasImages = Object.values(images).some(img => img !== null)

    // Validation logic: Allow submission if we have either:
    // 1. Manual input for both fields, OR
    // 2. Images with successful analysis, OR
    // 3. Manual input for one field + images for the other

    let hasValidProductName = hasManualProductName
    let hasValidBatchNumber = hasManualBatchNumber

    // If we don't have manual input, check if image analysis provided valid data
    if (!hasManualProductName && hasImageAnalysis && imageAnalysis.result?.analysis.productName) {
      hasValidProductName = true
    }

    if (!hasManualBatchNumber && hasImageAnalysis && imageAnalysis.result?.analysis.batchNumbers && imageAnalysis.result.analysis.batchNumbers.length > 0) {
      hasValidBatchNumber = true
    }

    // Require at least one image if we're missing any required data
    if ((!hasValidProductName || !hasValidBatchNumber) && !hasImages) {
      newErrors.images = 'At least one product image is required to extract missing information'
    }

    // If we have images but no analysis yet, suggest running analysis
    if (hasImages && !hasAnalyzedImages && !hasImageAnalysis && (!hasValidProductName || !hasValidBatchNumber)) {
      newErrors.images = 'Please analyze your images first or provide manual input'
    }

    // If analysis failed and we're missing data, require manual input
    if (hasAnalyzedImages && !hasImageAnalysis && (!hasValidProductName || !hasValidBatchNumber)) {
      if (!hasValidProductName) {
        newErrors.productName = 'Please provide product name manually or upload clearer images'
      }
      if (!hasValidBatchNumber) {
        newErrors.userBatchNumber = 'Please provide batch number manually or upload clearer images'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      // Convert images to base64
      const imagePromises = Object.entries(images).map(async ([zone, file]) => {
        if (!file) return { zone, data: null }

        return new Promise<{ zone: string; data: string }>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            resolve({
              zone,
              data: e.target?.result as string || ''
            })
          }
          reader.readAsDataURL(file)
        })
      })

      const imageData = await Promise.all(imagePromises)

      // Use extracted data as fallbacks when manual input is not provided
      const finalProductName = formData.productName.trim() ||
        (imageAnalysis.result?.analysis.productName ? imageAnalysis.result.analysis.productName : '')
      const finalBatchNumber = formData.userBatchNumber.trim() ||
        (imageAnalysis.result?.analysis.batchNumbers && imageAnalysis.result.analysis.batchNumbers.length > 0
          ? imageAnalysis.result.analysis.batchNumbers[0] : '')
      const finalDescription = formData.productDescription.trim()

      const payload = {
        productName: finalProductName,
        productDescription: finalDescription,
        userBatchNumber: finalBatchNumber,
        images: imageData.filter(item => item.data !== null).map(item => item.data)
      }

      console.log('Submitting product check:', payload)

      // TODO: Call MCP service for product verification
      // const response = await fetch('/api/mcp/check-product', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload)
      // })

      // const result = await response.json()

      // Call the real API for product verification
      const response = await fetch('/api/verify-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || errorData.error || 'Verification failed')
      }

      const result = await response.json()

      // Store result in localStorage for demo
      localStorage.setItem('lastScanResult', JSON.stringify(result))

      // Redirect to results page
      router.push(`/result/${result.resultId}`)

    } catch (error) {
      console.error('Submission error:', error)

      // Provide more specific error messages
      let errorMessage = 'Failed to submit. Please try again.'

      if (error instanceof Error) {
        if (error.message.includes('Authentication required')) {
          errorMessage = 'Please sign in to scan products.'
        } else if (error.message.includes('You need at least 1 point for verification')) {
          setIsInsufficientPointsMode(true)
          console.log('✅ Insufficient points detected - showing modal')
          return // Don't set error message - activates insufficient points mode instead
        } else if (error.message.includes('Network')) {
          errorMessage = 'Network error. Please check your connection and try again.'
        } else if (error.message.includes('Internal Server Error')) {
          errorMessage = 'Server error. Please try again later.'
        } else {
          errorMessage = error.message
        }
      }

      // Only set error if insufficient points mode was not triggered
      if (!isInsufficientPointsMode) {
        setErrors({ images: errorMessage })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handler for claiming daily free points
  const handleClaimDailyPoints = async () => {
    setIsClaimingDaily(true)
    try {
      const response = await fetch('/api/daily-points', { method: 'POST' })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          console.log('Successfully claimed', data.pointsAdded, 'points!')
          setIsInsufficientPointsMode(false) // Close modal on success
          // Optionally refresh the page to update point balance
          window.location.reload()
        } else {
          console.error('Failed to claim points:', data.message)
        }
      } else {
        console.error('Error claiming daily points')
      }
    } catch (error) {
      console.error('Network error claiming points:', error)
    } finally {
      setIsClaimingDaily(false)
    }
  }

  // Handler for upgrading plan
  const handleUpgradePlan = () => {
    setIsUpgrading(true)
    // Redirect to pricing page
    window.location.href = '/pricing'
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="mb-6 sm:mb-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-900">Scan Your Product</h1>
        <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">Upload photos from all angles for accurate detection</p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-blue-600">🔍</span>
            <span className="font-medium text-blue-800 text-sm sm:text-base">Professional NAFDAC Database Verification</span>
          </div>
          <p className="text-sm text-blue-700">
            Each scan uses advanced AI to check your product against the official NAFDAC database for counterfeit detection.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Product Information */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            📋 Product Information
          </h2>

          {/* Product Information Fields (Optional when images are provided) */}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Product Name {Object.values(images).some(img => img !== null) ? '(Optional)' : '*'}
              </label>
              <input
                type="text"
                value={formData.productName}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  productName: e.target.value
                }))}
                className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  formData.productName && !formData.productName.trim() ? '' : 'border-gray-300'
                }`}
                placeholder="e.g., Paracetamol 500mg or let AI extract from images"
              />
              {errors.productName && (
                <p className="text-red-500 text-sm mt-1">{errors.productName}</p>
              )}
              {imageAnalysis.result?.analysis.productName && !formData.productName && (
                <p className="text-green-600 text-xs mt-1">💡 AI extracted: {imageAnalysis.result?.analysis.productName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Batch Number {Object.values(images).some(img => img !== null) ? '(Optional)' : '*'}
              </label>
              <input
                type="text"
                value={formData.userBatchNumber}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  userBatchNumber: e.target.value
                }))}
                className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  formData.userBatchNumber && !formData.userBatchNumber.trim() ? '' : 'border-gray-300'
                }`}
                placeholder="e.g., TXXXXXB or let AI extract from images"
              />
              {errors.userBatchNumber && (
                <p className="text-red-500 text-sm mt-1">{errors.userBatchNumber}</p>
              )}
              {imageAnalysis.result?.analysis.batchNumbers && imageAnalysis.result.analysis.batchNumbers.length > 0 && !formData.userBatchNumber && (
                <p className="text-green-600 text-xs mt-1">💡 AI extracted: {imageAnalysis.result?.analysis.batchNumbers[0]}</p>
              )}
            </div>
          </div>

          {/* Optional Field: Description */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Product Description (Optional)
            </label>
            <textarea
              value={formData.productDescription}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                productDescription: e.target.value
              }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32 resize-none"
              placeholder="Describe the product, manufacturing details, expiry date, etc."
              // No longer required
            />
            <p className="text-xs text-gray-500 mt-1">Description provides additional context for better matching</p>
          </div>
        </div>

        {/* Image Upload Zones */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            📸 Product Images
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <UploadZone
                zone="front"
                label="Front View"
                onImageSelect={(file) => handleImageSelect('front', file)}
              />
              <p className="text-xs text-gray-500 mt-2 text-center">Product name should be visible</p>
            </div>

            <div>
              <UploadZone
                zone="back"
                label="Back View"
                onImageSelect={(file) => handleImageSelect('back', file)}
              />
              <p className="text-xs text-gray-500 mt-2 text-center">Batch number should be visible</p>
            </div>
          </div>

          {/* Manual Analysis Button - BLOCKED FOR INSUFFICIENT POINTS */}
          {Object.values(images).some(img => img !== null) && !imageAnalysis.hasAnalyzed && !imageAnalysis.isAnalyzing && pointsValidated && (
            <div className="mb-4">
              <Button
                type="button"
                onClick={hasSufficientPoints ? analyzeImagesWithNewAPI : () => setIsInsufficientPointsMode(true)}
                disabled={!pointsValidated}
                className={`w-full py-3 ${
                  hasSufficientPoints
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {hasSufficientPoints ? '🔍 Analyze Images & Extract Product Info' : '⚠️ Insufficient Points - Click to Upgrade'}
              </Button>
              <p className="text-xs text-gray-500 mt-1 text-center">
                {hasSufficientPoints
                  ? 'Extract product name, batch number, and manufacturer from your uploaded images'
                  : 'You need at least 1 point to analyze images. Upgrade your plan to unlock AI features.'
                }
              </p>
            </div>
          )}

          {/* Loading State While Validating Points */}
          {Object.values(images).some(img => img !== null) && !pointsValidated && (
            <div className="mb-4">
              <div className="w-full bg-gray-200 text-gray-500 py-3 rounded-lg flex items-center justify-center">
                <div className="mr-2 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" style={{width: '16px', height: '16px'}}></div>
                Checking your account status...
              </div>
              <p className="text-xs text-gray-400 mt-1 text-center">
                Validating your points balance before allowing AI processing
              </p>
            </div>
          )}

          {/* Re-analyze Button */}
          {imageAnalysis.result && !imageAnalysis.isAnalyzing && (
            <div className="mb-4">
              <Button
                type="button"
                onClick={analyzeImagesWithNewAPI}
                variant="outline"
                className="w-full py-2 text-sm"
              >
                🔄 Re-analyze Images
              </Button>
            </div>
          )}

          {/* Enhanced Image Analysis Status */}
          {(imageAnalysis.isAnalyzing || imageAnalysis.result || aiAnalysis.isAnalyzing || aiAnalysis.result) && (
            <div className="mb-6 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="text-2xl">🔍</span>
                  Smart Image Analysis
                </h3>
                {(imageAnalysis.isAnalyzing || aiAnalysis.isAnalyzing) && (
                  <div className="text-sm text-blue-600 font-medium">
                    Processing: {Math.round(imageAnalysis.progress || aiAnalysis.progress)}%
                  </div>
                )}
              </div>

              {/* Analysis Progress Bar */}
              {(imageAnalysis.isAnalyzing || aiAnalysis.isAnalyzing) && (
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${imageAnalysis.progress || aiAnalysis.progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>OCR Reading</span>
                    <span>Pattern Matching</span>
                    <span>Data Extraction</span>
                  </div>
                </div>
              )}

              {/* New Enhanced Analysis Results */}
              {imageAnalysis.result && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-800">🎯 Enhanced Analysis Results:</h4>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      imageAnalysis.result.validation.quality === 'excellent' ? 'bg-green-100 text-green-800' :
                      imageAnalysis.result.validation.quality === 'good' ? 'bg-blue-100 text-blue-800' :
                      imageAnalysis.result.validation.quality === 'fair' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {imageAnalysis.result.validation.quality.toUpperCase()} QUALITY
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Extracted Information */}
                    <div className="space-y-3">
                      {imageAnalysis.result.analysis.productName && (
                        <div className="bg-green-50 border border-green-200 rounded p-3">
                          <div className="text-sm font-medium text-green-800 mb-1">📦 Product Name:</div>
                          <div className="text-sm text-green-700 font-medium">
                            {imageAnalysis.result.analysis.productName}
                          </div>
                        </div>
                      )}

                      {imageAnalysis.result.analysis.batchNumbers.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-3">
                          <div className="text-sm font-medium text-blue-800 mb-1">🔢 Batch Numbers:</div>
                          <div className="text-sm text-blue-700">
                            {imageAnalysis.result.analysis.batchNumbers.map((batch, idx) => (
                              <span key={idx} className="inline-block bg-blue-100 px-2 py-1 rounded mr-1">
                                {batch}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {imageAnalysis.result.analysis.expiryDate && (
                        <div className="bg-purple-50 border border-purple-200 rounded p-3">
                          <div className="text-sm font-medium text-purple-800 mb-1">📅 Expiry Date:</div>
                          <div className="text-sm text-purple-700">
                            {imageAnalysis.result.analysis.expiryDate}
                          </div>
                        </div>
                      )}

                      {imageAnalysis.result.analysis.manufacturers.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded p-3">
                          <div className="text-sm font-medium text-indigo-800 mb-1">🏭 Manufacturers:</div>
                          <div className="text-sm text-indigo-700">
                            {imageAnalysis.result.analysis.manufacturers.join(', ')}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Analysis Quality & Confidence */}
                    <div className="space-y-3">
                      <div className="bg-gray-50 border border-gray-200 rounded p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700">Overall Confidence:</span>
                          <span className={`font-bold ${
                            imageAnalysis.result.analysis.confidence >= 0.8 ? 'text-green-600' :
                            imageAnalysis.result.analysis.confidence >= 0.6 ? 'text-blue-600' :
                            imageAnalysis.result.analysis.confidence >= 0.4 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {(() => {
                              // Handle both decimal (0-1) and integer (0-100) confidence formats
                              const conf = imageAnalysis.result.analysis.confidence;
                              const displayConf = conf > 1 ? conf : Math.round(conf * 100);
                              return `${displayConf}%`;
                            })()}
                          </span>
                        </div>
                        {/* Debug: Show raw confidence value */}
                        {process.env.NODE_ENV === 'development' && (
                          <div className="text-xs text-gray-500 mb-1">
                            Raw: {imageAnalysis.result.analysis.confidence} ({imageAnalysis.result.analysis.confidence > 1 ? 'integer' : 'decimal'}) | Display: {(() => {
                              const conf = imageAnalysis.result.analysis.confidence;
                              return conf > 1 ? `${conf}%` : `${Math.round(conf * 100)}%`;
                            })()}
                          </div>
                        )}
                        <div className="relative w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              imageAnalysis.result.analysis.confidence >= 0.8 ? 'bg-green-500' :
                              imageAnalysis.result.analysis.confidence >= 0.6 ? 'bg-blue-500' :
                              imageAnalysis.result.analysis.confidence >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{
                              width: `${(() => {
                                const conf = imageAnalysis.result.analysis.confidence;
                                const displayWidth = conf > 1 ? conf : Math.min(conf * 100, 100);
                                return displayWidth;
                              })()}%`,
                              maxWidth: '100%'
                            }}
                          ></div>
                        </div>
                      </div>


                    </div>
                  </div>

                </div>
              )}

              {/* Legacy Analysis Results (fallback) */}
              {aiAnalysis.result && !imageAnalysis.result && (
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Extracted Information */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-800">📋 Extracted Information:</h4>

                    {aiAnalysis.result.extractedBatchNumbers.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded p-3">
                        <div className="text-sm font-medium text-green-800 mb-1">Batch Numbers Found:</div>
                        <div className="text-sm text-green-700">
                          {aiAnalysis.result.extractedBatchNumbers.map((batch, idx) => (
                            <span key={idx} className="inline-block bg-green-100 px-2 py-1 rounded mr-1">
                              {batch}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiAnalysis.result.extractedManufacturers.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <div className="text-sm font-medium text-blue-800 mb-1">Manufacturers Detected:</div>
                        <div className="text-sm text-blue-700">
                          {aiAnalysis.result.extractedManufacturers.join(', ')}
                        </div>
                      </div>
                    )}

                    {aiAnalysis.result.detectedProducts.length > 0 && (
                      <div className="bg-purple-50 border border-purple-200 rounded p-3">
                        <div className="text-sm font-medium text-purple-800 mb-1">Products Identified:</div>
                        <div className="text-sm text-purple-700">
                          {aiAnalysis.result.detectedProducts.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Analysis Confidence */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-800">🎯 Analysis Quality:</h4>

                    <div className="bg-gray-50 border border-gray-200 rounded p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">OCR Confidence:</span>
                        <span className={`font-bold ${
                          aiAnalysis.result.aiConfidence > 0.8 ? 'text-green-600' :
                          aiAnalysis.result.aiConfidence > 0.6 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {Math.round(aiAnalysis.result.aiConfidence * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            aiAnalysis.result.aiConfidence > 0.8 ? 'bg-green-500' :
                            aiAnalysis.result.aiConfidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(aiAnalysis.result.aiConfidence * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded p-3">
                      <div className="text-sm font-medium text-gray-700 mb-1">Processing Time:</div>
                      <div className="text-lg font-bold text-blue-600">
                        {aiAnalysis.result.processingTime}ms ⚡
                      </div>
                    <div className="text-xs text-gray-500 mt-1">
                        {aiAnalysis.result.processingTime < 1000 ? 'Excellent speed' :
                         aiAnalysis.result.processingTime < 2000 ? 'Good performance' : 'Processing&hellip;'}
                      </div>
                    </div>

                    <div className="bg-orange-50 border border-orange-200 rounded p-3">
                      <div className="text-sm text-orange-800">
                        <strong>Recommendation:</strong>
                      </div>
                      <div className="text-sm text-orange-700 mt-1">
                        {aiAnalysis.result.recommendation || 'Upload more images for better analysis.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {errors.images && (
            <p className="text-red-500 text-center mb-4">{errors.images}</p>
          )}

        </div>

        {/* Submit Button */}
        <div className="flex justify-center">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-4 text-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Analyzing Product...
              </span>
            ) : (
              <>🔍 Scan & Verify Product</>
            )}
          </Button>
        </div>

        {/* Cost Information */}
        <div className="text-center text-gray-600">
          <p>Each scan costs <strong>1 point</strong> from your daily balance</p>
          <p className="text-sm">No points? Purchase more or wait for tomorrow's daily allocation</p>
        </div>
      </form>

      {/* Insufficient Points Mode */}
      {isInsufficientPointsMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full text-center">
            <div className="mb-6">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {dailyStatusLoaded ? (
                  <span className="text-2xl">⚠️</span>
                ) : (
                  <div className="w-6 h-6 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {dailyStatusLoaded ? 'Insufficient Points' : 'Checking Daily Points...'}
              </h3>
              <p className="text-gray-700">
                {dailyStatusLoaded
                  ? 'You need at least 1 point to scan products. Get free points or upgrade your plan!'
                  : 'Please wait while we check your daily points status...'
                }
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              {/* Claim Free Points Button - Smart States */}
              <Button
                onClick={handleClaimDailyPoints}
                disabled={!canClaimDaily || isClaimingDaily}
                className={`px-6 py-3 transition-all duration-200 ${
                  canClaimDaily && !isClaimingDaily
                    ? 'bg-green-600 hover:bg-green-700 text-white hover:scale-105'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-60'
                }`}
              >
                {isClaimingDaily ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Claiming...
                  </span>
                ) : !canClaimDaily ? (
                  <>⏰ Try Again Tomorrow</>
                ) : (
                  <>🎁 Claim Free Points</>
                )}
              </Button>

              {/* Upgrade Plan Button */}
              <Button
                onClick={handleUpgradePlan}
                disabled={isUpgrading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3"
              >
                {isUpgrading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Upgrading...
                  </span>
                ) : (
                  <>⭐ Upgrade Plan</>
                )}
              </Button>
            </div>

            {/* Exit Button */}
            <div className="flex justify-center mt-4">
              <Button
                onClick={() => setIsInsufficientPointsMode(false)}
                variant="ghost"
                className="text-sm text-gray-600"
              >
                Back to Scanning
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
