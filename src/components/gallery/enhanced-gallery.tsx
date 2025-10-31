'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMediaApi, useMediaUrls } from '@/hooks/useMediaApi'
import { 
  Play,
  Image as ImageIcon,
  Clock,
  CheckCircle,
  AlertCircle,
  Download,
  Eye,
  RefreshCw,
  Filter,
  Film
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface EnhancedGalleryProps {
  type?: 'image' | 'video' | 'all'
  status?: string
  modelId?: string
  autoRefresh?: boolean
}

export function EnhancedGallery({ 
  type = 'all', 
  status,
  modelId,
  autoRefresh = true 
}: EnhancedGalleryProps) {
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  const { data, loading, error, refresh, getMediaUrl } = useMediaApi({
    page,
    limit: 20,
    status,
    type,
    modelId,
    autoRefresh,
    refreshInterval: 30000
  })
  
  const { getMediaUrl: getCachedMediaUrl, isLoading: isUrlLoading } = useMediaUrls()

  const [mediaUrls, setMediaUrls] = useState<Map<string, string[]>>(new Map())

  // Load media URLs for visible items
  // ✅ Removido mediaUrls das dependências para evitar loop infinito
  useEffect(() => {
    if (!data?.items) return

    const loadUrls = async () => {
      const urlPromises = data.items
        .filter(item => item.status === 'COMPLETED' && item.urls.length > 0)
        .map(async (item) => {
          if (!mediaUrls.has(item.id)) {
            const urls = await getCachedMediaUrl(item.id)
            if (urls.length > 0) {
              setMediaUrls(prev => new Map(prev).set(item.id, urls))
            }
          }
        })

      await Promise.all(urlPromises)
    }

    loadUrls()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.items, getCachedMediaUrl])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'PROCESSING':
        return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />
      case 'FAILED':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'PROCESSING':
        return 'bg-yellow-100 text-yellow-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleMediaClick = async (mediaId: string) => {
    const urlData = await getMediaUrl(mediaId)
    if (urlData) {
      setSelectedMedia(mediaId)
      // Here you could open a modal or navigate to detail view
      console.log('Media clicked:', urlData)
    }
  }

  const handleDownload = async (mediaId: string, prompt: string) => {
    const urlData = await getMediaUrl(mediaId)
    if (urlData && urlData.urls.length > 0) {
      const url = urlData.urls[0]
      const link = document.createElement('a')
      link.href = url
      link.download = `generated-${prompt.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}.${urlData.isVideo ? 'mp4' : 'jpg'}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-500 mr-2" />
        <span className="text-gray-600">Carregando galeria...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
        <p className="text-red-600 mb-4">Erro ao carregar galeria: {error}</p>
        <Button onClick={refresh} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <ImageIcon className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma mídia encontrada</h3>
        <p className="text-gray-500">Comece gerando algumas imagens ou vídeos!</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      {data.statistics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{data.statistics.total}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{data.statistics.completed}</div>
              <div className="text-sm text-gray-600">Concluídas</div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{data.statistics.processing}</div>
              <div className="text-sm text-gray-600">Processando</div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{data.statistics.failed}</div>
              <div className="text-sm text-gray-600">Falharam</div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{data.statistics.images}</div>
              <div className="text-sm text-gray-600">Imagens</div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">{data.statistics.videos}</div>
              <div className="text-sm text-gray-600">Vídeos</div>
            </div>
          </Card>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            onClick={refresh}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Badge variant="secondary">
            {data.pagination.totalCount} itens
          </Badge>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {data.items.map((item) => {
          const displayUrls = mediaUrls.get(item.id) || item.urls
          const displayThumbnails = mediaUrls.get(item.id) || item.thumbnailUrls
          
          return (
            <div key={item.id} className="space-y-3">
              {/* Item Header */}
              <div className="p-3 bg-white rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(item.status)}
                    <Badge variant="secondary" className={getStatusColor(item.status)}>
                      {item.status}
                    </Badge>
                    <Badge variant="outline">
                      {item.type === 'video' ? <Play className="w-3 h-3 mr-1" /> : <ImageIcon className="w-3 h-3 mr-1" />}
                      {item.type}
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
                
                <p className="text-sm text-gray-700 truncate" title={item.prompt}>
                  {item.prompt}
                </p>
                
                {item.model && (
                  <p className="text-xs text-gray-500 mt-1">
                    Modelo: {item.model.name}
                  </p>
                )}
                
                {item.processingTime && (
                  <p className="text-xs text-gray-500">
                    Tempo: {(item.processingTime / 1000).toFixed(1)}s
                  </p>
                )}
              </div>

              {/* Media Display */}
              {item.status === 'COMPLETED' && displayUrls.length > 0 ? (
                <div className="grid gap-2">
                  {displayUrls.map((url, index) => (
                    <div
                      key={`${item.id}-${index}`}
                      className="relative group cursor-pointer"
                    >
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                        {item.type === 'video' ? (
                          // Sempre usar thumbnail/poster - vídeo completo só carrega no modal
                          displayThumbnails[index] ? (
                            <img
                              src={displayThumbnails[index]}
                              alt="Video thumbnail"
                            className="w-full h-full object-cover"
                              loading="lazy"
                            onClick={() => handleMediaClick(item.id)}
                          />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-200">
                              <Film className="w-12 h-12 text-gray-400" />
                            </div>
                          )
                        ) : (
                          <img
                            src={displayThumbnails[index] || url}
                            alt={`Generated ${item.type} ${index + 1}`}
                            className="w-full h-full object-cover"
                            onClick={() => handleMediaClick(item.id)}
                            loading="lazy"
                          />
                        )}
                      </div>

                      {/* Hover Actions */}
                      <div className="absolute inset-0 bg-black bg-opacity-30 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 w-8 p-0"
                            onClick={() => handleMediaClick(item.id)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 w-8 p-0"
                            onClick={() => handleDownload(item.id, item.prompt)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Loading Overlay */}
                      {isUrlLoading(item.id) && (
                        <div className="absolute inset-0 bg-white bg-opacity-75 rounded-lg flex items-center justify-center">
                          <RefreshCw className="w-6 h-6 animate-spin text-gray-500" />
                        </div>
                      )}

                      {/* Video Indicator */}
                      {item.type === 'video' && (
                        <div className="absolute top-2 right-2">
                          <Play className="w-6 h-6 text-white drop-shadow-lg" />
                        </div>
                      )}

                      {/* Duration for videos */}
                      {item.type === 'video' && item.duration && (
                        <div className="absolute bottom-2 right-2">
                          <Badge variant="secondary" className="text-xs">
                            {item.duration}s
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : item.status === 'PROCESSING' ? (
                <Card className="aspect-square">
                  <CardContent className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-pulse" />
                      <p className="text-sm text-gray-600">Processando...</p>
                      <p className="text-xs text-gray-500">~30 segundos</p>
                    </div>
                  </CardContent>
                </Card>
              ) : item.status === 'FAILED' ? (
                <Card className="aspect-square border-red-200 bg-red-50">
                  <CardContent className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                      <p className="text-sm text-red-600">Falhou</p>
                      <p className="text-xs text-red-500">Tente novamente</p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <Button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={!data.pagination.hasPreviousPage}
            variant="outline"
          >
            Anterior
          </Button>
          <span className="text-sm text-gray-600">
            Página {data.pagination.page} de {data.pagination.totalPages}
          </span>
          <Button
            onClick={() => setPage(p => p + 1)}
            disabled={!data.pagination.hasNextPage}
            variant="outline"
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}