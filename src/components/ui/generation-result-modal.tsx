'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

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

  // Debug logging - always log when state changes
  useEffect(() => {
    console.log('🎯 [MODAL] GenerationResultModal state changed:', {
      open,
      hasImageUrl: !!imageUrl,
      hasVideoUrl: !!videoUrl,
      mediaUrl: mediaUrl?.substring(0, 100) + '...',
      type,
      willRender: open && !!mediaUrl,
      imageUrlValue: imageUrl,
      videoUrlValue: videoUrl
    })
  }, [open, imageUrl, videoUrl, mediaUrl, type])

  // CRITICAL: Always render Dialog when open, even without mediaUrl (for loading state)
  // This ensures the modal appears immediately
  if (open) {
    if (!mediaUrl) {
      console.log('⏳ [MODAL] Modal open but no mediaUrl yet, showing loading state')
      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-4xl">
            <DialogTitle>Carregando imagem...</DialogTitle>
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          </DialogContent>
        </Dialog>
      )
    }

    console.log('✅ [MODAL] Rendering modal with media:', mediaUrl?.substring(0, 50) + '...')
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
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
            <div className="flex-1 overflow-auto p-4 bg-gray-50 flex items-center justify-center">
              {type === 'image' ? (
                <img
                  src={mediaUrl}
                  alt="Resultado gerado"
                  className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
                  onError={(e) => {
                    console.error('❌ [MODAL] Image failed to load:', mediaUrl)
                    e.currentTarget.src = '/placeholder-image.png'
                  }}
                  onLoad={() => {
                    console.log('✅ [MODAL] Image loaded successfully:', mediaUrl?.substring(0, 50) + '...')
                  }}
                />
              ) : (
                <video
                  src={mediaUrl}
                  controls
                  className="max-w-full max-h-[60vh] rounded-lg shadow-lg"
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
