'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Download,
  Heart,
  Share2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Copy,
  ExternalLink,
  Info,
  ArrowLeft,
  ArrowRight,
  ChevronDown
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
  const [showShareMenu, setShowShareMenu] = useState(false)
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

  const handleShare = async (action?: string) => {
    switch (action) {
      case 'instagram':
        const instagramUrl = `https://www.instagram.com/create/story/?url=${encodeURIComponent(currentUrl)}`
        window.open(instagramUrl, '_blank')
        break
      case 'tiktok':
        const tiktokUrl = `https://www.tiktok.com/upload?url=${encodeURIComponent(currentUrl)}`
        window.open(tiktokUrl, '_blank')
        break
      case 'whatsapp':
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Confira esta imagem ${mediaItem.operationType}! ${currentUrl}`)}`
        window.open(whatsappUrl, '_blank')
        break
      default:
        if (navigator.share) {
          try {
            await navigator.share({
              title: `${mediaItem.operationType} Image`,
              text: `Confira esta imagem ${mediaItem.operationType}`,
              url: currentUrl
            })
          } catch (error) {
            navigator.clipboard.writeText(currentUrl)
            alert('Image URL copied to clipboard!')
          }
        } else {
          navigator.clipboard.writeText(currentUrl)
          alert('Image URL copied to clipboard!')
        }
    }
    setShowShareMenu(false)
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
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <Share2 className="w-4 h-4 mr-1" />
                Share
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>

              {showShareMenu && (
                <div className="absolute bottom-full left-0 mb-2 bg-black bg-opacity-90 border border-gray-600 rounded-lg shadow-lg min-w-48">
                  <div className="py-1">
                    <button
                      onClick={() => handleShare('instagram')}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white hover:bg-opacity-20 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <defs>
                          <linearGradient id="instagram-gradient-comparison" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#833ab4" />
                            <stop offset="50%" stopColor="#fd1d1d" />
                            <stop offset="100%" stopColor="#fcb045" />
                          </linearGradient>
                        </defs>
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="url(#instagram-gradient-comparison)" />
                        <rect x="4" y="4" width="16" height="16" rx="3" ry="3" stroke="white" strokeWidth="2" fill="none" />
                        <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2" fill="none" />
                        <circle cx="17.5" cy="6.5" r="1.5" fill="white" />
                      </svg>
                      <span>Instagram</span>
                    </button>
                    <button
                      onClick={() => handleShare('whatsapp')}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white hover:bg-opacity-20 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#25D366">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.893 3.488"/>
                      </svg>
                      <span>WhatsApp</span>
                    </button>
                    <hr className="border-gray-600 my-1" />
                    <button
                      onClick={() => handleShare()}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white hover:bg-opacity-20 flex items-center space-x-2"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Compartilhar geral</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
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