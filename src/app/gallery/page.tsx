import { requireAuth } from '@/lib/auth'
import { getGenerationsByUserId, searchGenerations } from '@/lib/db/generations'
import { getModelsByUserId } from '@/lib/db/models'
import { getVideoGenerationsByUserId, getVideoGenerationStats } from '@/lib/db/videos'
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
    
    if (activeTab === 'packages') {
      const where = {
        userId,
        status: 'COMPLETED' as any,
        packageId: { not: null },
        ...(modelFilter && { modelId: modelFilter }),
        ...(searchQuery && {
          OR: [
            { prompt: { contains: searchQuery, mode: 'insensitive' as any } },
            { model: { name: { contains: searchQuery, mode: 'insensitive' as any } } }
          ]
        })
      }

      // Query paralela: models + generations + count
      const [modelsResult, generations, total] = await Promise.all([
        getModelsByUserId(userId),
        prisma.generation.findMany({
          where,
          skip,
          take: limit,
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
        prisma.generation.count({ where })
      ])

      models = modelsResult
      generationsData = { generations, totalCount: total }
      
    } else if (searchQuery) {
      // Query paralela: models + search
      const [modelsResult, searchResult] = await Promise.all([
        getModelsByUserId(userId),
        searchGenerations(userId, searchQuery, page, limit)
      ])
      
      models = modelsResult
      generationsData = searchResult
      
    } else {
      const where = {
        userId,
        status: 'COMPLETED' as any,
        packageId: null,
        ...(modelFilter && { modelId: modelFilter })
      }

      // Query paralela: models + generations + count
      const [modelsResult, generations, total] = await Promise.all([
        getModelsByUserId(userId),
        prisma.generation.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { 
            model: {
              select: { id: true, name: true, class: true }
            }
          }
        }),
        prisma.generation.count({ where })
      ])

      models = modelsResult
      generationsData = { generations, totalCount: total }
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
    const packageCondition = activeTab === 'packages' 
      ? { packageId: { not: null } } 
      : { packageId: null }
    
    const statsAgg = await prisma.generation.groupBy({
      by: ['status'],
      where: { userId, ...packageCondition },
      _count: { status: true }
    })
    
    totalCount = statsAgg.reduce((sum, stat) => sum + stat._count.status, 0)
    completedCount = statsAgg.find(s => s.status === 'COMPLETED')?._count.status || 0
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
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 py-4 sm:py-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                Galeria
              </h1>
            </div>
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3">
              <a
                href="/generate"
                className="inline-flex items-center justify-center px-4 sm:px-6 py-2 text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-br from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] border-[#667EEA] shadow-lg shadow-[#667EEA]/25 transition-all duration-200 min-w-[120px] text-center"
                style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
              >
                Gerar Nova Foto
              </a>
              <a
                href="/generate?tab=video"
                className="inline-flex items-center justify-center px-4 sm:px-6 py-2 text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-br from-[#764BA2] to-[#667EEA] hover:from-[#6a4190] hover:to-[#5a6bd8] border-[#764BA2] shadow-lg shadow-[#764BA2]/25 transition-all duration-200 min-w-[120px] text-center"
                style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
              >
                Gerar Novo Vídeo
              </a>
              <a
                href="/editor"
                className="inline-flex items-center justify-center px-4 sm:px-6 py-2 text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-br from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] border-[#667EEA] shadow-lg shadow-[#667EEA]/25 transition-all duration-200 min-w-[120px] text-center"
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