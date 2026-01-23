'use client'

import { useRef, useCallback, useEffect } from 'react'
import { Download } from 'lucide-react'

interface ImagePreviewSliderProps {
  resultUrl: string
  originalUrl?: string
  onDownload?: () => void
}

export function ImagePreviewSlider({
  resultUrl,
  originalUrl,
  onDownload
}: ImagePreviewSliderProps) {
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
  }, [applySliderPosition, resultUrl, originalUrl])

  useEffect(() => {
    return () => {
      document.body.style.userSelect = ''
    }
  }, [])

  // Se não houver imagem original, mostrar apenas o resultado
  if (!originalUrl) {
    return (
      <div className="relative w-full bg-gray-100">
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="absolute right-16 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-gray-900 shadow-sm transition-all duration-200 ease-in-out hover:bg-white hover:ring-2 hover:ring-[#3b82f6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2"
          >
            <Download className="w-3 h-3" />
            Baixar
          </button>
        )}
        <img
          src={resultUrl}
          alt="Resultado gerado"
          className="w-full h-auto max-h-[85vh] object-contain"
        />
      </div>
    )
  }

  // Slider de comparação antes/depois
  return (
    <div className="relative w-full bg-gray-100 select-none" style={{ touchAction: 'none' }}>
      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          className="absolute right-16 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-gray-900 shadow-sm transition-all duration-200 ease-in-out hover:bg-white hover:ring-2 hover:ring-[#3b82f6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2"
        >
          <Download className="w-3 h-3" />
          Baixar
        </button>
      )}

      <div
        ref={comparisonContainerRef}
        className="relative w-full cursor-ew-resize"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Imagem original (antes) */}
        <img
          src={originalUrl}
          alt="Original"
          className="w-full h-auto max-h-[85vh] object-contain"
        />

        {/* Imagem resultado (depois) - com clip path */}
        <div
          ref={afterImageMaskRef}
          className="absolute inset-0"
          style={{ clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)' }}
        >
          <img
            src={resultUrl}
            alt="Resultado"
            className="w-full h-auto max-h-[85vh] object-contain"
          />
        </div>

        {/* Linha divisória do slider com alto contraste */}
        <div
          ref={sliderRef}
          className="absolute top-0 bottom-0 w-1 -translate-x-1/2 pointer-events-none z-10"
          style={{
            left: '50%',
            background: 'linear-gradient(to right, rgba(0,0,0,0.5) 0%, rgba(255,255,255,0.9) 40%, rgba(255,255,255,0.9) 60%, rgba(0,0,0,0.5) 100%)',
            boxShadow: '0 0 10px rgba(0,0,0,0.5), 0 0 20px rgba(255,255,255,0.3)'
          }}
        >
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border-2 border-gray-800 flex items-center justify-center"
            style={{ boxShadow: '0 0 0 3px rgba(255,255,255,0.3), 0 4px 12px rgba(0,0,0,0.5)' }}
          >
            <div className="flex gap-0.5">
              <div className="w-0.5 h-4 bg-gray-800 rounded-full" />
              <div className="w-0.5 h-4 bg-gray-800 rounded-full" />
            </div>
          </div>
        </div>

        {/* Labels antes/depois - centralizados verticalmente */}
        <div className="absolute top-1/2 -translate-y-1/2 left-6 bg-black/80 text-white text-sm px-3 py-1.5 rounded-lg pointer-events-none z-10 font-medium shadow-lg">
          Antes
        </div>
        <div className="absolute top-1/2 -translate-y-1/2 right-24 bg-black/80 text-white text-sm px-3 py-1.5 rounded-lg pointer-events-none z-10 font-medium shadow-lg">
          Depois
        </div>
      </div>
    </div>
  )
}
