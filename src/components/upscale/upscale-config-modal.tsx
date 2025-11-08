'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { X, Sparkles } from 'lucide-react'
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
  const [scaleFactor, setScaleFactor] = useState<string>('2x')
  const [objectDetection, setObjectDetection] = useState<string>('none')
  const comparisonContainerRef = useRef<HTMLDivElement | null>(null)
  const afterImageMaskRef = useRef<HTMLDivElement | null>(null)
  const sliderRef = useRef<HTMLDivElement | null>(null)
  const pointerActiveRef = useRef(false)

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

  const handleUpscale = () => {
    onUpscale(scaleFactor, objectDetection)
  }

  // Calcular custo de créditos
  const getCreditCost = () => getUpscaleCost(1)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] bg-[#34495E] border-[#4A5F7A] p-6 rounded-2xl [&>button]:hidden">
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
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Original Image */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-300 font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
              Imagem Original
            </h3>
            <Card className="bg-[#2C3E50] border-[#4A5F7A] p-3 rounded-xl h-64">
              {imageUrl ? (
                <div className="w-full h-full relative">
                  <img
                    src={imageUrl}
                    alt="Imagem original"
                    className="w-full h-full object-contain rounded-lg"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
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

          {/* Result Image */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-300 font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
              Antes e Depois
            </h3>
            <Card className="bg-[#2C3E50] border-[#4A5F7A] p-3 rounded-xl h-64">
              {resultImageUrl ? (
                <div className="w-full h-full relative select-none touch-none">
                  <div
                    ref={comparisonContainerRef}
                    className="absolute inset-0 rounded-lg overflow-hidden cursor-ew-resize"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  >
                    <img
                      src={imageUrl || resultImageUrl}
                      alt="Imagem original"
                      className="absolute inset-0 w-full h-full object-contain"
                    />
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
                    <div
                      ref={sliderRef}
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md -translate-x-1/2 transition-colors duration-150 pointer-events-none"
                      style={{ left: '50%' }}
                    >
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/25 backdrop-blur-sm border border-white/40 shadow-lg flex items-center justify-center">
                        <div className="w-1 h-6 bg-white rounded-full" />
                      </div>
                    </div>
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      Antes
                    </div>
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      Depois
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  {isLoading ? (
                    <div className="flex flex-col items-center space-y-2">
                      <Sparkles className="w-8 h-8 animate-spin" />
                      <span className="text-xs">Processando...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-12 h-12 bg-white/10 rounded-full">
                      <div className="w-6 h-6 border-2 border-dashed border-gray-400 rounded"></div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Scale Factor */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
              Fator de Escala
            </label>
            <div className="flex gap-1">
              <Button
                variant={scaleFactor === 'none' ? "default" : "outline"}
                onClick={() => setScaleFactor('none')}
                className={`flex-1 h-8 text-xs font-medium font-[system-ui,-apple-system,'SF Pro Display',sans-serif] ${
                  scaleFactor === 'none'
                    ? 'bg-gradient-to-r from-[#667EEA] to-[#764BA2] text-white border-0'
                    : 'bg-[#2C3E50] border-[#4A5F7A] text-gray-300 hover:bg-[#4A5F7A] hover:text-white'
                }`}
              >
                Nenhum
              </Button>
              <Button
                variant={scaleFactor === '2x' ? "default" : "outline"}
                onClick={() => setScaleFactor('2x')}
                className={`flex-1 h-8 text-xs font-medium font-[system-ui,-apple-system,'SF Pro Display',sans-serif] ${
                  scaleFactor === '2x'
                    ? 'bg-gradient-to-r from-[#667EEA] to-[#764BA2] text-white border-0'
                    : 'bg-[#2C3E50] border-[#4A5F7A] text-gray-300 hover:bg-[#4A5F7A] hover:text-white'
                }`}
              >
                2x
              </Button>
              <Button
                variant={scaleFactor === '4x' ? "default" : "outline"}
                onClick={() => setScaleFactor('4x')}
                className={`flex-1 h-8 text-xs font-medium font-[system-ui,-apple-system,'SF Pro Display',sans-serif] ${
                  scaleFactor === '4x'
                    ? 'bg-gradient-to-r from-[#667EEA] to-[#764BA2] text-white border-0'
                    : 'bg-[#2C3E50] border-[#4A5F7A] text-gray-300 hover:bg-[#4A5F7A] hover:text-white'
                }`}
              >
                4x
              </Button>
            </div>
          </div>

          {/* Object Detection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
              Detecção de Objeto
            </label>
            <Select value={objectDetection} onValueChange={setObjectDetection}>
              <SelectTrigger className="h-8 bg-[#2C3E50] border-[#4A5F7A] text-white text-xs font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#2C3E50] border-[#4A5F7A]">
                <SelectItem value="none" className="text-white hover:bg-[#4A5F7A] font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                  Nenhum
                </SelectItem>
                <SelectItem value="all" className="text-white hover:bg-[#4A5F7A] font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                  Todos
                </SelectItem>
                <SelectItem value="foreground" className="text-white hover:bg-[#4A5F7A] font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                  Primeiro Plano
                </SelectItem>
                <SelectItem value="background" className="text-white hover:bg-[#4A5F7A] font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                  Fundo
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

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