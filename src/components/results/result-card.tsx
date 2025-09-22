"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle, Share2, Download, ExternalLink } from "lucide-react"

interface CheckResult {
  id: string
  isCounterfeit: boolean
  summary: string
  sourceUrl: string
  source: string
  batchNumber?: string
  issueDate?: string
  alertType: string
  images?: string[]
}

interface ResultCardProps {
  result: CheckResult
  productName: string
  remainingPoints: number
}

export function ResultCard({ result, productName, remainingPoints }: ResultCardProps) {
  const isGenuine = !result.isCounterfeit

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Product Verification: ${productName}`,
          text: result.summary,
          url: window.location.href
        })
      } catch (error) {
        // Fallback to clipboard
        navigator.clipboard.writeText(window.location.href)
      }
    }
  }

  const handleDownload = () => {
    // Create a simple report
    const report = {
      productName,
      result: isGenuine ? 'GENUINE' : 'COUNTERFEIT',
      summary: result.summary,
      source: result.source,
      sourceUrl: result.sourceUrl,
      batchNumber: result.batchNumber,
      alertType: result.alertType,
      verifiedAt: new Date().toISOString(),
      resultId: result.id
    }

    const jsonData = JSON.stringify(report, null, 2)
    const blob = new Blob([jsonData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `product-verification-${result.id}.json`
    a.click()

    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Product Verification Results</h1>
        <p className="text-gray-600">Result ID: <code className="px-2 py-1 bg-gray-100 rounded">{result.id}</code></p>
      </div>

      {/* Main Result Card */}
      <Card className={`mb-6 border-2 ${isGenuine
        ? 'border-green-200 bg-green-50/30'
        : 'border-red-200 bg-red-50/30'
      }`}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isGenuine ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-red-600" />
              )}
              <span className="text-2xl">
                {isGenuine ? '✅ Genuine Product' : '⚠️ Counterfeit Alert'}
              </span>
            </div>
            <Badge variant={isGenuine ? 'default' : 'destructive'} className="text-sm px-3 py-1">
              {result.alertType}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left: Content */}
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Product: {productName}</h3>

                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                    <span className="font-medium">Status:</span>
                    <Badge variant={isGenuine ? 'default' : 'destructive'} className="w-fit">
                      {isGenuine ? 'GENUINE' : 'COUNTERFEIT'}
                    </Badge>
                  </div>

                  {result.batchNumber && (
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                      <span className="font-medium">Batch Number:</span>
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        {result.batchNumber}
                      </span>
                    </div>
                  )}

                  {result.issueDate && (
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                      <span className="font-medium">Issue Date:</span>
                      <span>{new Date(result.issueDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div>
                <h4 className="font-semibold mb-2">Analysis Summary:</h4>
                <div className={`p-4 rounded-lg border-l-4 ${
                  isGenuine
                    ? 'bg-green-50 border-l-green-400'
                    : 'bg-red-50 border-l-red-400'
                }`}>
                  <p className={`text-sm leading-relaxed ${
                    isGenuine ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {result.summary}
                  </p>
                </div>
              </div>

              {/* Source Information */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Source:</span>
                <span className="font-medium">{result.source}</span>
                <ExternalLink className="w-4 h-4" />
              </div>
            </div>

            {/* Right: Image */}
            <div className="flex justify-center lg:justify-end">
              {result.images && result.images[0] ? (
                <div className="w-full max-w-sm">
                  <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                    <img
                      src={result.images[0]}
                      alt={`${productName} verification image`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-xs text-center text-gray-500 mt-2">
                    * Demo image - actual product imagery not available
                  </p>
                </div>
              ) : (
                <div className="w-full max-w-sm h-48 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center border-2 border-dashed border-purple-300">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📷</div>
                    <p className="text-gray-600 text-sm">Product image would appear here</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 justify-center">
            <Button onClick={handleShare} variant="outline" className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              Share Result
            </Button>

            <Button onClick={handleDownload} variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download Report
            </Button>

            <Button variant="outline" className="flex items-center gap-2" onClick={() => window.open("https://nafdac.gov.ng/category/recalls-and-alerts/", "_blank", "noopener,noreferrer")}>
              <ExternalLink className="w-4 h-4" />
              NAFDAC Database
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Points Information */}
      <div className="text-center">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm">
              <span>Points Used:</span>
              <span className="font-semibold text-red-600">-1</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Remaining Balance:</span>
              <span className="font-semibold text-green-600">{remainingPoints} points</span>
            </div>

            <div className="mt-4 pt-4 border-t">
              <div className="flex gap-2 justify-center">
                <Button size="sm" onClick={() => window.location.href = '/dashboard'}>
                  Scan Another Product
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.location.href = '/points'}>
                  Manage Points
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Important Notice */}
      {!isGenuine && (
        <Card className="mt-6 bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-red-800 mb-2">Important Notice:</h4>
                <p className="text-red-700 text-sm leading-relaxed">
                  Reported counterfeit products should not be consumed or distributed.
                  Please consult with healthcare professionals or authorities for proper disposal.
                  Report any suspected counterfeit medicines to NAFDAC immediately.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
