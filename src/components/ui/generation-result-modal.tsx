'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, X, RefreshCw, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface GenerationResultModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl?: string | null
  videoUrl?: string | null
  title?: string
  type?: 'image' | 'video'
}

export function GenerationResultModal({
  open,
  onOpenChange,
  imageUrl,
  videoUrl,
  title = 'Mídia Gerada',
  type = 'image'
}: GenerationResultModalProps) {
  const router = useRouter()
  const mediaUrl = type === 'image' ? imageUrl : videoUrl
  const [imageError, setImageError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const maxRetries = 2

  // Debug logging - always log when state changes
  useEffect(() => {
    console.log('🎯 [MODAL] GenerationResultModal state changed:', {
      open,
      hasImageUrl: !!imageUrl,
      hasVideoUrl: !!videoUrl,
      mediaUrl: mediaUrl?.substring(0, 100) + '...',
      mediaUrlFull: mediaUrl, // CRITICAL: Log full URL
      mediaUrlLength: mediaUrl?.length || 0,
      type,
      willRender: open && !!mediaUrl,
      imageUrlValue: imageUrl, // CRITICAL: Log full imageUrl
      imageUrlLength: imageUrl?.length || 0,
      videoUrlValue: videoUrl, // CRITICAL: Log full videoUrl
      videoUrlLength: videoUrl?.length || 0,
      imageError,
      retryCount
    })
  }, [open, imageUrl, videoUrl, mediaUrl, type, imageError, retryCount])

  // Reset error state when URL changes
  useEffect(() => {
    if (mediaUrl) {
      setImageError(false)
      setRetryCount(0)
      setIsLoading(true)
    }
  }, [mediaUrl])

  // CRITICAL: Always render Dialog when open, even without mediaUrl (for loading state)
  // This ensures the modal appears immediately
  if (open) {
    console.log('🔥 [MODAL] ===== MODAL OPEN BLOCK ENTERED =====')
    console.log('🔥 [MODAL] Props:', { open, hasImageUrl: !!imageUrl, hasVideoUrl: !!videoUrl, mediaUrl: !!mediaUrl })

    if (!mediaUrl) {
      console.log('⏳ [MODAL] Modal open but no mediaUrl yet, showing loading state')
      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            className="sm:max-w-4xl"
            ref={(el) => {
              if (el) {
                console.log('🔍 [MODAL-LOADING] DOM Element mounted:', {
                  display: window.getComputedStyle(el).display,
                  visibility: window.getComputedStyle(el).visibility,
                  opacity: window.getComputedStyle(el).opacity,
                  zIndex: window.getComputedStyle(el).zIndex,
                  position: window.getComputedStyle(el).position,
                  width: el.offsetWidth,
                  height: el.offsetHeight,
                  boundingRect: el.getBoundingClientRect()
                })
              } else {
                console.error('❌ [MODAL-LOADING] Element is NULL')
              }
            }}
          >
            <DialogTitle>Carregando imagem...</DialogTitle>
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          </DialogContent>
        </Dialog>
      )
    }

    console.log('✅ [MODAL] Rendering modal with media (FULL URL):', mediaUrl)
    console.log('✅ [MODAL] Media URL length:', mediaUrl?.length || 0)
    console.log('✅ [MODAL] Media URL preview:', mediaUrl?.substring(0, 100) + '...')

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0"
          ref={(el) => {
            if (el) {
              const styles = window.getComputedStyle(el)
              console.log('🔍 [MODAL-CONTENT] DOM Element mounted:', {
                display: styles.display,
                visibility: styles.visibility,
                opacity: styles.opacity,
                zIndex: styles.zIndex,
                position: styles.position,
                top: styles.top,
                left: styles.left,
                transform: styles.transform,
                width: el.offsetWidth,
                height: el.offsetHeight,
                boundingRect: el.getBoundingClientRect(),
                isConnected: el.isConnected,
                parentElement: el.parentElement?.tagName
              })
            } else {
              console.error('❌ [MODAL-CONTENT] Element is NULL')
            }
          }}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <DialogTitle className="font-[system-ui,-apple-system,'SF Pro Display',sans-serif] text-lg font-semibold">
              {title}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-auto p-4 bg-gray-50 flex items-center justify-center relative">
              {type === 'image' ? (
                <>
                  {imageError && retryCount >= maxRetries ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                      <p className="text-gray-700 mb-4">Não foi possível carregar a imagem.</p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setImageError(false)
                          setRetryCount(0)
                          setIsLoading(true)
                        }}
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Tentar novamente
                      </Button>
                    </div>
                  ) : (
                    <>
                      {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-10">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                        </div>
                      )}
                      <img
                        src={mediaUrl}
                        alt="Resultado gerado"
                        className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
                        onError={(e) => {
                          console.error('❌ [MODAL] Image failed to load (FULL URL):', mediaUrl)
                          console.error('❌ [MODAL] Image src attribute:', e.currentTarget.src)
                          console.error('❌ [MODAL] Image src length:', e.currentTarget.src?.length || 0)
                          console.error('❌ [MODAL] Retry count:', retryCount)
                          if (retryCount < maxRetries) {
                            // Retry loading the image
                            setRetryCount(prev => prev + 1)
                            setTimeout(() => {
                              const img = e.currentTarget
                              const originalSrc = img.src
                              img.src = ''
                              setTimeout(() => {
                                img.src = originalSrc
                              }, 1000)
                            }, 2000 * (retryCount + 1)) // Exponential backoff
                          } else {
                            setImageError(true)
                            setIsLoading(false)
                          }
                        }}
                        onLoad={() => {
                          console.log('✅ [MODAL] Image loaded successfully:', mediaUrl?.substring(0, 50) + '...')
                          setIsLoading(false)
                          setImageError(false)
                        }}
                      />
                    </>
                  )}
                </>
              ) : (
                <video
                  src={mediaUrl}
                  controls
                  className="max-w-full max-h-[60vh] rounded-lg shadow-lg"
                  onError={(e) => {
                    console.error('❌ [MODAL] Video failed to load:', mediaUrl)
                  }}
                  onLoadedMetadata={() => {
                    console.log('✅ [MODAL] Video loaded successfully:', mediaUrl?.substring(0, 50) + '...')
                    setIsLoading(false)
                  }}
                >
                  Seu navegador não suporta o elemento de vídeo.
                </video>
              )}
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-200 bg-white">
              <Button
                asChild
                className="flex-1 bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 text-white font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              >
                <a 
                  href={mediaUrl} 
                  download={type === 'image' ? `imagem-gerada-${Date.now()}.png` : `video-gerado-${Date.now()}.mp4`}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar
                </a>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  router.push('/gallery?tab=generated')
                }}
                className="flex-1 border-2 border-gray-200 hover:border-[#667EEA] font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
              >
                Ver na galeria
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Modal is closed
  return null
}
