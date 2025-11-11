import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { fetchGenerationBatch } from '@/lib/db/generations'
import { fetchVideoBatch } from '@/lib/db/videos'
import { VideoStatus } from '@prisma/client'

// Configurar cache dinâmico
export const dynamic = 'force-dynamic'
export const revalidate = 0 // Não usar cache estático, usar cache manual

/**
 * API endpoint para buscar dados da galeria
 * Usado pela interface AutoSyncGalleryInterface para atualizações automáticas
 *
 * Cache Strategy:
 * - Dados de galeria: 30 segundos
 * - Modelos do usuário: 5 minutos (mudam raramente)
 * - Stats: 1 minuto
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '24', 10), 40)
    const modelFilter = searchParams.get('model') || undefined
    const searchQuery = searchParams.get('search') || undefined
    const sortBy = (searchParams.get('sort') || 'newest') as 'newest' | 'oldest' | 'model' | 'prompt'
    const tab = searchParams.get('tab') || 'generated'
    const cursor = searchParams.get('cursor') || undefined
    const statusParam = searchParams.get('status') || undefined
    const qualityParam = searchParams.get('quality') || undefined

    if (tab === 'videos') {
      const videoResult = await fetchVideoBatch({
        userId,
        limit,
        cursor,
        status: statusParam ? (statusParam.toUpperCase() as VideoStatus) : undefined,
        quality: qualityParam || undefined,
        searchQuery
      })

      const totalCreditsUsed = videoResult.items.reduce((sum, video) => {
        const credits = typeof video.creditsUsed === 'number' ? video.creditsUsed : parseFloat(video.creditsUsed || '0')
        return sum + (isNaN(credits) ? 0 : credits)
      }, 0)

      return NextResponse.json({
        generations: [],
        editHistory: [],
        videos: videoResult.items,
        stats: {
          totalGenerations: 0,
          completedGenerations: 0,
          totalImages: 0,
          favoriteImages: 0,
          collections: 0,
          totalVideos: videoResult.totalCount,
          totalCreditsUsed
        },
        pagination: {
          limit,
          total: videoResult.totalCount,
          nextCursor: videoResult.nextCursor,
          hasMore: videoResult.hasMore
        },
        timestamp: new Date().toISOString()
      })
    }

    const generationResult = await fetchGenerationBatch({
      userId,
      limit,
      cursor,
      modelId: modelFilter,
      searchQuery,
      sortBy
    })

    return NextResponse.json({
      generations: generationResult.items,
      editHistory: [],
      videos: [],
      stats: {
        totalGenerations: generationResult.totalCount,
        completedGenerations: generationResult.totalCount,
        totalImages: generationResult.totalCount,
        favoriteImages: 0,
        collections: 0,
        totalVideos: 0,
        totalCreditsUsed: 0
      },
      pagination: {
        limit,
        total: generationResult.totalCount,
        nextCursor: generationResult.nextCursor,
        hasMore: generationResult.hasMore
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Gallery data API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch gallery data' },
      { status: 500 }
    )
  }
}