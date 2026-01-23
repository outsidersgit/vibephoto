'use client'

import { useRef, useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { X, Sparkles, Download } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getUpscaleCost } from '@/lib/credits/pricing'

interface UpscaleConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onUpscale: (scaleFactor: string, objectDetection: string) => void
  imageUrl: string
  isLoading?: boolean
  resultImageUrl?: string
}

export function UpscaleConfigModal({
  isOpen,
  onClose,
  onUpscale,
  imageUrl,
  isLoading = false,
  resultImageUrl
}: UpscaleConfigModalProps) {
  const comparisonContainerRef = useRef<HTMLDivElement | null>(null)
  const afterImageMaskRef = useRef<HTMLDivElement | null>(null)
  const sliderRef = useRef<HTMLDivElement | null>(null)
  const pointerActiveRef = useRef(false)
  const { addToast } = useToast()

  const applySliderPosition = useCallback((percentage: number) => {
    const clamped = Math.min(100, Math.max(0, percentage))
    if (afterImageMaskRef.current) {
      afterImageMaskRef.current.style.clipPath = `polygon(${clamped}% 0, 100% 0, 100% 100%, ${clamped}% 100%)`
    }
    if (sliderRef.current) {
      sliderRef.current.style.left = `${clamped}%`
    }
  }, [])

  const updateFromClientX = useCallback((clientX: number) => {
    const container = comparisonContainerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    if (rect.width === 0) return
    const relative = ((clientX - rect.left) / rect.width) * 100
    applySliderPosition(relative)
  }, [applySliderPosition])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    pointerActiveRef.current = true
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.style.userSelect = 'none'
    updateFromClientX(event.clientX)
  }, [updateFromClientX])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerActiveRef.current) return
    event.preventDefault()
    updateFromClientX(event.clientX)
  }, [updateFromClientX])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    pointerActiveRef.current = false
    event.preventDefault()
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // ignore
    }
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    applySliderPosition(50)
  }, [applySliderPosition, resultImageUrl, imageUrl])

  useEffect(() => {
    return () => {
      document.body.style.userSelect = ''
    }
  }, [])

  const handleDownloadResult = useCallback(async () => {
    if (!resultImageUrl) {
      return
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const response = await fetch('/api/download-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: resultImageUrl,
          filename: `vibephoto-upscale-${timestamp}.png`
        })
      })

      if (!response.ok) {
        throw new Error(`Download proxy returned ${response.status}`)
      }

      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `vibephoto-upscale-${timestamp}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(downloadUrl)

      addToast({
        type: 'success',
        title: 'Download iniciado',
        description: 'A imagem em alta resolução foi baixada.'
      })
    } catch (error) {
      console.error('❌ [UPSCALE_MODAL] Download failed:', error)
      addToast({
        type: 'error',
        title: 'Erro no download',
        description: 'Não foi possível baixar a imagem. Tente novamente.'
      })
    }
  }, [resultImageUrl, addToast])

  const handleUpscale = () => {
    // Nano Banana Pro: 4K fixo, sem opções adicionais
    onUpscale('4k', 'none')
  }

  // Calcular custo de créditos
  const getCreditCost = () => getUpscaleCost(1)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[1100px] bg-[#34495E] border-[#4A5F7A] p-6 rounded-2xl [&>button]:hidden">
        <DialogTitle className="sr-only">Upscale</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
            Upscale
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-[#2C3E50]"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Images Section */}
        <div className="grid grid-cols-[220px_1fr] gap-4 mb-4">
          {/* Original Image - Compacto */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-400 font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
              Original
            </h3>
            <Card className="bg-[#2C3E50] border-[#4A5F7A] p-0 rounded-lg h-[450px] overflow-hidden">
              {imageUrl ? (
                <div className="w-full h-full relative">
                  <img
                    src={imageUrl}
                    alt="Imagem original"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">
                    Antes
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  Carregando...
                </div>
              )}
            </Card>
          </div>

          {/* Result Image - Responsivo ao aspect ratio */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-400 font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
              Antes e Depois (arraste para comparar)
            </h3>
            <Card className="bg-[#2C3E50] border-[#4A5F7A] p-0 rounded-lg h-[450px] overflow-hidden">
              {resultImageUrl ? (
                <div className="w-full h-full relative select-none touch-none">
                  <div
                    ref={comparisonContainerRef}
                    className="absolute inset-0 overflow-hidden cursor-ew-resize"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  >
                    {/* Imagem original (antes) */}
                    <img
                      src={imageUrl || resultImageUrl}
                      alt="Imagem original"
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                    {/* Imagem upscaled (depois) - com clip path */}
                    <div
                      ref={afterImageMaskRef}
                      className="absolute inset-0"
                      style={{ clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)' }}
                    >
                      <img
                        src={resultImageUrl}
                        alt="Resultado do upscale"
                        className="absolute inset-0 w-full h-full object-contain"
                      />
                    </div>
                    {/* Slider divisor */}
                    <div
                      ref={sliderRef}
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg -translate-x-1/2 pointer-events-none z-10"
                      style={{ left: '50%' }}
                    >
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/30 backdrop-blur-sm border-2 border-white shadow-xl flex items-center justify-center">
                        <div className="w-0.5 h-4 bg-white rounded-full" />
                      </div>
                    </div>
                    {/* Labels antes/depois */}
                    <div className="absolute top-3 left-3 bg-black/70 text-white text-[10px] px-2 py-1 rounded">
                      Antes
                    </div>
                    <div className="absolute top-3 right-3 bg-black/70 text-white text-[10px] px-2 py-1 rounded">
                      Depois
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  {isLoading ? (
                    <div className="flex flex-col items-center space-y-3">
                      <Sparkles className="w-10 h-10 animate-spin text-[#667EEA]" />
                      <span className="text-sm font-medium">Processando 4K...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-16 h-16 bg-white/5 rounded-full">
                      <div className="w-8 h-8 border-2 border-dashed border-gray-500 rounded"></div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Informações compactas */}
        {resultImageUrl ? (
          <div className="mb-4">
            <div className="flex items-center justify-between bg-[#2C3E50]/50 border border-[#4A5F7A]/50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-300">
                Imagem salva na galeria
              </p>
              <Button
                type="button"
                onClick={handleDownloadResult}
                size="sm"
                className="h-7 bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 text-white text-xs px-2 gap-1"
              >
                <Download className="w-3 h-3" />
                Baixar
              </Button>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <p className="text-xs text-gray-400 text-center">
              <span className="font-medium text-gray-300">4K Ultra HD:</span> Melhora resolução e qualidade preservando detalhes
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-9 bg-transparent border-[#4A5F7A] text-gray-300 hover:bg-[#2C3E50] hover:text-white text-sm font-[system-ui,-apple-system,'SF Pro Display',sans-serif]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleUpscale}
            disabled={isLoading}
            className="flex-1 h-9 bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 text-white border-0 text-sm font-semibold font-[system-ui,-apple-system,'SF Pro Display',sans-serif] disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              `Novo Upscale (${getCreditCost()} créditos)`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}