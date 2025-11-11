import { requireAuth } from '@/lib/auth'
import { fetchGenerationBatch } from '@/lib/db/generations'
import { getModelsByUserId } from '@/lib/db/models'
import { fetchVideoBatch, getVideoGenerationStats } from '@/lib/db/videos'
import { AutoSyncGalleryInterface } from '@/components/gallery/auto-sync-gallery-interface'
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
  const limit = Math.min(parseInt(params.limit || '20'), 30)
  const page = Math.max(parseInt(params.page || '1'), 1)
  const modelFilter = params.model
  const searchQuery = params.search
  const sortParam = params.sort === 'oldest' ? 'oldest' : 'newest'
  const viewMode = params.view || 'grid'
  const activeTab = params.tab || 'generated'
  const videoStatus = params.status
  const videoQuality = params.quality

  // Safe serialization with comprehensive error handling
  const serializeForProps = <T,>(data: T, context = 'unknown'): T => {
    try {
      // Handle null/undefined early
      if (data === null || data === undefined) {
        return data as T
      }

      return JSON.parse(
        JSON.stringify(data, (key, value) => {
          // Handle BigInt
          if (typeof value === 'bigint') {
            return value.toString()
          }
          // Handle Date objects
          if (value instanceof Date) {
            return value.toISOString()
          }
          // Skip functions
          if (typeof value === 'function') {
            return undefined
          }
          // Handle Buffer (common in Prisma)
          if (value && typeof value === 'object' && value.type === 'Buffer') {
            return undefined
          }
          return value
        })
      )
    } catch (error) {
      console.error(`❌ Serialization error in ${context}:`, error)
      console.error('Failed data sample:', typeof data === 'object' ? JSON.stringify(data, null, 2).substring(0, 500) : data)

      // Return safe fallback based on type
      if (Array.isArray(data)) {
        return [] as unknown as T
      }
      if (typeof data === 'object' && data !== null) {
        return {} as T
      }
      return data
    }
  }

  // Fetch data with better error handling
  let models: any[] = []
  let generationBatch: any = { items: [], totalCount: 0, page: 1, totalPages: 1, hasMore: false }

  try {
    [models, generationBatch] = await Promise.all([
      getModelsByUserId(userId).catch((err) => {
        console.error('❌ Error fetching models:', err)
        return []
      }),
      fetchGenerationBatch({
        userId,
        limit,
        page,
        modelId: modelFilter,
        searchQuery: searchQuery || undefined,
        sortBy: sortParam
      }).catch((err) => {
        console.error('❌ Error fetching generations:', err)
        return { items: [], totalCount: 0, page: 1, totalPages: 1, hasMore: false }
      })
    ])
  } catch (error) {
    console.error('❌ Critical error loading gallery data:', error)
    // Use safe defaults
  }

  const shouldPrefetchVideos = activeTab === 'videos'

  const videoBatchPromise = shouldPrefetchVideos
    ? fetchVideoBatch({
        userId,
        limit,
        page,
        status: videoStatus || undefined,
        quality: videoQuality || undefined,
        searchQuery: searchQuery || undefined
      })
    : Promise.resolve({
        items: [] as any[],
        page: 1,
        totalPages: 1,
        hasMore: false,
        totalCount: 0
      })

  const videoStatsPromise = shouldPrefetchVideos
    ? getVideoGenerationStats(userId).catch(() => ({
        totalVideos: 0,
        completedVideos: 0,
        processingVideos: 0,
        failedVideos: 0,
        totalCreditsUsed: 0
      }))
    : Promise.resolve(undefined)

  const [videoBatch, videoStatsResult] = await Promise.all([
    videoBatchPromise,
    videoStatsPromise
  ])

  const stats = serializeForProps({
    totalGenerations: generationBatch.totalCount,
    completedGenerations: generationBatch.totalCount,
    totalImages: generationBatch.totalCount,
    favoriteImages: 0,
    collections: 0
  }, 'stats')

  const videoStats = videoStatsResult ? serializeForProps(videoStatsResult, 'videoStats') : undefined

  const safeGenerations = serializeForProps(generationBatch.items, 'generations')
  const safeVideos = serializeForProps(videoBatch.items, 'videos')
  const safeModels = serializeForProps(models, 'models')
  const safeGenerationPagination = serializeForProps({
    limit,
    total: generationBatch.totalCount,
    page: generationBatch.page,
    pages: generationBatch.totalPages
  }, 'generationPagination')
  const safeVideoPagination = serializeForProps({
    limit,
    total: videoBatch.totalCount,
    page: videoBatch.page,
    pages: videoBatch.totalPages,
    hasMore: videoBatch.hasMore
  }, 'videoPagination')

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
            user={session.user}
            initialGenerations={safeGenerations}
            initialVideos={safeVideos}
            pagination={safeGenerationPagination}
            videoPagination={safeVideoPagination}
            stats={stats}
            videoStats={videoStats}
            filters={{
              model: modelFilter,
              search: searchQuery || undefined,
              sort: sortParam,
              view: viewMode,
              tab: activeTab === 'videos' ? 'videos' : 'generated'
            }}
            models={safeModels}
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