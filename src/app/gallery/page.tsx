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
  const limit = Math.min(parseInt(params.limit || '24'), 30)
  const modelFilter = params.model
  const searchQuery = params.search
  const sortBy = (params.sort || 'newest') as 'newest' | 'oldest' | 'model' | 'prompt'
  const viewMode = params.view || 'grid'
  const activeTab = params.tab || 'generated'
  const videoStatus = params.status
  const videoQuality = params.quality

  const serializeForProps = <T,>(data: T): T => {
    return JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    )
  }

  const [models, generationBatch] = await Promise.all([
    getModelsByUserId(userId).catch(() => []),
    fetchGenerationBatch({
      userId,
      limit,
      modelId: modelFilter,
      searchQuery: searchQuery || undefined,
      sortBy
    })
  ])

  const shouldPrefetchVideos = activeTab === 'videos'

  const videoBatchPromise = shouldPrefetchVideos
    ? fetchVideoBatch({
        userId,
        limit,
        status: videoStatus || undefined,
        quality: videoQuality || undefined,
        searchQuery: searchQuery || undefined
      })
    : Promise.resolve({
        items: [] as any[],
        nextCursor: null as string | null,
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
  })

  const videoStats = videoStatsResult ? serializeForProps(videoStatsResult) : undefined

  const safeGenerations = serializeForProps(generationBatch.items)
  const safeVideos = serializeForProps(videoBatch.items)
  const safeModels = serializeForProps(models)
  const safeGenerationPagination = serializeForProps({
    limit,
    total: generationBatch.totalCount,
    nextCursor: generationBatch.nextCursor,
    hasMore: generationBatch.hasMore
  })
  const safeVideoPagination = serializeForProps({
    limit,
    total: videoBatch.totalCount,
    nextCursor: videoBatch.nextCursor,
    hasMore: videoBatch.hasMore
  })

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
              sort: sortBy,
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