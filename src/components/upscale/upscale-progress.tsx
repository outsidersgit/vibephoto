'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ZoomIn, Clock, X, AlertCircle, CheckCircle, Loader } from 'lucide-react'

interface UpscaleProgressProps {
  jobId: string
  originalImage: string
  scaleFactor: number
  onComplete: (result: { resultImages: string[]; downloadUrl: string }) => void
  onCancel?: () => void
  onError?: (error: string) => void
  className?: string
}

export function UpscaleProgress({
  jobId,
  originalImage,
  scaleFactor,
  onComplete,
  onCancel,
  onError,
  className = ''
}: UpscaleProgressProps) {
  const [status, setStatus] = useState<'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'>('pending')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [estimatedTime, setEstimatedTime] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [resultImages, setResultImages] = useState<string[]>([])

  useEffect(() => {
    let interval: NodeJS.Timeout
    let timeInterval: NodeJS.Timeout
    let timeoutTimer: NodeJS.Timeout
    let cancelled = false
    const MAX_UPSCALE_TIME = 5 * 60 * 1000 // 5 minutos de timeout

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/upscale/status/${jobId}`)
        const data = await response.json()

        if (cancelled) return

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao verificar status')
        }

        setStatus(data.status)
        setProgress(data.progress || 0)
        setEstimatedTime(data.estimatedTime || 0)

        if (data.status === 'succeeded') {
          setResultImages(data.resultImages || [])
          if (data.resultImages && data.resultImages.length > 0) {
            onComplete({
              resultImages: data.resultImages,
              downloadUrl: data.downloadUrl || data.resultImages[0]
            })
          }
          if (interval) clearInterval(interval)
          if (timeInterval) clearInterval(timeInterval)
          if (timeoutTimer) clearTimeout(timeoutTimer)
        } else if (data.status === 'failed') {
          setError(data.error || 'Upscale falhou')
          onError?.(data.error || 'Upscale falhou')
          if (interval) clearInterval(interval)
          if (timeInterval) clearInterval(timeInterval)
          if (timeoutTimer) clearTimeout(timeoutTimer)
        }
      } catch (err) {
        if (cancelled) return
        
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
        setError(errorMessage)
        setStatus('failed')
        onError?.(errorMessage)
        
        if (interval) clearInterval(interval)
        if (timeInterval) clearInterval(timeInterval)
        if (timeoutTimer) clearTimeout(timeoutTimer)
      }
    }

    // Inicia verificação de status
    checkStatus()
    interval = setInterval(checkStatus, 3000) // Verifica a cada 3 segundos

    // Timer para tempo decorrido
    const startTime = Date.now()
    timeInterval = setInterval(() => {
      setElapsedTime(Date.now() - startTime)
    }, 1000)

    // CRITICAL: Timeout de 5 minutos - se não completar, mostrar erro
    timeoutTimer = setTimeout(() => {
      if (!cancelled && status !== 'completed' && status !== 'failed') {
        console.error(`❌ Upscale timeout after ${MAX_UPSCALE_TIME}ms`)
        const timeoutMessage = 'Tempo limite excedido. O processamento pode ter falhado.'
        setError(timeoutMessage)
        setStatus('failed')
        onError?.(timeoutMessage)
        
        if (interval) clearInterval(interval)
        if (timeInterval) clearInterval(timeInterval)
      }
    }, MAX_UPSCALE_TIME)

    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
      if (timeInterval) clearInterval(timeInterval)
      if (timeoutTimer) clearTimeout(timeoutTimer)
    }
  }, [jobId, onComplete, onError])

  const handleCancel = async () => {
    try {
      const response = await fetch(`/api/upscale/status/${jobId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setStatus('cancelled')
        onCancel?.()
      } else {
        const data = await response.json()
        setError(data.error || 'Falha ao cancelar')
      }
    } catch (err) {
      setError('Erro ao cancelar upscale')
    }
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }
    return `${remainingSeconds}s`
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />
      case 'processing':
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'cancelled':
        return <X className="w-5 h-5 text-gray-500" />
      default:
        return <ZoomIn className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-200 border border-yellow-400/20'
      case 'processing':
        return 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-200 border border-blue-400/20'
      case 'completed':
        return 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-200 border border-emerald-400/20'
      case 'failed':
        return 'bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-200 border border-red-400/20'
      case 'cancelled':
        return 'bg-gradient-to-r from-gray-500/20 to-gray-600/20 text-gray-200 border border-gray-400/20'
      default:
        return 'bg-gradient-to-r from-gray-500/20 to-gray-600/20 text-gray-200 border border-gray-400/20'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return '✨ Inicializando upscale...'
      case 'processing':
        return '🚀 Processando com IA...'
      case 'completed':
        return '🎉 Upscale concluído!'
      case 'failed':
        return '❌ Falha no processamento'
      case 'cancelled':
        return '🛑 Cancelado pelo usuário'
      default:
        return '⚠️ Status desconhecido'
    }
  }

  if (status === 'completed') return null // Componente pai deve mostrar resultado

  return (
    <Card className={`w-full bg-[#2C3E50] border-[#34495E] rounded-2xl shadow-lg font-[system-ui,-apple-system,"SF Pro Display",sans-serif] ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between p-6 border-b border-[#34495E]">
        <CardTitle className="flex items-center text-white">
          {getStatusIcon()}
          <span className="ml-3 text-lg font-semibold">Upscale {scaleFactor}x</span>
        </CardTitle>

        <div className="flex items-center space-x-3">
          <Badge className={`px-3 py-1.5 text-xs font-medium rounded-full ${getStatusColor()}`}>
            {getStatusText()}
          </Badge>

          {status === 'processing' && onCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="border-red-400/30 text-red-300 hover:text-red-200 hover:bg-red-500/20 hover:border-red-400/50 transition-all duration-200"
            >
              <X className="w-4 h-4 mr-1" />
              Cancelar
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Preview da imagem original */}
        <div className="flex items-center space-x-4">
          <div className="w-20 h-20 bg-[#34495E] rounded-xl overflow-hidden flex-shrink-0 border border-[#4A5F7A]">
            <img
              src={originalImage}
              alt="Original"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300 font-medium">Progresso do upscale</span>
              <span className="text-white font-semibold">{progress}%</span>
            </div>
            <Progress value={progress} className="h-3 bg-[#34495E] rounded-full" />
          </div>
        </div>

        {/* Informações de tempo */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#34495E]/50 rounded-xl p-4 border border-[#4A5F7A]/30">
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm">Tempo decorrido</span>
              <span className="text-white font-semibold">{formatTime(elapsedTime)}</span>
            </div>
          </div>
          {estimatedTime > 0 && (
            <div className="bg-[#34495E]/50 rounded-xl p-4 border border-[#4A5F7A]/30">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-sm">Tempo estimado</span>
                <span className="text-white font-semibold">{formatTime(estimatedTime)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Mensagem de status detalhada */}
        {status === 'pending' && (
          <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-400/20 rounded-xl p-4">
            <p className="text-sm text-yellow-200 leading-relaxed">
              ⏳ <strong>Seu upscale está na fila de processamento.</strong><br />
              <span className="text-yellow-300/80">Isso pode levar alguns momentos...</span>
            </p>
          </div>
        )}

        {status === 'processing' && (
          <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-400/20 rounded-xl p-4">
            <p className="text-sm text-blue-200 leading-relaxed">
              🚀 <strong>Processando sua imagem com IA de última geração.</strong><br />
              <span className="text-blue-300/80">Aumentando resolução para {scaleFactor}x com qualidade profissional...</span>
            </p>
          </div>
        )}

        {status === 'failed' && error && (
          <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-400/20 rounded-xl p-4">
            <p className="text-sm text-red-200 leading-relaxed">
              ❌ <strong>Falha no processamento:</strong><br />
              <span className="text-red-300/80">{error}</span>
            </p>
            <p className="text-xs text-red-400/80 mt-2 font-medium">
              💰 Seus créditos foram estornados automaticamente.
            </p>
          </div>
        )}

        {status === 'cancelled' && (
          <div className="bg-gradient-to-r from-gray-500/10 to-gray-600/10 border border-gray-400/20 rounded-xl p-4">
            <p className="text-sm text-gray-200 leading-relaxed">
              🛑 <strong>Upscale cancelado pelo usuário.</strong><br />
              <span className="text-gray-300/80">Seus créditos foram estornados.</span>
            </p>
          </div>
        )}

        {/* Dicas durante processamento */}
        {(status === 'pending' || status === 'processing') && (
          <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-400/20 rounded-xl p-4">
            <p className="text-sm text-emerald-200 leading-relaxed">
              💡 <strong>Dica:</strong> Mantenha esta aba aberta para acompanhar o progresso.<br />
              <span className="text-emerald-300/80">O resultado aparecerá automaticamente quando pronto.</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}