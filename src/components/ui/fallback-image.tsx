'use client'

import { useState } from 'react'
import { Image as ImageIcon, AlertTriangle } from 'lucide-react'

interface FallbackImageProps {
  src: string
  fallbackSrc?: string
  alt: string
  className?: string
  onClick?: () => void
}

export function FallbackImage({ src, fallbackSrc, alt, className = '', onClick }: FallbackImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const handleError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc)
      setHasError(false)
    } else {
      setHasError(true)
    }
    setIsLoading(false)
  }

  const handleLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  if (hasError) {
    return (
      <div 
        className={`bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center p-4 text-gray-500 ${className}`}
        onClick={onClick}
      >
        <AlertTriangle className="w-6 h-6 mb-1" />
        <span className="text-xs text-center">Imagem não disponível</span>
        <span className="text-xs text-center opacity-75">URL expirada</span>
      </div>
    )
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className={`absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center ${className}`}>
          <div className="flex flex-col items-center">
            <ImageIcon className="w-6 h-6 text-gray-400 animate-pulse mb-1" />
            <span className="text-xs text-gray-500">Carregando...</span>
          </div>
        </div>
      )}
      <img
        src={currentSrc}
        alt={alt}
        className={`w-full h-full object-cover rounded-lg transition-opacity duration-200 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } ${className}`}
        onClick={onClick}
        onError={handleError}
        onLoad={handleLoad}
        style={{ aspectRatio: '1' }}
      />
    </div>
  )
}