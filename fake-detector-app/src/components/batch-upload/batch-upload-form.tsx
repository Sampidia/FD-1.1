"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { UploadZone } from "../product-upload/upload-zone"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Play, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { imagePreprocessing, PreprocessingResult, ImagePreprocessingService } from "@/services/image-preprocessing"
import Link from "next/link"
import PriceTable from "@/components/price-table"

interface UserPlan {
  planType: 'basic' | 'standard' | 'business'
  maxBatchSlots: number
}

interface BatchSlot {
  id: string
  images: {
    front: File | null
    back: File | null
  }
  productName: string
  batchNumber: string
  isAnalyzed: boolean
  analysisResult?: ImageAnalysisResponse
  isProcessing: boolean
  isCompleted: boolean
  error?: string
  showOCRAnalysis?: boolean
  isOCRAnalyzing?: boolean
  lastOCRAnalysisTrigger?: number // Timestamp to prevent duplicate triggers
  ocrAnalysisId?: string // Unique ID for each OCR analysis session
}

interface BatchUploadFormProps {
  userPlan: UserPlan
  userBalance: number
}

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

export function BatchUploadForm({ userPlan, userBalance }: BatchUploadFormProps) {
  const router = useRouter()
  const [batchSlots, setBatchSlots] = useState<BatchSlot[]>([])
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(-1)
  const [userHasModifiedSlots, setUserHasModifiedSlots] = useState(false)

  // Handle basic user upgrade interface
  const renderUpgradeInterface = () => (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Upgrade to Access Batch Product Scan
        </h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Your Basic Plan includes single product scanning. Upgrade to Standard or Business plan to unlock batch processing capabilities with multiple products and advanced AI features.
        </p>
      </div>

        {/* Upgrade Plans */}
        <PriceTable
          showUpgradeButtons={true}
          currentPlan="basic"
          excludePlans={['basic']}
        />

      {/* Benefits Section */}
      <div className="mt-8 bg-blue-50 rounded-xl p-6 text-left">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 What You'll Get with Batch Processing</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">✨ Multiple Products</h4>
            <p className="text-sm text-gray-700 mb-4">
              Scan up to 3 products per batch with Standard plan, or up to 9+ with Business plan.
            </p>

            <h4 className="font-medium text-gray-900 mb-2">⚡ Faster Processing</h4>
            <p className="text-sm text-gray-700">
              Advanced AI processing with Claude (Standard) or GPT-4 (Business) for superior accuracy.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">🔄 Batch Efficiency</h4>
            <p className="text-sm text-gray-700 mb-4">
              Process multiple products simultaneously and save time on large-scale verification needs.
            </p>

            <h4 className="font-medium text-gray-900 mb-2">📊 Detailed Analytics</h4>
            <p className="text-sm text-gray-700">
              Comprehensive reports and analytics for all scanned products in your batch.
            </p>
          </div>
        </div>
      </div>

      {/* Single Scan Redirect */}
      <div className="mt-8 text-center bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Already have a single product to scan?</h3>
        <p className="text-gray-600 mb-4">Your Basic Plan includes daily free scans for single products.</p>
        <Link href="/scan">
          <Button className="bg-blue-600 hover:bg-blue-700">
            Go to Single Scan
          </Button>
        </Link>
      </div>
    </div>
  )

  // ✅ FIX: Only reinitialize on plan TYPE change, preserve user deletions
  useEffect(() => {
    setBatchSlots(prev => {
      const requiredSlots = userPlan.planType === 'business' ? 5 :
                           userPlan.planType === 'standard' ? 3 : 1

      // If this is the first load (empty slots), initialize to plan default
      if (prev.length === 0) {
        console.log(`🆕 Initializing to ${requiredSlots} slots for ${userPlan.planType} plan`)
        const newSlots: BatchSlot[] = []
        for (let i = 0; i < requiredSlots; i++) {
          newSlots.push({
            id: `slot-${i + 1}`,
            images: { front: null, back: null },
            productName: '',
            batchNumber: '',
            isAnalyzed: false,
            isProcessing: false,
            isCompleted: false,
            showOCRAnalysis: false,
            isOCRAnalyzing: false,
            lastOCRAnalysisTrigger: undefined,
            ocrAnalysisId: undefined
          })
        }
        setUserHasModifiedSlots(false) // Reset modification flag
        return newSlots
      }

      // If plan was upgraded, add additional slots (preserving existing)
      if (prev.length < requiredSlots && !userHasModifiedSlots) {
        console.log(`⬆️ Plan upgraded: Adding ${requiredSlots - prev.length} slots (preserving ${prev.length} existing)`)
        const newSlots: BatchSlot[] = []
        for (let i = prev.length; i < requiredSlots; i++) {
          newSlots.push({
            id: `slot-${i + 1}`,
            images: { front: null, back: null },
            productName: '',
            batchNumber: '',
            isAnalyzed: false,
            isProcessing: false,
            isCompleted: false,
            showOCRAnalysis: false,
            isOCRAnalyzing: false,
            lastOCRAnalysisTrigger: undefined,
            ocrAnalysisId: undefined
          })
        }
        return [...prev, ...newSlots]
      }

      // If plan was downgraded and user hasn't modified slots, reduce to new limit
      if (prev.length > requiredSlots && !userHasModifiedSlots) {
        console.log(`⬇️ Plan downgraded: Reducing to ${requiredSlots} slots`)
        return prev.slice(0, requiredSlots)
      }

      // ✅ KEY FIX: If user has modified slots (deleted some), preserve their changes!
      // Do not reinitialize or add any slots back automatically
      if (userHasModifiedSlots || prev.length !== requiredSlots) {
        console.log(`👷 User modified slots: Preserving ${prev.length} slots (ignoring ${requiredSlots} default)`)
        return prev
      }

      // No changes needed
      return prev
    })
  }, [userPlan.planType, userHasModifiedSlots]) // ✅ Only depend on plan type, not entire userPlan object

  const handleImageSelect = useCallback((slotId: string, zone: 'front' | 'back', file: File) => {
    console.log(`📸 [${new Date().toISOString()}] ⭐⭐⭐⭐⭐ IMAGE SELECTED: slot ${slotId}, zone ${zone}`)
    console.log(`📸 File size: ${file.size}, type: ${file.type}`)

    setBatchSlots(prev => {
      console.log(`📸 PREV SLOTS COUNT: ${prev.length}`)

      // Find the target slot and get its current state
      const currentSlot = prev.find(s => s.id === slotId)
      console.log(`📸 TARGET SLOT FOUND: ${!!currentSlot}, slotID: ${slotId}`)
      if (!currentSlot) {
        console.log(`❌ ❌ ❌ SLOT ${slotId} NOT FOUND!`)
        return prev
      }

      const now = Date.now()

      console.log(`🔍 Current slot ${slotId} state: isAnalyzed=${currentSlot.isAnalyzed}, isOCRAnalyzing=${currentSlot.isOCRAnalyzing}, hasResult=${!!currentSlot.analysisResult}`)

      // Check if OCR analysis is already running or was recently triggered
      if (currentSlot.isOCRAnalyzing ||
          (currentSlot.lastOCRAnalysisTrigger && (now - currentSlot.lastOCRAnalysisTrigger) < 2000)) {
        console.log(`⚠️ OCR analysis already running for slot ${slotId}, just updating image`)
        // If OCR is already running or recently triggered, just update the image
        return prev.map(slot =>
          slot.id === slotId
            ? { ...slot, images: { ...slot.images, [zone]: file } }
            : slot
        )
      }

      const updatedSlots = prev.map(slot =>
        slot.id === slotId
          ? {
              ...slot,
              images: { ...slot.images, [zone]: file },
              // CRITICAL: Preserve manual input data and only update analysis-related state
              isAnalyzed: slot.isAnalyzed,
              analysisResult: slot.analysisResult,
              showOCRAnalysis: slot.showOCRAnalysis,
              lastOCRAnalysisTrigger: now,
              // Never touch productName or batchNumber here - they're manual input
              productName: slot.productName,
              batchNumber: slot.batchNumber
            }
          : slot
      )

      console.log(`✅ SLOTS UPDATED SUCCESSFULLY ${slotId}`)

      // Get the updated slot and trigger OCR analysis
      const updatedSlot = updatedSlots.find(s => s.id === slotId)

      if (updatedSlot) {
        console.log(`📊 UPDATED SLOT ${slotId} FOUND: isAnalyzed=${updatedSlot.isAnalyzed}, hasResult=${!!updatedSlot.analysisResult}`)

        // DETAILED IMAGE CHECK - This is CRITICAL
        const images = updatedSlot.images
        console.log(`🖼️ SLOT ${slotId} IMAGES CHECK:`)
        console.log(`   Front: ${images.front ? 'PRESENT' : 'NULL'}`)
        console.log(`   Back: ${images.back ? 'PRESENT' : 'NULL'}`)

        const hasImages = Object.values(updatedSlot.images).some(img => img !== null)

        console.log(`🤔 OCR TRIGGER CHECK for slot ${slotId}:`)
        console.log(`   hasImages: ${hasImages} (${Object.values(updatedSlot.images).filter(img => img === null).length} null images)`)

        if (hasImages) {
          console.log(`🎯 TRIGGERING OCR ANALYSIS for slot ${slotId}`)
          // Use setTimeout to ensure state update completes before triggering OCR
          setTimeout(() => {
            console.log(`🚀 EXECUTING OCR ANALYSIS for slot ${slotId} - TIMER FIRED`)
            try {
              analyzeSlotOCR(slotId)
            } catch (error) {
              console.error(`🔴 ERROR in analyzeSlotOCR for slot ${slotId}:`, error)
            }
          }, 150)
        } else {
          console.log(`⚠️ No images uploaded, skipping OCR analysis for slot ${slotId}`)
        }
      } else {
        console.log(`❌ UPDATED SLOT ${slotId} NOT FOUND - OCR WILL NOT TRIGGER`)
      }

      return updatedSlots
    })
  }, [])

  const handleImageRemove = useCallback((slotId: string, zone: 'front' | 'back') => {
    console.log(`🗑️ [${new Date().toISOString()}] Removing image from slot ${slotId}, zone ${zone} - clearing OCR results`)
    setBatchSlots((prev) =>
      prev.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              images: { ...slot.images, [zone]: null },
              isAnalyzed: false,
              analysisResult: undefined,
              showOCRAnalysis: false,
              isOCRAnalyzing: false,
            }
          : slot
      )
    )
  }, [])

  const addBatchSlot = () => {
    if (batchSlots.length >= userPlan.maxBatchSlots) return

    const newSlotId = `slot-${batchSlots.length + 1}`
    const newSlot: BatchSlot = {
      id: newSlotId,
      images: { front: null, back: null },
      productName: '',
      batchNumber: '',
      isAnalyzed: false,
      isProcessing: false,
      isCompleted: false,
      showOCRAnalysis: false,
      isOCRAnalyzing: false,
      lastOCRAnalysisTrigger: undefined,
      ocrAnalysisId: undefined
    }

    setBatchSlots(prev => [...prev, newSlot])
  }

  const removeBatchSlot = (slotId: string) => {
    setBatchSlots(prev => prev.filter(slot => slot.id !== slotId))
    setUserHasModifiedSlots(true) // Mark that user has intentionally modified slots
  }

  const toggleSlotOCRAnalysis = (slotId: string) => {
    console.log(`🔄 Toggling OCR analysis visibility for slot ${slotId}`)
    setBatchSlots(prev => prev.map(slot =>
      slot.id === slotId
        ? { ...slot, showOCRAnalysis: !slot.showOCRAnalysis }
        : slot
    ))
  }

  // OCR Analysis function (FIXED: State-aware to avoid stale closures)
  const analyzeSlotOCR = async (slotId: string) => {
    console.log(`🤖 [${new Date().toISOString()}] Starting OCR analysis for batch slot: ${slotId}`)

    // ✅ FIX: Use setState callback instead of stale batchSlots reference
    let slotFound = false
    let imageFiles: File[] = []
    let shouldAnalyze = false

    setBatchSlots(currentSlots => {
      const currentSlot = currentSlots.find(s => s.id === slotId)
      if (!currentSlot) {
        console.log(`⚠️ [${new Date().toISOString()}] Slot ${slotId} not found, skipping OCR analysis`)
        return currentSlots
      }

      slotFound = true
      imageFiles = Object.values(currentSlot.images).filter(img => img !== null) as File[]

      if (imageFiles.length === 0) {
        console.log(`⚠️ [${new Date().toISOString()}] No images found for slot ${slotId}, skipping OCR analysis`)
        return currentSlots
      }

      console.log(`📸 Slot ${slotId} has ${imageFiles.length} images: front=${!!currentSlot.images.front}, back=${!!currentSlot.images.back}`)
      console.log(`🔄 Slot ${slotId} state: isAnalyzed=${currentSlot.isAnalyzed}, isOCRAnalyzing=${currentSlot.isOCRAnalyzing}, hasResult=${!!currentSlot.analysisResult}, showOCRAnalysis=${currentSlot.showOCRAnalysis}`)

      // Double-check if analysis is already running or completed (defensive programming)
      if (currentSlot.isOCRAnalyzing) {
        console.log(`⚠️ [${new Date().toISOString()}] OCR analysis already running for slot ${slotId}, skipping`)
        return currentSlots
      }

      // If we already have valid results and the slot is analyzed, don't re-analyze
      if (currentSlot.isAnalyzed && currentSlot.analysisResult && currentSlot.analysisResult.validation.isValid) {
        console.log(`✅ [${new Date().toISOString()}] Slot ${slotId} already has valid OCR results, skipping re-analysis`)
        return currentSlots.map(s =>
          s.id === slotId ? { ...s, showOCRAnalysis: true } : s
        )
      }

      shouldAnalyze = true

      // Set analyzing state
      return currentSlots.map(s =>
        s.id === slotId ? {
          ...s,
          isOCRAnalyzing: true,
          showOCRAnalysis: true,
          // Only clear results if we don't have valid existing results
          analysisResult: (s.analysisResult && s.analysisResult.validation.isValid) ? s.analysisResult : undefined
        } : s
      )
    })

    // If no valid slot found or no analysis needed, exit early
    if (!slotFound || !shouldAnalyze || imageFiles.length === 0) {
      if (!slotFound) {
        console.log(`❌ Slot ${slotId} not found in state-managed lookup`)
      }
      return
    }

    console.log(`🤖 [${new Date().toISOString()}] Proceeding with OCR analysis for batch slot: ${slotId} with ${imageFiles.length} images`)

    try {
      // Preprocess images for better OCR accuracy
      const preprocessingSupported = ImagePreprocessingService.isSupported()
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

      const imageData = preprocessingResults.map(result => result.dataUrl)

      console.log(`🌐 [${new Date().toISOString()}] Calling /api/analyze-image with ${imageData.length} images for slot ${slotId}`)
      console.log(`📊 [${new Date().toISOString()}] Request payload: images count=${imageData.length}, analysisType=comprehensive`)
      console.log(`🖼️ [${new Date().toISOString()}] First image preview: ${imageData[0]?.substring(0, 100)}...`)

      // Use image analysis API for OCR
      const analysisResponse = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: imageData,
          analysisType: 'comprehensive'
        })
      })

      console.log(`📡 [${new Date().toISOString()}] OCR API response status: ${analysisResponse.status} for slot ${slotId}`)

      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text()
        console.error(`❌ [${new Date().toISOString()}] OCR API error for slot ${slotId}:`, errorText)
        throw new Error(`OCR analysis failed: ${errorText}`)
      }

      console.log(`✅ [${new Date().toISOString()}] OCR API call successful for slot ${slotId}`)

      const analysisResult: ImageAnalysisResponse = await analysisResponse.json()

      // DEBUG: Log received analysis result structure
      console.log(`📥 [${new Date().toISOString()}] RECEIVED ANALYSIS RESULT for slot ${slotId}:`)
      console.log(`   Success: ${analysisResult.success}`)
      console.log(`   Confidence: ${analysisResult.analysis.confidence}`)
      console.log(`   Product Name: "${analysisResult.analysis.productName || 'EMPTY'}"`)
      console.log(`   Batch Count: ${analysisResult.analysis.batchNumbers?.length || 0}`)
      console.log(`   Batch First: "${analysisResult.analysis.batchNumbers?.[0] || 'EMPTY'}"`)
      console.log(`   Manufacturers: ${analysisResult.analysis.manufacturers?.join(', ') || 'EMPTY'}`)
      console.log(`   Extracted Text Length: ${analysisResult.analysis.extractedText?.length || 0}`)

      // ✅ FIX: Update results using state updater pattern
      setBatchSlots(prev => {
        console.log(`💾 [${new Date().toISOString()}] UPDATING SLOT STATE for slot ${slotId}`)

        return prev.map(s => {
          if (s.id !== slotId) return s

          // CRITICAL FIX: Calculate what will be set
          const newProductName = s.productName || (analysisResult.analysis.productName || '')
          const newBatchNumber = s.batchNumber || (analysisResult.analysis.batchNumbers?.[0] || '')

          console.log(`🔄 [${new Date().toISOString()}] SLOT ${slotId} FIELD UPDATES:`)
          console.log(`   Product: "${s.productName}" → "${newProductName}"`)
          console.log(`   Batch: "${s.batchNumber}" → "${newBatchNumber}"`)

          return {
            ...s,
            // CRITICAL FIX: Only fill EMPTY fields with OCR data, NEVER overwrite manual input
            productName: newProductName,
            batchNumber: newBatchNumber,
            isAnalyzed: true,
            analysisResult,
            isOCRAnalyzing: false,
            showOCRAnalysis: true // Ensure results are visible
          }
        })
      })

      console.log(`✅ [${new Date().toISOString()}] OCR Analysis Complete for slot ${slotId}`)
      console.log(`   📦 Final Product: ${analysisResult.analysis.productName || 'Not detected'}`)
      console.log(`   🔢 Final Batch: ${analysisResult.analysis.batchNumbers?.[0] || 'Not detected'}`)
      console.log(`   📊 Confidence: ${analysisResult.analysis.confidence}%`)
      console.log(`   📄 Extracted Text: "${analysisResult.analysis.extractedText?.substring(0, 100) || 'N/A'}..."`)

    } catch (error) {
      console.error('OCR Analysis failed for slot:', slotId, error)

      // ✅ FIX: Handle errors using state updater pattern
      setBatchSlots(prev => {
        const isCriticalError = error instanceof Error &&
          (error.message.includes('Invalid image') ||
           error.message.includes('Unsupported format') ||
           error.message.includes('File too large'))

        if (isCriticalError) {
          console.log(`🚨 Critical OCR error for slot ${slotId}, clearing results`)
          return prev.map(s =>
            s.id === slotId ? {
              ...s,
              isOCRAnalyzing: false,
              analysisResult: undefined,
              isAnalyzed: false
            } : s
          )
        } else {
          console.log(`⚠️ Non-critical OCR error for slot ${slotId}, keeping existing results`)
          // For non-critical errors (network, API timeouts, etc.), just stop analyzing
          return prev.map(s =>
            s.id === slotId ? {
              ...s,
              isOCRAnalyzing: false,
              // Keep existing analysisResult and isAnalyzed state
            } : s
          )
        }
      })
    }
  }

  const analyzeSlotImages = async (slot: BatchSlot): Promise<ImageAnalysisResponse | null> => {
    const imageFiles = Object.values(slot.images).filter(img => img !== null) as File[]
    if (imageFiles.length === 0) return null

    try {
      // Preprocess images for better OCR accuracy
      const preprocessingSupported = ImagePreprocessingService.isSupported()
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

      const imageData = preprocessingResults.map(result => result.dataUrl)

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
        throw new Error('Image analysis failed')
      }

      return await analysisResponse.json()
    } catch (error) {
      console.error('Analysis failed for slot:', slot.id, error)
      return null
    }
  }

  const processBatch = async () => {
    console.log(`🚀 Starting batch processing for ${batchSlots.length} slots`)

    // Check if user has enough balance (1 point per scan)
    const requiredPoints = batchSlots.length
    if (userBalance < requiredPoints) {
      alert(`Insufficient points. You need ${requiredPoints} points but only have ${userBalance}.`)
      return
    }

    setIsBatchProcessing(true)
    setBatchProgress(0)
    setCurrentProcessingIndex(0)

    const batchResults = []

    for (let i = 0; i < batchSlots.length; i++) {
      const slot = batchSlots[i]
      setCurrentProcessingIndex(i)

      // Update slot to processing state (preserve all existing analysis state)
      setBatchSlots(prev => prev.map(s =>
        s.id === slot.id ? {
          ...s,
          isProcessing: true,
          // Preserve all analysis-related state during batch processing
          isAnalyzed: s.isAnalyzed,
          analysisResult: s.analysisResult,
          showOCRAnalysis: s.showOCRAnalysis
        } : s
      ))

      // ✅ FIX: Always use slot's persistent OCR results (avoid stale variable)
      if (Object.values(slot.images).some(img => img !== null) && slot.analysisResult?.validation.isValid) {
        console.log(`✅ Using existing OCR results for slot ${slot.id} during batch processing`)
        console.log(`🤖 Slot ${slot.id} OCR data:`, {
          productName: slot.analysisResult?.analysis.productName,
          batchNumbers: slot.analysisResult?.analysis.batchNumbers,
          confidence: slot.analysisResult?.analysis.confidence
        })
      } else {
        console.log(`ℹ️ No valid existing OCR results for slot ${slot.id}, will use manual input only`)
      }

      // Convert images to base64
      const imagePromises = Object.entries(slot.images).map(async ([zone, file]) => {
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

      // ✅ FIX: Use slot's persistent OCR data, but don't use fallbacks for empty slots (prevents false positive alerts)
      const finalProductName = slot.productName ||
        slot.analysisResult?.analysis.productName ||
        ''  // Empty instead of 'Product Scan' to prevent false positive database searches

      const finalBatchNumber = slot.batchNumber ||
        slot.analysisResult?.analysis.batchNumbers[0] ||
        ''

      console.log(`🔍 SLOT ${slot.id} FINAL DATA:`, {
        manualProductName: slot.productName,
        manualBatchNumber: slot.batchNumber,
        ocrProductName: slot.analysisResult?.analysis.productName,
        ocrBatchNumbers: slot.analysisResult?.analysis.batchNumbers,
        finalProductName: finalProductName,
        finalBatchNumber: finalBatchNumber,
        hasImages: imageData.filter(item => item.data !== null).length
      })

      // ✅ FIX: Skip validation for empty slots (no image/no manual input)
      // Empty slots should not trigger API calls in the first place
      if (finalProductName.length > 0 && finalProductName.length < 2) {
        throw new Error(`Product name must be at least 2 characters. Got: "${finalProductName}"`)
      }

      const payload = {
        productName: finalProductName,
        productDescription: '',
        userBatchNumber: finalBatchNumber,
        images: imageData.filter(item => item.data !== null).map(item => item.data)
      }

      try {
        // Submit individual scan
        const response = await fetch('/api/verify-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Verification failed')
        }

        const result = await response.json()
        // ✅ INCLUDE ORIGINAL INPUT DATA in batch results for display
        batchResults.push({
          slotId: slot.id,
          result,
          input: {
            productName: finalProductName,
            userBatchNumber: finalBatchNumber,
            ocrConfidence: slot.analysisResult?.analysis.confidence || 0
          },
          success: true
        })

        // Update slot to completed state (preserve OCR results)
        setBatchSlots(prev => prev.map(s =>
          s.id === slot.id ? {
            ...s,
            isProcessing: false,
            isCompleted: true,
            error: undefined,
            // Preserve all analysis-related state
            isAnalyzed: s.isAnalyzed,
            analysisResult: s.analysisResult,
            showOCRAnalysis: s.showOCRAnalysis
          } : s
        ))

      } catch (error) {
        console.error('Batch scan failed for slot:', slot.id, error)
        batchResults.push({
          slotId: slot.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        })

        // Update slot to error state (preserve OCR results even on error)
        setBatchSlots(prev => prev.map(s =>
          s.id === slot.id ? {
            ...s,
            isProcessing: false,
            isCompleted: true,
            error: error instanceof Error ? error.message : 'Unknown error',
            // Preserve all analysis-related state even on error
            isAnalyzed: s.isAnalyzed,
            analysisResult: s.analysisResult,
            showOCRAnalysis: s.showOCRAnalysis
          } : s
        ))
      }

      // Update progress
      setBatchProgress(((i + 1) / batchSlots.length) * 100)
    }

    setIsBatchProcessing(false)

    // Create batch result summary
    const batchId = `batch-${Date.now()}`
    const batchSummary = {
      batchId,
      totalScans: batchSlots.length,
      successfulScans: batchResults.filter(r => r.success).length,
      failedScans: batchResults.filter(r => !r.success).length,
      results: batchResults,
      createdAt: new Date().toISOString()
    }

    // Store batch result in localStorage (for now)
    localStorage.setItem(`batch-result-${batchId}`, JSON.stringify(batchSummary))

    // Redirect to batch results page
    router.push(`/batch-result/${batchId}`)
  }

  const filledSlots = batchSlots.filter(slot =>
    Object.values(slot.images).some(img => img !== null) ||
    slot.productName.trim() !== '' ||
    slot.batchNumber.trim() !== ''
  ).length

  const canProcessBatch = filledSlots > 0 && !isBatchProcessing

  // Check if user is basic and render upgrade interface
  if (userPlan.planType === 'basic') {
    return renderUpgradeInterface()
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Batch Header */}
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold mb-2">Configure Your Batch</h2>
        <div className="flex justify-center items-center gap-4 mb-4">
          <Badge variant="outline">
            {filledSlots} of {batchSlots.length} slots filled
          </Badge>
          <Badge variant="outline">
            Cost: {batchSlots.length} points
          </Badge>
        </div>

        {/* Add Slot Button for Business Plan */}
        {userPlan.planType === 'business' && batchSlots.length < userPlan.maxBatchSlots && (
          <Button
            onClick={addBatchSlot}
            variant="outline"
            className="mb-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Product Slot ({batchSlots.length}/9)
          </Button>
        )}
      </div>


      {/* Batch Slots Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {batchSlots.map((slot, index) => (
          <Card key={slot.id} className={`transition-all ${
            slot.isProcessing ? 'ring-2 ring-blue-500' :
            slot.isCompleted && !slot.error ? 'ring-2 ring-green-500' :
            slot.isCompleted && slot.error ? 'ring-2 ring-red-500' : ''
          }`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Product {index + 1}</CardTitle>
                {/* ✅ ALLOW DELETION FROM SLOT 3 ONWARDS (keep minimum 2 slots) */}
                {index >= 2 && batchSlots.length > 2 && (
                  <Button
                    onClick={() => removeBatchSlot(slot.id)}
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Status Badge */}
              <div className="flex justify-center">
                {slot.isProcessing ? (
                  <Badge className="bg-blue-100 text-blue-800">
                    <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                    Processing...
                  </Badge>
                ) : slot.isCompleted && !slot.error ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Completed
                  </Badge>
                ) : slot.isCompleted && slot.error ? (
                  <Badge className="bg-red-100 text-red-800">
                    <XCircle className="w-3 h-3 mr-1" />
                    Failed
                  </Badge>
                ) : (
                  <Badge variant="outline">Ready</Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Image Upload Zones */}
              <div className="grid grid-cols-2 gap-3">
        <div>
                  <UploadZone
                    zone="front"
                    label="Front View"
                    onImageSelect={(file) => {
                      console.log(`🔄 BATCH FRONT IMAGE SELECTED for slot ${slot.id}`)
                      handleImageSelect(slot.id, 'front', file)
                    }}
                  />
                  {slot.images.front && (
                    <button
                      onClick={() => handleImageRemove(slot.id, 'front')}
                      className="text-xs text-red-500 hover:text-red-700 mt-1"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div>
                  <UploadZone
                    zone="back"
                    label="Back View"
                    onImageSelect={(file) => {
                      console.log(`🔄 BATCH BACK IMAGE SELECTED for slot ${slot.id}`)
                      handleImageSelect(slot.id, 'back', file)
                    }}
                  />
                  {slot.images.back && (
                    <button
                      onClick={() => handleImageRemove(slot.id, 'back')}
                      className="text-xs text-red-500 hover:text-red-700 mt-1"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Manual Input Fields */}
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Product Name (optional)"
                    value={slot.productName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      console.log(`📝 Manual update: Product name for slot ${slot.id}: "${e.target.value}"`)
                      setBatchSlots(prev => prev.map(s =>
                        s.id === slot.id ? {
                          ...s,
                          productName: e.target.value,
                          // Preserve all analysis state when updating text fields
                          isAnalyzed: s.isAnalyzed,
                          analysisResult: s.analysisResult,
                          showOCRAnalysis: s.showOCRAnalysis
                        } : s
                      ))
                    }}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      slot.productName && slot.analysisResult?.analysis.productName === slot.productName
                        ? 'border-green-300 bg-green-50' : // OCR data being used
                      slot.productName && slot.analysisResult?.analysis.productName && slot.analysisResult.analysis.productName !== slot.productName
                        ? 'border-orange-300 bg-orange-50' : // Manual override
                      'border-gray-300' // Manual input
                    }`}
                  />
                  {slot.productName && slot.analysisResult?.analysis?.productName && (
                    <div className="absolute right-2 top-2">
                      {slot.analysisResult.analysis.productName === slot.productName ? (
                        <span className="text-xs text-green-600 font-medium">✓ OCR</span>
                      ) : (
                        <span className="text-xs text-orange-600 font-medium">✏️ Manual</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Batch Number (optional)"
                    value={slot.batchNumber}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      console.log(`🔢 Manual update: Batch number for slot ${slot.id}: "${e.target.value}"`)
                      setBatchSlots(prev => prev.map(s =>
                        s.id === slot.id ? {
                          ...s,
                          batchNumber: e.target.value,
                          // Preserve all analysis state when updating text fields
                          isAnalyzed: s.isAnalyzed,
                          analysisResult: s.analysisResult,
                          showOCRAnalysis: s.showOCRAnalysis
                        } : s
                      ))
                    }}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      slot.batchNumber && slot.analysisResult?.analysis?.batchNumbers?.includes(slot.batchNumber)
                        ? 'border-green-300 bg-green-50' : // OCR data being used
                      slot.batchNumber && slot.analysisResult?.analysis?.batchNumbers?.length && slot.analysisResult.analysis.batchNumbers.length > 0 && !slot.analysisResult.analysis.batchNumbers.includes(slot.batchNumber)
                        ? 'border-orange-300 bg-orange-50' : // Manual override
                      'border-gray-300' // Manual input
                    }`}
                  />
                  {slot.batchNumber && slot.analysisResult?.analysis?.batchNumbers && slot.analysisResult.analysis.batchNumbers.length > 0 && (
                    <div className="absolute right-2 top-2">
                      {slot.analysisResult.analysis.batchNumbers.includes(slot.batchNumber) ? (
                        <span className="text-xs text-green-600 font-medium">✓ OCR</span>
                      ) : (
                        <span className="text-xs text-orange-600 font-medium">✏️ Manual</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* OCR Analysis for this slot */}
              {slot.analysisResult && slot.showOCRAnalysis && (() => {
                console.log(`👁️ [${new Date().toISOString()}] Rendering OCR analysis for slot ${slot.id}: showOCRAnalysis=${slot.showOCRAnalysis}, hasResult=${!!slot.analysisResult}`)
                const result = slot.analysisResult!
                return (
                <Card className="mt-4 border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-medium text-purple-800 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-7.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L7 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd"/>
                        </svg>
                        AI OCR Analysis
                      </h5>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        result.validation.quality === 'excellent' ? 'bg-green-100 text-green-800' :
                        result.validation.quality === 'good' ? 'bg-blue-100 text-blue-800' :
                        result.validation.quality === 'fair' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {result.validation.quality.toUpperCase()} QUALITY
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3 mb-3">
                      <div className="space-y-2">
                        {slot.analysisResult.analysis.productName && (
                          <div className="bg-green-50 border border-green-200 rounded p-2">
                            <div className="text-xs font-medium text-green-800 mb-1">📦 Product Name:</div>
                            <div className="text-xs text-green-700 font-medium">
                              {slot.analysisResult.analysis.productName}
                            </div>
                          </div>
                        )}

                        {slot.analysisResult?.analysis?.batchNumbers && slot.analysisResult?.analysis?.batchNumbers.length > 0 && (
                          <div className="bg-blue-50 border border-blue-200 rounded p-2">
                            <div className="text-xs font-medium text-blue-800 mb-1">🔢 Batch Numbers:</div>
                            <div className="text-xs text-blue-700">
                              {slot.analysisResult.analysis.batchNumbers.map((batch: string, idx: number) => (
                                <span key={idx} className="inline-block bg-blue-100 px-1.5 py-0.5 rounded mr-1 mb-1">
                                  {batch}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="bg-gray-50 border border-gray-200 rounded p-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-gray-700">Confidence:</span>
                            <span className={`font-bold text-xs ${(() => {
                              const conf = slot.analysisResult!.analysis.confidence;
                              const normalizedConf = conf > 1 ? conf : Math.round(conf * 100);
                              return normalizedConf >= 80 ? 'text-green-600' : normalizedConf >= 60 ? 'text-yellow-600' : 'text-red-600';
                            })()}`}>
                              {(() => {
                                const conf = slot.analysisResult!.analysis.confidence;
                                return conf > 1 ? `${conf}%` : `${Math.round(conf * 100)}%`;
                              })()}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${(() => {
                                const conf = slot.analysisResult!.analysis.confidence;
                                const normalizedConf = conf > 1 ? conf : Math.round(conf * 100);
                                return normalizedConf >= 80 ? 'bg-green-500' : normalizedConf >= 60 ? 'bg-yellow-500' : 'bg-red-500';
                              })()}`}
                              style={{
                                width: `${(() => {
                                  const conf = slot.analysisResult!.analysis.confidence;
                                  return conf > 1 ? conf : Math.min(conf * 100, 100);
                                })()}%`,
                                maxWidth: '100%'
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-center">
                      <Button
                        onClick={() => toggleSlotOCRAnalysis(slot.id)}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        Hide Analysis
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                )
              })()}

              {/* OCR Analysis Toggle Button */}
              {slot.analysisResult && !slot.showOCRAnalysis && !slot.isOCRAnalyzing && (
                <div className="mt-3 text-center">
                  <Button
                    onClick={() => toggleSlotOCRAnalysis(slot.id)}
                    variant="outline"
                    size="sm"
                    className="text-xs bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                  >
                    🔍 View OCR Analysis
                  </Button>
                </div>
              )}

              {/* OCR Processing Indicator */}
              {slot.isOCRAnalyzing && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-blue-700">Analyzing images...</span>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {slot.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                  <p className="text-red-700 text-xs">{slot.error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Batch Processing Controls */}
      <div className="text-center">
        <Button
          onClick={processBatch}
          disabled={!canProcessBatch || isBatchProcessing}
          size="lg"
          className="px-8 py-4 text-lg"
        >
          {isBatchProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Processing Batch... ({Math.round(batchProgress)}%)
            </>
          ) : (
            <>
              <Play className="w-5 h-5 mr-2" />
              Process Batch ({batchSlots.length} products)
            </>
          )}
        </Button>

        {!canProcessBatch && !isBatchProcessing && (
          <p className="text-gray-500 text-sm mt-2">
            Add at least one product to process the batch
          </p>
        )}

        {userBalance < batchSlots.length && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4 max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2 text-yellow-800">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Insufficient points: Need {batchSlots.length}, have {userBalance}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
