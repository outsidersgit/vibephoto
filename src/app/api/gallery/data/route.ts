import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { getGenerationsByUserId, searchGenerations } from '@/lib/db/generations'
import { getModelsByUserId } from '@/lib/db/models'
import { getEditHistoryByUserId, searchEditHistory } from '@/lib/db/edit-history'
import { getVideoGenerationsByUserId, searchVideoGenerations } from '@/lib/db/videos'
import { VideoStatus, GenerationStatus } from '@prisma/client'
import { prisma } from '@/lib/db'

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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20
    const modelFilter = searchParams.get('model') || undefined
    const searchQuery = searchParams.get('search') || undefined
    const sortBy = searchParams.get('sort') || 'newest'
    const tab = searchParams.get('tab') || 'generated'

    // Cache para modelos do usuário (5 minutos)
    const getCachedModels = unstable_cache(
      async (uid: string) => {
        try {
          return await getModelsByUserId(uid)
        } catch (error) {
          console.error('Error fetching models for gallery API:', error)
          return []
        }
      },
      [`user-models-${userId}`],
      {
        revalidate: 300, // 5 minutos
        tags: [`user-${userId}-models`]
      }
    )

    const models = await getCachedModels(userId)

    // Cache key baseado nos parâmetros de busca
    const cacheKey = `gallery-${userId}-${tab}-p${page}-${modelFilter || 'all'}-${searchQuery || 'none'}-${sortBy}`

    // Função para buscar dados com cache (30 segundos)
    const getCachedGalleryData = unstable_cache(
      async () => {
        let generationsData = { generations: [], totalCount: 0 }
        let editHistoryData = { editHistory: [], totalCount: 0 }
        let videosData = { videos: [], totalCount: 0 }

        if (tab === 'edited') {
          // Get edited images from edit_history table
          try {
            if (searchQuery) {
              editHistoryData = await searchEditHistory(userId, searchQuery, page, limit)
            } else {
              editHistoryData = await getEditHistoryByUserId(userId, page, limit)
            }
          } catch (error) {
            console.error('Error fetching edit history for gallery API:', error)
            editHistoryData = { editHistory: [], totalCount: 0 }
          }
        } else if (tab === 'videos') {
      // Get videos from video_generations table - only show completed ones
      try {
        if (searchQuery) {
          videosData = await searchVideoGenerations(userId, searchQuery, page, limit)
        } else {
          videosData = await getVideoGenerationsByUserId(userId, page, limit, VideoStatus.COMPLETED)
        }
      } catch (error) {
        console.error('Error fetching videos for gallery API:', error)
        videosData = { videos: [], totalCount: 0 }
      }
    } else if (tab === 'packages') {
      // Get package generations - only show completed ones with packageId
      try {
        const skip = (page - 1) * limit
        const where = {
          userId,
          status: GenerationStatus.COMPLETED,
          packageId: { not: null },
          ...(modelFilter && { modelId: modelFilter }),
          ...(searchQuery && {
            OR: [
              { prompt: { contains: searchQuery, mode: 'insensitive' } },
              { model: { name: { contains: searchQuery, mode: 'insensitive' } } }
            ]
          })
        }

        const [generations, total] = await Promise.all([
          prisma.generation.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
              model: true,
              userPackage: {
                include: {
                  package: true
                }
              }
            }
          }),
          prisma.generation.count({ where })
        ])

        generationsData = { generations, totalCount: total }
      } catch (error) {
        console.error('Error fetching package generations for gallery API:', error)
        generationsData = { generations: [], totalCount: 0 }
      }
    } else {
      // Get generations (default tab) - only show completed ones without packageId
      try {
        if (searchQuery) {
          generationsData = await searchGenerations(userId, searchQuery, page, limit, GenerationStatus.COMPLETED)
        } else {
          // Modified to exclude package generations
          const skip = (page - 1) * limit
          const where = {
            userId,
            status: GenerationStatus.COMPLETED,
            packageId: null, // Exclude package generations
            ...(modelFilter && { modelId: modelFilter })
          }

          const [generations, total] = await Promise.all([
            prisma.generation.findMany({
              where,
              skip,
              take: limit,
              orderBy: { createdAt: 'desc' },
              include: { model: true }
            }),
            prisma.generation.count({ where })
          ])

          generationsData = { generations, totalCount: total }
        }
      } catch (error) {
        console.error('Error fetching generations for gallery API:', error)
        generationsData = { generations: [], totalCount: 0 }
      }
    }

        // Get updated stats based on tab
        let totalCount = 0
        let completedCount = 0
        let currentData = []
        let currentTotalCount = 0

        if (tab === 'edited') {
      currentData = editHistoryData.editHistory
      currentTotalCount = editHistoryData.totalCount
      // For edited images, count from edit_history table
      try {
        totalCount = await prisma.editHistory.count({ where: { userId } })
        completedCount = totalCount // All edit history entries are "completed"
      } catch (error) {
        console.error('Error fetching edit history stats:', error)
        totalCount = editHistoryData.editHistory?.length || 0
        completedCount = totalCount
      }
    } else if (tab === 'videos') {
      currentData = videosData.videos
      currentTotalCount = videosData.totalCount
      // For videos, count only completed ones
      try {
        const completedVideosCount = await prisma.videoGeneration.count({
          where: { userId, status: VideoStatus.COMPLETED }
        })
        totalCount = completedVideosCount
        completedCount = completedVideosCount
      } catch (error) {
        console.error('Error fetching video stats:', error)
        totalCount = videosData.videos?.filter(v => v.status === 'COMPLETED').length || 0
        completedCount = totalCount
      }
    } else if (tab === 'packages') {
      currentData = generationsData.generations
      currentTotalCount = generationsData.totalCount
      // For packages, count only completed package generations
      try {
        const completedPackagesCount = await prisma.generation.count({
          where: { userId, packageId: { not: null }, status: GenerationStatus.COMPLETED }
        })
        totalCount = completedPackagesCount
        completedCount = completedPackagesCount
      } catch (error) {
        console.error('Error fetching package stats:', error)
        totalCount = generationsData.generations?.filter(g => g.status === 'COMPLETED' && g.packageId).length || 0
        completedCount = totalCount
      }
    } else {
      currentData = generationsData.generations
      currentTotalCount = generationsData.totalCount
      // For generations, count only completed ones without packageId
      try {
        const completedGenerationsCount = await prisma.generation.count({
          where: { userId, packageId: null, status: GenerationStatus.COMPLETED }
        })
        totalCount = completedGenerationsCount
        completedCount = completedGenerationsCount
      } catch (error) {
        console.error('Error fetching generation stats:', error)
        totalCount = generationsData.generations?.filter(g => g.status === 'COMPLETED' && !g.packageId).length || 0
        completedCount = totalCount
      }
    }

        // Transform edit history data to match generations format
        const transformedEditHistory = editHistoryData.editHistory.map(edit => ({
          id: edit.id,
          userId: edit.userId,
          status: 'COMPLETED', // All edit history entries are completed
          prompt: `[EDITED] ${edit.prompt}`,
          imageUrls: [edit.editedImageUrl], // Transform single URL to array
          thumbnailUrls: [edit.thumbnailUrl || edit.editedImageUrl], // Use thumbnail or fallback to main image
          createdAt: edit.createdAt,
          updatedAt: edit.updatedAt,
          metadata: edit.metadata,
          operation: edit.operation,
          originalImageUrl: edit.originalImageUrl,
          // Add fields expected by gallery components
          model: { name: `Editor IA - ${edit.operation}` },
          parameters: {
            prompt: edit.prompt,
            operation: edit.operation
          }
        }))

        const pagination = {
          page,
          limit,
          total: currentTotalCount,
          pages: Math.ceil(currentTotalCount / limit)
        }

        return {
          generations: tab === 'generated' ? generationsData.generations :
                      tab === 'edited' ? transformedEditHistory : [],
          editHistory: [], // Keep empty to avoid confusion
          videos: tab === 'videos' ? videosData.videos : [],
          stats: {
            totalGenerations: totalCount,
            completedGenerations: completedCount,
            totalImages: completedCount,
            favoriteImages: 0,
            collections: 0
          },
          pagination
        }
      },
      [cacheKey],
      {
        revalidate: 30, // Cache por 30 segundos
        tags: [`user-${userId}-gallery`, `gallery-${tab}`]
      }
    )

    // Executar função com cache
    const cachedData = await getCachedGalleryData()

    return NextResponse.json({
      ...cachedData,
      models,
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