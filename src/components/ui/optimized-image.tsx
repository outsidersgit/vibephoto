'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { toCloudFrontUrl } from '@/lib/utils/cloudfront-url'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  fill?: boolean
  priority?: boolean
  quality?: number
  sizes?: string
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  onLoad?: () => void
  onClick?: () => void
  thumbnailUrl?: string
}

/**
 * Componente de imagem otimizado usando next/image
 *
 * Benefícios:
 * - Lazy loading automático
 * - Responsive images (srcset)
 * - WebP/AVIF automático
 * - Blur placeholder
 * - CDN otimizado da Vercel
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  fill = false,
  priority = false,
  quality = 85,
  sizes,
  objectFit = 'cover',
  onLoad,
  onClick,
  thumbnailUrl
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  // Converter URLs S3 antigas para CloudFront
  const optimizedSrc = toCloudFrontUrl(src) || src // Fallback para URL original se conversão falhar
  const optimizedThumbnail = thumbnailUrl ? toCloudFrontUrl(thumbnailUrl) : undefined

  // Se não houver src válido, mostrar erro
  if (!optimizedSrc) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gray-100 text-gray-400',
          className
        )}
        style={{ width, height }}
      >
        <svg
          className="w-12 h-12"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    )
  }

  // Fallback para imagens com erro
  const handleError = () => {
    setError(true)
    setIsLoading(false)
  }

  const handleLoad = () => {
    setIsLoading(false)
    onLoad?.()
  }

  // Se houver erro, mostrar fallback
  if (error) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gray-100 text-gray-400',
          className
        )}
        style={{ width, height }}
      >
        <svg
          className="w-12 h-12"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    )
  }

  const imageProps = {
    src: optimizedSrc,
    alt,
    quality,
    priority,
    onLoad: handleLoad,
    onError: handleError,
    className: cn(
      'transition-opacity duration-300',
      isLoading ? 'opacity-0' : 'opacity-100',
      onClick && 'cursor-pointer',
      className
    ),
    onClick,
    // Use thumbnail as blur placeholder if available
    ...(optimizedThumbnail && !priority && {
      placeholder: 'blur' as const,
      blurDataURL: optimizedThumbnail
    })
  }

  if (fill) {
    // Otimização mobile: sizes mais agressivos para reduzir LCP e Speed Index
    const defaultSizes = sizes || 
      // Mobile first: tamanhos menores para economizar banda (reduz 118 KiB)
      '(max-width: 640px) 50vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw'
    
    return (
      <Image
        {...imageProps}
        fill
        style={{ objectFit }}
        sizes={defaultSizes}
      />
    )
  }

  return (
    <Image
      {...imageProps}
      width={width || 800}
      height={height || 600}
      style={{ objectFit }}
      sizes={sizes}
    />
  )
}
