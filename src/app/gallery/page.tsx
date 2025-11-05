import { requireAuth } from '@/lib/auth'
import { getGenerationsByUserId, searchGenerations } from '@/lib/db/generations'
import { getModelsByUserId } from '@/lib/db/models'
import { getVideoGenerationsByUserId, getVideoGenerationStats } from '@/lib/db/videos'
import { getEditHistoryByUserId, searchEditHistory } from '@/lib/db/edit-history'
import { AutoSyncGalleryInterface } from '@/components/gallery/auto-sync-gallery-interface'
import { prisma } from '@/lib/db'
import { ProtectedPageScript } from '@/components/auth/protected-page-script'

interface GalleryPageProps {
  searchParams: Promise<{
    model?: string
    generation?: string
    search?: string
    page?: string
    limit?: string
    sort?: string
    view?: string
    tab?: string
    status?: string
    quality?: string
  }>
}

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const session = await requireAuth()
  const userId = session.user.id

  const params = await searchParams
  const page = parseInt(params.page || '1')
  const limit = parseInt(params.limit || '20')
  const modelFilter = params.model
  const searchQuery = params.search
  const sortBy = params.sort || 'newest'
  const viewMode = params.view || 'grid'
  const activeTab = params.tab || 'generated'
  const videoStatus = params.status
  const videoQuality = params.quality

  // Otimização: Buscar modelos e gerações em paralelo para reduzir latência (Fase 2 - Performance)
  let models = []
  let generationsData = { generations: [], totalCount: 0 }
  
  try {
    // Executar todas as queries em paralelo com Promise.all
    const skip = (page - 1) * limit
    
    if (activeTab === 'generated' || !activeTab || activeTab === 'edited' || activeTab === 'packages') {
      // Consolidate all photos in "Fotos Geradas" tab (normal, editor, packages, edited)
      const where = {
        userId,
        status: 'COMPLETED' as any,
        ...(modelFilter && { modelId: modelFilter }),
        ...(searchQuery && {
          OR: [
            { prompt: { contains: searchQuery, mode: 'insensitive' as any } },
            { model: { name: { contains: searchQuery, mode: 'insensitive' as any } } }
          ]
        })
      }

      // Query paralela: models + generations + edit_history + counts
      // Fetch all data first, then combine and paginate
      const [modelsResult, allGenerations, allEditHistory, generationCount, editHistoryCount] = await Promise.all([
        getModelsByUserId(userId),
        prisma.generation.findMany({
          where,
          // Don't paginate here - fetch all to combine with edit_history
          orderBy: { createdAt: 'desc' },
          include: { 
            model: {
              select: { id: true, name: true, class: true }
            },
            userPackage: {
              include: {
                package: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        }),
        // Fetch all edit history entries (no pagination yet)
        searchQuery 
          ? searchEditHistory(userId, searchQuery, 1, 10000) // Get all for search
          : getEditHistoryByUserId(userId, 1, 10000), // Get all for regular view
        prisma.generation.count({ where }),
        prisma.editHistory.count({ 
          where: searchQuery ? {
            userId,
            prompt: { contains: searchQuery, mode: 'insensitive' as any }
          } : { userId }
        })
      ])

      // Transform edit_history entries to match generations format
      const transformedEditHistory = allEditHistory.editHistory.map(edit => ({
        id: edit.id,
        userId: edit.userId,
        modelId: null,
        model: {
          id: 'editor',
          name: `Editor IA - ${edit.operation}`,
          class: 'EDITOR'
        },
        prompt: `[EDITOR] ${edit.prompt}`,
        status: 'COMPLETED' as any,
        imageUrls: [edit.editedImageUrl],
        thumbnailUrls: [edit.thumbnailUrl || edit.editedImageUrl],
        createdAt: edit.createdAt,
        updatedAt: edit.updatedAt,
        completedAt: edit.createdAt,
        metadata: {
          ...edit.metadata,
          source: 'edit_history',
          operation: edit.operation,
          originalImageUrl: edit.originalImageUrl
        },
        // Add fields for compatibility
        aspectRatio: '1:1',
        resolution: '1024x1024',
        estimatedCost: 15,
        aiProvider: 'nano-banana',
        packageId: null,
        userPackage: null
      }))

      // Combine generations and transformed edit history, then sort by date
      const allPhotos = [...allGenerations, ...transformedEditHistory].sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime()
        const dateB = new Date(b.createdAt).getTime()
        return dateB - dateA // Newest first
      })

      // Apply pagination to combined results
      const paginatedPhotos = allPhotos.slice(skip, skip + limit)
      const totalCount = generationCount + editHistoryCount

      models = modelsResult
      generationsData = { generations: paginatedPhotos, totalCount }
    } else if (searchQuery && activeTab === 'generated') {
      // Query paralela: models + search (both generations and edit_history)
      const [modelsResult, generationSearchResult, editHistorySearchResult] = await Promise.all([
        getModelsByUserId(userId),
        searchGenerations(userId, searchQuery, page, limit),
        searchEditHistory(userId, searchQuery, page, limit)
      ])
      
      // Transform edit_history search results
      const transformedEditHistory = editHistorySearchResult.editHistory.map(edit => ({
        id: edit.id,
        userId: edit.userId,
        modelId: null,
        model: {
          id: 'editor',
          name: `Editor IA - ${edit.operation}`,
          class: 'EDITOR'
        },
        prompt: `[EDITOR] ${edit.prompt}`,
        status: 'COMPLETED' as any,
        imageUrls: [edit.editedImageUrl],
        thumbnailUrls: [edit.thumbnailUrl || edit.editedImageUrl],
        createdAt: edit.createdAt,
        updatedAt: edit.updatedAt,
        completedAt: edit.createdAt,
        metadata: {
          ...edit.metadata,
          source: 'edit_history',
          operation: edit.operation,
          originalImageUrl: edit.originalImageUrl
        },
        aspectRatio: '1:1',
        resolution: '1024x1024',
        estimatedCost: 15,
        aiProvider: 'nano-banana',
        packageId: null,
        userPackage: null
      }))
      
      // Combine and sort search results
      const allSearchResults = [...generationSearchResult.generations, ...transformedEditHistory].sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime()
        const dateB = new Date(b.createdAt).getTime()
        return dateB - dateA
      })
      
      // Apply pagination to combined results
      const searchSkip = (page - 1) * limit
      const paginatedResults = allSearchResults.slice(searchSkip, searchSkip + limit)
      const totalSearchCount = generationSearchResult.totalCount + editHistorySearchResult.totalCount
      
      models = modelsResult
      generationsData = { generations: paginatedResults, totalCount: totalSearchCount }
    }
  } catch (error) {
    console.error('Database error:', error)
    models = []
    generationsData = { generations: [], totalCount: 0 }
  }

  // Get video data if on videos tab
  let videosData = { videos: [], totalCount: 0 }
  let videoStats = null
  
  if (activeTab === 'videos') {
    try {
      if (searchQuery) {
        // Search videos by prompt
        const { searchVideoGenerations } = await import('@/lib/db/videos')
        videosData = await searchVideoGenerations(userId, searchQuery, page, limit)
      } else {
        // Get videos with status and quality filters
        videosData = await getVideoGenerationsByUserId(
          userId, 
          page, 
          limit, 
          videoStatus as any,
          videoQuality as any
        )
      }
      
      // Get video stats
      videoStats = await getVideoGenerationStats(userId)
    } catch (error) {
      console.error('Database error fetching videos:', error)
      videosData = { videos: [], totalCount: 0 }
      videoStats = {
        totalVideos: 0,
        completedVideos: 0,
        processingVideos: 0,
        failedVideos: 0,
        totalCreditsUsed: 0,
      }
    }
  }

  // Otimização: Usar query agregada única ao invés de múltiplas counts (Fase 2 - Performance)
  let totalCount = 0
  let completedCount = 0

  try {
    // Uma única query agregada com groupBy por status
    // Include all photos in "Fotos Geradas" tab (generations + edit_history)
    const [statsAgg, editHistoryCount] = await Promise.all([
      prisma.generation.groupBy({
        by: ['status'],
        where: { userId },
        _count: { status: true }
      }),
      prisma.editHistory.count({ where: { userId } })
    ])
    
    const generationCompleted = statsAgg.find(s => s.status === 'COMPLETED')?._count.status || 0
    totalCount = statsAgg.reduce((sum, stat) => sum + stat._count.status, 0) + editHistoryCount
    completedCount = generationCompleted + editHistoryCount
  } catch (error) {
    console.error('Database error in gallery stats:', error)
    // Use fallback stats from generationsData
    totalCount = generationsData?.generations?.length || 0
    completedCount = generationsData?.generations?.filter(g => g.status === 'COMPLETED').length || 0
  }
  
  const stats = {
    totalGenerations: totalCount,
    completedGenerations: completedCount,
    totalImages: completedCount, // Simplified - assume 1 image per generation
    favoriteImages: 0, // This would come from a favorites table
    collections: 0 // This would come from collections
  }

  return (
    <>
      {/* CRITICAL: Script compartilhado que verifica autenticação ANTES do React hidratar */}
      {/* Isso previne erros quando a página é restaurada do bfcache */}
      <ProtectedPageScript />
      
      <div className="min-h-screen bg-gray-50" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
        {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 py-4 sm:py-8">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                Galeria
              </h1>
            </div>
            <div className="flex flex-row items-center justify-end gap-2 sm:gap-3">
              <a
                href="/generate"
                className="inline-flex items-center justify-center px-4 sm:px-6 py-2 text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-br from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] border-[#667EEA] shadow-lg shadow-[#667EEA]/25 transition-all duration-200 w-[140px] sm:w-auto text-center"
                style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
              >
                Gerar Nova Foto
              </a>
              <a
                href="/generate?tab=video"
                className="inline-flex items-center justify-center px-4 sm:px-6 py-2 text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-br from-[#764BA2] to-[#667EEA] hover:from-[#6a4190] hover:to-[#5a6bd8] border-[#764BA2] shadow-lg shadow-[#764BA2]/25 transition-all duration-200 w-[140px] sm:w-auto text-center"
                style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
              >
                Gerar Novo Vídeo
              </a>
              <a
                href="/editor"
                className="inline-flex items-center justify-center px-4 sm:px-6 py-2 text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-br from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] border-[#667EEA] shadow-lg shadow-[#667EEA]/25 transition-all duration-200 w-[140px] sm:w-auto text-center"
                style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
              >
                Editor IA
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {session?.user ? (
          <AutoSyncGalleryInterface
            initialGenerations={generationsData.generations}
            initialVideos={videosData.videos}
            pagination={{
              page,
              limit,
              total: generationsData.totalCount,
              pages: Math.ceil(generationsData.totalCount / limit)
            }}
            videoPagination={{
              page,
              limit,
              total: videosData.totalCount,
              pages: Math.ceil(videosData.totalCount / limit)
            }}
            models={models}
            stats={stats}
            videoStats={videoStats}
            filters={{
              model: modelFilter,
              search: searchQuery,
              sort: sortBy,
              view: viewMode,
              page,
              tab: activeTab
            }}
            user={session.user}
          />
        ) : (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Verificando autenticação...</p>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  )
}