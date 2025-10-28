'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Filter, 
  Grid3X3, 
  List, 
  SortDesc, 
  Download, 
  Heart,
  Share2,
  Trash2,
  Image,
  Calendar,
  Eye,
  ChevronDown,
  X
} from 'lucide-react'
import { GalleryGrid } from './gallery-grid'
import { GalleryList } from './gallery-list'
import { GalleryStats } from './gallery-stats'
import { FilterPanel } from './filter-panel'
import { ImageModal } from './image-modal'
import { UpscaleModal } from '@/components/upscale/upscale-modal'
import { UpscaleProgress } from '@/components/upscale/upscale-progress'
import { UpscalePreview } from '@/components/upscale/upscale-preview'
import { combineAllMediaItems, generationToMediaItems, editHistoryToMediaItems, videoToMediaItems } from '@/lib/utils/media-transformers'
import { MediaItem } from '@/types'

interface GalleryInterfaceProps {
  generations: any[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  models: any[]
  stats: {
    totalGenerations: number
    completedGenerations: number
    totalImages: number
    favoriteImages: number
    collections: number
  }
  filters: {
    model?: string
    search?: string
    sort: string
    view: string
    page: number
  }
}

export function GalleryInterface({ 
  generations, 
  pagination, 
  models, 
  stats, 
  filters 
}: GalleryInterfaceProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  
  const [searchQuery, setSearchQuery] = useState(filters.search || '')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [bulkSelectMode, setBulkSelectMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'generated' | 'edited' | 'videos'>('generated')
  const [editedImages, setEditedImages] = useState<any[]>([])
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  // Upscale states
  const [upscaleModal, setUpscaleModal] = useState({
    isOpen: false,
    imageUrl: '',
    generation: null
  })
  const [activeUpscale, setActiveUpscale] = useState<{
    jobId: string
    originalImage: string
    scaleFactor: number
  } | null>(null)
  const [upscaleResult, setUpscaleResult] = useState<{
    originalImage: string
    upscaledImage: string
    scaleFactor: number
  } | null>(null)

  const sortOptions = [
    { value: 'newest', label: 'Mais Recentes' },
    { value: 'oldest', label: 'Mais Antigas' },
    { value: 'model', label: 'Por Modelo' },
    { value: 'prompt', label: 'Por Prompt' }
  ]

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
    
    router.push(`/gallery?${params.toString()}`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilter('search', searchQuery || null)
  }

  const clearFilters = () => {
    router.push('/gallery')
    setSearchQuery('')
  }

  const handleBulkAction = (action: string) => {
    switch (action) {
      case 'download':
        // Implement bulk download
        console.log('Bulk download:', selectedImages)
        break
      case 'favorite':
        // Implement bulk favorite
        console.log('Bulk favorite:', selectedImages)
        break
      case 'delete':
        // Implement bulk delete
        console.log('Bulk delete:', selectedImages)
        break
    }
    
    setSelectedImages([])
    setBulkSelectMode(false)
  }

  const toggleImageSelection = (imageUrl: string) => {
    setSelectedImages(prev =>
      prev.includes(imageUrl)
        ? prev.filter(url => url !== imageUrl)
        : [...prev, imageUrl]
    )
  }

  // Delete handler
  const handleDelete = async (generationId: string) => {
    // Refresh gallery after deletion
    window.location.reload()
  }

  // Upscale functions
  const handleOpenUpscale = async (imageUrl: string, generation?: any) => {
    // Check if the URL is a temporary Replicate URL (will be expired)
    const isReplicateUrl = imageUrl.includes('replicate.delivery') || imageUrl.includes('pbxt.replicate.delivery')
    
    if (isReplicateUrl && generation) {
      const shouldRecover = confirm(
        'Esta imagem usa uma URL temporária que pode ter expirado. Deseja tentar recuperar a imagem permanentemente antes do upscale?'
      )
      
      if (shouldRecover) {
        try {
          const response = await fetch('/api/images/recover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ generationId: generation.id })
          })
          
          const result = await response.json()
          
          if (result.success && result.recovered) {
            alert(`Imagem recuperada com sucesso! Agora você pode fazer o upscale.`)
            // Use the new permanent URL
            const newImageUrl = result.imageUrls[0]
            setUpscaleModal({
              isOpen: true,
              imageUrl: newImageUrl,
              generation
            })
            // Reload the page to show updated URLs
            window.location.reload()
            return
          } else if (response.status === 410) {
            alert('As imagens expiraram e não podem mais ser recuperadas. Gere novas imagens.')
            return
          } else {
            alert(`Falha na recuperação: ${result.error}. Você pode tentar novamente ou gerar novas imagens.`)
            return
          }
        } catch (error) {
          console.error('Recovery error:', error)
          alert('Erro ao tentar recuperar a imagem. Tente novamente ou gere novas imagens.')
          return
        }
      } else {
        alert('Upscale cancelado. Para fazer upscale, é necessário ter URLs permanentes.')
        return
      }
    }
    
    // No need to check image availability with fetch/HEAD since:
    // 1. If image is displayed in gallery, it's accessible
    // 2. CORS restrictions can block HEAD requests while allowing img tags
    // 3. The upscale API will validate the URL anyway
    setUpscaleModal({
      isOpen: true,
      imageUrl,
      generation
    })
  }

  const handleCloseUpscale = () => {
    setUpscaleModal({
      isOpen: false,
      imageUrl: '',
      generation: null
    })
  }

  const handleStartUpscale = async (options: any) => {
    try {
      const requestBody = {
        imageUrl: upscaleModal.imageUrl,
        options: options
      }
      
      
      const response = await fetch('/api/upscale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao iniciar upscale')
      }

      // Start monitoring upscale progress
      setActiveUpscale({
        jobId: data.jobIds?.[0] || data.jobId,
        originalImage: upscaleModal.imageUrl,
        scaleFactor: options.scale_factor || 2
      })

      // Clear modal
      setUpscaleModal({
        isOpen: false,
        imageUrl: '',
        generation: null
      })

    } catch (error) {
      console.error('Error starting upscale:', error)
      alert('Erro ao iniciar upscale: ' + (error instanceof Error ? error.message : 'Erro desconhecido'))
    }
  }

  const handleUpscaleComplete = (result: { resultImages: string[]; downloadUrl: string }) => {
    if (activeUpscale && result.resultImages?.length > 0) {
      setUpscaleResult({
        originalImage: activeUpscale.originalImage,
        upscaledImage: result.resultImages[0],
        scaleFactor: activeUpscale.scaleFactor
      })
    }
    setActiveUpscale(null)
  }

  const handleUpscaleCancel = () => {
    setActiveUpscale(null)
  }

  const handleUpscaleError = (error: string) => {
    alert('Erro no upscale: ' + error)
    setActiveUpscale(null)
  }

  const handleResetUpscale = () => {
    setUpscaleResult(null)
  }

  // Load specific data for each tab
  const loadEditedImages = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/gallery/edited?page=${filters.page}&limit=20${filters.search ? `&search=${filters.search}` : ''}`)
      const data = await response.json()

      if (data.success) {
        setEditedImages(data.data)
      }
    } catch (error) {
      console.error('Error loading edited images:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadVideos = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/gallery/videos?page=${filters.page}&limit=20${filters.search ? `&search=${filters.search}` : ''}`)
      const data = await response.json()

      if (data.success) {
        setVideos(data.data)
      }
    } catch (error) {
      console.error('Error loading videos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load data when tab changes
  // ✅ Adicionado controle para evitar carregamentos desnecessários
  useEffect(() => {
    if (activeTab === 'edited') {
      loadEditedImages()
    } else if (activeTab === 'videos') {
      loadVideos()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filters.page, filters.search])

  // Get current data based on active tab
  const getCurrentData = (): MediaItem[] => {
    switch (activeTab) {
      case 'edited':
        return editHistoryToMediaItems(editedImages)
      case 'videos':
        return videoToMediaItems(videos)
      case 'generated':
      default:
        // Show regular generated images (not edited or upscaled)
        const filteredGenerations = generations.filter(generation => {
          if (generation.operationType) {
            return generation.operationType === 'generation'
          }
          // Legacy fallback: exclude only edited (include upscaled in generated tab)
          return !generation.prompt?.startsWith('[EDITED]')
        })
        return generationToMediaItems(filteredGenerations)
    }
  }

  const currentData = getCurrentData()

  const hasActiveFilters = filters.model || filters.search

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <GalleryStats stats={stats} />

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('generated')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === 'generated'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            🎨 Fotos Geradas ({generations.filter(g => !g.prompt?.startsWith('[EDITED]') && !g.prompt?.startsWith('[UPSCALED]')).length})
          </button>
          <button
            onClick={() => setActiveTab('edited')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === 'edited'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            ✨ Fotos Editadas ({editedImages.length})
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === 'videos'
                ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            🎬 Vídeos ({videos.length})
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por prompt, nome do modelo..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      updateFilter('search', null)
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </form>

            {/* Filter Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  Ativo
                </Badge>
              )}
            </Button>

            {/* View Toggle */}
            <div className="flex border border-gray-300 rounded-md">
              <Button
                variant={filters.view === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => updateFilter('view', 'grid')}
                className="rounded-r-none"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={filters.view === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => updateFilter('view', 'list')}
                className="rounded-l-none"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={filters.sort}
                onChange={(e) => updateFilter('sort', e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-md px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-200">
              <span className="text-sm text-gray-600">Filtros ativos:</span>
              
              {filters.model && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Modelo: {models.find(m => m.id === filters.model)?.name}
                  <button onClick={() => updateFilter('model', null)}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              
              {filters.search && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Busca: "{filters.search}"
                  <button onClick={() => updateFilter('search', null)}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpar todos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter Panel */}
      {showFilters && (
        <FilterPanel
          models={models}
          selectedModel={filters.model}
          onModelSelect={(modelId) => updateFilter('model', modelId)}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Bulk Actions */}
      {bulkSelectMode && selectedImages.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="font-medium text-blue-900">
                  {selectedImages.length} imagem{selectedImages.length !== 1 ? 'ns' : ''} selecionada{selectedImages.length !== 1 ? 's' : ''}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedImages([])
                    setBulkSelectMode(false)
                  }}
                >
                  Cancelar Seleção
                </Button>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('download')}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Baixar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('favorite')}
                >
                  <Heart className="w-4 h-4 mr-1" />
                  Favoritar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleBulkAction('delete')}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Excluir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gallery Content */}
      {currentData.length === 0 && !loading ? (
        <Card className="text-center py-12">
          <CardContent>
            <h3 className="text-xl font-semibold text-gray-900 mb-2" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
              {hasActiveFilters ? 'Nenhum Resultado Encontrado' : 'Nenhuma Foto Ainda'}
            </h3>
            <p className="text-gray-600 mb-6" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
              {hasActiveFilters
                ? 'Tente ajustar seus filtros ou termos de busca'
                : 'Comece gerando fotos com IA para construir sua galeria'
              }
            </p>
            {hasActiveFilters ? (
              <Button onClick={clearFilters} style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>Limpar Filtros</Button>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                <Button asChild className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-0">
                  <a href="/generate" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>Gere Sua Primeira Foto</a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/editor" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>✨ Editar com IA</a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Toggle Bulk Select */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Mostrando {currentData.length} de {currentData.length} {
                activeTab === 'generated' ? 'fotos geradas' :
                activeTab === 'edited' ? 'fotos editadas' : 'vídeos'
              }
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkSelectMode(!bulkSelectMode)}
            >
              {bulkSelectMode ? 'Sair' : 'Selecionar'} Múltiplas
            </Button>
          </div>

          {/* Gallery Grid or List */}
          {currentData.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <h3 className="text-xl font-semibold text-gray-900 mb-2" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                  {activeTab === 'generated' ? 'Nenhuma Foto Gerada' :
                   activeTab === 'edited' ? 'Nenhuma Foto Editada' : 'Nenhum Vídeo'}
                </h3>
                <p className="text-gray-600 mb-6" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                  {activeTab === 'generated' ? 'Comece gerando fotos com IA para construir sua galeria' :
                   activeTab === 'edited' ? 'Edite suas fotos existentes com nosso Editor IA' :
                   'Crie vídeos incríveis a partir de suas fotos'}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                  {activeTab === 'generated' ? (
                    <>
                      <Button asChild className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-0">
                        <a href="/generate" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>Gere Sua Primeira Foto</a>
                      </Button>
                      <Button variant="outline" onClick={() => setActiveTab('edited')} style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                        Ver Fotos Editadas
                      </Button>
                    </>
                  ) : activeTab === 'edited' ? (
                    <>
                      <Button asChild className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-0">
                        <a href="/editor" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>✨ Editar com IA</a>
                      </Button>
                      <Button variant="outline" onClick={() => setActiveTab('generated')} style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                        Ver Fotos Geradas
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button asChild className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-0">
                        <a href="/video" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>🎬 Criar Vídeo</a>
                      </Button>
                      <Button variant="outline" onClick={() => setActiveTab('generated')} style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                        Ver Fotos Geradas
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">Carregando...</p>
                </div>
              ) : (
                <>
                  {filters.view === 'grid' ? (
                    <GalleryGrid
                      mediaItems={currentData}
                      bulkSelectMode={bulkSelectMode}
                      selectedImages={selectedImages}
                      onImageSelect={toggleImageSelection}
                      onImageClick={setSelectedImage}
                      onUpscale={handleOpenUpscale}
                    />
                  ) : (
                    <GalleryList
                      mediaItems={currentData}
                      bulkSelectMode={bulkSelectMode}
                      selectedImages={selectedImages}
                      onImageSelect={toggleImageSelection}
                      onImageClick={setSelectedImage}
                      onUpscale={handleOpenUpscale}
                    />
                  )}
                </>
              )}
            </>
          )}

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

      {/* Image Modal */}
      {selectedImage && (() => {
        const mediaItem = currentData.find(item => item.url === selectedImage)
        if (!mediaItem) return null

        return (
          <ImageModal
            mediaItem={mediaItem}
            allImages={currentData}
            onClose={() => setSelectedImage(null)}
            onUpscale={handleOpenUpscale}
            onDelete={handleDelete}
            userPlan={session?.user?.plan || 'FREE'}
          />
        )
      })()}

      {/* Upscale Modal */}
      {upscaleModal.isOpen && (
        <UpscaleModal
          isOpen={upscaleModal.isOpen}
          imageUrl={upscaleModal.imageUrl}
          generation={upscaleModal.generation}
          onClose={handleCloseUpscale}
          onUpscale={handleStartUpscale}
          userPlan={session?.user?.plan || 'FREE'}
        />
      )}

      {/* Upscale Progress */}
      {activeUpscale && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md">
          <UpscaleProgress
            jobId={activeUpscale.jobId}
            originalImage={activeUpscale.originalImage}
            scaleFactor={activeUpscale.scaleFactor}
            onComplete={handleUpscaleComplete}
            onCancel={handleUpscaleCancel}
            onError={handleUpscaleError}
          />
        </div>
      )}

      {/* Upscale Result */}
      {upscaleResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <UpscalePreview
              originalImage={upscaleResult.originalImage}
              upscaledImage={upscaleResult.upscaledImage}
              scaleFactor={upscaleResult.scaleFactor}
              onReset={handleResetUpscale}
            />
          </div>
        </div>
      )}
    </div>
  )
}