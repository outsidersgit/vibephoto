'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, ZoomIn, ZoomOut, Eye, EyeOff, RotateCcw, Share2 } from 'lucide-react'

interface UpscalePreviewProps {
  originalImage: string
  upscaledImage: string
  scaleFactor: number
  onDownload?: () => void
  onShare?: () => void
  onReset?: () => void
  className?: string
}

export function UpscalePreview({
  originalImage,
  upscaledImage,
  scaleFactor,
  onDownload,
  onShare,
  onReset,
  className = ''
}: UpscalePreviewProps) {
  const [showComparison, setShowComparison] = useState(true)
  const [sliderPosition, setSliderPosition] = useState(50)
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [originalInfo, setOriginalInfo] = useState({ width: 0, height: 0 })
  const [upscaledInfo, setUpscaledInfo] = useState({ width: 0, height: 0 })

  // Carrega informações das imagens
  useEffect(() => {
    const loadImageInfo = async () => {
      const loadImage = (src: string): Promise<{ width: number; height: number }> => {
        return new Promise((resolve) => {
          const img = new Image()
          img.onload = () => resolve({ width: img.width, height: img.height })
          img.src = src
        })
      }

      try {
        const [original, upscaled] = await Promise.all([
          loadImage(originalImage),
          loadImage(upscaledImage)
        ])
        
        setOriginalInfo(original)
        setUpscaledInfo(upscaled)
      } catch (error) {
        console.error('Error loading image info:', error)
      }
    }

    if (originalImage && upscaledImage) {
      loadImageInfo()
    }
  }, [originalImage, upscaledImage])

  const handleSliderChange = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSliderPosition(percentage)
  }

  const handleMouseDown = () => setIsDragging(true)
  const handleMouseUp = () => setIsDragging(false)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
        setSliderPosition(percentage)
      }
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      onDownload?.()
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  return (
    <Card className={`w-full ${className}`}>
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <ZoomIn className="w-5 h-5 mr-2 text-green-600" />
          Resultado do Upscale {scaleFactor}x
        </CardTitle>
        
        <div className="flex items-center space-x-2">
          {/* Toggle comparação */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowComparison(!showComparison)}
          >
            {showComparison ? (
              <>
                <EyeOff className="w-4 h-4 mr-2" />
                Ocultar Original
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Comparar
              </>
            )}
          </Button>

          {/* Controles de zoom */}
          <div className="flex items-center space-x-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Badge variant="outline" className="text-xs">
              {Math.round(zoom * 100)}%
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(Math.min(3, zoom + 0.25))}
              disabled={zoom >= 3}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Comparação antes/depois */}
        {showComparison ? (
          <div className="space-y-4">
            {/* Slider de comparação */}
            <div 
              ref={containerRef}
              className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden cursor-col-resize"
              onMouseDown={handleMouseDown}
              onClick={handleSliderChange}
            >
              {/* Imagem original */}
              <div 
                className="absolute inset-0"
                style={{ 
                  clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)`,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left'
                }}
              >
                <img
                  src={originalImage}
                  alt="Original"
                  className="w-full h-full object-contain"
                  onLoadStart={() => setImageLoading(true)}
                  onLoad={() => setImageLoading(false)}
                />
                <div className="absolute top-2 left-2">
                  <Badge className="bg-blue-600 text-white">
                    Original ({originalInfo.width}×{originalInfo.height})
                  </Badge>
                </div>
              </div>

              {/* Imagem upscalada */}
              <div 
                className="absolute inset-0"
                style={{ 
                  clipPath: `polygon(${sliderPosition}% 0, 100% 0, 100% 100%, ${sliderPosition}% 100%)`,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left'
                }}
              >
                <img
                  src={upscaledImage}
                  alt="Upscaled"
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-2 right-2">
                  <Badge className="bg-green-600 text-white">
                    Upscaled {scaleFactor}x ({upscaledInfo.width}×{upscaledInfo.height})
                  </Badge>
                </div>
              </div>

              {/* Linha divisória */}
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg cursor-col-resize z-10"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center">
                  <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
                </div>
              </div>

              {/* Loading overlay */}
              {imageLoading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
                </div>
              )}
            </div>

            {/* Controle do slider */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Original</span>
              <div className="flex-1 relative">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderPosition}
                  onChange={(e) => setSliderPosition(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
              <span className="text-sm text-gray-600">Upscaled</span>
            </div>
          </div>
        ) : (
          /* Vista única do resultado */
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden relative">
            <img
              src={upscaledImage}
              alt="Upscaled result"
              className="w-full h-full object-contain"
              style={{ 
                transform: `scale(${zoom})`,
                transformOrigin: 'center'
              }}
            />
            <div className="absolute top-2 right-2">
              <Badge className="bg-green-600 text-white">
                {scaleFactor}x ({upscaledInfo.width}×{upscaledInfo.height})
              </Badge>
            </div>
          </div>
        )}

        {/* Informações técnicas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="font-medium text-blue-900">Original</div>
            <div className="text-blue-700">{originalInfo.width}×{originalInfo.height}</div>
            <div className="text-xs text-blue-600">
              {((originalInfo.width * originalInfo.height) / 1000000).toFixed(1)}MP
            </div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="font-medium text-green-900">Upscaled</div>
            <div className="text-green-700">{upscaledInfo.width}×{upscaledInfo.height}</div>
            <div className="text-xs text-green-600">
              {((upscaledInfo.width * upscaledInfo.height) / 1000000).toFixed(1)}MP
            </div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="font-medium text-purple-900">Fator</div>
            <div className="text-purple-700">{scaleFactor}x</div>
            <div className="text-xs text-purple-600">Ampliação</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="font-medium text-orange-900">Melhoria</div>
            <div className="text-orange-700">{scaleFactor * scaleFactor}x</div>
            <div className="text-xs text-orange-600">Pixels totais</div>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            onClick={() => downloadImage(upscaledImage, `upscaled_${scaleFactor}x_${Date.now()}.png`)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Upscaled
          </Button>
          
          <Button
            variant="outline"
            onClick={() => downloadImage(originalImage, `original_${Date.now()}.png`)}
          >
            <Download className="w-4 h-4 mr-2" />
            Download Original
          </Button>

          {onShare && (
            <Button variant="outline" onClick={onShare}>
              <Share2 className="w-4 h-4 mr-2" />
              Compartilhar
            </Button>
          )}

          {onReset && (
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Novo Upscale
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}