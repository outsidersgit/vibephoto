'use client'

import { useState, useEffect, useCallback, useRef, useTransition, useMemo } from 'react'
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
  Trash2,
  Image,
  Calendar,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  Wifi,
  WifiOff,
  Film,
  Settings,
  BarChart3,
  Loader2
} from 'lucide-react'
import { GalleryGrid } from './gallery-grid'
import { GalleryList } from './gallery-list'
import { GalleryStats } from './gallery-stats'
import { UpscaleProgress } from '@/components/upscale/upscale-progress'
import { VideoGalleryWrapper } from './video-gallery-wrapper'
import { PackageProgressBarMinimal } from '@/components/packages/package-progress-bar-minimal'

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
    limit: number
    total: number
    page: number
    pages: number
  }
  videoPagination?: {
    limit: number
    total: number
    page: number
    pages: number
    hasMore?: boolean
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
  const { data: session, status } = useSession()
  const isAuthorized = useAuthGuard()

  // CRITICAL: useEffect para redirecionar (não pode fazer early return após hooks)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // PERFORMANCE: Função leve (<0.1ms) que verifica cookies diretamente
      const hasSessionCookie = () => {
        try {
          const cookies = document.cookie.split(';')
          return cookies.some(cookie => {
            const cookieName = cookie.trim().split('=')[0]
            return cookieName.includes('next-auth') ||
                   cookieName.includes('__Secure-next-auth') ||
                   cookieName.includes('__Host-next-auth')
          })
        } catch (e) {
          return false
        }
      }

      // CRITICAL: Se não há cookie de sessão, redirecionar IMEDIATAMENTE
      if (!hasSessionCookie() && (status === 'unauthenticated' || isAuthorized === false)) {
        const redirectUrl = '/auth/signin?callbackUrl=' + encodeURIComponent('/gallery')
        try {
          window.location.replace(redirectUrl)
        } catch (error) {
          window.location.href = redirectUrl
        }
      }
    }
  }, [status, isAuthorized])
  
  // CRITICAL: Redirecionar se não autorizado (usando useEffect para não violar regras dos hooks)
  useEffect(() => {
    if (isAuthorized === false || status === 'unauthenticated') {
      console.log('🚫 [Gallery] Acesso não autorizado - redirecionando para login')
      const redirectUrl = '/auth/signin?callbackUrl=' + encodeURIComponent('/gallery')
      try {
        window.location.replace(redirectUrl)
      } catch (error) {
        console.error('❌ [Gallery] Erro ao redirecionar:', error)
        window.location.href = redirectUrl
      }
    }
  }, [isAuthorized, status])
  
  // CRITICAL: Se não autorizado, bloquear renderização ANTES de usar estados iniciais
  // Isso previne erros de renderização quando a página é restaurada do bfcache sem autenticação
  if (isAuthorized === false || status === 'unauthenticated') {
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
  const [isNavigating, startTransition] = useTransition()

  // React Query hooks
  const queryClient = useQueryClient()
  const deleteGenerationMutation = useDeleteGeneration()
  const deleteEditHistoryMutation = useDeleteEditHistory()
  const bulkDeleteVideosMutation = useBulkDeleteVideos()

  // Active tab and filters
  const activeTab = searchParams.get('tab') || 'generated'
  const DEFAULT_LOAD_LIMIT = 20

  const currentModel = searchParams.get('model') || filters.model || undefined
  const currentSearchParam = searchParams.get('search') || filters.search || ''
  const currentSort = searchParams.get('sort') || filters.sort || 'newest'
  const currentPackage = searchParams.get('package') || undefined

  const galleryFilters = {
    tab: activeTab,
    model: currentModel,
    search: currentSearchParam || undefined,
    sort: currentSort,
    limit: Number(searchParams.get('limit') || DEFAULT_LOAD_LIMIT.toString()),
    package: currentPackage
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
  const [favoriteImages, setFavoriteImages] = useState<string[]>([])
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  const filterSignature = [
    activeTab,
    currentModel || '',
    currentSearchParam || '',
    currentSort || '',
    showFavoritesOnly ? 'fav' : '',
  ].join('|')
  const previousFilterSignatureRef = useRef(filterSignature)

  // CRITICAL: Limpar dados locais se sessão for perdida
  useEffect(() => {
    if (status === 'unauthenticated') {
      console.log('🚫 [Gallery] Sessão perdida - limpando dados locais')
      setLocalGenerations([])
      setLocalEditHistory([])
      setLocalVideos([])
    }
  }, [status])
  
  useEffect(() => {
    if (!galleryData) return

    const filtersChanged = previousFilterSignatureRef.current !== filterSignature

    if (galleryData.generations) {
      const serverPage = galleryData.pagination?.page ?? 1
      const serverGenerations = [...galleryData.generations]

      setLocalGenerations(prev => {
        if (filtersChanged || serverPage <= 1) {
          return serverGenerations
        }

        const merged = new Map(prev.map((gen: any) => [gen.id, gen]))
        serverGenerations.forEach(gen => merged.set(gen.id, gen))
        return Array.from(merged.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      })
    }

    if (galleryData.editHistory) {
      setLocalEditHistory(galleryData.editHistory)
    }

    if (galleryData.videos) {
      const serverPage = activeTab === 'videos' ? galleryData.pagination?.page ?? 1 : 1
      const serverVideos = [...galleryData.videos]

      setLocalVideos(prev => {
        if (filtersChanged || serverPage <= 1) {
          return serverVideos
        }

        const merged = new Map(prev.map((video: any) => [video.id, video]))
        serverVideos.forEach(video => merged.set(video.id, video))
        return Array.from(merged.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      })
    }

    if (filtersChanged) {
      setGenerationPage(1)
      setVideoPage(1)
    }

    previousFilterSignatureRef.current = filterSignature
  }, [galleryData, activeTab, filterSignature])
  
  // Usar estado local (que sempre tem dados) em vez de dados diretos do React Query
  const generations = [...localGenerations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const editHistory = localEditHistory
  const videos = localVideos
  const stats = galleryData?.stats ?? initialStats
  const lastUpdate = galleryData ? new Date() : null
  const [pendingUpdates, setPendingUpdates] = useState(0)

  const derivedGenerationLimit =
    pagination?.limit ??
    galleryFilters.limit ??
    (initialGenerations.length > 0 ? initialGenerations.length : DEFAULT_LOAD_LIMIT)
  const derivedGenerationTotal = pagination?.total ?? initialGenerations.length
  const derivedGenerationPages =
    pagination?.pages ??
    Math.max(1, Math.ceil(derivedGenerationTotal / Math.max(derivedGenerationLimit, 1)))

  const fallbackGenerationPagination: { limit: number; total: number; page: number; pages: number } = {
    limit: derivedGenerationLimit,
    total: derivedGenerationTotal,
    page: pagination?.page ?? 1,
    pages: derivedGenerationPages
  }

  const derivedVideoLimit =
    videoPagination?.limit ??
    galleryFilters.limit ??
    ((initialVideos?.length ?? 0) > 0 ? (initialVideos?.length ?? 1) : DEFAULT_LOAD_LIMIT)
  const derivedVideoTotal = videoPagination?.total ?? (initialVideos?.length ?? 0)
  const derivedVideoPages =
    videoPagination?.pages ??
    Math.max(1, Math.ceil(derivedVideoTotal / Math.max(derivedVideoLimit, 1)))

  const fallbackVideoPagination: { limit: number; total: number; page: number; pages: number } = {
    limit: derivedVideoLimit,
    total: derivedVideoTotal,
    page: videoPagination?.page ?? 1,
    pages: derivedVideoPages
  }

  const generationPaginationData =
    activeTab === 'generated' && galleryData?.pagination
      ? galleryData.pagination
      : fallbackGenerationPagination
  const videoPaginationData =
    activeTab === 'videos' && galleryData?.pagination
      ? galleryData.pagination
      : fallbackVideoPagination

  const generationPageFromData = generationPaginationData.page ?? 1
  const generationPagesFromData = generationPaginationData.pages ?? 1

  const videoPageFromData = videoPaginationData.page ?? 1
  const videoPagesFromData = videoPaginationData.pages ?? 1

  const [generationPage, setGenerationPage] = useState(generationPageFromData)
  const [generationTotalPages, setGenerationTotalPages] = useState(generationPagesFromData)
  const [isLoadingMoreGenerations, setIsLoadingMoreGenerations] = useState(false)

  const [videoPage, setVideoPage] = useState(videoPageFromData)
  const [videoTotalPages, setVideoTotalPages] = useState(videoPagesFromData)
  const [isLoadingMoreVideos, setIsLoadingMoreVideos] = useState(false)

  useEffect(() => {
    setGenerationPage(generationPageFromData)
    setGenerationTotalPages(generationPagesFromData)
  }, [generationPageFromData, generationPagesFromData])

  useEffect(() => {
    setVideoPage(videoPageFromData)
    setVideoTotalPages(videoPagesFromData)
  }, [videoPageFromData, videoPagesFromData])

  const hasMoreGenerations = generationPage < generationTotalPages
  const hasMoreVideos = videoPage < videoTotalPages

  // State para contadores globais de cada tab (independente da tab ativa)
  const [globalCounts, setGlobalCounts] = useState({
    totalGenerations: initialStats.totalGenerations,
    totalEdited: 0,
    totalVideos: videoStats?.totalVideos || 0
  })
  const [isMounted, setIsMounted] = useState(false)
  const isRefreshing = isRefetching

  // Estados originais da interface
  const [searchQuery, setSearchQuery] = useState(currentSearchParam || '')
  useEffect(() => {
    setSearchQuery(currentSearchParam || '')
  }, [currentSearchParam])
  const [showFilters, setShowFilters] = useState(false)
  const [showStatsPanel, setShowStatsPanel] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set())
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [bulkSelectMode, setBulkSelectMode] = useState(false)

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
        // CRITICAL: Garantir que sempre adiciona, mesmo se já existe (pode ser atualização)
        const newGeneration = {
          id: generationId,
          status: 'COMPLETED' as const,
          imageUrls: data.imageUrls,
          thumbnailUrls: data.thumbnailUrls || data.imageUrls,
          completedAt: new Date(),
          processingTime: data.processingTime,
          createdAt: data.timestamp ? new Date(data.timestamp) : new Date(),
          updatedAt: new Date(),
          userId: data.userId || user?.id,
          prompt: data.prompt || '',
          modelId: data.modelId || null,
          model: data.model || null
        }
        
        // Se já existe, substituir; se não, adicionar no início
        const existingIndex = prev.findIndex((g: any) => g.id === generationId)
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = newGeneration
          console.log(`✅ Updated existing generation ${generationId} in gallery`)
          return updated
        }
        console.log(`✅ Added new completed generation ${generationId} to gallery`)
        return [newGeneration, ...prev]
      } else if (status === 'COMPLETED') {
        // Mesmo sem imageUrls, atualizar status se for COMPLETED
        const existingIndex = prev.findIndex((g: any) => g.id === generationId)
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = {
            ...updated[existingIndex],
            status: 'COMPLETED',
            completedAt: new Date(),
            processingTime: data.processingTime,
            errorMessage: data.errorMessage
          }
          console.log(`✅ Updated generation ${generationId} status to COMPLETED (no imageUrls yet)`)
          return updated
        }
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
    console.log(`📥 Gallery received generation status update: ${generationId} -> ${status}`, {
      isUpscale: data.isUpscale,
      hasImageUrls: !!data.imageUrls,
      imageUrlsCount: data.imageUrls?.length
    })
    
    // Processar upscale se for o caso
    if (data.isUpscale && activeUpscale?.jobId) {
      if (status === 'succeeded' || status === 'COMPLETED') {
        if (data.imageUrls?.length > 0) {
          handleUpscaleComplete({
            resultImages: data.imageUrls,
            downloadUrl: data.imageUrls[0]
          })
        }
      } else if (status === 'failed' || status === 'FAILED') {
        handleUpscaleError(data.errorMessage || 'Upscale failed')
      }
    }
    
    // CRITICAL: Sempre atualizar a galeria para TODAS as atualizações de geração
    // Não apenas upscales - isso garante que novas gerações apareçam automaticamente
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
        if (currentTab === 'videos') {
          return 10000 // Poll every 10 seconds for videos
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

  useEffect(() => {
    const currentTab = searchParams.get('tab') || 'generated'

    if (currentTab !== previousTabRef.current) {
      console.log(`🔄 Tab changed from [${previousTabRef.current}] to [${currentTab}], refreshing data...`)
      previousTabRef.current = currentTab
      refreshGalleryData(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const sortOptions = [
    { value: 'newest', label: 'Mais recente' },
    { value: 'oldest', label: 'Mais antigo' }
  ]

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }

    if (key !== 'page') {
      params.delete('page')
    }
    
    // Preserve tab when updating filters
    if (key !== 'tab' && activeTab !== 'generated') {
      params.set('tab', activeTab)
    }
    const nextQuery = params.toString()
    const nextUrl = nextQuery ? `/gallery?${nextQuery}` : '/gallery'

    startTransition(() => {
      router.push(nextUrl, { scroll: false })
    })
  }

  const switchTab = (tab: 'generated' | 'videos') => {
    const params = new URLSearchParams(searchParams.toString())

    if (tab === 'generated') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }

    params.delete('page')

    const nextQuery = params.toString()
    const nextUrl = nextQuery ? `/gallery?${nextQuery}` : '/gallery'

    startTransition(() => {
      router.push(nextUrl, { scroll: false })
    })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilter('search', searchQuery || null)
  }

  const clearFilters = () => {
    router.push('/gallery')
    setSearchQuery('')
    setShowFavoritesOnly(false)
    // Note: package filter is cleared via URL params update
  }

  // Funções para gerenciar favoritos
  const toggleFavorite = useCallback(async (imageUrl: string, generation?: any) => {
    const generationId = generation?.id
    const isCurrentlyFavorite = favoriteImages.includes(imageUrl)

    if (!generationId) {
      setFavoriteImages(prev => {
        const set = new Set(prev)
        if (isCurrentlyFavorite) {
          set.delete(imageUrl)
        } else {
          set.add(imageUrl)
        }
        return Array.from(set)
      })
      return !isCurrentlyFavorite
    }

    const nextState = !isCurrentlyFavorite

    setFavoriteImages(prev => {
      const set = new Set(prev)
      if (nextState) {
        set.add(imageUrl)
      } else {
        set.delete(imageUrl)
      }
      return Array.from(set)
    })

    try {
      const response = await fetch('/api/gallery/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          generationId,
          imageUrl,
          favorite: nextState
        })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao atualizar favorito')
      }

      const data = await response.json()
      if (Array.isArray(data?.data?.favoriteImages)) {
        const generationImages: string[] = Array.isArray(generation?.imageUrls)
          ? generation.imageUrls
          : []

        setFavoriteImages(prev => {
          const set = new Set(prev)

          if (generationImages.length > 0) {
            generationImages.forEach(url => set.delete(url))
          }

          data.data.favoriteImages.forEach((url: string) => set.add(url))
          return Array.from(set)
        })
      }

      addToast({
        title: nextState ? 'Adicionado aos favoritos' : 'Removido dos favoritos',
        description: nextState
          ? 'A imagem está salva nos seus favoritos.'
          : 'A imagem foi removida dos favoritos.',
        variant: 'default'
      })

      return nextState
    } catch (error) {
      console.error('Erro ao atualizar favorito:', error)
      setFavoriteImages(prev => {
        const set = new Set(prev)
        if (nextState) {
          set.delete(imageUrl)
        } else {
          set.add(imageUrl)
        }
        return Array.from(set)
      })

      addToast({
        title: 'Erro ao atualizar favorito',
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
        variant: 'destructive'
      })

      return isCurrentlyFavorite
    }
  }, [addToast, favoriteImages])

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

  const handleDeleteGeneration = useCallback(async (generationId: string, options: { confirm?: boolean } = {}) => {
    if (!generationId) return false

    if (options.confirm !== false) {
      const confirmed = confirm('Tem certeza que deseja excluir esta geração? Esta ação não pode ser desfeita.')
      if (!confirmed) {
        return false
      }
    }

    try {
      await deleteGenerationMutation.mutateAsync(generationId)

      setLocalGenerations(prev => prev.filter(gen => gen.id !== generationId))

      addToast({
        title: 'Imagem excluída',
        description: 'A geração foi removida com sucesso.',
        variant: 'default'
      })

      return true
    } catch (error) {
      console.error('❌ Erro ao excluir geração:', error)
      const message = error instanceof Error ? error.message : 'Não foi possível excluir a imagem.'

      if (message.toLowerCase().includes('not found')) {
        setLocalGenerations(prev => prev.filter(gen => gen.id !== generationId))
        addToast({
          title: 'Imagem já removida',
          description: 'Essa geração já não estava mais disponível na galeria.',
          variant: 'default'
        })
        return true
      }

      addToast({
        title: 'Erro ao excluir',
        description: message,
        variant: 'destructive'
      })
      return false
    }
  }, [addToast, deleteGenerationMutation])

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
      await Promise.all(deletePromises)

      // Limpar seleção
      setSelectedImages([])
      setBulkSelectMode(false)

      // Atualizar estados locais com itens removidos
      if (generationIds.size > 0) {
        setLocalGenerations(prev => prev.filter(gen => !generationIds.has(gen.id)))
      }

      if (videoIds.size > 0) {
        setLocalVideos(prev => prev.filter(video => !videoIds.has(video.id)))
      }

      if (editHistoryIds.size > 0) {
        setLocalEditHistory(prev => prev.filter(edit => !editHistoryIds.has(edit.id)))
      }

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
    } else {
      // Select all generation image URLs (includes all photos: normal, editor, packages)
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

  // 🚀 OTIMIZAÇÃO: Memoize filteredGenerations para evitar re-processamento
  // Só recalcula quando activeTab, generations, videos ou favoriteImages mudarem
  const filteredGenerations = useMemo(() => {
    // Se estamos na tab de vídeos, não processar generations
    if (activeTab === 'videos') {
      return []
    }

    let tabData = generations

    // Apply favorites filter
    if (showFavoritesOnly) {
      if (favoriteImages.length === 0) {
        return []
      }

      tabData = tabData.filter(item => {
        if (item.imageUrls) {
          return item.imageUrls.some(url => favoriteImages.includes(url))
        }
        return false
      })
    }

    return tabData
  }, [activeTab, generations, showFavoritesOnly, favoriteImages])

  const isFavoritesFilterActive = showFavoritesOnly
  const hasAnyFavoriteImages = favoriteImages.length > 0
  const isEmptyFavoritesView = isFavoritesFilterActive && !hasAnyFavoriteImages
  
  const sortIsDefault = (galleryFilters.sort || 'newest') === 'newest'
  const currentSortLabel =
    sortOptions.find(option => option.value === (galleryFilters.sort || 'newest'))?.label || 'Mais recente'
  const currentModelName = currentModel ? models.find(m => m.id === currentModel)?.name : undefined
  const activeFiltersCount = [
    currentModel,
    currentSearchParam ? 'search' : null,
    showFavoritesOnly ? 'favorites' : null,
    sortIsDefault ? null : galleryFilters.sort,
    currentPackage ? 'package' : null
  ].filter(Boolean).length
  const hasActiveFilters = activeFiltersCount > 0

  const handleLoadMoreGenerations = useCallback(async () => {
    if (isLoadingMoreGenerations || !hasMoreGenerations) {
      return
    }

    setIsLoadingMoreGenerations(true)

    try {
      const nextPage = generationPage + 1
      const params = new URLSearchParams()
      params.set('tab', 'generated')
      params.set('page', String(nextPage))
      params.set('limit', String(galleryFilters.limit ?? DEFAULT_LOAD_LIMIT))

      if (galleryFilters.model) params.set('model', galleryFilters.model)
      if (galleryFilters.search) params.set('search', galleryFilters.search)
      if (galleryFilters.sort) params.set('sort', galleryFilters.sort)
      if (galleryFilters.search) params.set('search', galleryFilters.search)
      if (galleryFilters.sort) params.set('sort', galleryFilters.sort)
      const response = await fetch(`/api/gallery/data?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Falha ao carregar mais fotos')
      }

      const json = await response.json()
      const fetchedGenerations: any[] = json.generations || []

      if (fetchedGenerations.length > 0) {
        setLocalGenerations(prev => {
          const existingIds = new Set(prev.map((gen: any) => gen.id))
          const merged = [...prev]

          fetchedGenerations.forEach(gen => {
            if (!existingIds.has(gen.id)) {
              merged.push(gen)
            }
          })

          merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          return merged
        })
      }

      setGenerationPage(json.pagination?.page ?? nextPage)
      setGenerationTotalPages(json.pagination?.pages ?? generationTotalPages)
    } catch (error) {
      console.error('❌ Erro ao carregar mais fotos:', error)
      addToast({
        title: 'Não foi possível carregar mais fotos',
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
        variant: 'destructive'
      })
    } finally {
      setIsLoadingMoreGenerations(false)
    }
  }, [
    isLoadingMoreGenerations,
    hasMoreGenerations,
    generationPage,
    galleryFilters.limit,
    galleryFilters.model,
    galleryFilters.search,
    galleryFilters.sort,
    addToast,
    generationTotalPages
  ])

  const handleLoadMoreVideos = useCallback(async () => {
    if (isLoadingMoreVideos || !hasMoreVideos) {
      return
    }

    setIsLoadingMoreVideos(true)

    try {
      const nextPage = videoPage + 1
      const params = new URLSearchParams()
      params.set('tab', 'videos')
      params.set('page', String(nextPage))
      params.set('limit', String(galleryFilters.limit ?? DEFAULT_LOAD_LIMIT))

      if (galleryFilters.search) params.set('search', galleryFilters.search)
      const response = await fetch(`/api/gallery/data?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Falha ao carregar mais vídeos')
      }

      const json = await response.json()
      const fetchedVideos: any[] = json.videos || []

      if (fetchedVideos.length > 0) {
        setLocalVideos(prev => {
          const existingIds = new Set(prev.map((video: any) => video.id))
          const merged = [...prev]

          fetchedVideos.forEach(video => {
            if (!existingIds.has(video.id)) {
              merged.push(video)
            }
          })

          merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          return merged
        })
      }

      setVideoPage(json.pagination?.page ?? nextPage)
      setVideoTotalPages(json.pagination?.pages ?? videoTotalPages)
    } catch (error) {
      console.error('❌ Erro ao carregar mais vídeos:', error)
      addToast({
        title: 'Não foi possível carregar mais vídeos',
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
        variant: 'destructive'
      })
    } finally {
      setIsLoadingMoreVideos(false)
    }
  }, [
    isLoadingMoreVideos,
    hasMoreVideos,
    videoPage,
    galleryFilters.limit,
    galleryFilters.search,
    addToast,
    videoTotalPages
  ])

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
        </div>
      </div>

      {/* Compact Search and Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-3" aria-busy={isNavigating}>
        <div className="flex items-center gap-3">
          {/* Compact Search Bar */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                id="gallery-search"
                name="search"
                type="text"
                role="searchbox"
                inputMode="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar por prompt..."
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
              disabled={isNavigating}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateFilter('view', 'list')}
                className={`rounded-l-none h-8 px-2 ${filters.view === 'list' ? 'bg-gray-700 text-white hover:bg-gray-800' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`}
              disabled={isNavigating}
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
            disabled={isNavigating}
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
            disabled={isNavigating}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filtros
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs bg-purple-100 text-purple-700">
                {activeFiltersCount}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ordenar por</label>
                <select
                  value={galleryFilters.sort || 'newest'}
                  onChange={(e) => updateFilter('sort', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={isNavigating}
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
                  value={currentModel || ''}
                  onChange={(e) => updateFilter('model', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={isNavigating}
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

              {currentModel && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                  Modelo: {currentModelName || 'Selecionado'}
                  <button onClick={() => updateFilter('model', null)}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}

              {currentSearchParam && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                  Busca: "{currentSearchParam}"
                    <button onClick={() => updateFilter('search', null)}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}

              {!sortIsDefault && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Ordenação: {currentSortLabel}
                  <button onClick={() => updateFilter('sort', 'newest')}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}

                {showFavoritesOnly && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Favoritas
                    <button onClick={toggleFavoritesFilter}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}

                {currentPackage && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Pacote: {currentPackage}
                    <button onClick={() => updateFilter('package', null)}>
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


      {/* Bulk Actions - Mobile optimized */}
      {bulkSelectMode && (
        <Card className="bg-blue-50 border-blue-200 sticky top-0 z-50 mb-4">
          <CardContent className="pt-4 pb-4">
            {/* Mobile: Stack vertically, Desktop: Horizontal */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              {/* Left side - Selection info and clear */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                {(activeTab === 'videos' ? selectedVideos.size : selectedImages.length) > 0 ? (
                  <>
                    <span className="font-medium text-blue-900 text-sm sm:text-base">
                      {activeTab === 'videos'
                        ? `${selectedVideos.size} ${selectedVideos.size === 1 ? 'vídeo' : 'vídeos'} ${selectedVideos.size === 1 ? 'selecionado' : 'selecionados'}`
                        : `${selectedImages.length} ${selectedImages.length === 1 ? 'imagem' : 'imagens'} ${selectedImages.length === 1 ? 'selecionada' : 'selecionadas'}`
                      }
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeselectAll}
                      className="text-xs sm:text-sm"
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
                  className="text-xs sm:text-sm"
                >
                  Sair
                </Button>
              </div>

              {/* Right side - Actions */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAll}
                  className="text-xs sm:text-sm px-2 sm:px-3"
                >
                  {activeTab === 'videos' ? 'Selecionar Todos' : 'Selecionar Todas'}
                </Button>
                {(activeTab === 'videos' ? selectedVideos.size : selectedImages.length) > 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkAction('download')}
                      className="text-xs sm:text-sm px-2 sm:px-3"
                    >
                      <Download className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Baixar</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkAction('favorite')}
                      className="text-xs sm:text-sm px-2 sm:px-3"
                    >
                      <Heart className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Favoritar</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleBulkAction('delete')}
                      disabled={isRefreshing}
                      className="text-xs sm:text-sm px-2 sm:px-3"
                    >
                      {isRefreshing ? (
                        <>
                          <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1 animate-spin" />
                          <span className="hidden sm:inline">Excluindo...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                          <span className="hidden sm:inline">Excluir</span>
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
        <>
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
              search: currentSearchParam || undefined,
              sort: galleryFilters.sort
            }}
            bulkSelectMode={bulkSelectMode}
            selectedVideos={selectedVideos}
            onToggleVideoSelection={toggleVideoSelection}
          />

          <div className="flex flex-col items-center mt-6 space-y-4">
            {hasMoreVideos ? (
              <Button
                type="button"
                onClick={handleLoadMoreVideos}
                disabled={isLoadingMoreVideos}
                className="relative inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#667EEA] to-[#764BA2] px-6 sm:px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-[#667EEA]/20 transition-all duration-200 hover:from-[#5a6bd8] hover:to-[#6a4190] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#764BA2]/60 focus-visible:ring-offset-2 disabled:opacity-70"
              >
                {isLoadingMoreVideos ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Carregando...</span>
                  </>
                ) : (
                  <span>Carregar mais</span>
                )}
              </Button>
            ) : (
              videos.length > 0 && (
                <p className="text-xs text-gray-500">Você já visualizou todos os vídeos.</p>
              )
            )}
          </div>
        </>
      ) : (
        <>
          {filteredGenerations.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <h3 className="text-xl font-semibold text-gray-900 mb-2" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                  {isEmptyFavoritesView
                    ? 'Sem favoritos ainda'
                    : hasActiveFilters
                      ? 'Nenhum Resultado Encontrado'
                      : 'Nenhuma Foto Ainda'}
                </h3>
                <p className="text-gray-600 mb-6" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                  {isEmptyFavoritesView
                    ? 'Você ainda não favoritou nenhuma imagem.'
                    : hasActiveFilters
                      ? 'Tente ajustar seus filtros ou termos de busca'
                      : 'Comece gerando fotos com IA para construir sua galeria'
                  }
                </p>
                {isEmptyFavoritesView ? (
                  <Button onClick={toggleFavoritesFilter} style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                    Ver todas as imagens
                  </Button>
                ) : hasActiveFilters ? (
                  <Button onClick={clearFilters} style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                    Limpar Filtros
                  </Button>
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
                      {isEmptyFavoritesView
                        ? 'Sem favoritos ainda'
                        : activeTab === 'generated'
                          ? 'Nenhuma Foto Gerada'
                          : 'Nenhum Item'}
                    </h3>
                    <p className="text-gray-600 mb-6" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                      {isEmptyFavoritesView
                        ? 'Você ainda não favoritou nenhuma imagem.'
                        : activeTab === 'generated'
                          ? 'Comece gerando fotos com IA para construir sua galeria'
                          : 'Nenhum conteúdo encontrado'
                      }
                    </p>
                    {isEmptyFavoritesView ? (
                      <Button onClick={toggleFavoritesFilter} style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                        Ver todas as imagens
                      </Button>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                        {activeTab === 'generated' ? (
                          <>
                            <Button asChild className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-0">
                              <a href="/generate" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>Gere Sua Primeira Foto</a>
                            </Button>
                            <Button asChild variant="outline" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                              <a href="/editor">Usar Editor IA</a>
                            </Button>
                          </>
                        ) : (
                          <Button asChild className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-0">
                            <a href="/generate" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>Começar</a>
                          </Button>
                        )}
                      </div>
                    )}
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
                      userPlan={user?.plan || 'PREMIUM'}
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

              {/* Load more */}
              <div className="flex flex-col items-center mt-6 space-y-4">
                {hasMoreGenerations ? (
                  <Button
                    type="button"
                    onClick={handleLoadMoreGenerations}
                    disabled={isLoadingMoreGenerations}
                    className="relative inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#667EEA] to-[#764BA2] px-6 sm:px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-[#667EEA]/20 transition-all duration-200 hover:from-[#5a6bd8] hover:to-[#6a4190] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#764BA2]/60 focus-visible:ring-offset-2 disabled:opacity-70"
                  >
                    {isLoadingMoreGenerations ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Carregando...</span>
                      </>
                    ) : (
                      <span>Carregar mais</span>
                    )}
                  </Button>
                ) : (
                  generations.length > 0 && (
                    <p className="text-xs text-gray-500">Você já visualizou todas as fotos geradas.</p>
                  )
                )}
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
            onDeleteGeneration={handleDeleteGeneration}
            onToggleFavorite={toggleFavorite}
            isFavorite={favoriteImages.includes(mediaItem.url)}
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

      {/* Barra de progresso minimalista para pacotes - apenas fallback quando modal está fechado */}
      <PackageProgressBarMinimal />

    </div>
  )
}