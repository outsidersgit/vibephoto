'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Download,
  Heart,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  Info,
  ArrowLeft,
  ArrowRight
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { MediaItem } from '@/types'

interface ComparisonModalProps {
  mediaItem: MediaItem
  onClose: () => void
  showSlider?: boolean // true for upscaled, false for edited
}

export function ComparisonModal({ mediaItem, onClose, showSlider = false }: ComparisonModalProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [showInfo, setShowInfo] = useState(false)
  const [sliderPosition, setSliderPosition] = useState(50) // For upscaled comparison
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'i':
        case 'I':
          setShowInfo(!showInfo)
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [showInfo, onClose])

  // Fallback handling for missing originalUrl
  const originalUrl = mediaItem.originalUrl
  const currentUrl = mediaItem.url

  useEffect(() => {
    if (!originalUrl) {
      console.warn('ComparisonModal: originalUrl is missing for media item:', mediaItem.id)
      // Log to system for monitoring
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'warn',
          message: 'Missing originalUrl in comparison modal',
          metadata: { mediaItemId: mediaItem.id, operationType: mediaItem.operationType }
        })
      }).catch(() => {}) // Silent fail for logging
    }
  }, [originalUrl, mediaItem.id, mediaItem.operationType])

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = currentUrl
    link.download = `${mediaItem.operationType}-${mediaItem.id}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current || !showSlider) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSliderPosition(percentage)
  }

  const handleMouseDown = () => {
    if (showSlider) setIsDragging(true)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove as any)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove as any)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging])

  if (!originalUrl) {
    // Fallback: show single image if no original
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="text-center text-white">
          <div className="mb-4">
            <img
              src={currentUrl}
              alt={`${mediaItem.operationType} image`}
              className="max-w-full max-h-[80vh] object-contain"
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            />
          </div>
          <p className="text-yellow-400">⚠️ Original image not available for comparison</p>
          <p className="text-sm text-gray-400 mt-2">Showing result only</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-50 p-4 z-10">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center space-x-4">
            <Badge variant="secondary" className="bg-blue-600">
              {mediaItem.operationType === 'edited' ? 'Edited' : 'Upscaled'}
            </Badge>
            {showSlider && (
              <span className="text-sm text-gray-300">
                Drag to compare • {Math.round(sliderPosition)}%
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInfo(!showInfo)}
              className="text-white hover:bg-white hover:bg-opacity-20"
            >
              <Info className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Comparison Container */}
      <div className="relative w-full h-full flex items-center justify-center p-16">
        {showSlider ? (
          // Slider comparison for upscaled
          <div
            ref={containerRef}
            className="relative max-w-4xl max-h-full overflow-hidden cursor-ew-resize"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
          >
            {/* Original Image (background) */}
            <img
              src={originalUrl}
              alt="Original"
              className="w-full h-auto object-contain"
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            />

            {/* Upscaled Image (clipped) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
              <img
                src={currentUrl}
                alt="Upscaled"
                className="w-full h-auto object-contain"
                style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
              />
            </div>

            {/* Slider Line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg cursor-ew-resize"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                <ArrowLeft className="w-3 h-3 text-gray-600 mr-0.5" />
                <ArrowRight className="w-3 h-3 text-gray-600 ml-0.5" />
              </div>
            </div>

            {/* Labels */}
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm">
              Original
            </div>
            <div className="absolute bottom-4 right-4 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm">
              Upscaled
            </div>
          </div>
        ) : (
          // Side by side comparison for edited
          <div className="flex gap-8 max-w-6xl max-h-full">
            <div className="flex-1 text-center">
              <div className="mb-2">
                <Badge variant="outline" className="text-white border-white">
                  Original
                </Badge>
              </div>
              <img
                src={originalUrl}
                alt="Original"
                className="w-full h-auto max-h-[70vh] object-contain"
                style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
              />
            </div>

            <div className="flex-1 text-center">
              <div className="mb-2">
                <Badge variant="secondary" className="bg-green-600">
                  Edited
                </Badge>
              </div>
              <img
                src={currentUrl}
                alt="Edited"
                className="w-full h-auto max-h-[70vh] object-contain"
                style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4 z-10">
        <div className="flex items-center justify-between text-white">
          {/* Zoom Controls */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              className="text-white hover:bg-white hover:bg-opacity-20"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm min-w-16 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(Math.min(3, zoom + 0.25))}
              className="text-white hover:bg-white hover:bg-opacity-20"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRotation((rotation + 90) % 360)}
              className="text-white hover:bg-white hover:bg-opacity-20"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="text-white hover:bg-white hover:bg-opacity-20"
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => console.log('Toggle favorite')}
              className="text-white hover:bg-white hover:bg-opacity-20"
            >
              <Heart className="w-4 h-4 mr-1" />
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(currentUrl, '_blank')}
              className="text-white hover:bg-white hover:bg-opacity-20"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Open
            </Button>
          </div>
        </div>
      </div>

      {/* Info Panel */}
      {showInfo && mediaItem.generation && (
        <div className="absolute top-16 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg max-w-sm z-10">
          <h3 className="font-semibold mb-3">
            {mediaItem.operationType === 'edited' ? 'Edit' : 'Upscale'} Details
          </h3>

          <div className="space-y-3 text-sm">
            <div>
              <div className="text-gray-300">Type:</div>
              <div className="capitalize">{mediaItem.operationType}</div>
            </div>

            {mediaItem.metadata && (
              <>
                {mediaItem.metadata.width && mediaItem.metadata.height && (
                  <div>
                    <div className="text-gray-300">Dimensions:</div>
                    <div>{mediaItem.metadata.width} × {mediaItem.metadata.height}</div>
                  </div>
                )}

                {mediaItem.metadata.sizeBytes && (
                  <div>
                    <div className="text-gray-300">Size:</div>
                    <div>{(mediaItem.metadata.sizeBytes / 1024 / 1024).toFixed(1)} MB</div>
                  </div>
                )}
              </>
            )}

            <div>
              <div className="text-gray-300">Status:</div>
              <div className="capitalize">{mediaItem.status.toLowerCase()}</div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-600 text-xs text-gray-400">
            Press 'I' to toggle this panel, ESC to close
            {showSlider && <div className="mt-1">Drag to compare images</div>}
          </div>
        </div>
      )}
    </div>
  )
}