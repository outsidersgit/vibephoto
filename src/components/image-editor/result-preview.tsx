'use client'

import { useState } from 'react'
import { Download, Eye, EyeOff, RotateCcw, Share2 } from 'lucide-react'
import { ImageEditResponse } from '@/lib/ai/image-editor'

interface ResultPreviewProps {
  result: ImageEditResponse | null
  originalImage?: string
  loading?: boolean
  onDownload?: () => void
  onShare?: () => void
  onReset?: () => void
  onSave?: (success: boolean) => void
  className?: string
}

export function ResultPreview({ 
  result, 
  originalImage,
  loading = false,
  onDownload,
  onShare,
  onReset,
  onSave,
  className = ''
}: ResultPreviewProps) {
  const [showComparison, setShowComparison] = useState(true)
  const [imageLoading, setImageLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const downloadImage = async () => {
    if (!result?.resultImage) return

    try {
      // Check if it's a URL or base64 data
      const isUrl = result.resultImage.startsWith('http')
      
      if (isUrl) {
        // Handle URL case - fetch the image
        const response = await fetch(result.resultImage)
        const blob = await response.blob()
        
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `edited_${result.metadata?.operation || 'image'}_${Date.now()}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } else {
        // Handle base64 case
        const base64Data = result.resultImage.includes(',') 
          ? result.resultImage.split(',')[1] 
          : result.resultImage
          
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: 'image/png' })
        
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `edited_${result.metadata?.operation || 'image'}_${Date.now()}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }

      onDownload?.()
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const saveImage = async () => {
    if (!result?.resultImage || !onSave) return

    setSaving(true)
    try {
      console.log('💾 Starting image save...', {
        hasResultImage: !!result.resultImage,
        operation: result.metadata?.operation || 'edit',
        prompt: result.metadata?.prompt || 'Edited image',
        hasOriginalImage: !!originalImage
      })

      const requestBody = {
        imageUrl: result.resultImage.startsWith('http') ? result.resultImage : `data:image/png;base64,${result.resultImage}`,
        operation: result.metadata?.operation || 'edit',
        prompt: result.metadata?.prompt || 'Edited image',
        originalImageUrl: originalImage
      }

      console.log('📤 Request payload prepared')

      const response = await fetch('/api/image-editor/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log('📥 Response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ HTTP error:', response.status, errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      console.log('📋 Response data:', data)

      if (data.success) {
        onSave(true)
        console.log('✅ Image saved successfully to gallery!')
      } else {
        throw new Error(data.error || 'Unknown error occurred')
      }
    } catch (error) {
      console.error('❌ Save image error:', error)
      onSave(false)
      
      // Show more specific error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Erro ao salvar imagem: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-blue-600"></div>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">Processing image...</h3>
            <p className="text-sm text-gray-500 mt-1">
              This may take a few moments. Please wait.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className={`bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center ${className}`}>
        <div className="text-gray-400">
          <Eye className="w-12 h-12 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Preview Area</h3>
          <p className="text-sm text-gray-500 mt-1">
            Upload an image and enter a prompt to see the result here
          </p>
        </div>
      </div>
    )
  }

  if (result.status === 'failed') {
    return (
      <div className={`bg-red-50 rounded-lg border border-red-200 p-6 ${className}`}>
        <div className="text-center">
          <div className="text-red-400 mb-4">
            <EyeOff className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-red-900">Processing Failed</h3>
          <p className="text-sm text-red-700 mt-1">
            {result.error || 'An error occurred while processing the image'}
          </p>
          {onReset && (
            <button
              onClick={onReset}
              className="mt-4 inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Try Again
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Result</h3>
            <p className="text-sm text-gray-500">
              {result.metadata?.operation} • {result.metadata?.processedAt && 
                new Date(result.metadata.processedAt).toLocaleTimeString()}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Comparison Toggle */}
            {originalImage && (
              <button
                onClick={() => setShowComparison(!showComparison)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {showComparison ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Hide Original
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Show Original
                  </>
                )}
              </button>
            )}
            
            {/* Download Button */}
            <button
              onClick={downloadImage}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Image Display */}
      <div className="p-4">
        {showComparison && originalImage ? (
          // Before/After Comparison
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Original</h4>
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={originalImage}
                  alt="Original"
                  className="w-full h-full object-cover"
                  onLoad={() => setImageLoading(false)}
                  onLoadStart={() => setImageLoading(true)}
                />
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Edited</h4>
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                {imageLoading && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600"></div>
                  </div>
                )}
                <img
                  src={result.resultImage.startsWith('http') ? result.resultImage : `data:image/png;base64,${result.resultImage}`}
                  alt="Edited result"
                  className="w-full h-full object-cover"
                  onLoad={() => setImageLoading(false)}
                  onLoadStart={() => setImageLoading(true)}
                />
              </div>
            </div>
          </div>
        ) : (
          // Single Result View
          <div>
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden max-w-md mx-auto">
              {imageLoading && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600"></div>
                </div>
              )}
              <img
                src={result.resultImage.startsWith('http') ? result.resultImage : `data:image/png;base64,${result.resultImage}`}
                alt="Edited result"
                className="w-full h-full object-cover"
                onLoad={() => setImageLoading(false)}
                onLoadStart={() => setImageLoading(true)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Metadata */}
      {result.metadata?.prompt && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Prompt Used</h4>
          <p className="text-sm text-gray-600 italic">
            "{result.metadata.prompt}"
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <div className="flex justify-center space-x-3">
          {onSave && (
            <button
              onClick={saveImage}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar na Galeria'}
            </button>
          )}
          
          {onShare && (
            <button
              onClick={onShare}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </button>
          )}
          
          {onReset && (
            <button
              onClick={onReset}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Edit Again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}