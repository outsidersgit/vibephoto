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
  Share2,
  Copy,
  Check,
  Clock,
  Calendar,
  Film,
  Image as ImageIcon,
  ExternalLink,
  Heart,
  Eye,
  ChevronDown,
  MoreHorizontal,
  Trash2
} from 'lucide-react'
import { InstagramIcon, TikTokIcon, WhatsAppIcon, TelegramIcon, GmailIcon } from '@/components/ui/social-icons'
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
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [showShareSubmenu, setShowShareSubmenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    const updateTime = () => setCurrentTime(videoElement.currentTime)
    const updateDuration = () => setDuration(videoElement.duration)

    videoElement.addEventListener('timeupdate', updateTime)
    videoElement.addEventListener('loadedmetadata', updateDuration)
    videoElement.addEventListener('ended', () => setIsPlaying(false))

    return () => {
      videoElement.removeEventListener('timeupdate', updateTime)
      videoElement.removeEventListener('loadedmetadata', updateDuration)
    }
  }, [])

  const togglePlay = () => {
    const videoElement = videoRef.current
    if (!videoElement) return

    if (isPlaying) {
      videoElement.pause()
    } else {
      videoElement.play()
    }
    setIsPlaying(!isPlaying)
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

  const handleShare = async (platform: string) => {
    if (!video.videoUrl) return

    const promptText = video.prompt || 'AI Generated Video'
    const videoUrl = video.videoUrl

    try {
      switch (platform) {
        case 'instagram':
          window.open(`https://www.instagram.com/create/story/?url=${encodeURIComponent(videoUrl)}`, '_blank')
          break
        case 'tiktok':
          window.open(`https://www.tiktok.com/upload?url=${encodeURIComponent(videoUrl)}`, '_blank')
          break
        case 'whatsapp':
          window.open(`https://wa.me/?text=${encodeURIComponent(`Olha esse vídeo incrível gerado por IA! ${videoUrl}`)}`, '_blank')
          break
        case 'telegram':
          window.open(`https://t.me/share/url?url=${encodeURIComponent(videoUrl)}&text=${encodeURIComponent(promptText)}`, '_blank')
          break
        case 'gmail':
          const gmailSubject = encodeURIComponent('Vídeo Incrível Gerado por IA')
          const gmailBody = encodeURIComponent(`Olha esse vídeo incrível que foi gerado por IA:\n\n${promptText}\n\n${videoUrl}`)
          window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${gmailSubject}&body=${gmailBody}`, '_blank')
          break
        case 'copy':
          await navigator.clipboard.writeText(videoUrl)
          alert('Link copiado para a área de transferência!')
          break
        default:
          if (navigator.share) {
            await navigator.share({
              title: 'AI Generated Video',
              text: promptText,
              url: videoUrl
            })
          } else {
            await navigator.clipboard.writeText(videoUrl)
            alert('Video URL copied to clipboard!')
          }
      }
    } catch (error) {
      console.error('Share failed:', error)
      // Fallback to copy
      try {
        await navigator.clipboard.writeText(videoUrl)
        alert('Link copiado para a área de transferência!')
      } catch (copyError) {
        console.error('Copy failed:', copyError)
      }
    }
    setShowShareMenu(false)
    setShowShareSubmenu(false)
  }

  const handleDownload = async () => {
    if (video.videoUrl) {
      try {
        const response = await fetch(video.videoUrl)
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
      } catch (error) {
        console.error('Download failed:', error)
        // Fallback to opening in new tab
        window.open(video.videoUrl, '_blank')
      }
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
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  src={video.videoUrl}
                  poster={video.thumbnailUrl || video.sourceImageUrl}
                  className="w-full aspect-video object-contain"
                  onClick={togglePlay}
                />

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

                  {/* Share Tool */}
                  <div className="relative">
                    <button
                      onClick={() => setShowShareMenu(!showShareMenu)}
                      className="w-8 h-8 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                      title="Compartilhar"
                    >
                      <Share2 className="w-4 h-4 text-gray-700" />
                    </button>

                    {showShareMenu && (
                      <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl min-w-48 z-50">
                        <div className="py-1">
                          <button
                            onClick={() => handleShare('instagram')}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <InstagramIcon size={16} />
                            <span>Instagram</span>
                          </button>
                          <button
                            onClick={() => handleShare('tiktok')}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <TikTokIcon size={16} />
                            <span>TikTok</span>
                          </button>
                          <button
                            onClick={() => handleShare('whatsapp')}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <WhatsAppIcon size={16} />
                            <span>WhatsApp</span>
                          </button>

                          <hr className="border-gray-200 my-1" />

                          {/* Outros Compartilhamentos Submenu */}
                          <div className="relative">
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
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
                              <div className="bg-gray-50 border-t border-gray-200">
                                <button
                                  onClick={() => handleShare('gmail')}
                                  className="w-full px-8 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                >
                                  <GmailIcon size={16} />
                                  <span>Gmail</span>
                                </button>
                                <button
                                  onClick={() => handleShare('copy')}
                                  className="w-full px-8 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                >
                                  <Copy className="w-4 h-4" />
                                  <span>Copiar Link</span>
                                </button>
                                <button
                                  onClick={() => handleShare('telegram')}
                                  className="w-full px-8 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                >
                                  <TelegramIcon size={16} />
                                  <span>Telegram</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Backdrop to close share menu */}
                {showShareMenu && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setShowShareMenu(false)
                      setShowShareSubmenu(false)
                    }}
                  />
                )}
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
                      {getCostDescription('video', { duration: video.duration })}
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