'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Download,
  Heart,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  RotateCw,
  ExternalLink,
  Info,
  SkipBack,
  SkipForward
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { MediaItem } from '@/types'

interface VideoPlayerModalProps {
  mediaItem: MediaItem
  onClose: () => void
}

export function VideoPlayerModal({ mediaItem, onClose }: VideoPlayerModalProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [showInfo, setShowInfo] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      // Configurar para streaming progressivo
      // Usar 'metadata' para carregar apenas metadados (duração) mas não o vídeo completo
      video.preload = 'metadata'
      video.setAttribute('preload', 'metadata')
    }
  }, [mediaItem.url])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          if (isFullscreen) {
            exitFullscreen()
          } else {
            onClose()
          }
          break
        case ' ':
          e.preventDefault()
          togglePlayPause()
          break
        case 'ArrowLeft':
          e.preventDefault()
          seekVideo(-10)
          break
        case 'ArrowRight':
          e.preventDefault()
          seekVideo(10)
          break
        case 'ArrowUp':
          e.preventDefault()
          adjustVolume(0.1)
          break
        case 'ArrowDown':
          e.preventDefault()
          adjustVolume(-0.1)
          break
        case 'm':
        case 'M':
          toggleMute()
          break
        case 'f':
        case 'F':
          toggleFullscreen()
          break
        case 'i':
        case 'I':
          setShowInfo(!showInfo)
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isFullscreen, showInfo])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setIsLoading(false)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
    }

    const handlePlay = () => {
      setIsPlaying(true)
      setIsLoading(false)
    }
    
    const handlePause = () => {
      setIsPlaying(false)
    }
    
    const handleEnded = () => {
      setIsPlaying(false)
    }
    
    const handleCanPlay = () => {
      setIsLoading(false)
    }
    
    const handleWaiting = () => {
      setIsLoading(true)
    }

    const handleError = () => {
      setError('Error loading video')
      setIsLoading(false)
      console.error('VideoPlayerModal: Error loading video:', mediaItem.url)

      // Log error for monitoring
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          message: 'Video loading error in player modal',
          metadata: { mediaItemId: mediaItem.id, videoUrl: mediaItem.url }
        })
      }).catch(() => {}) // Silent fail for logging
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('waiting', handleWaiting)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('waiting', handleWaiting)
    }
  }, [mediaItem.url, mediaItem.id])

  const togglePlayPause = async () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
    } else {
      // Reproduzir - o navegador fará HTTP Range Requests automaticamente
      // Isso permite streaming progressivo (carrega apenas chunks necessários)
      try {
        // Se não tem dados suficientes, esperar canplay primeiro
        if (video.readyState < 2) {
          // Não tem dados suficientes, carregar primeiro
          setIsLoading(true)
          const playOnCanPlay = () => {
            if (video.readyState >= 2) {
              video.play()
                .then(() => {
                  setIsPlaying(true)
                  setIsLoading(false)
                })
                .catch(e => {
                  console.error('Erro ao reproduzir vídeo após canplay:', e)
                  setIsLoading(false)
                  setError('Erro ao reproduzir vídeo')
                })
            }
            video.removeEventListener('canplay', playOnCanPlay)
          }
          
          video.addEventListener('canplay', playOnCanPlay, { once: true })
          video.load() // Inicia carregamento
        } else {
          // Já tem dados suficientes, reproduzir direto
          await video.play()
          setIsPlaying(true)
          setIsLoading(false)
        }
      } catch (err: any) {
        console.error('Erro ao iniciar reprodução:', err)
        setIsLoading(false)
        setError(err.message || 'Erro ao reproduzir vídeo')
        
        // Tentar novamente após loadeddata
        const playOnLoadedData = () => {
      video.play()
            .then(() => {
              setIsPlaying(true)
              setIsLoading(false)
              setError(null)
            })
            .catch(e => {
              console.error('Erro ao reproduzir vídeo após loadeddata:', e)
              setError('Erro ao reproduzir vídeo')
            })
          video.removeEventListener('loadeddata', playOnLoadedData)
        }
        
        video.addEventListener('loadeddata', playOnLoadedData, { once: true })
        video.load()
      }
    }
  }

  const seekVideo = (seconds: number) => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds))
  }

  const adjustVolume = (delta: number) => {
    const newVolume = Math.max(0, Math.min(1, volume + delta))
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
    if (newVolume === 0) {
      setIsMuted(true)
    } else if (isMuted) {
      setIsMuted(false)
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return

    const newMuted = !isMuted
    setIsMuted(newMuted)
    video.muted = newMuted
  }

  const toggleFullscreen = async () => {
    if (!containerRef.current) return

    try {
      if (!isFullscreen) {
        await containerRef.current.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }

  const exitFullscreen = async () => {
    try {
      await document.exitFullscreen()
      setIsFullscreen(false)
    } catch (error) {
      console.error('Exit fullscreen error:', error)
    }
  }

  const handleProgressClick = (e: React.MouseEvent) => {
    const video = videoRef.current
    const progressBar = e.currentTarget
    if (!video || !progressBar) return

    const rect = progressBar.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    video.currentTime = percentage * duration
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = mediaItem.url
    link.download = `video-${mediaItem.id}.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const showControlsWithTimeout = () => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
      }
    }, 3000)
  }

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="text-center text-white">
          <div className="mb-4 text-6xl">⚠️</div>
          <h3 className="text-xl font-semibold mb-2">Video Loading Error</h3>
          <p className="text-gray-400 mb-4">Unable to load the video file</p>
          <Button
            variant="outline"
            onClick={() => window.open(mediaItem.url, '_blank')}
            className="text-white border-white hover:bg-white hover:text-black"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in New Tab
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 bg-black z-50 flex flex-col ${isFullscreen ? '' : 'bg-opacity-90'}`}
      onMouseMove={showControlsWithTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Header - Hidden in fullscreen when controls are hidden */}
      {(!isFullscreen || showControls) && (
        <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-50 p-4 z-10 transition-opacity duration-300">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="bg-purple-600">
                Video
              </Badge>
              {mediaItem.metadata?.duration && (
                <span className="text-sm text-gray-300">
                  {Math.round(mediaItem.metadata.duration)}s
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInfo(!showInfo)}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <Info className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Video Container */}
      <div className="flex-1 flex items-center justify-center relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>Loading video...</p>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          src={mediaItem.url}
          className="max-w-full max-h-full"
          onClick={togglePlayPause}
          poster={mediaItem.thumbnailUrl}
          preload="metadata"
          controls={false}
          muted
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          onError={(e) => {
            console.error('Erro no elemento de vídeo:', e)
            setError('Erro ao carregar vídeo')
            setIsLoading(false)
          }}
        >
          <source src={mediaItem.url} type="video/mp4" />
          Seu navegador não suporta reprodução de vídeo.
        </video>
        
        {/* Fallback: se o vídeo não carregar, mostrar mensagem */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
            <div className="text-center p-4">
              <p className="mb-2">{error}</p>
              <Button onClick={() => {
                setError(null)
                setIsLoading(true)
                if (videoRef.current) {
                  videoRef.current.load()
                }
              }}>
                Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {/* Play/Pause Overlay */}
        {!isLoading && showControls && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Button
              size="lg"
              variant="ghost"
              onClick={togglePlayPause}
              className="w-20 h-20 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-70 pointer-events-auto"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8" />
              ) : (
                <Play className="w-8 h-8 ml-1" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Controls - Hidden in fullscreen when not hovering */}
      {(!isFullscreen || showControls) && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4 z-10 transition-opacity duration-300">
          {/* Progress Bar */}
          <div className="mb-4">
            <div
              className="w-full h-2 bg-gray-600 rounded-full cursor-pointer"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-white rounded-full transition-all duration-150"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-300 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-white">
            {/* Left Controls */}
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => seekVideo(-10)}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePlayPause}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => seekVideo(10)}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <SkipForward className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMute}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <Maximize className="w-4 h-4" />
              </Button>
            </div>

            {/* Right Controls */}
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => console.log('Toggle favorite')}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <Heart className="w-4 h-4 mr-1" />
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(mediaItem.url, '_blank')}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Open
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Info Panel */}
      {showInfo && (
        <div className="absolute top-16 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg max-w-sm z-10">
          <h3 className="font-semibold mb-3">Video Details</h3>

          <div className="space-y-3 text-sm">
            <div>
              <div className="text-gray-300">Type:</div>
              <div>AI Generated Video</div>
            </div>

            {mediaItem.metadata && (
              <>
                {mediaItem.metadata.duration && (
                  <div>
                    <div className="text-gray-300">Duration:</div>
                    <div>{Math.round(mediaItem.metadata.duration)} seconds</div>
                  </div>
                )}

                {mediaItem.metadata.width && mediaItem.metadata.height && (
                  <div>
                    <div className="text-gray-300">Resolution:</div>
                    <div>{mediaItem.metadata.width} × {mediaItem.metadata.height}</div>
                  </div>
                )}

                {mediaItem.metadata.sizeBytes && (
                  <div>
                    <div className="text-gray-300">Size:</div>
                    <div>{(mediaItem.metadata.sizeBytes / 1024 / 1024).toFixed(1)} MB</div>
                  </div>
                )}
              </>
            )}

            <div>
              <div className="text-gray-300">Status:</div>
              <div className="capitalize">{mediaItem.status.toLowerCase()}</div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-600 text-xs text-gray-400">
            <div>Spacebar: Play/Pause</div>
            <div>← →: Seek 10s</div>
            <div>↑ ↓: Volume</div>
            <div>F: Fullscreen</div>
            <div>M: Mute</div>
            <div>I: Toggle info</div>
          </div>
        </div>
      )}
    </div>
  )
}