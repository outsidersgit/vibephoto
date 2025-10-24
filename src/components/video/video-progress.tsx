'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Video, Clock, X, CheckCircle, AlertCircle, Loader2, Play, Download } from 'lucide-react'
import { VideoStatus } from '@/lib/ai/video/config'
import { formatProcessingTime } from '@/lib/ai/video/utils'

interface VideoProgressProps {
  videoId: string
  initialStatus?: VideoStatus
  onComplete?: (videoUrl: string) => void
  onError?: (error: string) => void
  onCancel?: () => void
  className?: string
  compact?: boolean
}

interface VideoStatusData {
  id: string
  status: VideoStatus
  progress: number
  videoUrl?: string
  thumbnailUrl?: string
  errorMessage?: string
  estimatedTimeRemaining?: number
  duration: number
  aspectRatio: string
  quality: string
  creditsUsed: number
  processingTime?: number
  createdAt: string
  completedAt?: string
  sourceImageUrl: string
  prompt: string
}

export function VideoProgress({
  videoId,
  initialStatus = VideoStatus.STARTING,
  onComplete,
  onError,
  onCancel,
  className = '',
  compact = false
}: VideoProgressProps) {
  const [status, setStatus] = useState<VideoStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch video status
  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/video/status/${videoId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar status')
      }

      setStatus(data)
      setLoading(false)

      // Handle completion
      if (data.status === VideoStatus.COMPLETED && data.videoUrl) {
        if (onComplete) {
          onComplete(data.videoUrl)
        }
        // Stop polling
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }

      // Handle error
      if (data.status === VideoStatus.FAILED) {
        if (onError) {
          onError(data.errorMessage || 'Erro desconhecido')
        }
        // Stop polling
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }

      // Handle cancellation
      if (data.status === VideoStatus.CANCELLED) {
        // Stop polling
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }

    } catch (error) {
      console.error('❌ Error fetching video status:', error)
      setLoading(false)
      
      if (onError) {
        onError(error instanceof Error ? error.message : 'Erro ao buscar status')
      }
    }
  }

  // Start polling for status updates
  useEffect(() => {
    // Initial fetch
    fetchStatus()

    // Only poll if video is still processing
    if ([VideoStatus.STARTING, VideoStatus.PROCESSING].includes(initialStatus)) {
      intervalRef.current = setInterval(fetchStatus, 5000) // Poll every 5 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [videoId])

  // Cancel video generation
  const handleCancel = async () => {
    if (!status) return

    setCancelling(true)

    try {
      const response = await fetch(`/api/video/status/${videoId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao cancelar')
      }

      console.log('✅ Video cancelled:', data)
      
      // Update status immediately
      setStatus(prev => prev ? { ...prev, status: VideoStatus.CANCELLED } : null)
      
      if (onCancel) {
        onCancel()
      }

    } catch (error) {
      console.error('❌ Error cancelling video:', error)
    } finally {
      setCancelling(false)
    }
  }

  // Get status display info
  const getStatusInfo = () => {
    if (!status) {
      return {
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        label: 'Carregando...',
        color: 'text-gray-500',
        bgColor: 'bg-gray-100'
      }
    }

    switch (status.status) {
      case VideoStatus.STARTING:
        return {
          icon: <Clock className="w-4 h-4" />,
          label: 'Aguardando',
          color: 'text-blue-600',
          bgColor: 'bg-blue-100'
        }
      case VideoStatus.PROCESSING:
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          label: 'Processando',
          color: 'text-purple-600',
          bgColor: 'bg-purple-100'
        }
      case VideoStatus.COMPLETED:
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          label: 'Concluído',
          color: 'text-green-600',
          bgColor: 'bg-green-100'
        }
      case VideoStatus.FAILED:
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          label: 'Erro',
          color: 'text-red-600',
          bgColor: 'bg-red-100'
        }
      case VideoStatus.CANCELLED:
        return {
          icon: <X className="w-4 h-4" />,
          label: 'Cancelado',
          color: 'text-gray-600',
          bgColor: 'bg-gray-100'
        }
      default:
        return {
          icon: <Loader2 className="w-4 h-4" />,
          label: status.status,
          color: 'text-gray-500',
          bgColor: 'bg-gray-100'
        }
    }
  }

  const statusInfo = getStatusInfo()

  if (loading && !status) {
    return (
      <Card className={`${compact ? 'p-3' : ''} ${className}`}>
        <CardContent className={compact ? 'p-0' : 'pt-6'}>
          <div className="flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            <span className="text-sm">Carregando status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (compact) {
    return (
      <Card className={`${className} ${statusInfo.bgColor}`}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={statusInfo.color}>
                {statusInfo.icon}
              </div>
              <div>
                <p className="text-sm font-medium">{statusInfo.label}</p>
                {status && (
                  <p className="text-xs text-gray-600 truncate max-w-[200px]">
                    {status.prompt}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {status?.progress !== undefined && status.progress > 0 && (
                <span className="text-xs font-medium">{status.progress}%</span>
              )}

              {status?.status === VideoStatus.COMPLETED && status.videoUrl && (
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" asChild>
                  <a href={status.videoUrl} target="_blank" rel="noopener noreferrer">
                    <Play className="w-3 h-3" />
                  </a>
                </Button>
              )}

              {[VideoStatus.STARTING, VideoStatus.PROCESSING].includes(status?.status as VideoStatus) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={handleCancel}
                  disabled={cancelling}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {status?.progress !== undefined && status.progress > 0 && (
            <div className="mt-2">
              <Progress value={status.progress} className="h-1" />
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center">
          <Video className="w-4 h-4 mr-2 text-purple-600" />
          Gerando Vídeo
        </CardTitle>
        {[VideoStatus.STARTING, VideoStatus.PROCESSING].includes(status?.status as VideoStatus) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={cancelling}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Preview da imagem source */}
        {status?.sourceImageUrl && (
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
            <img 
              src={status.sourceImageUrl} 
              alt="Imagem base" 
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Status e progresso */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={statusInfo.color}>
                {statusInfo.icon}
              </div>
              <Badge variant="outline" className={statusInfo.color}>
                {statusInfo.label}
              </Badge>
            </div>
            
            {status?.progress !== undefined && status.progress > 0 && (
              <span className="text-sm font-medium">{status.progress}%</span>
            )}
          </div>

          {status?.progress !== undefined && status.progress > 0 && (
            <Progress value={status.progress} className="h-2" />
          )}

          {/* Prompt */}
          {status?.prompt && (
            <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              📝 {status.prompt}
            </p>
          )}

          {/* Informações do vídeo */}
          {status && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Duração:</span>
                <span className="ml-1 font-medium">{status.duration}s</span>
              </div>
              <div>
                <span className="text-gray-500">Formato:</span>
                <span className="ml-1 font-medium">{status.aspectRatio}</span>
              </div>
              <div>
                <span className="text-gray-500">Qualidade:</span>
                <span className="ml-1 font-medium">{status.quality}</span>
              </div>
              <div>
                <span className="text-gray-500">Créditos:</span>
                <span className="ml-1 font-medium">{status.creditsUsed}</span>
              </div>
            </div>
          )}

          {/* Tempo restante estimado */}
          {status?.estimatedTimeRemaining && status.estimatedTimeRemaining > 0 && (
            <p className="text-xs text-gray-500">
              ⏱️ Tempo restante: {formatProcessingTime(status.estimatedTimeRemaining)}
            </p>
          )}

          {/* Tempo de processamento (se concluído) */}
          {status?.processingTime && status.status === VideoStatus.COMPLETED && (
            <p className="text-xs text-green-600">
              ✅ Processado em {formatProcessingTime(status.processingTime)}
            </p>
          )}

          {/* Erro */}
          {status?.errorMessage && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
              ❌ {status.errorMessage}
            </p>
          )}

          {/* Botão de reprodução/download */}
          {status?.status === VideoStatus.COMPLETED && status.videoUrl && (
            <div className="flex space-x-2 pt-2">
              <Button className="flex-1" asChild>
                <a href={status.videoUrl} target="_blank" rel="noopener noreferrer">
                  <Play className="w-4 h-4 mr-2" />
                  Reproduzir
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={status.videoUrl} download>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar
                </a>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}