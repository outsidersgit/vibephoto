'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Download,
  Heart,
  Share2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Copy,
  ExternalLink,
  Info,
  Edit2,
  ChevronDown,
  Video,
  MoreHorizontal,
  Trash2
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { MediaItem } from '@/types'
import { calculateOperationCost, getCostDescription } from '@/lib/utils/cost-calculator'
import Link from 'next/link'
import { CompactVideoButton } from '@/components/video/video-button'
import { FeedbackModal } from '@/components/feedback/feedback-modal'
import { useFeedback } from '@/hooks/useFeedback'
import { InstagramIcon, TikTokIcon, WhatsAppIcon, TelegramIcon, GmailIcon } from '@/components/ui/social-icons'

// Lazy load VideoModal (Fase 2 - Otimização de Performance)
const VideoModal = dynamic(() => import('@/components/video/video-modal').then(mod => ({ default: mod.VideoModal })), {
  loading: () => <div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>,
  ssr: false
})

interface ImageModalProps {
  mediaItem: MediaItem
  onClose: () => void
  allImages: MediaItem[]
  onUpscale?: (imageUrl: string, generation: any) => void
  onDelete?: (generationId: string) => void
  userPlan?: string
}

export function ImageModal({ mediaItem, onClose, allImages, onUpscale, onDelete, userPlan }: ImageModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [showInfo, setShowInfo] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [showShareSubmenu, setShowShareSubmenu] = useState(false)
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)

  const currentImage = allImages[currentImageIndex] || mediaItem
  const generationId = currentImage?.generation?.id
  const { shouldShow: shouldShowFeedback, dismissModal: dismissFeedbackModal } = useFeedback(generationId)

  // Auto-trigger feedback after user views image for 3 seconds
  useEffect(() => {
    if (!generationId) return

    const timer = setTimeout(() => {
      setShowFeedbackModal(true)
    }, 3000) // Show after 3 seconds of viewing

    return () => clearTimeout(timer)
  }, [currentImageIndex, generationId])

  useEffect(() => {
    // Find current image index in the array
    const currentIndex = allImages.findIndex(img => img.id === mediaItem.id)
    if (currentIndex >= 0) {
      setCurrentImageIndex(currentIndex)
    }
  }, [mediaItem.id, allImages])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          navigateImage(-1)
          break
        case 'ArrowRight':
          navigateImage(1)
          break
        case 'i':
        case 'I':
          setShowInfo(!showInfo)
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentImageIndex, showInfo])

  const navigateImage = (direction: number) => {
    if (allImages.length === 0) return

    const newIndex = (currentImageIndex + direction + allImages.length) % allImages.length
    setCurrentImageIndex(newIndex)
    setZoom(1)
    setRotation(0)
  }

  const handleDownload = async () => {
    const currentImage = allImages[currentImageIndex]
    if (!currentImage) return

    try {
      // Fetch the image as blob to handle CORS and different domains
      const response = await fetch(currentImage.url)
      if (!response.ok) throw new Error('Failed to fetch image')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)

      // Create download link
      const link = document.createElement('a')
      link.href = url

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
      const promptSlug = currentImage.prompt?.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_') || 'image'
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
      link.href = currentImage.url
      link.download = `vibephoto_${currentImage.id}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleDelete = async () => {
    if (!currentImage.generation?.id) return

    const confirmed = confirm(
      'Tem certeza que deseja excluir esta geração? Esta ação não pode ser desfeita.'
    )

    if (!confirmed) return

    try {
      const response = await fetch('/api/generations/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationId: currentImage.generation.id })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete generation')
      }

      console.log('✅ Generation deleted successfully')

      // Close modal first
      onClose()

      // Notify parent after a small delay to ensure modal is closed
      setTimeout(() => {
        if (onDelete) {
          onDelete(currentImage.generation.id)
        }
      }, 100)

    } catch (error) {
      console.error('❌ Delete failed:', error)
      alert('Erro ao excluir geração. Tente novamente.')
    }
  }

  const handleShare = async (platform: string) => {
    const currentImage = allImages[currentImageIndex]
    if (!currentImage) return

    const promptText = currentImage.generation?.prompt || 'AI Generated Photo'
    const imageUrl = currentImage.url

    try {
      switch (platform) {
        case 'instagram':
          window.open(`https://www.instagram.com/create/story/?url=${encodeURIComponent(imageUrl)}`, '_blank')
          break
        case 'tiktok':
          window.open(`https://www.tiktok.com/upload?url=${encodeURIComponent(imageUrl)}`, '_blank')
          break
        case 'whatsapp':
          window.open(`https://wa.me/?text=${encodeURIComponent(`Olha essa foto incrível gerada por IA! ${imageUrl}`)}`, '_blank')
          break
        case 'telegram':
          window.open(`https://t.me/share/url?url=${encodeURIComponent(imageUrl)}&text=${encodeURIComponent(promptText)}`, '_blank')
          break
        case 'gmail':
          const gmailSubject = encodeURIComponent('Foto Incrível Gerada por IA')
          const gmailBody = encodeURIComponent(`Olha essa foto incrível que foi gerada por IA:\n\n${promptText}\n\n${imageUrl}`)
          window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${gmailSubject}&body=${gmailBody}`, '_blank')
          break
        case 'copy':
          await navigator.clipboard.writeText(imageUrl)
          alert('Link copiado para a área de transferência!')
          break
        default:
          if (navigator.share) {
            await navigator.share({
              title: 'AI Generated Photo',
              text: promptText,
              url: imageUrl
            })
          } else {
            await navigator.clipboard.writeText(imageUrl)
            alert('Image URL copied to clipboard!')
          }
      }
    } catch (error) {
      console.error('Share failed:', error)
      // Fallback to copy
      try {
        await navigator.clipboard.writeText(imageUrl)
        alert('Link copiado para a área de transferência!')
      } catch (copyError) {
        console.error('Copy failed:', copyError)
      }
    }
    setShowShareMenu(false)
    setShowShareSubmenu(false)
  }

  const handleCopyPrompt = () => {
    const currentImage = allImages[currentImageIndex]
    if (currentImage?.generation?.prompt) {
      navigator.clipboard.writeText(currentImage.generation.prompt)
      alert('Prompt copied to clipboard!')
    }
  }

  if (!currentImage) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-50 p-4 z-10">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center space-x-4">
            <span className="text-sm">
              {currentImageIndex + 1} of {allImages.length}
            </span>
            {currentImage.generation && (
              <Badge variant="secondary">
                {currentImage.generation.model?.name || 'Unknown Model'}
              </Badge>
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

      {/* Navigation */}
      {allImages.length > 1 && (
        <>
          <button
            onClick={() => navigateImage(-1)}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-70 transition-colors z-10"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <button
            onClick={() => navigateImage(1)}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-70 transition-colors z-10"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Image */}
      <div 
        className="relative max-w-full max-h-full flex items-center justify-center cursor-move"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <img
          src={currentImage.url}
          alt="Generated image"
          className="max-w-full max-h-full object-contain transition-transform"
          style={{ 
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            maxWidth: '90vw',
            maxHeight: '90vh'
          }}
        />
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
            {/* Download */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="text-white hover:bg-white hover:bg-opacity-20"
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>

            {/* Favorite */}
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
              onClick={handleDelete}
              className="text-white hover:bg-red-500 hover:bg-opacity-80"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Excluir
            </Button>

            {/* Upscale */}
            {onUpscale && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onUpscale(currentImage.url, currentImage.generation)}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <ZoomIn className="w-4 h-4 mr-1" />
                Upscale (10 créditos)
              </Button>
            )}

            {/* Edit */}
            {currentImage.operationType === 'generated' && (
              <Link href={`/editor?image=${encodeURIComponent(currentImage.url)}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white hover:bg-opacity-20"
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Editar (15 créditos)
                </Button>
              </Link>
            )}

            {/* Video Creation */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowVideoModal(true)}
              className="text-white hover:bg-white hover:bg-opacity-20"
            >
              <Video className="w-4 h-4 mr-1" />
              Vídeo (100 créditos)
            </Button>

            {/* Share Dropdown */}
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
                      <InstagramIcon size={16} />
                      <span>Instagram</span>
                    </button>
                    <button
                      onClick={() => handleShare('tiktok')}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white hover:bg-opacity-20 flex items-center space-x-2"
                    >
                      <TikTokIcon size={16} />
                      <span>TikTok</span>
                    </button>
                    <button
                      onClick={() => handleShare('whatsapp')}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white hover:bg-opacity-20 flex items-center space-x-2"
                    >
                      <WhatsAppIcon size={16} />
                      <span>WhatsApp</span>
                    </button>

                    <hr className="border-gray-600 my-1" />

                    {/* Outros Compartilhamentos Submenu */}
                    <div className="relative">
                      <button
                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white hover:bg-opacity-20 flex items-center justify-between"
                        onClick={() => setShowShareSubmenu(!showShareSubmenu)}
                      >
                        <div className="flex items-center space-x-2">
                          <MoreHorizontal className="w-4 h-4" />
                          <span>Outros compartilhamentos</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showShareSubmenu ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Submenu */}
                      {showShareSubmenu && (
                        <div className="bg-black bg-opacity-95 border-t border-gray-600">
                          <button
                            onClick={() => handleShare('gmail')}
                            className="w-full px-8 py-2 text-left text-sm text-white hover:bg-white hover:bg-opacity-20 flex items-center space-x-2"
                          >
                            <GmailIcon size={16} />
                            <span>Gmail</span>
                          </button>
                          <button
                            onClick={() => handleShare('copy')}
                            className="w-full px-8 py-2 text-left text-sm text-white hover:bg-white hover:bg-opacity-20 flex items-center space-x-2"
                          >
                            <Copy className="w-4 h-4" />
                            <span>Copiar Link</span>
                          </button>
                          <button
                            onClick={() => handleShare('telegram')}
                            className="w-full px-8 py-2 text-left text-sm text-white hover:bg-white hover:bg-opacity-20 flex items-center space-x-2"
                          >
                            <TelegramIcon size={16} />
                            <span>Telegram</span>
                          </button>
                        </div>
                      )}
                    </div>

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

            {/* Open in new tab */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(currentImage.url, '_blank')}
              className="text-white hover:bg-white hover:bg-opacity-20"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Open
            </Button>

            {/* Back to Gallery */}
            <Link href="/gallery">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                Ver Galeria
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Info Panel */}
      {showInfo && currentImage && (
        <div className="absolute top-16 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg max-w-sm z-10">
          <h3 className="font-semibold mb-3">Image Details</h3>

          <div className="space-y-3 text-sm">
            {currentImage.generation?.prompt && (
              <div>
                <div className="text-gray-300">Prompt:</div>
                <div className="mt-1">
                  {currentImage.generation.prompt}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyPrompt}
                    className="ml-2 h-6 w-6 p-0 text-gray-300 hover:text-white"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}

            {currentImage.generation?.negativePrompt && (
              <div>
                <div className="text-gray-300">Negative Prompt:</div>
                <div className="mt-1">{currentImage.generation.negativePrompt}</div>
              </div>
            )}

            <div>
              <div className="text-gray-300">Type:</div>
              <div className="capitalize">{currentImage.operationType}</div>
            </div>

            <div>
              <div className="text-gray-300">Status:</div>
              <div className="capitalize">{currentImage.status.toLowerCase()}</div>
            </div>

            {currentImage.metadata && (
              <>
                {currentImage.metadata.width && currentImage.metadata.height && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-gray-300">Dimensions:</div>
                      <div>{currentImage.metadata.width} × {currentImage.metadata.height}</div>
                    </div>
                    {currentImage.metadata.format && (
                      <div>
                        <div className="text-gray-300">Format:</div>
                        <div className="uppercase">{currentImage.metadata.format}</div>
                      </div>
                    )}
                  </div>
                )}

                {currentImage.metadata.sizeBytes && (
                  <div>
                    <div className="text-gray-300">Size:</div>
                    <div>{(currentImage.metadata.sizeBytes / 1024 / 1024).toFixed(1)} MB</div>
                  </div>
                )}
              </>
            )}

            {currentImage.generation && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-gray-300">Model:</div>
                    <div>{currentImage.generation.model?.name || 'Unknown'}</div>
                  </div>
                  {currentImage.generation.resolution && (
                    <div>
                      <div className="text-gray-300">Resolution:</div>
                      <div>{currentImage.generation.resolution}</div>
                    </div>
                  )}
                  {currentImage.generation.aspectRatio && (
                    <div>
                      <div className="text-gray-300">Aspect Ratio:</div>
                      <div>{currentImage.generation.aspectRatio}</div>
                    </div>
                  )}
                  {currentImage.generation.style && (
                    <div>
                      <div className="text-gray-300">Style:</div>
                      <div className="capitalize">{currentImage.generation.style}</div>
                    </div>
                  )}
                </div>

                {currentImage.generation.createdAt && (
                  <div>
                    <div className="text-gray-300">Created:</div>
                    <div>{formatDate(currentImage.generation.createdAt)}</div>
                  </div>
                )}

                {currentImage.generation.processingTime && (
                  <div>
                    <div className="text-gray-300">Processing Time:</div>
                    <div>{(currentImage.generation.processingTime / 1000).toFixed(1)}s</div>
                  </div>
                )}

                {/* Cost Information */}
                <div>
                  <div className="text-gray-300">Custo:</div>
                  <div className="text-white font-medium">
                    {getCostDescription(
                      currentImage.operationType === 'generated' && currentImage.generation?.prompt?.includes('[EDITED]')
                        ? 'edited'
                        : currentImage.operationType,
                      {
                        duration: currentImage.metadata?.duration,
                        packageType: currentImage.generation?.style
                      }
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-600 text-xs text-gray-400">
            Press 'I' to toggle this panel, ESC to close, ← → to navigate
          </div>
        </div>
      )}

      {/* Video Modal */}
      {showVideoModal && (
        <VideoModal
          isOpen={showVideoModal}
          onClose={() => setShowVideoModal(false)}
          imageUrl={currentImage.url}
          mode="image-to-video"
          generation={currentImage.generation}
          userPlan={userPlan || 'FREE'}
        />
      )}

      {/* Feedback Modal */}
      {generationId && showFeedbackModal && shouldShowFeedback && (
        <FeedbackModal
          isOpen={true}
          onClose={() => {
            setShowFeedbackModal(false)
            dismissFeedbackModal()
          }}
          generationId={generationId}
          generationPrompt={currentImage?.generation?.prompt}
          onSuccess={() => {
            console.log('✅ Feedback submitted from image modal!')
            setShowFeedbackModal(false)
          }}
        />
      )}
    </div>
  )
}