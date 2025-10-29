'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
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
  ZoomIn,
  Edit,
  Video,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Info
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { calculateOperationCost, getCostDescription } from '@/lib/utils/cost-calculator'
import { CompactVideoButton } from '@/components/video/video-button'
import { InstagramIcon, TikTokIcon, WhatsAppIcon, TelegramIcon, GmailIcon } from '@/components/ui/social-icons'
import { sharePhoto, SharePlatform } from '@/lib/utils/social-share'
import { OptimizedImage } from '@/components/ui/optimized-image'

// Lazy load modals pesados (Fase 2 - Otimização de Performance)
const ComparisonModal = dynamic(() => import('./comparison-modal').then(mod => ({ default: mod.ComparisonModal })), {
  loading: () => <div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>,
  ssr: false
})

const ImageModal = dynamic(() => import('./image-modal').then(mod => ({ default: mod.ImageModal })), {
  loading: () => <div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>,
  ssr: false
})

const VideoPlayerModal = dynamic(() => import('./video-player-modal').then(mod => ({ default: mod.VideoPlayerModal })), {
  loading: () => <div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>,
  ssr: false
})

interface GalleryGridProps {
  generations: any[]
  bulkSelectMode: boolean
  selectedImages: string[]
  onImageSelect: (imageUrl: string) => void
  onImageClick: (imageUrl: string) => void
  onUpscale?: (imageUrl: string, generation: any) => void
  userPlan?: string
  favoriteImages?: string[]
  onToggleFavorite?: (imageUrl: string) => void
}

export function GalleryGrid({
  generations,
  bulkSelectMode,
  selectedImages,
  onImageSelect,
  onImageClick,
  onUpscale,
  userPlan,
  favoriteImages = [],
  onToggleFavorite
}: GalleryGridProps) {
  const router = useRouter()
  const [hoveredImage, setHoveredImage] = useState<string | null>(null)
  const [shareDropdown, setShareDropdown] = useState<string | null>(null)
  const [shareSubmenu, setShareSubmenu] = useState<string | null>(null)
  const [expandedDescription, setExpandedDescription] = useState<string | null>(null)
  const [currentVariations, setCurrentVariations] = useState<Record<string, number>>({})
  const [currentModal, setCurrentModal] = useState<{
    type: 'image' | 'comparison' | 'video' | null
    generation: any | null
    imageUrl?: string
    showSlider?: boolean
  }>({ type: null, generation: null })

  // Close share dropdown and submenu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShareDropdown(null)
      setShareSubmenu(null)
    }

    if (shareDropdown || shareSubmenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [shareDropdown, shareSubmenu])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'PROCESSING':
        return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />
      case 'FAILED':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'PROCESSING':
        return 'bg-yellow-100 text-yellow-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Helper function to detect image operation type
  const getOperationType = (generation: any) => {
    if (generation.videoUrl) return 'video'
    if (generation.isUpscaled || generation.prompt?.includes('[UPSCALED]')) return 'upscaled'
    if (generation.isEdited || generation.originalImageUrl) return 'edited'
    return 'generated'
  }

  // Helper function to create MediaItem for modal
  const createMediaItem = (generation: any, imageUrl: string) => {
    const operationType = getOperationType(generation)
    return {
      id: generation.id,
      url: imageUrl,
      originalUrl: generation.originalImageUrl,
      thumbnailUrl: generation.thumbnailUrls?.[0] || imageUrl,
      operationType,
      status: generation.status,
      generation,
      metadata: {
        width: generation.width,
        height: generation.height
      }
    }
  }

  // Enhanced click handler for different media types
  const handleMediaClick = (imageUrl: string, generation: any) => {
    if (bulkSelectMode) {
      onImageSelect(imageUrl)
      return
    }

    const operationType = getOperationType(generation)

    switch (operationType) {
      case 'video':
        setCurrentModal({
          type: 'video',
          generation,
          imageUrl
        })
        break
      case 'edited':
        if (!generation.originalImageUrl) {
          console.warn('Edited image missing originalImageUrl, falling back to simple modal')
          onImageClick(imageUrl)
        } else {
          setCurrentModal({
            type: 'comparison',
            generation,
            imageUrl,
            showSlider: false
          })
        }
        break
      case 'upscaled':
        if (!generation.originalImageUrl) {
          console.warn('Upscaled image missing originalImageUrl, falling back to simple modal')
          onImageClick(imageUrl)
        } else {
          setCurrentModal({
            type: 'comparison',
            generation,
            imageUrl,
            showSlider: true
          })
        }
        break
      case 'generated':
      default:
        onImageClick(imageUrl)
        break
    }
  }

  const closeModal = () => {
    setCurrentModal({ type: null, generation: null })
  }

  // Get current variation index for a generation
  const getCurrentVariationIndex = (generationId: string) => {
    return currentVariations[generationId] || 0
  }

  // Set variation index for a generation
  const setVariationIndex = (generationId: string, index: number) => {
    setCurrentVariations(prev => ({
      ...prev,
      [generationId]: index
    }))
  }

  // Social sharing functions
  // Nova função centralizada de compartilhamento
  const handleShare = async (platform: SharePlatform, imageUrl: string, generation: any) => {
    try {
      console.log(`🚀 [GALLERY] Sharing to ${platform}:`, { imageUrl, generation })

      const result = await sharePhoto({
        imageUrl,
        generation,
        platform
      })

      // Exibe feedback baseado no resultado
      showShareFeedback(result)

      return result.success

    } catch (error) {
      console.error('❌ [GALLERY] Share failed:', error)
      showShareFeedback({
        success: false,
        method: 'copy',
        message: 'Erro no compartilhamento',
        action: 'Tente novamente'
      })
      return false
    }
  }

  // Função para exibir feedback visual
  const showShareFeedback = (result: any) => {
    const toast = document.createElement('div')

    // Ícone baseado no sucesso
    const icon = result.success ? '✅' : '❌'

    // Cor baseada no sucesso
    const bgColor = result.success ? '#10b981' : '#ef4444'

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">${icon}</span>
        <div>
          <div style="font-weight: 600;">${result.message}</div>
          ${result.action ? `<div style="font-size: 12px; opacity: 0.9;">${result.action}</div>` : ''}
        </div>
      </div>
    `

    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColor};
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      z-index: 1000;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease-out;
      max-width: 320px;
      min-width: 250px;
    `

    document.body.appendChild(toast)

    // Add animation keyframes if not exists
    if (!document.getElementById('share-toast-styles')) {
      const style = document.createElement('style')
      style.id = 'share-toast-styles'
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `
      document.head.appendChild(style)
    }

    // Remove toast after delay
    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.style.animation = 'slideIn 0.3s ease-out reverse'
        setTimeout(() => {
          if (document.body.contains(toast)) {
            document.body.removeChild(toast)
          }
        }, 300)
      }
    }, 4000)
  }


  const handleImageAction = async (action: string, imageUrl: string, generation: any) => {
    switch (action) {
      case 'download':
        try {
          // Generate filename first
          const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
          const promptSlug = generation.prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')
          const filename = `vibephoto_${promptSlug}_${timestamp}.jpg`

          // Try different download methods
          let downloadSuccess = false

          // Method 1: Try proxy download through our API
          try {
            const proxyResponse = await fetch('/api/download-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageUrl, filename })
            })

            if (proxyResponse.ok) {
              const blob = await proxyResponse.blob()
              const url = window.URL.createObjectURL(blob)

              const link = document.createElement('a')
              link.href = url
              link.download = filename
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              window.URL.revokeObjectURL(url)

              downloadSuccess = true
            }
          } catch (proxyError) {
            console.log('Proxy download failed, trying direct fetch:', proxyError)
          }

          // Method 2: Direct fetch with CORS mode
          if (!downloadSuccess) {
            try {
              const response = await fetch(imageUrl, {
                mode: 'cors',
                headers: {
                  'Accept': 'image/*'
                }
              })

              if (!response.ok) throw new Error(`HTTP ${response.status}`)

              const blob = await response.blob()
              const url = window.URL.createObjectURL(blob)

              const link = document.createElement('a')
              link.href = url
              link.download = filename
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              window.URL.revokeObjectURL(url)

              downloadSuccess = true
            } catch (directError) {
              console.log('Direct fetch failed, trying fallback:', directError)
            }
          }

          // Method 3: Fallback - open in new tab
          if (!downloadSuccess) {
            const link = document.createElement('a')
            link.href = imageUrl
            link.target = '_blank'
            link.download = filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            downloadSuccess = true
          }

          // Show success feedback
          showShareFeedback({
            success: true,
            method: 'download',
            message: 'Download iniciado com sucesso!'
          })

        } catch (error) {
          console.error('All download methods failed:', error)
          showShareFeedback({
            success: false,
            method: 'download',
            message: 'Erro ao baixar arquivo. Tente clicar com o botão direito e "Salvar imagem como".'
          })
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
      case 'upscale':
        onUpscale?.(imageUrl, generation)
        break
      case 'edit':
        // Navigate to editor with image URL using client-side routing
        router.push(`/editor?image=${encodeURIComponent(imageUrl)}&generationId=${generation.id}`)
        break
      case 'video':
        // Video creation is handled by the CompactVideoButton component
        break
      case 'share-dropdown':
        // Toggle share dropdown
        setShareDropdown(shareDropdown === imageUrl ? null : imageUrl)
        setShareSubmenu(null) // Close submenu when opening dropdown
        break
      case 'share-submenu':
        // Toggle share submenu
        setShareSubmenu(shareSubmenu === imageUrl ? null : imageUrl)
        break
      case 'share-email':
        handleShare('gmail', imageUrl, generation)
        break
      case 'share-copy':
        handleShare('copy', imageUrl, generation)
        break
      case 'share-whatsapp-direct':
        handleShare('whatsapp', imageUrl, generation)
        break
      case 'share-telegram':
        handleShare('telegram', imageUrl, generation)
        break
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {generations.map((generation) => (
          <div key={generation.id} className="space-y-3">
          {/* Single Image with Carousel for Variations */}
          {generation.status === 'COMPLETED' && generation.imageUrls.length > 0 ? (
            (() => {
              const currentIndex = getCurrentVariationIndex(generation.id)
              const currentImageUrl = generation.imageUrls[currentIndex]

              return (
                <div
                  className="relative group cursor-pointer"
                  onMouseEnter={() => setHoveredImage(currentImageUrl)}
                  onMouseLeave={(e) => {
                    // Only hide if we're not hovering over child elements
                    try {
                      const relatedTarget = e.relatedTarget
                      if (!relatedTarget ||
                          !(relatedTarget instanceof Node) ||
                          !e.currentTarget.contains(relatedTarget)) {
                        setHoveredImage(null)
                      }
                    } catch (error) {
                      // Fallback: just hide the image on any error
                      setHoveredImage(null)
                    }
                  }}
                  onClick={() => {
                    // Card is clickable anywhere except on buttons (which have stopPropagation)
                    handleMediaClick(currentImageUrl, generation)
                  }}
                >
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                    <OptimizedImage
                      src={currentImageUrl}
                      alt={`Generated image ${currentIndex + 1} of ${generation.imageUrls.length}`}
                      fill
                      objectFit="cover"
                      className="transition-transform group-hover:scale-105"
                      thumbnailUrl={generation.thumbnailUrls?.[currentIndex]}
                      // Mobile-first sizes: menor para mobile, evita carregar imagens grandes desnecessariamente
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                      // Priority apenas primeira imagem no mobile (LCP optimization)
                      priority={index === 0}
                    />
                  </div>

                  {/* Navigation Arrows - only show if multiple variations */}
                  {generation.imageUrls.length > 1 && (
                    <>
                      {/* Left Arrow */}
                      {currentIndex > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setVariationIndex(generation.id, currentIndex - 1)
                          }}
                          className={`absolute left-2 top-2/3 transform -translate-y-1/2 w-7 h-7 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-all duration-200 z-20 ${
                            hoveredImage === currentImageUrl ? 'opacity-100' : 'opacity-0'
                          }`}
                          title="Variação anterior"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      )}

                      {/* Right Arrow */}
                      {currentIndex < generation.imageUrls.length - 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setVariationIndex(generation.id, currentIndex + 1)
                          }}
                          className={`absolute right-2 top-2/3 transform -translate-y-1/2 w-7 h-7 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-all duration-200 z-20 ${
                            hoveredImage === currentImageUrl ? 'opacity-100' : 'opacity-0'
                          }`}
                          title="Próxima variação"
                        >
                          <ChevronLeft className="w-4 h-4 rotate-180" />
                        </button>
                      )}

                      {/* Variation Counter Badge */}
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="text-xs bg-black/60 text-white border-0">
                          {currentIndex + 1}/{generation.imageUrls.length}
                        </Badge>
                      </div>

                      {/* Dots Indicator */}
                      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
                        <div className="flex space-x-1">
                          {generation.imageUrls.map((_, index) => (
                            <button
                              key={index}
                              onClick={(e) => {
                                e.stopPropagation()
                                setVariationIndex(generation.id, index)
                              }}
                              className={`w-2 h-2 rounded-full transition-colors ${
                                index === currentIndex
                                  ? 'bg-white'
                                  : 'bg-white/50 hover:bg-white/80'
                              }`}
                              title={`Ver variação ${index + 1}`}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Bulk Select Checkbox */}
                  {bulkSelectMode && (
                    <div className="absolute top-2 left-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onImageSelect(currentImageUrl)
                        }}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                          selectedImages.includes(currentImageUrl)
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'bg-white border-gray-300'
                        }`}
                      >
                        {selectedImages.includes(currentImageUrl) && (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Hover Actions */}
                  {!bulkSelectMode && hoveredImage === currentImageUrl && (
                    <div
                      className="absolute inset-0 bg-black bg-opacity-30 rounded-lg flex items-center justify-center px-2 z-10"
                      onClick={(e) => {
                        // Allow clicks through the overlay to trigger card click
                        // Buttons will still stopPropagation
                        if (e.target === e.currentTarget) {
                          e.stopPropagation()
                          handleMediaClick(currentImageUrl, generation)
                        }
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1 max-w-full">
                        {/* Baixar imagem */}
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-9 w-9 sm:h-7 sm:w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleImageAction('download', currentImageUrl, generation)
                          }}
                          title="Baixar imagem"
                        >
                          <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        </Button>

                        {/* Favoritar */}
                        <Button
                          size="sm"
                          variant="secondary"
                          className={`h-9 w-9 sm:h-7 sm:w-7 p-0 ${favoriteImages.includes(currentImageUrl) ? 'bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-[#667EEA]' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleImageAction('favorite', currentImageUrl, generation)
                          }}
                          title={favoriteImages.includes(currentImageUrl) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                        >
                          <Heart className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${favoriteImages.includes(currentImageUrl) ? 'fill-current' : ''}`} />
                        </Button>

                        {/* Fazer upscale */}
                        {onUpscale && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-9 w-9 sm:h-7 sm:w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleImageAction('upscale', currentImageUrl, generation)
                            }}
                            title="Fazer upscale"
                          >
                            <ZoomIn className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                          </Button>
                        )}

                        {/* Editar imagem */}
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-9 w-9 sm:h-7 sm:w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleImageAction('edit', currentImageUrl, generation)
                          }}
                          title="Editar imagem"
                        >
                          <Edit className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        </Button>

                        {/* Criar vídeo */}
                        <CompactVideoButton
                          imageUrl={currentImageUrl}
                          mode="image-to-video"
                          generation={generation}
                          userPlan={userPlan || 'FREE'}
                          variant="secondary"
                          className="h-9 w-9 sm:h-7 sm:w-7 p-0"
                        />

                        {/* Compartilhar */}
                        <div className="relative">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-9 w-9 sm:h-7 sm:w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleImageAction('share-dropdown', currentImageUrl, generation)
                            }}
                            title="Compartilhar"
                          >
                            <Share2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                          </Button>

                          {/* Share Dropdown */}
                          {shareDropdown === currentImageUrl && (
                            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border p-2 min-w-[200px] sm:min-w-[180px] z-30">
                              <button
                                className="flex items-center space-x-2 w-full p-2 hover:bg-gray-100 rounded text-sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleShare('instagram', currentImageUrl, generation)
                                  setShareDropdown(null)
                                }}
                              >
                                <InstagramIcon size={20} />
                                <span className="text-gray-700">Instagram</span>
                              </button>

                              <button
                                className="flex items-center space-x-2 w-full p-2 hover:bg-gray-100 rounded text-sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleShare('tiktok', currentImageUrl, generation)
                                  setShareDropdown(null)
                                }}
                              >
                                <TikTokIcon size={20} />
                                <span className="text-gray-700">TikTok</span>
                              </button>

                              <button
                                className="flex items-center space-x-2 w-full p-2 hover:bg-gray-100 rounded text-sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleShare('whatsapp', currentImageUrl, generation)
                                  setShareDropdown(null)
                                }}
                              >
                                <WhatsAppIcon size={20} />
                                <span className="text-gray-700">WhatsApp</span>
                              </button>

                              <div className="border-t border-gray-200 my-1"></div>

                              {/* Outros Compartilhamentos Submenu */}
                              <div className="relative">
                                <button
                                  className="flex items-center justify-between w-full p-2 hover:bg-gray-100 rounded text-sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleImageAction('share-submenu', currentImageUrl, generation)
                                  }}
                                >
                                  <div className="flex items-center space-x-2">
                                    <MoreHorizontal size={20} />
                                    <span className="text-gray-700">Outros compartilhamentos</span>
                                  </div>
                                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${shareSubmenu === currentImageUrl ? 'rotate-0' : 'rotate-270'}`} />
                                </button>

                                {/* Submenu - appears on click */}
                                {shareSubmenu === currentImageUrl && (
                                  <div className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-lg border p-2 min-w-[160px] z-40">
                                    <button
                                      className="flex items-center space-x-2 w-full p-2 hover:bg-gray-100 rounded text-sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleImageAction('share-email', currentImageUrl, generation)
                                        setShareDropdown(null)
                                        setShareSubmenu(null)
                                      }}
                                    >
                                      <GmailIcon size={16} />
                                      <span className="text-gray-700">Gmail</span>
                                    </button>

                                    <button
                                      className="flex items-center space-x-2 w-full p-2 hover:bg-gray-100 rounded text-sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleImageAction('share-copy', currentImageUrl, generation)
                                        setShareDropdown(null)
                                        setShareSubmenu(null)
                                      }}
                                    >
                                      <Copy size={16} className="text-gray-600" />
                                      <span className="text-gray-700">Copiar Link</span>
                                    </button>

                                    <button
                                      className="flex items-center space-x-2 w-full p-2 hover:bg-gray-100 rounded text-sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleImageAction('share-telegram', currentImageUrl, generation)
                                        setShareDropdown(null)
                                        setShareSubmenu(null)
                                      }}
                                    >
                                      <TelegramIcon size={16} />
                                      <span className="text-gray-700">Telegram</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()
          ) : generation.status === 'PROCESSING' ? (
            <Card className="aspect-square">
              <CardContent className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm text-gray-600">Generating...</p>
                  <p className="text-xs text-gray-500">~30 seconds</p>
                </div>
              </CardContent>
            </Card>
          ) : generation.status === 'FAILED' ? (
            <Card className="aspect-square border-red-200 bg-red-50">
              <CardContent className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-sm text-red-600">Failed</p>
                  <p className="text-xs text-red-500">Try again</p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Description Dropdown */}
          {generation.status === 'COMPLETED' && (
            <div className="bg-gray-800/80 rounded border border-gray-700/50">
              <button
                onClick={() => setExpandedDescription(expandedDescription === generation.id ? null : generation.id)}
                className="w-full flex items-center justify-center py-1.5 px-2 text-left hover:bg-gray-700/50 transition-colors"
              >
                {expandedDescription === generation.id ? (
                  <ChevronUp className="w-3 h-3 text-gray-200" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-gray-200" />
                )}
              </button>

              {expandedDescription === generation.id && (
                <div className="px-3 pb-3 border-t border-gray-700/50">
                  <div className="space-y-2 pt-3">
                    {/* Prompt */}
                    <div>
                      <div className="text-xs font-medium text-gray-400 mb-1">Prompt:</div>
                      <p className="text-sm text-gray-200 leading-relaxed">{generation.prompt}</p>
                    </div>

                    {/* Model */}
                    {generation.model && (
                      <div>
                        <div className="text-xs font-medium text-gray-400 mb-1">Modelo:</div>
                        <p className="text-sm text-gray-300">{generation.model.name}</p>
                      </div>
                    )}

                    {/* Date */}
                    <div>
                      <div className="text-xs font-medium text-gray-400 mb-1">Criado em:</div>
                      <p className="text-sm text-gray-300">{formatDate(generation.createdAt)}</p>
                    </div>

                    {/* Images count */}
                    <div>
                      <div className="text-xs font-medium text-gray-400 mb-1">Imagens:</div>
                      <p className="text-sm text-gray-300">{generation.imageUrls?.length || 0} gerada(s)</p>
                    </div>

                    {/* Cost Information */}
                    <div>
                      <div className="text-xs font-medium text-gray-400 mb-1">Custo:</div>
                      <p className="text-sm text-gray-300 font-medium">
                        {getCostDescription(
                          generation.prompt?.includes('[EDITED]') ? 'edited' : 'generated',
                          {
                            packageType: generation.style
                          }
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        ))}
      </div>

      {/* Modals */}
      {currentModal.type === 'comparison' && currentModal.generation && currentModal.imageUrl && (
        <ComparisonModal
          mediaItem={createMediaItem(currentModal.generation, currentModal.imageUrl)}
          onClose={closeModal}
          showSlider={currentModal.showSlider || false}
        />
      )}

      {currentModal.type === 'video' && currentModal.generation && (
        <VideoPlayerModal
          mediaItem={createMediaItem(currentModal.generation, currentModal.generation.videoUrl)}
          onClose={closeModal}
        />
      )}
    </>
  )
}