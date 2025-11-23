'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Download,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Check,
  Clock,
  Calendar,
  Film,
  Image as ImageIcon,
  ExternalLink,
  Heart,
  Eye,
  Trash2,
  AlertCircle
} from 'lucide-react'
import { calculateOperationCost, getCostDescription } from '@/lib/utils/cost-calculator'

interface VideoGeneration {
  id: string
  sourceImageUrl: string
  sourceGenerationId: string | null
  prompt: string
  negativePrompt: string | null
  duration: number
  aspectRatio: string
  quality: 'standard' | 'pro'
  template: string | null
  status: 'STARTING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  videoUrl: string | null
  thumbnailUrl: string | null
  creditsUsed: number
  progress: number
  errorMessage: string | null
  processingTime: number | null
  fileSize: number | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  startedAt: string | null
  sourceGeneration?: {
    id: string
    prompt: string
    imageUrls: any[]
  } | null
}

interface VideoModalProps {
  video: VideoGeneration
  onClose: () => void
  onDelete?: (videoId: string) => void
}

export function VideoModal({ video, onClose, onDelete }: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showFullPrompt, setShowFullPrompt] = useState(false)
  const [showSourceImage, setShowSourceImage] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  // SEMPRE usar proxy para evitar erro CORS até CloudFront estar configurado
  const [videoSrc, setVideoSrc] = useState<string>(
    video.id ? `/api/videos/${video.id}/stream` : (video.videoUrl || '')
  )
  const [isUsingProxy, setIsUsingProxy] = useState(true)
  const [triedProxy, setTriedProxy] = useState(true)

  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    // Configurar para streaming progressivo - NUNCA carregar tudo de uma vez
    // Usar 'metadata' para carregar apenas metadados (duração) mas não o vídeo completo
    videoElement.preload = 'metadata'
    videoElement.setAttribute('preload', 'metadata')

    const updateTime = () => setCurrentTime(videoElement.currentTime)
    const updateDuration = () => {
      setDuration(videoElement.duration)
    }

    // Carregar apenas metadados (duração) quando necessário
    const handleLoadedMetadata = () => {
      setDuration(videoElement.duration)
    }

    // Monitorar progresso sem carregar tudo
    const handleProgress = () => {
      // O navegador fará streaming progressivo automaticamente com preload="none"
      // Não precisamos fazer nada aqui, apenas monitorar
    }

    // Prevenir carregamento completo antes de play
    const handleLoadStart = () => {
      // Apenas carrega quando usuário clica em play (preload="none")
    }

    videoElement.addEventListener('timeupdate', updateTime)
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata)
    videoElement.addEventListener('progress', handleProgress)
    videoElement.addEventListener('loadstart', handleLoadStart)
    videoElement.addEventListener('ended', () => setIsPlaying(false))

    // Não usar canplaythrough pois isso pode forçar carregamento completo
    // Usar canplay que indica que pode começar a tocar com dados mínimos

    // Limpar ao desmontar
    return () => {
      videoElement.removeEventListener('timeupdate', updateTime)
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata)
      videoElement.removeEventListener('progress', handleProgress)
      videoElement.removeEventListener('loadstart', handleLoadStart)
      // Pausar e resetar o vídeo ao desmontar para economizar banda
      videoElement.pause()
      videoElement.currentTime = 0
      // Não remover src para evitar re-requests desnecessários
      // Apenas resetar para estado inicial
      videoElement.load()
    }
  }, [isPlaying])

  const togglePlay = async () => {
    const videoElement = videoRef.current
    if (!videoElement) return

    if (isPlaying) {
      videoElement.pause()
      setIsPlaying(false)
    } else {
      // IMPORTANTE: Configurar para streaming progressivo ANTES de qualquer carregamento
      videoElement.preload = 'none'
      videoElement.setAttribute('preload', 'none')
      
      // Garantir que não há src configurado até agora (evita carregamento automático)
      // O navegador fará HTTP Range Requests automaticamente quando necessário
      // Isso permite streaming progressivo - carrega apenas chunks necessários
      
      try {
        // Tentar reproduzir - o navegador automaticamente fará range requests progressivos
        // Não carrega tudo de uma vez quando preload="none"
        
        // Se não tem dados suficientes, esperar canplay primeiro
        if (videoElement.readyState < 2) {
          // Não tem dados suficientes, carregar primeiro
          const playOnCanPlay = () => {
            if (videoElement.readyState >= 2) {
              videoElement.play()
                .then(() => setIsPlaying(true))
                .catch(e => {
                  console.error('Erro ao reproduzir vídeo após canplay:', e)
                  // Tentar novamente após loadeddata
                  videoElement.addEventListener('loadeddata', () => {
                    videoElement.play()
                      .then(() => setIsPlaying(true))
                      .catch(err => console.error('Erro ao reproduzir vídeo após loadeddata:', err))
                  }, { once: true })
                })
            }
            videoElement.removeEventListener('canplay', playOnCanPlay)
          }
          
          videoElement.addEventListener('canplay', playOnCanPlay, { once: true })
          videoElement.load() // Inicia carregamento
        } else {
          // Já tem dados suficientes, reproduzir direto
          await videoElement.play()
          setIsPlaying(true)
        }
      } catch (err: any) {
        console.error('Erro ao iniciar reprodução:', err)
        // Se play() falhou, tentar novamente após carregar
        const playOnLoadedData = () => {
      videoElement.play()
            .then(() => setIsPlaying(true))
            .catch(e => console.error('Erro ao reproduzir vídeo após loadeddata:', e))
          videoElement.removeEventListener('loadeddata', playOnLoadedData)
        }
        
        videoElement.addEventListener('loadeddata', playOnLoadedData, { once: true })
        videoElement.load()
      }
    }
  }

  const toggleMute = () => {
    const videoElement = videoRef.current
    if (!videoElement) return

    videoElement.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const toggleFullscreen = () => {
    const videoElement = videoRef.current
    if (!videoElement) return

    if (!isFullscreen) {
      videoElement.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
    setIsFullscreen(!isFullscreen)
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const videoElement = videoRef.current
    if (!videoElement || !duration) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const newTime = (clickX / rect.width) * duration
    
    videoElement.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleDownload = async () => {
    if (video.videoUrl) {
      try {
        // Mostrar indicador de download - vídeo completo só baixa quando solicitado
        const downloadButton = document.querySelector('[aria-label="Baixar vídeo"], [title="Baixar vídeo"]')
        if (downloadButton) {
          (downloadButton as HTMLElement).style.opacity = '0.5'
          ;(downloadButton as HTMLElement).style.pointerEvents = 'none'
        }

        // Usar proxy se estiver disponível, senão usar URL direta
        const downloadUrl = isUsingProxy ? `/api/videos/${video.id}/stream` : video.videoUrl

        // Baixar o vídeo completo apenas quando usuário solicitar
        const response = await fetch(downloadUrl, {
          method: 'GET',
          headers: {
            'Accept': 'video/mp4',
          },
        })
        
        if (!response.ok) {
          throw new Error('Erro ao baixar vídeo')
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        // Generate filename
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
        const promptSlug = video.prompt?.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_') || 'video'
        a.download = `vibephoto_video_${promptSlug}_${timestamp}.mp4`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        // Restaurar botão
        if (downloadButton) {
          (downloadButton as HTMLElement).style.opacity = '1'
          ;(downloadButton as HTMLElement).style.pointerEvents = 'auto'
        }
      } catch (error) {
        console.error('Download failed:', error)
        // Fallback to opening in new tab
        window.open(video.videoUrl, '_blank')
      }
    }
  }

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const errorCode = e.currentTarget.error?.code
    const errorMessage = e.currentTarget.error?.message || 'Unknown error'
    console.error('❌ [VIDEO_MODAL] Error loading video:', {
      videoUrl: videoSrc,
      error: e.currentTarget.error,
      errorCode,
      errorMessage,
      isUsingProxy,
      triedProxy
    })
    
    // Se não tentou proxy ainda e teve erro, tentar fallback para proxy
    if (!triedProxy && !isUsingProxy && video.videoUrl && video.id) {
      console.log('🔄 [VIDEO_MODAL] Trying proxy fallback...')
      setTriedProxy(true)
      setIsUsingProxy(true)
      const proxyUrl = `/api/videos/${video.id}/stream`
      console.log('🔄 [VIDEO_MODAL] Switching to proxy URL:', proxyUrl)
      setVideoSrc(proxyUrl)
      setVideoError(null)
      
      // Recarregar vídeo com nova URL após um pequeno delay
      setTimeout(() => {
        if (videoRef.current) {
          console.log('🔄 [VIDEO_MODAL] Reloading video with proxy URL')
          videoRef.current.load()
        }
      }, 100)
      return
    }
    
    // Se já tentou proxy e ainda deu erro, mostrar mensagem
    if (triedProxy && errorCode && errorCode !== 1) {
      console.error('❌ [VIDEO_MODAL] Proxy also failed, showing error to user')
    }
    
    // Só mostra erro se for um erro real (não erro temporário de carregamento)
    // Error code 1 = MEDIA_ERR_ABORTED: Media loading aborted (não é erro real)
    if (errorCode && errorCode !== 1) {
      let userError = 'Erro ao carregar vídeo.'
      if (errorCode === 4) {
        userError = 'Vídeo não encontrado ou URL expirada.'
      } else if (errorCode === 3) {
        userError = 'Formato de vídeo não suportado.'
      } else if (errorCode === 2) {
        userError = 'Erro de rede ao carregar vídeo.'
      }
      
      // Se já tentou proxy, adicionar informação extra
      if (triedProxy) {
        userError += ' (Tentativa de fallback também falhou)'
      }
      
      setVideoError(userError)
    }
  }

  const handleFavorite = async () => {
    try {
      // For now, just toggle the state - in a real app this would make an API call
      setIsFavorited(!isFavorited)

      // Uncomment when API endpoint is ready:
      // const response = await fetch(`/api/videos/${video.id}/favorite`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ favorite: !isFavorited })
      // })
      // if (!response.ok) {
      //   setIsFavorited(isFavorited) // Revert on error
      // }
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
      setIsFavorited(isFavorited) // Revert on error
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/videos/${video.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao deletar vídeo')
      }

      onDelete(video.id)
      onClose()
    } catch (error) {
      console.error('Failed to delete video:', error)
      alert('Erro ao deletar vídeo. Tente novamente.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800'
      case 'STARTING':
        return 'bg-yellow-100 text-yellow-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'Concluído'
      case 'PROCESSING':
        return 'Processando'
      case 'STARTING':
        return 'Iniciando'
      case 'FAILED':
        return 'Falhou'
      case 'CANCELLED':
        return 'Cancelado'
      default:
        return status
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const truncatePrompt = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="max-w-5xl w-full max-h-[90vh] bg-[#2C3E50] rounded-xl shadow-2xl border border-[#34495E] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-end p-4 border-b border-[#34495E]">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-[#34495E]">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
          {/* Video Player */}
          <div className="lg:col-span-2 space-y-4">
            {video.status === 'COMPLETED' && video.videoUrl ? (
              videoError ? (
                <div className="aspect-video bg-red-50 rounded-lg flex flex-col items-center justify-center space-y-4 p-6">
                  <AlertCircle className="w-16 h-16 text-red-600" />
                  <div className="text-center space-y-2">
                    <p className="text-red-900 font-semibold text-lg">{videoError}</p>
                    <p className="text-red-700 text-sm">URL: {video.videoUrl?.substring(0, 80)}...</p>
                    <Button 
                      onClick={() => {
                        console.log('🔄 [VIDEO_MODAL] User clicked retry')
                        setVideoError(null)
                        setTriedProxy(false)
                        setIsUsingProxy(false)
                        setVideoSrc(video.videoUrl || '')
                        setTimeout(() => {
                          if (videoRef.current) {
                            console.log('🔄 [VIDEO_MODAL] Reloading video after retry')
                            videoRef.current.load()
                          }
                        }, 100)
                      }}
                      variant="outline"
                      className="mt-4"
                    >
                      Tentar Novamente
                    </Button>
                  </div>
                </div>
              ) : (
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  src={videoSrc}
                  poster={video.thumbnailUrl || video.sourceImageUrl}
                  className="w-full aspect-video object-contain"
                  onClick={togglePlay}
                  crossOrigin="anonymous"
                  playsInline
                  onError={handleVideoError}
                  onLoadStart={() => {
                    console.log('🎬 [VIDEO_MODAL] Starting to load video:', videoSrc?.substring(0, 100), `(using proxy: ${isUsingProxy})`)
                    // Limpa erro anterior ao tentar carregar novamente
                    setVideoError(null)
                  }}
                  onCanPlay={() => {
                    console.log('✅ [VIDEO_MODAL] Video can play', `(using proxy: ${isUsingProxy})`)
                    // Limpa erro quando conseguir reproduzir
                    setVideoError(null)
                  }}
                  onLoadedMetadata={() => console.log('✅ [VIDEO_MODAL] Video metadata loaded', `(using proxy: ${isUsingProxy})`)}
                  preload="metadata"
                  controls={false}
                  muted={isMuted}
                  disablePictureInPicture
                  disableRemotePlayback
                />
                
                {/* Overlay de loading */}
                {(!duration || duration === 0) && !videoError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-center space-y-2">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
                      <p className="text-white text-sm">Carregando vídeo...</p>
                    </div>
                  </div>
                )}
                
                {/* Fallback: se o vídeo não carregar, mostrar mensagem */}
                {!video.videoUrl && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                    <p className="text-center p-4">Vídeo não disponível</p>
                  </div>
                )}

                {/* Video Controls */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                  {/* Progress Bar */}
                  <div 
                    className="w-full h-1 bg-white bg-opacity-30 rounded-full cursor-pointer mb-3"
                    onClick={handleSeek}
                  >
                    <div 
                      className="h-full bg-white rounded-full"
                      style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                    />
                  </div>

                  {/* Control Buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={togglePlay}
                        className="text-white hover:text-gray-300 transition-colors"
                      >
                        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                      </button>
                      
                      <button
                        onClick={toggleMute}
                        className="text-white hover:text-gray-300 transition-colors"
                      >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </button>

                      <span className="text-white text-sm">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    <button
                      onClick={toggleFullscreen}
                      className="text-white hover:text-gray-300 transition-colors"
                    >
                      <Maximize className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
              )
            ) : video.status === 'PROCESSING' ? (
              <div className="aspect-video bg-gray-100 rounded-lg flex flex-col items-center justify-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                <div className="text-center space-y-2">
                  <p className="text-gray-900 font-medium">Processando vídeo...</p>
                  <p className="text-gray-600 text-sm">Progresso: {video.progress}%</p>
                  <div className="w-64 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${video.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : video.status === 'FAILED' ? (
              <div className="aspect-video bg-red-50 rounded-lg flex flex-col items-center justify-center space-y-4">
                <X className="w-12 h-12 text-red-600" />
                <div className="text-center space-y-2">
                  <p className="text-red-900 font-medium">Falha no processamento</p>
                  {video.errorMessage && (
                    <p className="text-red-700 text-sm max-w-md">{video.errorMessage}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="aspect-video bg-gray-100 rounded-lg flex flex-col items-center justify-center">
                <img
                  src={video.sourceImageUrl}
                  alt="Source"
                  className="w-full h-full object-cover opacity-50"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Clock className="w-12 h-12 text-gray-400" />
                </div>
              </div>
            )}

            {/* Source Image - compact version */}
            {video.sourceImageUrl ? (
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-white text-sm flex items-center">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Imagem de Origem
                </h3>
                <div className="flex items-center space-x-2">
                  <img
                    src={video.sourceImageUrl}
                    alt="Thumbnail da imagem original"
                    className="w-12 h-12 object-cover rounded border border-[#4A5F7A] cursor-pointer hover:border-[#5DADE2] transition-colors"
                    onClick={() => setShowSourceImage(true)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSourceImage(true)}
                    className="text-xs text-gray-300 hover:text-white hover:bg-[#34495E]"
                  >
                    Ver Imagem
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <span className="text-xs text-gray-400">Vídeo gerado com texto</span>
              </div>
            )}

            {/* Source Image Modal */}
            {showSourceImage && video.sourceImageUrl && (
              <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50" onClick={() => setShowSourceImage(false)}>
                <div className="max-w-4xl max-h-[90vh] p-4">
                  <img
                    src={video.sourceImageUrl}
                    alt="Imagem original"
                    className="max-w-full max-h-full object-contain rounded-lg"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSourceImage(false)}
                    className="absolute top-4 right-4 text-white hover:bg-black hover:bg-opacity-50"
                  >
                    <X className="w-6 h-6" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Video Info */}
          <div className="space-y-4">
            {/* Actions - Gallery Style Tools */}
            {video.videoUrl && video.status === 'COMPLETED' && (
              <div className="flex justify-center relative">
                <div className="flex items-center gap-2">
                  {/* Download Tool */}
                  <button
                    onClick={handleDownload}
                    className="w-8 h-8 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                    title="Baixar vídeo"
                  >
                    <Download className="w-4 h-4 text-gray-700" />
                  </button>

                  {/* Favorite Tool */}
                  <button
                    onClick={handleFavorite}
                    className={`w-8 h-8 rounded-lg shadow-lg flex items-center justify-center transition-colors ${
                      isFavorited
                        ? 'bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90'
                        : 'bg-white hover:bg-gray-100'
                    }`}
                    title="Favoritar"
                  >
                    <Heart className={`w-4 h-4 ${isFavorited ? 'text-white fill-current' : 'text-gray-700'}`} />
                  </button>

                  {/* Delete Tool */}
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-8 h-8 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-red-50 hover:shadow-md transition-colors"
                    title="Deletar vídeo"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>

              </div>
            )}

            {/* Video Details */}
            <Card className="border-[#34495E] bg-[#34495E]">
              <CardContent className="p-3 space-y-3">
                <h3 className="font-medium text-white text-sm">Detalhes</h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Duração:</span>
                    <span className="font-medium text-white">{video.duration}s</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-300">Proporção:</span>
                    <span className="font-medium text-white">{video.aspectRatio}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-300">Qualidade:</span>
                    <span className="font-medium text-white">1080p</span>
                  </div>


                  <div className="flex justify-between">
                    <span className="text-gray-300">Data:</span>
                    <span className="font-medium text-white">{new Date(video.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>

                  {video.fileSize && (
                    <div className="flex justify-between">
                      <span className="text-gray-300">Tamanho:</span>
                      <span className="font-medium text-white">{formatFileSize(video.fileSize)}</span>
                    </div>
                  )}

                  {video.processingTime && (
                    <div className="flex justify-between">
                      <span className="text-gray-300">Tempo de processamento:</span>
                      <span className="font-medium text-white">{Math.round(video.processingTime / 1000)}s</span>
                    </div>
                  )}

                  {/* Cost Information */}
                  <div className="flex justify-between">
                    <span className="text-gray-300">Custo:</span>
                    <span className="font-medium text-white">
                      {getCostDescription('video', { duration: video.duration, estimatedCost: video.creditsUsed })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Prompt */}
            <Card className="border-[#34495E] bg-[#34495E]">
              <CardContent className="p-3 space-y-2">
                <h3 className="font-medium text-white text-sm">Prompt</h3>
                <div className="text-xs text-gray-300 bg-[#2C3E50] p-2 rounded-md">
                  <p className={showFullPrompt ? '' : 'line-clamp-3'}>
                    {video.prompt}
                  </p>
                  {video.prompt.length > 100 && (
                    <button
                      onClick={() => setShowFullPrompt(!showFullPrompt)}
                      className="text-[#5DADE2] hover:text-[#4A90C2] mt-1 text-xs"
                    >
                      {showFullPrompt ? 'menos' : 'mais'}
                    </button>
                  )}
                </div>

                {video.negativePrompt && (
                  <>
                    <h4 className="font-medium text-white text-xs">Prompt Negativo</h4>
                    <p className="text-xs text-gray-300 bg-[#2C3E50] p-2 rounded-md line-clamp-2">
                      {video.negativePrompt}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Deletar Vídeo</h3>
                <p className="text-sm text-gray-600">Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <p className="text-gray-700 mb-6">
              Tem certeza que deseja deletar este vídeo permanentemente?
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? 'Deletando...' : 'Deletar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}