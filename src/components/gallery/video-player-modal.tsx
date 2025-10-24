'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Download,
  Heart,
  Share2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  RotateCw,
  Copy,
  ExternalLink,
  Info,
  ChevronDown,
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
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()

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

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => setIsPlaying(false)

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

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
    }
  }, [mediaItem.url, mediaItem.id])

  const togglePlayPause = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play()
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

  const handleShare = async (action?: string) => {
    switch (action) {
      case 'instagram':
        const instagramUrl = `https://www.instagram.com/create/story/?url=${encodeURIComponent(mediaItem.url)}`
        window.open(instagramUrl, '_blank')
        break
      case 'tiktok':
        const tiktokUrl = `https://www.tiktok.com/upload?url=${encodeURIComponent(mediaItem.url)}`
        window.open(tiktokUrl, '_blank')
        break
      case 'whatsapp':
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Confira este vídeo incrível! ${mediaItem.url}`)}`
        window.open(whatsappUrl, '_blank')
        break
      default:
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'AI Generated Video',
              text: 'Confira este vídeo incrível gerado por IA',
              url: mediaItem.url
            })
          } catch (error) {
            navigator.clipboard.writeText(mediaItem.url)
            alert('Video URL copied to clipboard!')
          }
        } else {
          navigator.clipboard.writeText(mediaItem.url)
          alert('Video URL copied to clipboard!')
        }
    }
    setShowShareMenu(false)
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
        />

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
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className="text-white hover:bg-white hover:bg-opacity-20"
                >
                  <Share2 className="w-4 h-4 mr-1" />
                  Share
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>

                {showShareMenu && (
                  <div className="absolute bottom-full left-0 mb-2 bg-black bg-opacity-90 border border-gray-600 rounded-lg shadow-lg min-w-48">
                    <div className="py-1">
                      <button
                        onClick={() => handleShare('instagram')}
                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white hover:bg-opacity-20 flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <defs>
                            <linearGradient id="instagram-gradient-video" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#833ab4" />
                              <stop offset="50%" stopColor="#fd1d1d" />
                              <stop offset="100%" stopColor="#fcb045" />
                            </linearGradient>
                          </defs>
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="url(#instagram-gradient-video)" />
                          <rect x="4" y="4" width="16" height="16" rx="3" ry="3" stroke="white" strokeWidth="2" fill="none" />
                          <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2" fill="none" />
                          <circle cx="17.5" cy="6.5" r="1.5" fill="white" />
                        </svg>
                        <span>Instagram</span>
                      </button>
                      <button
                        onClick={() => handleShare('tiktok')}
                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white hover:bg-opacity-20 flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white">
                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-.88-.05A6.33 6.33 0 0 0 5.76 20.8a6.34 6.34 0 0 0 10.86-4.43V8.56a8.16 8.16 0 0 0 4.77 1.53v-3.4a4.85 4.85 0 0 1-1.8 0z"/>
                        </svg>
                        <span>TikTok</span>
                      </button>
                      <button
                        onClick={() => handleShare('whatsapp')}
                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white hover:bg-opacity-20 flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#25D366">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.893 3.488"/>
                        </svg>
                        <span>WhatsApp</span>
                      </button>
                      <hr className="border-gray-600 my-1" />
                      <button
                        onClick={() => handleShare()}
                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white hover:bg-opacity-20 flex items-center space-x-2"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>Compartilhar geral</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
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