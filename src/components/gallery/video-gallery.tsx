'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Play,
  Download,
  Trash2,
  Eye,
  Clock,
  Film,
  X,
  Calendar,
  CheckCircle,
  Circle
} from 'lucide-react'
import { VideoModal } from './video-modal'

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

interface VideoGalleryProps {
  videos: VideoGeneration[]
  stats: {
    totalVideos: number
    completedVideos: number
    processingVideos: number
    failedVideos: number
    totalCreditsUsed: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  filters: {
    status?: string
    quality?: string
    search?: string
    sort: string
  }
  bulkSelectMode?: boolean
  selectedVideos?: Set<string>
  onToggleVideoSelection?: (videoId: string) => void
  onBulkDelete?: () => void
}

export function VideoGallery({
  videos,
  stats,
  pagination,
  filters,
  bulkSelectMode = false,
  selectedVideos = new Set(),
  onToggleVideoSelection,
  onBulkDelete
}: VideoGalleryProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedVideo, setSelectedVideo] = useState<VideoGeneration | null>(null)
  const [localVideos, setLocalVideos] = useState<VideoGeneration[]>(videos)

  // Update local videos when videos prop changes
  useEffect(() => {
    setLocalVideos(videos)
  }, [videos])

  // Function to update URL parameters
  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    
    // Reset to page 1 when filtering
    if (key !== 'page') {
      params.set('page', '1')
    }
    
    router.push(`/gallery?tab=videos&${params.toString()}`)
  }

  const clearFilters = () => {
    router.push('/gallery?tab=videos')
  }

  const handleVideoDelete = (videoId: string) => {
    setLocalVideos(prev => prev.filter(video => video.id !== videoId))
  }

  const formatDuration = (seconds: number) => {
    return `${seconds}s`
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

  const hasActiveFilters = filters.status || filters.quality || filters.search

  return (
    <div className="space-y-6">
      {/* Videos Grid */}
      {localVideos.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Film className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {hasActiveFilters ? 'Nenhum Vídeo Encontrado' : 'Nenhum Vídeo Ainda'}
            </h3>
            <p className="text-gray-600 mb-6">
              {hasActiveFilters
                ? 'Tente ajustar seus filtros para encontrar vídeos'
                : 'Comece criando vídeos a partir de suas fotos geradas'
              }
            </p>
            {hasActiveFilters ? (
              <Button onClick={clearFilters}>Limpar Filtros</Button>
            ) : (
              <Button asChild>
                <a href="/generate">Gerar Primeira Foto</a>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {localVideos.map((video) => (
              <Card key={video.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group relative">
                {/* Selection Checkbox */}
                {bulkSelectMode && (
                  <div
                    className="absolute top-2 left-2 z-10"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleVideoSelection?.(video.id)
                    }}
                  >
                    {selectedVideos.has(video.id) ? (
                      <CheckCircle className="w-6 h-6 text-blue-600 bg-white rounded-full" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-400 bg-white rounded-full" />
                    )}
                  </div>
                )}

                <div
                  className="relative"
                  onClick={() => {
                    if (bulkSelectMode) {
                      onToggleVideoSelection?.(video.id)
                    } else {
                      setSelectedVideo(video)
                    }
                  }}
                >
                  {/* Thumbnail or Video Preview */}
                  <div className="aspect-video bg-gray-100 flex items-center justify-center relative overflow-hidden">
                    {video.status === 'COMPLETED' && video.videoUrl ? (
                      // Show video thumbnail if available, otherwise use the video itself as preview
                      video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt="Video thumbnail"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={video.videoUrl}
                          className="w-full h-full object-cover"
                          muted
                          poster={video.sourceImageUrl || undefined}
                        />
                      )
                    ) : video.sourceImageUrl ? (
                      // Show source image for processing videos or as fallback
                      <img
                        src={video.sourceImageUrl}
                        alt="Source image"
                        className="w-full h-full object-cover opacity-50"
                      />
                    ) : (
                      // Show placeholder for text-to-video with no source image
                      <div className="w-full h-full flex items-center justify-center bg-gray-200">
                        <Film className="w-16 h-16 text-gray-400" />
                        <div className="ml-2 text-gray-500 text-sm">
                          Vídeo {video.status === 'PROCESSING' ? 'processando' : 'texto para vídeo'}
                        </div>
                      </div>
                    )}
                    
                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center group-hover:bg-opacity-50 transition-all">
                      <div className="bg-white bg-opacity-90 rounded-full p-3">
                        <Play className="w-6 h-6 text-gray-900 ml-0.5" />
                      </div>
                    </div>


                    {/* Progress Bar for Processing */}
                    {video.status === 'PROCESSING' && (
                      <div className="absolute bottom-0 left-0 right-0 bg-white bg-opacity-90 p-2">
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${video.progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{video.progress}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </Card>
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center space-x-2">
              <Button
                variant="outline"
                disabled={pagination.page === 1}
                onClick={() => updateFilter('page', (pagination.page - 1).toString())}
              >
                Anterior
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  const pageNum = i + 1
                  return (
                    <Button
                      key={pageNum}
                      variant={pagination.page === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateFilter('page', pageNum.toString())}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>
              
              <Button
                variant="outline"
                disabled={pagination.page === pagination.pages}
                onClick={() => updateFilter('page', (pagination.page + 1).toString())}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}

      {/* Video Modal */}
      {selectedVideo && !bulkSelectMode && (
        <VideoModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onDelete={handleVideoDelete}
        />
      )}
    </div>
  )
}