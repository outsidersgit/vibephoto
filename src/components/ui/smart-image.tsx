'use client'

import { useState, useEffect, useRef } from 'react'
import { RefreshCw, AlertTriangle, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SmartImageProps {
  src: string
  fallbackSrc?: string
  generationId?: string
  alt: string
  className?: string
  onClick?: () => void
  onError?: () => void
  onLoad?: () => void
}

type ImageState = 'loading' | 'loaded' | 'error' | 'retrying' | 'expired'

export function SmartImage({ 
  src, 
  fallbackSrc, 
  generationId,
  alt, 
  className = '', 
  onClick, 
  onError,
  onLoad 
}: SmartImageProps) {
  const [imageState, setImageState] = useState<ImageState>('loading')
  const [currentSrc, setCurrentSrc] = useState(src)
  const [retryCount, setRetryCount] = useState(0)
  const imgRef = useRef<HTMLImageElement>(null)
  const maxRetries = 3

  useEffect(() => {
    setCurrentSrc(src)
    setImageState('loading')
    setRetryCount(0)
  }, [src])

  const handleImageLoad = () => {
    setImageState('loaded')
    onLoad?.()
  }

  const handleImageError = async () => {
    console.warn(`Image failed to load: ${currentSrc}`)
    
    // If we have a fallback source and haven't tried it yet
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      console.log(`Trying fallback source: ${fallbackSrc}`)
      setCurrentSrc(fallbackSrc)
      setImageState('loading')
      return
    }
    
    // If this is a Replicate URL that might have expired, try adding cache-busting
    if (currentSrc.includes('replicate.delivery') && !currentSrc.includes('?v=')) {
      const cacheBustUrl = `${currentSrc}?v=${Date.now()}`
      console.log(`Trying cache-busted URL: ${cacheBustUrl}`)
      setCurrentSrc(cacheBustUrl)
      setImageState('loading')
      return
    }

    // If we haven't exhausted retries, try to refresh the image
    if (retryCount < maxRetries) {
      setImageState('retrying')
      console.log(`Retrying image load (${retryCount + 1}/${maxRetries}): ${src}`)
      
      // Try to refresh the generation data if we have an ID
      if (generationId) {
        try {
          const response = await fetch(`/api/generations/${generationId}`)
          if (response.ok) {
            const generation = await response.json()
            if (generation.imageUrls && generation.imageUrls.length > 0) {
              // Find the index of the current image and use the refreshed URL
              const currentIndex = generation.imageUrls.findIndex((url: string) => 
                url.includes(src.split('/').pop()?.split('?')[0] || '')
              )
              if (currentIndex >= 0) {
                setCurrentSrc(generation.imageUrls[currentIndex])
                setRetryCount(retryCount + 1)
                setImageState('loading')
                return
              }
            }
          }
        } catch (error) {
          console.error('Failed to refresh generation data:', error)
        }
      }

      // If refresh didn't work, just retry with a cache-busting parameter
      setTimeout(() => {
        setCurrentSrc(`${src}?t=${Date.now()}`)
        setRetryCount(retryCount + 1)
        setImageState('loading')
      }, 1000 * (retryCount + 1)) // Exponential backoff
    } else {
      setImageState('expired')
      onError?.()
    }
  }

  const handleRetry = () => {
    setRetryCount(0)
    setCurrentSrc(`${src}?t=${Date.now()}`)
    setImageState('loading')
  }

  const renderImageContent = () => {
    switch (imageState) {
      case 'loading':
      case 'retrying':
        return (
          <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
            <div className="text-center">
              <RefreshCw className={`w-6 h-6 mx-auto mb-2 text-gray-400 ${
                imageState === 'loading' || imageState === 'retrying' ? 'animate-spin' : ''
              }`} />
              <p className="text-xs text-gray-500">
                {imageState === 'retrying' ? `Tentando novamente... (${retryCount}/${maxRetries})` : 'Carregando...'}
              </p>
            </div>
          </div>
        )
      
      case 'expired':
        return (
          <div className="flex items-center justify-center h-full bg-red-50 rounded-lg border border-red-200">
            <div className="text-center p-4">
              <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-400" />
              <p className="text-xs text-red-600 mb-2">Imagem expirada</p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                className="text-xs h-6 px-2"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Tentar novamente
              </Button>
            </div>
          </div>
        )
      
      case 'loaded':
        return (
          <img
            ref={imgRef}
            src={currentSrc}
            alt={alt}
            className={`w-full h-full object-cover transition-transform group-hover:scale-105 ${className}`}
            onClick={onClick}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )
      
      default:
        return null
    }
  }

  return (
    <div className="relative w-full h-full">
      {renderImageContent()}
      
      {/* Loading overlay */}
      {(imageState === 'loading' || imageState === 'retrying') && imageState !== 'expired' && (
        <div className="absolute inset-0 bg-gray-100 rounded-lg animate-pulse" />
      )}
      
      {/* Retry indicator */}
      {imageState === 'retrying' && (
        <div className="absolute top-2 right-2">
          <div className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
            {retryCount}/{maxRetries}
          </div>
        </div>
      )}
    </div>
  )
}