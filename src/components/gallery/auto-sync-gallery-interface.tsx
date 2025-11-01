'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'
import { useToast } from '@/hooks/use-toast'
import { useGalleryData, useDeleteGeneration, useDeleteEditHistory, useBulkDeleteVideos } from '@/hooks/useGalleryData'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthGuard } from '@/hooks/useAuthGuard'
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
  ChevronUp,
  X,
  RefreshCw,
  Wifi,
  WifiOff,
  Film,
  Settings,
  BarChart3
} from 'lucide-react'
import { GalleryGrid } from './gallery-grid'
import { GalleryList } from './gallery-list'
import { GalleryStats } from './gallery-stats'
import { FilterPanel } from './filter-panel'
import { UpscaleProgress } from '@/components/upscale/upscale-progress'
import { VideoGalleryWrapper } from './video-gallery-wrapper'

// Lazy load modals pesados (Fase 2 - Otimização de Performance)
const ImageModal = dynamic(() => import('./image-modal').then(mod => ({ default: mod.ImageModal })), {
  loading: () => <div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>,
  ssr: false
})

const ComparisonModal = dynamic(() => import('./comparison-modal').then(mod => ({ default: mod.ComparisonModal })), {
  loading: () => <div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>,
  ssr: false
})

const UpscaleConfigModal = dynamic(() => import('@/components/upscale/upscale-config-modal').then(mod => ({ default: mod.UpscaleConfigModal })), {
  loading: () => <div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>,
  ssr: false
})

interface AutoSyncGalleryInterfaceProps {
  initialGenerations: any[]
  initialVideos?: any[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  videoPagination?: {
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
  videoStats?: {
    totalVideos: number
    completedVideos: number
    processingVideos: number
    failedVideos: number
    totalCreditsUsed: number
  }
  filters: {
    model?: string
    search?: string
    sort: string
    view: string
    page: number
    tab?: string
  }
  user: {
    id: string
    plan: string
    [key: string]: any
  }
}

export function AutoSyncGalleryInterface({
  initialGenerations,
  initialVideos = [],
  pagination,
  videoPagination,
  models,
  stats: initialStats,
  videoStats,
  filters,
  user
}: AutoSyncGalleryInterfaceProps) {
  // CRITICAL: Proteção contra botão voltar (bfcache) após logout
  const isAuthorized = useAuthGuard()
  const { data: session, status } = useSession()
  
  // CRITICAL: Se não autorizado, bloquear renderização ANTES de usar estados iniciais
  if (isAuthorized === false || status === 'unauthenticated') {
    console.log('🚫 [Gallery] Acesso não autorizado - bloqueando renderização')
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecionando para login...</p>
        </div>
      </div>
    )
  }

  const router = useRouter()
  const searchParams = useSearchParams()
  const { addToast } = useToast()

  // React Query hooks
  const queryClient = useQueryClient()
  const deleteGenerationMutation = useDeleteGeneration()
  const deleteEditHistoryMutation = useDeleteEditHistory()
  const bulkDeleteVideosMutation = useBulkDeleteVideos()

  // Active tab and filters
  const activeTab = searchParams.get('tab') || 'generated'
  const galleryFilters = {
    tab: activeTab,
    model: searchParams.get('model') || undefined,
    search: searchParams.get('search') || undefined,
    sort: searchParams.get('sort') || 'newest',
    page: parseInt(searchParams.get('page') || '1'),
  }

  // CRITICAL: Só usar initialGenerations se autorizado e tem sessão
  const safeInitialGenerations = (isAuthorized === true && session) ? initialGenerations : []
  const safeInitialVideos = (isAuthorized === true && session) ? initialVideos : []

  // Use React Query para dados da galeria - passar safeInitialGenerations como placeholder
  const {
    data: galleryData,
    isLoading: isLoadingGallery,
    isRefetching,
    refetch: refetchGallery
  } = useGalleryData(galleryFilters, {
    generations: safeInitialGenerations,
    editHistory: [],
    videos: safeInitialVideos,
    stats: initialStats,
    pagination
  } as any)

  // State local para manter gerações visíveis mesmo durante refetch
  // CRITICAL: Inicializar vazio se não autorizado
  const [localGenerations, setLocalGenerations] = useState<any[]>(safeInitialGenerations)
  const [localEditHistory, setLocalEditHistory] = useState<any[]>([])
  const [localVideos, setLocalVideos] = useState<any[]>(safeInitialVideos)
  
  // CRITICAL: Limpar dados locais se sessão for perdida
  useEffect(() => {
    if (status === 'unauthenticated') {
      console.log('🚫 [Gallery] Sessão perdida - limpando dados locais')
      setLocalGenerations([])
      setLocalEditHistory([])
      setLocalVideos([])
    }
  }, [status])
  
  // Atualizar estado local quando React Query retornar novos dados
  useEffect(() => {
    if (galleryData?.generations) {
      setLocalGenerations(galleryData.generations)
    }
    if (galleryData?.editHistory) {
      setLocalEditHistory(galleryData.editHistory)
    }
    if (galleryData?.videos) {
      setLocalVideos(galleryData.videos)
    }
  }, [galleryData])
  
  // Usar estado local (que sempre tem dados) em vez de dados diretos do React Query
  const generations = localGenerations
  const editHistory = localEditHistory
  const videos = localVideos
  const stats = galleryData?.stats ?? initialStats
  const lastUpdate = galleryData ? new Date() : null
  const [pendingUpdates, setPendingUpdates] = useState(0)

  // State para contadores globais de cada tab (independente da tab ativa)
  const [globalCounts, setGlobalCounts] = useState({
    totalGenerations: initialStats.totalGenerations,
    totalEdited: 0,
    totalVideos: videoStats?.totalVideos || 0
  })
  const [isMounted, setIsMounted] = useState(false)
  const isRefreshing = isRefetching

  // Estados originais da interface
  const [searchQuery, setSearchQuery] = useState(filters.search || '')
  const [showFilters, setShowFilters] = useState(false)
  const [showStatsPanel, setShowStatsPanel] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set())
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [bulkSelectMode, setBulkSelectMode] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [favoriteImages, setFavoriteImages] = useState<string[]>([])
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  // Upscale states
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
  const [upscaleConfigModal, setUpscaleConfigModal] = useState<{
    isOpen: boolean
    imageUrl: string
    generation?: any
    isLoading: boolean
    resultImageUrl?: string
  }>({ isOpen: false, imageUrl: '', generation: null, isLoading: false, resultImageUrl: undefined })

  // ✅ Função refatorada para usar React Query
  const refreshGalleryData = async (showLoading = false) => {
    console.log('🔄 Refreshing gallery data using React Query...')

    // React Query refetch
    await refetchGallery()

    // Update global counts (separado pois não está no useGalleryData hook)
    try {
      const statsResponse = await fetch('/api/gallery/stats')
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        if (statsData.success) {
          setGlobalCounts({
            totalGenerations: statsData.stats.totalGenerations || 0,
            totalEdited: statsData.stats.totalEdited || 0,
            totalVideos: statsData.stats.totalVideos || 0
          })
          console.log(`📊 Global counts updated - Generated: ${statsData.stats.totalGenerations}, Edited: ${statsData.stats.totalEdited}, Videos: ${statsData.stats.totalVideos}`)
        }
      }
    } catch (error) {
      console.warn('Failed to update global counts:', error)
    }

    // Verificar gerações presas (mantém lógica original)
    if (galleryData?.generations) {
      const stuckGenerations = galleryData.generations.filter((gen: any) => {
        if (gen.status !== 'PROCESSING') return false
        const minutesAgo = Math.round((new Date().getTime() - new Date(gen.createdAt).getTime()) / (1000 * 60))
        return minutesAgo > 10
      })

      if (stuckGenerations.length > 0) {
        console.log(`⚠️ Found ${stuckGenerations.length} stuck generation(s), attempting to fix...`)

        for (const gen of stuckGenerations) {
          try {
            const checkResponse = await fetch(`/api/generations/${gen.id}/check-status`, {
              method: 'POST'
            })
            if (checkResponse.ok) {
              const result = await checkResponse.json()
              if (result.action === 'timeout') {
                console.log(`✅ Fixed stuck generation: ${gen.id}`)
              }
            }
          } catch (error) {
            console.error(`❌ Failed to fix generation ${gen.id}:`, error)
          }
        }

        // Refresh novamente após correções
        setTimeout(() => refetchGallery(), 2000)
      }
    }
  }

  // ✅ Handler para atualizações em tempo real - atualiza estado local PRIMEIRO
  const handleGenerationStatusChange = useCallback((
    generationId: string,
    status: string,
    data: any
  ) => {
    console.log(`🔄 Real-time update: Generation ${generationId} -> ${status}`, data)

    // ATUALIZAR ESTADO LOCAL PRIMEIRO - garante que imagens nunca desapareçam
    setLocalGenerations((prev: any[]) => {
      const existingIndex = prev.findIndex((g: any) => g.id === generationId)

      if (existingIndex >= 0) {
        // Atualizar geração existente
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          status,
          imageUrls: data.imageUrls || updated[existingIndex].imageUrls,
          thumbnailUrls: data.thumbnailUrls || updated[existingIndex].thumbnailUrls,
          completedAt: status === 'COMPLETED' ? new Date() : updated[existingIndex].completedAt,
          processingTime: data.processingTime || updated[existingIndex].processingTime,
          errorMessage: data.errorMessage || updated[existingIndex].errorMessage
        }
        return updated
      } else if (status === 'COMPLETED' && data.imageUrls?.length > 0) {
        // Adicionar nova geração completada no início
        return [{
          id: generationId,
          status: 'COMPLETED',
          imageUrls: data.imageUrls,
          thumbnailUrls: data.thumbnailUrls || data.imageUrls,
          completedAt: new Date(),
          processingTime: data.processingTime,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: data.userId,
          prompt: data.prompt || '',
          modelId: data.modelId || null,
          model: data.model || null
        }, ...prev]
      }
      return prev
    })

    // Depois atualizar cache do React Query (opcional - para sincronização futura)
    queryClient.setQueriesData({ queryKey: ['gallery'] }, (old: any) => {
      if (!old) return old
      let currentGenerations = old.generations || old.data?.generations || (Array.isArray(old) ? old : [])
      if (!Array.isArray(currentGenerations)) return old

      let updatedGenerations = [...currentGenerations]
      const existingIndex = updatedGenerations.findIndex((g: any) => g.id === generationId)

      if (existingIndex >= 0) {
        updatedGenerations[existingIndex] = {
          ...updatedGenerations[existingIndex],
          status,
          imageUrls: data.imageUrls || updatedGenerations[existingIndex].imageUrls,
          thumbnailUrls: data.thumbnailUrls || updatedGenerations[existingIndex].thumbnailUrls,
          completedAt: status === 'COMPLETED' ? new Date() : updatedGenerations[existingIndex].completedAt,
          processingTime: data.processingTime || updatedGenerations[existingIndex].processingTime,
          errorMessage: data.errorMessage || updatedGenerations[existingIndex].errorMessage
        }
      } else if (status === 'COMPLETED' && data.imageUrls?.length > 0) {
        updatedGenerations.unshift({
          id: generationId,
          status: 'COMPLETED',
          imageUrls: data.imageUrls,
          thumbnailUrls: data.thumbnailUrls || data.imageUrls,
          completedAt: new Date(),
          processingTime: data.processingTime,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: data.userId,
          prompt: data.prompt || '',
          modelId: data.modelId || null
        })
      }

      if (old.generations !== undefined) {
        return {
          ...old,
          generations: updatedGenerations
        }
      }
      return old
    })
    
    // Incrementa contador de updates pendentes
    setPendingUpdates(prev => prev + 1)

    // Reset contador após 3 segundos
    setTimeout(() => {
      setPendingUpdates(prev => Math.max(0, prev - 1))
    }, 3000)
    
  }, [queryClient])

  // Handler para atualizações de upscale via WebSocket
  const handleUpscaleUpdate = useCallback((generationId: string, status: string, data: any) => {
    if (data.isUpscale && activeUpscale?.jobId) {
      if (status === 'succeeded' && data.imageUrls?.length > 0) {
        handleUpscaleComplete({
          resultImages: data.imageUrls,
          downloadUrl: data.imageUrls[0]
        })
      } else if (status === 'failed') {
        handleUpscaleError(data.errorMessage || 'Upscale failed')
      }
    }
    
    // Também atualizar a galeria se for um upscale que virou uma nova geração
    handleGenerationStatusChange(generationId, status, data)
  }, [activeUpscale, handleGenerationStatusChange])

  // Set mounted flag on client-side to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Configurar WebSocket para atualizações em tempo real
  const { isConnected, connectionError } = useRealtimeUpdates({
    onGenerationStatusChange: handleUpscaleUpdate, // Usa o handler que suporta upscale
    onConnect: () => {
      console.log('✅ Gallery WebSocket connected - isConnected should be true')
    },
    onDisconnect: () => {
      console.log('🔌 Gallery WebSocket disconnected - isConnected should be false')
    },
    onError: (error) => {
      console.error('❌ Gallery WebSocket error:', {
        error,
        type: error.type || 'unknown',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Debug connection state in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Gallery connection state:', { isConnected, connectionError })
    }
  }, [isConnected, connectionError])

  // Fallback polling mechanism when WebSocket connection fails
  // ✅ Usar ref para activeTab e remover das dependências para evitar loop
  const activeTabRef = useRef(activeTab)

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  useEffect(() => {
    if (!isConnected || connectionError) {
      console.log('🔄 WebSocket not connected, falling back to polling mode')

      // Use different polling intervals based on active tab
      const getPollingInterval = () => {
        const currentTab = activeTabRef.current
        if (currentTab === 'edited' || currentTab === 'videos') {
          return 10000 // Poll every 10 seconds for edited/videos
        }
        return 15000 // Poll every 15 seconds for generated images
      }

      const pollInterval = setInterval(() => {
        console.log(`🔄 Polling for gallery updates [${activeTabRef.current}] (fallback mode)`)
        refreshGalleryData(false)
      }, getPollingInterval())

      return () => {
        console.log('🧹 Cleaning up polling interval')
        clearInterval(pollInterval)
      }
    }
  }, [isConnected, connectionError]) // Removido activeTab das dependências

  // Force refresh when URL tab parameter changes (via router.push)
  // ✅ Usar searchParams em vez de activeTab state para detectar mudanças de tab
  const previousTabRef = useRef(filters.tab || 'generated')
  const previousPageRef = useRef(filters.page)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const currentTab = searchParams.get('tab') || 'generated'
    const currentPage = parseInt(searchParams.get('page') || '1')

    // Limpar timer anterior
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Se a tab mudou, atualizar imediatamente (sem debounce)
    if (currentTab !== previousTabRef.current) {
      console.log(`🔄 Tab changed from [${previousTabRef.current}] to [${currentTab}], refreshing data...`)
      previousTabRef.current = currentTab
      previousPageRef.current = currentPage
      // activeTab agora é derivado de searchParams, não precisa mais de setState
      refreshGalleryData(false)
      return
    }

    // Se apenas a página mudou, usar debounce de 150ms
    if (currentPage !== previousPageRef.current) {
      console.log(`📄 Page changed from [${previousPageRef.current}] to [${currentPage}], debouncing refresh...`)
      debounceTimerRef.current = setTimeout(() => {
        previousPageRef.current = currentPage
        refreshGalleryData(false)
      }, 150)
    }

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

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
    
    // Preserve tab when updating filters
    if (key !== 'tab' && activeTab !== 'generated') {
      params.set('tab', activeTab)
    }
    
    router.push(`/gallery?${params.toString()}`)
  }

  const switchTab = (tab: 'generated' | 'edited' | 'videos' | 'packages') => {
    const params = new URLSearchParams(searchParams.toString())

    if (tab === 'generated') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }

    // Reset page when switching tabs
    params.set('page', '1')

    // O useEffect detectará a mudança na URL e atualizará activeTab + fará refresh
    router.push(`/gallery?${params.toString()}`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilter('search', searchQuery || null)
  }

  const clearFilters = () => {
    router.push('/gallery')
    setSearchQuery('')
    setStatusFilter('all')
  }

  // Funções para gerenciar favoritos
  const toggleFavorite = (imageUrl: string) => {
    setFavoriteImages(prev => {
      if (prev.includes(imageUrl)) {
        return prev.filter(url => url !== imageUrl)
      } else {
        return [...prev, imageUrl]
      }
    })
  }

  const toggleFavoritesFilter = () => {
    setShowFavoritesOnly(!showFavoritesOnly)
  }

  const handleBulkAction = async (action: string) => {
    switch (action) {
      case 'download':
        if (activeTab === 'videos') {
          console.log('Bulk download videos:', Array.from(selectedVideos))
        } else {
          console.log('Bulk download images:', selectedImages)
        }
        break
      case 'favorite':
        console.log('Bulk favorite:', selectedImages)
        break
      case 'delete':
        if (activeTab === 'videos') {
          await handleBulkDeleteVideos(Array.from(selectedVideos))
        } else {
          await handleBulkDelete(selectedImages)
        }
        break
    }

    setSelectedImages([])
    setSelectedVideos(new Set())
    setBulkSelectMode(false)
  }

  const handleDeleteGeneration = (generationId: string) => {
    // Remove from local state
    setGenerations(prev => prev.filter(gen => gen.id !== generationId))
  }

  const handleBulkDeleteVideos = async (videoIds: string[]) => {
    if (videoIds.length === 0) return

    const confirmed = confirm(
      `Tem certeza que deseja excluir ${videoIds.length} ${
        videoIds.length === 1 ? 'vídeo' : 'vídeos'
      }? Esta ação não pode ser desfeita.`
    )

    if (!confirmed) return

    try {
      console.log('🗑️ Deleting videos:', videoIds)

      // ✅ Usar React Query mutation
      await bulkDeleteVideosMutation.mutateAsync(videoIds)

      // Limpar seleção
      setSelectedVideos(new Set())
      setBulkSelectMode(false)

      addToast({
        title: 'Exclusão concluída',
        description: `${videoIds.length} vídeo${videoIds.length === 1 ? '' : 's'} excluído${videoIds.length === 1 ? '' : 's'} com sucesso!`,
        variant: 'default'
      })

    } catch (error) {
      console.error('❌ Error deleting videos:', error)
      addToast({
        title: 'Erro ao excluir',
        description: error instanceof Error ? error.message : 'Erro ao excluir vídeos. Tente novamente.',
        variant: 'destructive'
      })
    }
  }

  const handleBulkDelete = async (selectedImageUrls: string[]) => {
    if (selectedImageUrls.length === 0) return

    const confirmed = confirm(
      `Tem certeza que deseja excluir ${selectedImageUrls.length} ${
        selectedImageUrls.length === 1 ? 'item' : 'itens'
      }? Esta ação não pode ser desfeita.`
    )

    if (!confirmed) return

    // Mostrar indicador de carregamento
    setIsRefreshing(true)

    try {
      // Identificar itens a deletar por tipo
      const generationIds = new Set<string>()
      const videoIds = new Set<string>()
      const editHistoryIds = new Set<string>()

      // Check images from generations (ou edited transformados como generations)
      for (const generation of generations) {
        if (generation.imageUrls) {
          const hasSelectedImage = generation.imageUrls.some((url: string) =>
            selectedImageUrls.includes(url)
          )
          if (hasSelectedImage) {
            // Verificar se é um item editado (tem operation ou prompt com [EDITED])
            if (generation.operation || generation.prompt?.startsWith('[EDITED]')) {
              editHistoryIds.add(generation.id)
            } else {
              generationIds.add(generation.id)
            }
          }
        }
      }

      // Check videos
      for (const video of videos) {
        if (video.videoUrl && selectedImageUrls.includes(video.videoUrl)) {
          videoIds.add(video.id)
        }
        if (video.thumbnailUrl && selectedImageUrls.includes(video.thumbnailUrl)) {
          videoIds.add(video.id)
        }
      }

      // Check edit history array (se houver)
      for (const editItem of editHistory) {
        if (editItem.imageUrl && selectedImageUrls.includes(editItem.imageUrl)) {
          editHistoryIds.add(editItem.id)
        }
        if (editItem.thumbnailUrl && selectedImageUrls.includes(editItem.thumbnailUrl)) {
          editHistoryIds.add(editItem.id)
        }
      }

      console.log('🗑️ Deleting items:', {
        generations: generationIds.size,
        videos: videoIds.size,
        editHistory: editHistoryIds.size
      })

      // Executar deleções em paralelo usando bulk endpoints quando possível
      const deletePromises = []

      // ✅ Delete generations usando React Query mutation
      if (generationIds.size > 0) {
        for (const id of generationIds) {
          deletePromises.push(
            deleteGenerationMutation.mutateAsync(id)
              .then(() => ({ type: 'generation', id }))
          )
        }
      }

      // ✅ Delete videos usando React Query mutation
      if (videoIds.size > 0) {
        const videoIdArray = Array.from(videoIds)
        deletePromises.push(
          bulkDeleteVideosMutation.mutateAsync(videoIdArray)
            .then(() => videoIdArray.map(id => ({ type: 'video', id })))
        )
      }

      // ✅ Delete edit history usando React Query mutation
      if (editHistoryIds.size > 0) {
        const editHistoryIdsArray = Array.from(editHistoryIds)
        deletePromises.push(
          deleteEditHistoryMutation.mutateAsync(editHistoryIdsArray)
            .then(() => editHistoryIdsArray.map(id => ({ type: 'editHistory', id })))
        )
      }

      // Aguardar todas as deleções
      const results = await Promise.all(deletePromises)
      const deletedItems = results.flat()

      // Limpar seleção
      setSelectedImages([])
      setBulkSelectMode(false)

      // React Query já invalida o cache automaticamente nas mutations

      // Mostrar mensagem de sucesso
      const totalDeleted = generationIds.size + videoIds.size + editHistoryIds.size
      addToast({
        title: 'Exclusão concluída',
        description: `${totalDeleted} ${totalDeleted === 1 ? 'item excluído' : 'itens excluídos'} com sucesso!`,
        variant: 'default'
      })

    } catch (error) {
      console.error('❌ Error deleting items:', error)
      addToast({
        title: 'Erro ao excluir',
        description: error instanceof Error ? error.message : 'Erro ao excluir itens. Tente novamente.',
        variant: 'destructive'
      })
    }
  }

  const toggleImageSelection = (imageUrl: string) => {
    setSelectedImages(prev =>
      prev.includes(imageUrl)
        ? prev.filter(url => url !== imageUrl)
        : [...prev, imageUrl]
    )
  }

  const handleSelectAll = () => {
    if (activeTab === 'videos') {
      // Para vídeos, usar IDs em vez de URLs
      const allVideoIds = new Set(videos.map(video => video.id))
      setSelectedVideos(allVideoIds)
      console.log(`✅ Selected ${allVideoIds.size} videos in tab [${activeTab}]`)
    } else if (activeTab === 'edited') {
      // Select all edited image URLs
      // Na aba edited, os dados vêm transformados em generations
      let allImageUrls: string[] = []
      if (editHistory.length > 0) {
        allImageUrls = editHistory.flatMap(item => {
          const urls = []
          if (item.imageUrl) urls.push(item.imageUrl)
          if (item.thumbnailUrl && item.thumbnailUrl !== item.imageUrl) urls.push(item.thumbnailUrl)
          return urls
        })
      } else {
        // Usar generations (que contém os dados transformados de editHistory)
        allImageUrls = generations.flatMap(gen => gen.imageUrls || [])
      }
      setSelectedImages(allImageUrls)
      console.log(`✅ Selected ${allImageUrls.length} items in tab [${activeTab}]`)
    } else {
      // Select all generation image URLs
      const allImageUrls = filteredGenerations.flatMap(gen => gen.imageUrls || [])
      setSelectedImages(allImageUrls)
      console.log(`✅ Selected ${allImageUrls.length} items in tab [${activeTab}]`)
    }
  }

  const handleDeselectAll = () => {
    setSelectedImages([])
    setSelectedVideos(new Set())
  }

  const toggleVideoSelection = (videoId: string) => {
    setSelectedVideos(prev => {
      const newSet = new Set(prev)
      if (newSet.has(videoId)) {
        newSet.delete(videoId)
      } else {
        newSet.add(videoId)
      }
      return newSet
    })
  }

  // Upscale functions - Show configuration modal
  const handleOpenUpscale = async (imageUrl: string, generation?: any) => {
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
            addToast({
              title: "Imagem recuperada",
              description: "Abrindo configurações de upscale...",
              type: "success"
            })
            const newImageUrl = result.imageUrls[0]
            setUpscaleConfigModal({
              isOpen: true,
              imageUrl: newImageUrl,
              generation,
              isLoading: false,
              resultImageUrl: undefined
            })
            refreshGalleryData()
            return
          } else if (response.status === 410) {
            addToast({
              title: "URL expirada",
              description: "As imagens expiraram. Gere novas imagens.",
              type: "error"
            })
            return
          } else {
            addToast({
              title: "Falha na recuperação",
              description: result.error || "Tente novamente.",
              type: "error"
            })
            return
          }
        } catch (error) {
          addToast({
            title: "Erro na recuperação",
            description: "Tente novamente ou gere novas imagens.",
            type: "error"
          })
          return
        }
      } else {
        addToast({
          title: "Upscale cancelado",
          description: "URLs permanentes são necessárias.",
          type: "info"
        })
        return
      }
    }

    // Show upscale configuration modal
    setUpscaleConfigModal({
      isOpen: true,
      imageUrl,
      generation,
      isLoading: false,
      resultImageUrl: undefined
    })
  }

  // Direct upscale processing function
  const startDirectUpscale = async (imageUrl: string, scaleFactor: string = '2x', objectDetection: string = 'none', generation?: any) => {
    // Update modal to loading state
    setUpscaleConfigModal(prev => ({
      ...prev,
      isLoading: true
    }))

    addToast({
      title: "Iniciando upscale",
      description: "Processando imagem com IA...",
      type: "info"
    })

    // Convert scale factor to number for API
    const scaleFactorNumber = scaleFactor === 'none' ? 1 :
                             scaleFactor === '2x' ? 2 :
                             scaleFactor === '4x' ? 4 : 2

    const options = {
      scale_factor: scaleFactorNumber,
      creativity: 0.35,
      resemblance: 0.6,
      dynamic: 6,
      sharpen: 0,
      handfix: 'disabled',
      output_format: 'png',
      object_detection: objectDetection
    }

    try {
      const response = await fetch('/api/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          options
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Erro ${response.status}`)
      }

      const data = await response.json()

      if (!data.jobIds && !data.jobId) {
        throw new Error('Resposta inválida do servidor')
      }

      setActiveUpscale({
        jobId: data.jobIds?.[0] || data.jobId,
        originalImage: imageUrl,
        scaleFactor: scaleFactorNumber
      })

      addToast({
        title: "Upscale em processamento",
        description: "Sua imagem será processada em alguns momentos...",
        type: "success"
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'

      // Reset modal loading state
      setUpscaleConfigModal(prev => ({
        ...prev,
        isLoading: false
      }))

      addToast({
        title: "Erro no upscale",
        description: errorMessage,
        type: "error"
      })
    }
  }

  const handleUpscaleComplete = (result: { resultImages: string[]; downloadUrl: string }) => {
    if (activeUpscale && result.resultImages?.length > 0) {
      // Update modal with result
      setUpscaleConfigModal(prev => ({
        ...prev,
        isLoading: false,
        resultImageUrl: result.resultImages[0]
      }))

      addToast({
        title: "Upscale concluído",
        description: "Sua imagem foi processada com sucesso!",
        type: "success"
      })
    }
    setActiveUpscale(null)

    // Refresh da galeria para mostrar novo upscale
    setTimeout(async () => {
      try {
        await refreshGalleryData(false)
        console.log('✅ Gallery refreshed successfully after upscale completion')
      } catch (error) {
        console.error('❌ Failed to refresh gallery after upscale, retrying...', error)
        setTimeout(() => {
          refreshGalleryData(false).catch(retryError => {
            console.error('❌ Gallery refresh retry also failed:', retryError)
          })
        }, 3000)
      }
    }, 1000)
  }

  const handleUpscaleCancel = () => {
    setActiveUpscale(null)
  }

  const handleUpscaleError = (error: string) => {
    addToast({
      title: "Erro no upscale",
      description: error,
      type: "error"
    })
    setActiveUpscale(null)
  }

  const handleResetUpscale = () => {
    setUpscaleResult(null)
  }

  // Handler for upscale configuration modal
  const handleUpscaleConfigClose = () => {
    setUpscaleConfigModal({ isOpen: false, imageUrl: '', generation: null, isLoading: false, resultImageUrl: undefined })
  }

  const handleUpscaleConfigSubmit = (scaleFactor: string, objectDetection: string) => {
    const { imageUrl, generation } = upscaleConfigModal
    startDirectUpscale(imageUrl, scaleFactor, objectDetection, generation)
  }

  // Filter generations based on active tab and status
  const filteredGenerations = (() => {
    let tabData = []

    if (activeTab === 'videos') {
      tabData = videos
    } else if (activeTab === 'packages') {
      // Filter generations that belong to packages
      tabData = generations.filter(gen => gen.packageId)
    } else {
      // For 'generated' and 'edited' tabs, show non-package generations
      if (activeTab === 'generated') {
        tabData = generations.filter(gen => !gen.packageId)
      } else {
        // For 'edited' tab, use all generations (API handles the transformation)
        tabData = generations
      }
    }

    // Apply status filter if not on videos tab
    if (activeTab !== 'videos' && statusFilter !== 'all') {
      tabData = tabData.filter(item => item.status === statusFilter)
    }

    // Apply favorites filter
    if (showFavoritesOnly && favoriteImages.length > 0) {
      tabData = tabData.filter(item => {
        // For generations, check if any of their images are favorited
        if (item.imageUrls) {
          return item.imageUrls.some(url => favoriteImages.includes(url))
        }
        return false
      })
    }

    return tabData
  })()
  
  const hasActiveFilters = filters.model || filters.search || statusFilter !== 'all' || showFavoritesOnly

  return (
    <div className="space-y-3">
      {/* Discrete Update Button */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refreshGalleryData(true)}
          disabled={isRefreshing}
          className="text-gray-500 hover:text-gray-700"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Processing Status Alert */}
      {generations.some(g => g.status === 'PROCESSING') && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-800">
                Gerações em Processamento
              </h3>
              <p className="text-sm text-blue-700">
                {generations.filter(g => g.status === 'PROCESSING').length} imagem(ns) sendo processada(s). 
                As imagens aparecerão aqui quando ficarem prontas.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline" 
              onClick={() => refreshGalleryData(true)}
              disabled={isRefreshing}
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Verificar
            </Button>
          </div>
        </div>
      )}

      {/* Clean Tabs with Underline */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex">
          <button
            onClick={() => switchTab('generated')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-all duration-200 relative ${
              activeTab === 'generated'
                ? 'text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Fotos Geradas
            {activeTab === 'generated' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#667EEA] to-[#764BA2]"></div>
            )}
          </button>
          <button
            onClick={() => switchTab('edited')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-all duration-200 relative ${
              activeTab === 'edited'
                ? 'text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Fotos Editadas
            {activeTab === 'edited' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#667EEA] to-[#764BA2]"></div>
            )}
          </button>
          <button
            onClick={() => switchTab('videos')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-all duration-200 relative ${
              activeTab === 'videos'
                ? 'text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Vídeos
            {activeTab === 'videos' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#667EEA] to-[#764BA2]"></div>
            )}
          </button>
          <button
            onClick={() => switchTab('packages')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-all duration-200 relative ${
              activeTab === 'packages'
                ? 'text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pacotes
            {activeTab === 'packages' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#667EEA] to-[#764BA2]"></div>
            )}
          </button>
        </div>
      </div>

      {/* Compact Search and Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-3">
          {/* Compact Search Bar */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar fotos..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    updateFilter('search', null)
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </form>

          {/* Compact View Toggle */}
          <div className="flex border border-gray-300 rounded-md">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateFilter('view', 'grid')}
              className={`rounded-r-none h-8 px-2 ${filters.view === 'grid' ? 'bg-gray-700 text-white hover:bg-gray-800' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateFilter('view', 'list')}
              className={`rounded-l-none h-8 px-2 ${filters.view === 'list' ? 'bg-gray-700 text-white hover:bg-gray-800' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          {/* Favorites Filter Toggle */}
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            size="sm"
            onClick={toggleFavoritesFilter}
            className={`h-8 px-3 flex items-center ${showFavoritesOnly ? 'bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-[#667EEA]' : 'text-gray-500 hover:text-[#667EEA] border-gray-200 hover:border-[#667EEA]'}`}
            title={showFavoritesOnly ? 'Mostrar todas as fotos' : 'Mostrar apenas favoritas'}
          >
            <Heart className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
          </Button>

          {/* Compact Filters Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center h-8 px-3"
          >
            <Filter className="w-4 h-4 mr-1" />
            Filtros
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs bg-purple-100 text-purple-700">
                {Object.values({ model: filters.model, search: filters.search }).filter(Boolean).length}
              </Badge>
            )}
            {showFilters ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          </Button>

          {/* Compact Select Multiple Toggle */}
          {((activeTab === 'videos' && videos.length > 0) || (activeTab !== 'videos' && filteredGenerations.length > 0)) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBulkSelectMode(!bulkSelectMode)}
              className="h-8 px-3 text-gray-500 hover:text-gray-700"
            >
              {bulkSelectMode ? 'Sair' : 'Selecionar'}
            </Button>
          )}
        </div>

        {/* Collapsible Advanced Filters */}
        {showFilters && (
          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="all">Todas ({generations.length})</option>
                  <option value="COMPLETED">Completas ({generations.filter(g => g.status === 'COMPLETED').length})</option>
                  <option value="PROCESSING">Processando ({generations.filter(g => g.status === 'PROCESSING').length})</option>
                  <option value="FAILED">Falharam ({generations.filter(g => g.status === 'FAILED').length})</option>
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ordenar por</label>
                <select
                  value={filters.sort}
                  onChange={(e) => updateFilter('sort', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Model Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Modelo</label>
                <select
                  value={filters.model || ''}
                  onChange={(e) => updateFilter('model', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Todos os modelos</option>
                  {models.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
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
          </div>
        )}
      </div>


      {/* Bulk Actions */}
      {bulkSelectMode && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {(activeTab === 'videos' ? selectedVideos.size : selectedImages.length) > 0 ? (
                  <>
                    <span className="font-medium text-blue-900">
                      {activeTab === 'videos'
                        ? `${selectedVideos.size} vídeo${selectedVideos.size !== 1 ? 's' : ''} selecionado${selectedVideos.size !== 1 ? 's' : ''}`
                        : `${selectedImages.length} imagem${selectedImages.length !== 1 ? 'ns' : ''} selecionada${selectedImages.length !== 1 ? 's' : ''}`
                      }
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeselectAll}
                    >
                      Desmarcar Todas
                    </Button>
                  </>
                ) : (
                  <span className="text-sm text-blue-700">
                    {activeTab === 'videos' ? 'Nenhum vídeo selecionado' : 'Nenhuma imagem selecionada'}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedImages([])
                    setSelectedVideos(new Set())
                    setBulkSelectMode(false)
                  }}
                >
                  Sair do Modo Seleção
                </Button>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAll}
                >
                  {activeTab === 'videos' ? 'Selecionar Todos' : 'Selecionar Todas'}
                </Button>
                {(activeTab === 'videos' ? selectedVideos.size : selectedImages.length) > 0 && (
                  <>
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
                      disabled={isRefreshing}
                    >
                      {isRefreshing ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                          Excluindo...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-1" />
                          Excluir
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gallery Content */}
      {activeTab === 'videos' ? (
        <VideoGalleryWrapper
          videos={videos}
          stats={videoStats || {
            totalVideos: 0,
            completedVideos: 0,
            processingVideos: 0,
            failedVideos: 0,
            totalCreditsUsed: 0
          }}
          pagination={videoPagination || pagination}
          filters={{
            status: filters.search ? undefined : undefined,
            quality: undefined,
            search: filters.search,
            sort: filters.sort
          }}
          bulkSelectMode={bulkSelectMode}
          selectedVideos={selectedVideos}
          onToggleVideoSelection={toggleVideoSelection}
        />
      ) : (
        <>
          {filteredGenerations.length === 0 ? (
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
                      <a href="/editor" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>Editar com IA</a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <>

              {filteredGenerations.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                      {activeTab === 'generated' ? 'Nenhuma Foto Gerada' :
                       activeTab === 'edited' ? 'Nenhuma Foto Editada' :
                       activeTab === 'packages' ? 'Nenhuma Foto de Pacote' : 'Nenhum Item'}
                    </h3>
                    <p className="text-gray-600 mb-6" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                      {activeTab === 'generated'
                        ? 'Comece gerando fotos com IA para construir sua galeria'
                        : activeTab === 'edited'
                        ? 'Edite suas fotos existentes com nosso Editor IA'
                        : activeTab === 'packages'
                        ? 'Ative pacotes de fotos para ver suas gerações aqui'
                        : 'Nenhum conteúdo encontrado'
                      }
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                      {activeTab === 'generated' ? (
                        <>
                          <Button asChild className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-0">
                            <a href="/generate" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>Gere Sua Primeira Foto</a>
                          </Button>
                          <Button variant="outline" onClick={() => switchTab('packages')} style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                            Ver Pacotes
                          </Button>
                        </>
                      ) : activeTab === 'edited' ? (
                        <>
                          <Button asChild className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-0">
                            <a href="/editor" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>✨ Editar com IA</a>
                          </Button>
                          <Button variant="outline" onClick={() => switchTab('generated')} style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                            Ver Fotos Geradas
                          </Button>
                        </>
                      ) : activeTab === 'packages' ? (
                        <>
                          <Button asChild className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-0">
                            <a href="/packages" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>Ativar Pacotes</a>
                          </Button>
                          <Button variant="outline" onClick={() => switchTab('generated')} style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                            Ver Fotos Geradas
                          </Button>
                        </>
                      ) : (
                        <Button asChild className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-0">
                          <a href="/generate" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>Começar</a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {filters.view === 'grid' ? (
                    <GalleryGrid
                      generations={filteredGenerations}
                      bulkSelectMode={bulkSelectMode}
                      selectedImages={selectedImages}
                      onImageSelect={toggleImageSelection}
                      onImageClick={setSelectedImage}
                      onUpscale={handleOpenUpscale}
                      userPlan={user?.plan || 'STARTER'}
                      favoriteImages={favoriteImages}
                      onToggleFavorite={toggleFavorite}
                    />
                  ) : (
                    <GalleryList
                      generations={filteredGenerations}
                      bulkSelectMode={bulkSelectMode}
                      selectedImages={selectedImages}
                      onImageSelect={toggleImageSelection}
                      onImageClick={setSelectedImage}
                      onUpscale={handleOpenUpscale}
                      favoriteImages={favoriteImages}
                      onToggleFavorite={toggleFavorite}
                      userPlan={user?.plan || 'FREE'}
                    />
                  )}
                </>
              )}

              {/* Pagination */}
              <div className="flex flex-col items-center space-y-3">
                {/* Stats Info */}
                <div className="text-xs text-gray-500">
                  Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} fotos
                  {pagination.pages > 1 && (
                    <span className="ml-2">• Página {pagination.page} de {pagination.pages}</span>
                  )}
                </div>

                {/* Pagination Controls */}
                {pagination.pages > 1 && (
                  <div className="flex items-center justify-center space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page === 1}
                      onClick={() => updateFilter('page', '1')}
                      className="text-xs h-7 px-2"
                    >
                      ≪ Primeira
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page === 1}
                      onClick={() => updateFilter('page', (pagination.page - 1).toString())}
                      className="text-xs h-7 px-2"
                    >
                      ‹ Anterior
                    </Button>

                    <div className="flex items-center space-x-1">
                      {(() => {
                        const currentPage = pagination.page
                        const totalPages = pagination.pages
                        const showPages = []

                        // Always show first page
                        if (totalPages > 0) showPages.push(1)

                        // Show pages around current page
                        for (let i = Math.max(2, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) {
                          if (!showPages.includes(i)) showPages.push(i)
                        }

                        // Always show last page (if different from first)
                        if (totalPages > 1 && !showPages.includes(totalPages)) {
                          showPages.push(totalPages)
                        }

                        // Sort and fill gaps
                        showPages.sort((a, b) => a - b)
                        const finalPages = []
                        for (let i = 0; i < showPages.length; i++) {
                          if (i > 0 && showPages[i] - showPages[i-1] > 1) {
                            finalPages.push('...')
                          }
                          finalPages.push(showPages[i])
                        }

                        return finalPages.map((pageItem, index) => {
                          if (pageItem === '...') {
                            return (
                              <span key={`ellipsis-${index}`} className="px-1 py-1 text-xs text-gray-400">
                                ...
                              </span>
                            )
                          }

                          const pageNum = pageItem as number
                          return (
                            <Button
                              key={pageNum}
                              variant={pagination.page === pageNum ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => updateFilter('page', pageNum.toString())}
                              className={`text-xs h-7 w-7 p-0 ${
                                pagination.page === pageNum
                                  ? 'bg-gray-300 hover:bg-gray-400 text-gray-800 border-gray-300'
                                  : ''
                              }`}
                            >
                              {pageNum}
                            </Button>
                          )
                        })
                      })()}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page === pagination.pages}
                      onClick={() => updateFilter('page', (pagination.page + 1).toString())}
                      className="text-xs h-7 px-2"
                    >
                      Próxima ›
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page === pagination.pages}
                      onClick={() => updateFilter('page', pagination.pages.toString())}
                      className="text-xs h-7 px-2"
                    >
                      Última ≫
                    </Button>
                  </div>
                )}

                {/* Quick page size selector */}
                <div className="flex items-center space-x-1 text-xs">
                  <span className="text-gray-500">Itens por página:</span>
                  {[10, 20, 50].map(size => (
                    <Button
                      key={size}
                      variant={pagination.limit === size ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => {
                        updateFilter('limit', size.toString())
                        updateFilter('page', '1')
                      }}
                      className={`text-xs h-6 px-2 ${
                        pagination.limit === size
                          ? 'bg-gray-300 hover:bg-gray-400 text-gray-800 border-gray-300'
                          : ''
                      }`}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Image Modal */}
      {selectedImage && (() => {
        // Find the generation that contains this image
        const generation = filteredGenerations.find(gen =>
          gen.imageUrls.includes(selectedImage)
        )

        if (!generation) return null

        // Create MediaItem for the selected image
        const mediaItem = {
          id: `${generation.id}-${selectedImage}`,
          url: selectedImage,
          thumbnailUrl: generation.thumbnailUrls?.[generation.imageUrls.indexOf(selectedImage)] || selectedImage,
          operationType: 'generated' as const,
          status: generation.status,
          generation,
          metadata: {
            width: generation.width,
            height: generation.height
          }
        }

        // Create MediaItem array for all images
        const allImages = filteredGenerations.flatMap(gen =>
          gen.imageUrls.map((url, index) => ({
            id: `${gen.id}-${url}`,
            url,
            thumbnailUrl: gen.thumbnailUrls?.[index] || url,
            operationType: 'generated' as const,
            status: gen.status,
            generation: gen,
            metadata: {
              width: gen.width,
              height: gen.height
            }
          }))
        )

        return (
          <ImageModal
            mediaItem={mediaItem}
            onClose={() => setSelectedImage(null)}
            allImages={allImages}
            onUpscale={handleOpenUpscale}
            onDelete={handleDeleteGeneration}
            userPlan={user?.plan || 'FREE'}
          />
        )
      })()}

      {/* Upscale Result Comparison Modal */}
      {upscaleResult && (
        <ComparisonModal
          isOpen={true}
          originalImage={upscaleResult.originalImage}
          processedImage={upscaleResult.upscaledImage}
          title={`Upscale ${upscaleResult.scaleFactor}x - Resultado`}
          onClose={handleResetUpscale}
          showDownload={true}
        />
      )}

      {/* Upscale Progress - Hidden background process */}
      {activeUpscale && (
        <div className="hidden">
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

      {/* Upscale Configuration Modal */}
      <UpscaleConfigModal
        isOpen={upscaleConfigModal.isOpen}
        onClose={handleUpscaleConfigClose}
        onUpscale={handleUpscaleConfigSubmit}
        imageUrl={upscaleConfigModal.imageUrl}
        isLoading={upscaleConfigModal.isLoading}
        resultImageUrl={upscaleConfigModal.resultImageUrl}
      />

    </div>
  )
}