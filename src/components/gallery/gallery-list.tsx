'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Download,
  Heart,
  Share2,
  Eye,
  MoreHorizontal,
  Clock,
  CheckCircle,
  AlertCircle,
  Check,
  Image,
  Calendar,
  User,
  Edit2,
  ZoomIn,
  Video,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { MediaItem } from '@/types'
import { calculateOperationCost, getCostDescription } from '@/lib/utils/cost-calculator'
import { CompactVideoButton } from '@/components/video/video-button'

interface GalleryListProps {
  mediaItems?: MediaItem[]
  generations?: any[] // Keep for backward compatibility
  bulkSelectMode: boolean
  selectedImages: string[]
  favoriteImages?: string[]
  onImageSelect: (imageUrl: string) => void
  onImageClick: (imageUrl: string) => void
  onToggleFavorite?: (imageUrl: string) => void
  onUpscale?: (imageUrl: string, generation?: any) => void
  userPlan?: string
}

export function GalleryList({
  mediaItems = [],
  generations = [], // Fallback for backward compatibility
  bulkSelectMode,
  selectedImages,
  favoriteImages = [],
  onImageSelect,
  onImageClick,
  onToggleFavorite,
  onUpscale,
  userPlan = 'FREE'
}: GalleryListProps) {
  const router = useRouter()
  // Use mediaItems if provided, otherwise fall back to generations
  const items = mediaItems.length > 0 ? mediaItems : generations
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set())

  const togglePromptExpansion = (itemId: string) => {
    const newExpanded = new Set(expandedPrompts)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedPrompts(newExpanded)
  }
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PROCESSING':
        return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />
      case 'FAILED':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PROCESSING':
        return 'bg-yellow-100 text-yellow-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      default:
        return ''
    }
  }

  const handleImageAction = async (action: string, imageUrl: string, generation: any) => {
    switch (action) {
      case 'download':
        try {
          // Fetch the image as blob to handle CORS and different domains
          const response = await fetch(imageUrl)
          if (!response.ok) throw new Error('Failed to fetch image')

          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)

          // Create download link
          const link = document.createElement('a')
          link.href = url

          // Generate filename
          const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
          const promptSlug = generation.prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')
          const extension = blob.type.includes('video') ? 'mp4' : 'jpg'
          link.download = `vibephoto_${promptSlug}_${timestamp}.${extension}`

          // Trigger download
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)

          // Clean up blob URL
          window.URL.revokeObjectURL(url)
        } catch (error) {
          console.error('Download failed:', error)
          // Fallback to simple download method
          const link = document.createElement('a')
          link.href = imageUrl
          link.download = `vibephoto_${generation.prompt.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}.jpg`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
        break
      case 'share':
        if (navigator.share) {
          navigator.share({
            title: 'AI Generated Photo',
            text: generation.prompt,
            url: imageUrl
          })
        } else {
          navigator.clipboard.writeText(imageUrl)
          alert('Image URL copied to clipboard!')
        }
        break
      case 'favorite':
        onToggleFavorite?.(imageUrl)
        break
      case 'edit':
        router.push(`/editor?image=${encodeURIComponent(imageUrl)}`)
        break
      case 'upscale':
        onUpscale?.(imageUrl, generation)
        break
    }
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        // Handle both MediaItem and legacy generation formats
        const generation = item.generation || item
        const imageUrl = item.url || item.imageUrls?.[0]
        const thumbnailUrl = item.thumbnailUrl || item.thumbnailUrls?.[0] || imageUrl
        const status = item.status || generation.status
        const prompt = generation.prompt || 'No prompt available'
        const itemId = item.id || generation.id
        const isExpanded = expandedPrompts.has(itemId)
        const shouldTruncate = prompt.length > 100

        return (
        <Card key={item.id || generation.id} className="overflow-hidden hover:shadow-md transition-shadow duration-200 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-start space-x-4">
              {/* Thumbnail Preview */}
              <div className="flex-shrink-0">
                {status === 'COMPLETED' && imageUrl ? (
                  <div className="relative group">
                    <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={thumbnailUrl}
                        alt="Generation preview"
                        className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                        onClick={() => onImageClick(imageUrl)}
                      />
                    </div>
                    
                    {generation.imageUrls && generation.imageUrls.length > 1 && (
                      <Badge variant="secondary" className="absolute -bottom-1 -right-1 text-xs">
                        +{generation.imageUrls.length - 1}
                      </Badge>
                    )}
                    
                    {bulkSelectMode && (
                      <button
                        onClick={() => onImageSelect(imageUrl)}
                        className={`absolute top-1 left-1 w-5 h-5 rounded border flex items-center justify-center ${
                          selectedImages.includes(imageUrl)
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'bg-white border-gray-300'
                        }`}
                      >
                        {selectedImages.includes(imageUrl) && (
                          <Check className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                ) : status === 'PROCESSING' ? (
                  <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-8 h-8 text-gray-400 animate-pulse" />
                  </div>
                ) : (
                  <div className="w-32 h-32 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                  </div>
                )}
              </div>

              {/* Generation Info */}
              <div className="flex-1 min-w-0">
                {/* Detalhes no topo - simplificados */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 text-xs text-gray-400 dark:text-gray-500">
                    <span>{formatDate(generation.createdAt)}</span>
                    {generation.imageUrls && generation.imageUrls.length > 1 && (
                      <>
                        <span>•</span>
                        <span>{generation.imageUrls.length} imagens</span>
                      </>
                    )}
                    <span>•</span>
                    <span className="text-gray-400 font-medium">
                      {getCostDescription(
                        generation.prompt?.includes('[EDITED]') ? 'edited' : 'generated',
                        {
                          packageType: generation.style
                        }
                      )}
                    </span>
                  </div>

                  {(status === 'PROCESSING' || status === 'FAILED') && (
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(status)}
                      <Badge variant="secondary" className={getStatusColor(status)}>
                        {status}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Prompt with expansion */}
                <div className="mb-3">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {shouldTruncate && !isExpanded
                      ? prompt.substring(0, 100) + '...'
                      : prompt
                    }
                    {shouldTruncate && (
                      <button
                        onClick={() => togglePromptExpansion(itemId)}
                        className="ml-2 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      >
                        {isExpanded ? (
                          <span className="inline-flex items-center gap-1">
                            menos <ChevronUp className="w-3 h-3" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            mais <ChevronDown className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                    )}
                  </h3>
                </div>

                {/* Badges - removidos para visual mais limpo */}

                {/* Actions */}
                {status === 'COMPLETED' && imageUrl && (
                  <div className="flex items-center flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                      onClick={() => onImageClick(imageUrl)}
                      title="Visualizar todas as imagens"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                      onClick={() => handleImageAction('edit', imageUrl, generation)}
                      title="Editar imagem"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>

                    {onUpscale && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                        onClick={() => handleImageAction('upscale', imageUrl, generation)}
                        title="Fazer upscale"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                    )}

                    <CompactVideoButton
                      imageUrl={imageUrl}
                      generation={generation}
                      userPlan={userPlan}
                      className="h-7 w-7 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                    />

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                      onClick={() => handleImageAction('download', imageUrl, generation)}
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-7 w-7 p-0 transition-colors duration-200 ${
                        favoriteImages.includes(imageUrl)
                          ? 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => handleImageAction('favorite', imageUrl, generation)}
                      title="Favoritar"
                    >
                      <Heart className={`w-4 h-4 ${favoriteImages.includes(imageUrl) ? 'fill-current' : ''}`} />
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                      onClick={() => handleImageAction('share', imageUrl, generation)}
                      title="Compartilhar"
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {status === 'PROCESSING' && (
                  <div className="flex items-center text-yellow-600 dark:text-yellow-400">
                    <Clock className="w-4 h-4 mr-2 animate-pulse" />
                    <span className="text-xs">Generating... (~30 seconds remaining)</span>
                  </div>
                )}

                {status === 'FAILED' && (
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center text-red-600 dark:text-red-400">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      <span className="text-xs">Generation failed</span>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 px-3 text-xs dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700">
                      Retry
                    </Button>
                  </div>
                )}
              </div>

              {/* Image Grid */}
              {status === 'COMPLETED' && generation.imageUrls && generation.imageUrls.length > 1 && (
                <div className="flex-shrink-0 hidden md:block">
                  <div className="grid grid-cols-2 gap-1 w-20">
                    {generation.imageUrls.slice(1, 5).map((imageUrl: string, index: number) => (
                      <div
                        key={`${generation.id}-thumb-${index + 1}`}
                        className="aspect-square bg-gray-100 rounded overflow-hidden cursor-pointer"
                        onClick={() => onImageClick(imageUrl)}
                      >
                        <img
                          src={generation.thumbnailUrls?.[index + 1] || imageUrl}
                          alt={`Image ${index + 2}`}
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        )
      })}
    </div>
  )
}