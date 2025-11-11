import { prisma } from '../prisma'
import { VideoStatus, VideoQuality } from '@prisma/client'
import type { VideoGenerationRequest } from '../ai/video/config'

/**
 * Create a new video generation record
 */
export async function createVideoGeneration(
  userId: string,
  request: VideoGenerationRequest & {
    creditsUsed?: number
    estimatedTime?: number
    sourceGenerationId?: string
  }
) {
  try {
    console.log('🎬 Creating video generation with data:', {
      userId,
      sourceImageUrl: request.sourceImageUrl,
      hasImage: !!request.sourceImageUrl,
      mode: request.sourceImageUrl ? 'image-to-video' : 'text-to-video'
    })

    const videoGeneration = await prisma.videoGeneration.create({
      data: {
        userId,
        sourceImageUrl: request.sourceImageUrl || null,
        sourceGenerationId: request.sourceGenerationId || null,
        prompt: request.prompt,
        negativePrompt: request.negativePrompt || null,
        duration: request.duration,
        aspectRatio: request.aspectRatio,
        quality: request.quality === 'pro' ? VideoQuality.pro : VideoQuality.standard,
        template: request.template || null,
        creditsUsed: request.creditsUsed || 20,
        estimatedTimeRemaining: request.estimatedTime || 90,
        status: VideoStatus.STARTING
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            plan: true
          }
        },
        sourceGeneration: {
          select: {
            id: true,
            prompt: true,
            imageUrls: true
          }
        }
      }
    })

    console.log(`✅ Video generation created: ${videoGeneration.id}`)
    return videoGeneration

  } catch (error) {
    console.error('❌ Failed to create video generation:', error)
    throw new Error(`Failed to create video generation: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Update video generation with job ID after submitting to provider
 */
export async function updateVideoGenerationJobId(
  id: string,
  jobId: string,
  estimatedTime?: number
) {
  try {
    const updated = await prisma.videoGeneration.update({
      where: { id },
      data: {
        jobId,
        status: VideoStatus.PROCESSING,
        processingStartedAt: new Date(),
        estimatedTimeRemaining: estimatedTime || undefined
      }
    })

    console.log(`✅ Video generation ${id} started with job ${jobId}`)
    return updated

  } catch (error) {
    console.error(`❌ Failed to update video generation job ID:`, error)
    throw new Error(`Failed to update video generation: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Update video generation status and progress
 */
export async function updateVideoGenerationStatus(
  id: string,
  status: VideoStatus,
  progress?: number,
  videoUrl?: string,
  thumbnailUrl?: string,
  errorMessage?: string,
) {
  try {
    const updateData: any = {
      status,
      updatedAt: new Date()
    }

    if (progress !== undefined) {
      updateData.progress = Math.max(0, Math.min(100, progress))
    }

    if (videoUrl) {
      updateData.videoUrl = videoUrl
    }

    if (thumbnailUrl) {
      updateData.thumbnailUrl = thumbnailUrl
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage
    }


    // Set completion time if completed or failed
    if (status === VideoStatus.COMPLETED || status === VideoStatus.FAILED || status === VideoStatus.CANCELLED) {
      updateData.processingCompletedAt = new Date()
      if (status === VideoStatus.COMPLETED) {
        updateData.progress = 100
      }
    }

    const updated = await prisma.videoGeneration.update({
      where: { id },
      data: updateData
    })

    console.log(`✅ Video generation ${id} updated to status: ${status}`)
    return updated

  } catch (error) {
    console.error(`❌ Failed to update video generation status:`, error)
    throw new Error(`Failed to update video generation: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Update video generation by job ID (used by webhooks)
 */
export async function updateVideoGenerationByJobId(
  jobId: string,
  status: VideoStatus,
  videoUrl?: string | null,
  errorMessage?: string,
  thumbnailUrl?: string,
  metadata?: any
) {
  try {
    const updateData: any = {
      status,
      updatedAt: new Date()
    }

    if (videoUrl !== undefined) {
      updateData.videoUrl = videoUrl
    }

    if (thumbnailUrl !== undefined) {
      updateData.thumbnailUrl = thumbnailUrl
    }

    if (metadata) {
      updateData.metadata = metadata
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage
    }

    // Set completion time and progress
    if (status === VideoStatus.COMPLETED || status === VideoStatus.FAILED || status === VideoStatus.CANCELLED) {
      updateData.processingCompletedAt = new Date()
      if (status === VideoStatus.COMPLETED) {
        updateData.progress = 100
      }
    }

    const updated = await prisma.videoGeneration.update({
      where: { jobId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    console.log(`✅ Video generation updated by jobId ${jobId}: ${status}`)
    return updated

  } catch (error) {
    console.error(`❌ Failed to update video generation by jobId:`, error)
    throw new Error(`Failed to update video generation: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get video generation by ID
 */
export async function getVideoGenerationById(id: string) {
  try {
    const video = await prisma.videoGeneration.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            plan: true
          }
        },
        sourceGeneration: {
          select: {
            id: true,
            prompt: true,
            imageUrls: true
          }
        }
      }
    })

    return video
  } catch (error) {
    console.error(`❌ Failed to get video generation:`, error)
    throw new Error(`Failed to get video generation: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get video generation by job ID
 */
export async function getVideoGenerationByJobId(jobId: string) {
  try {
    const video = await prisma.videoGeneration.findUnique({
      where: { jobId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            plan: true
          }
        }
      }
    })

    return video
  } catch (error) {
    console.error(`❌ Failed to get video generation by jobId:`, error)
    throw new Error(`Failed to get video generation: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get video generations for a user with pagination
 */
export async function getVideoGenerationsByUserId(
  userId: string,
  page: number = 1,
  limit: number = 20,
  status?: VideoStatus,
  quality?: VideoQuality
) {
  try {
    const offset = (page - 1) * limit

    const where: any = { userId }

    if (status) {
      where.status = status
    }

    if (quality) {
      where.quality = quality
    }

    const [videos, totalCount] = await Promise.all([
      prisma.videoGeneration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          // Include all video generation fields
          id: true,
          sourceImageUrl: true, // This is the key field that was missing!
          sourceGenerationId: true,
          prompt: true,
          negativePrompt: true,
          duration: true,
          aspectRatio: true,
          quality: true,
          template: true,
          status: true,
          jobId: true,
          errorMessage: true,
          videoUrl: true,
          thumbnailUrl: true,
          storageProvider: true,
          storageBucket: true,
          storageKey: true,
          posterKey: true,
          publicUrl: true,
          mimeType: true,
          sizeBytes: true,
          durationSec: true,
          creditsUsed: true,
          progress: true,
          processingStartedAt: true,
          estimatedTimeRemaining: true,
          createdAt: true,
          updatedAt: true,
          processingCompletedAt: true,
          metadata: true,
          userId: true,
          // Include related sourceGeneration data
          sourceGeneration: {
            select: {
              id: true,
              prompt: true,
              imageUrls: true
            }
          }
        }
      }),
      prisma.videoGeneration.count({ where })
    ])

    // Convert BigInt fields to strings for JSON serialization
    const videosWithSerializableFields = videos.map(video => ({
      ...video,
      sizeBytes: video.sizeBytes ? video.sizeBytes.toString() : null
    }))

    return {
      videos: videosWithSerializableFields,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    }
  } catch (error) {
    console.error(`❌ Failed to get video generations for user:`, error)
    throw new Error(`Failed to get video generations: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get video generation statistics for a user
 */
export async function getVideoGenerationStats(userId: string) {
  try {
    const [
      totalVideos,
      completedVideos,
      processingVideos,
      failedVideos,
      totalCreditsUsed,
      todayVideos
    ] = await Promise.all([
      // Total videos
      prisma.videoGeneration.count({
        where: { userId }
      }),
      // Completed videos
      prisma.videoGeneration.count({
        where: { userId, status: VideoStatus.COMPLETED }
      }),
      // Processing videos
      prisma.videoGeneration.count({
        where: { userId, status: VideoStatus.PROCESSING }
      }),
      // Failed videos
      prisma.videoGeneration.count({
        where: { userId, status: VideoStatus.FAILED }
      }),
      // Total credits used
      prisma.videoGeneration.aggregate({
        where: { userId },
        _sum: { creditsUsed: true }
      }),
      // Videos created today
      prisma.videoGeneration.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ])

    return {
      totalVideos,
      completedVideos,
      processingVideos,
      failedVideos,
      totalCreditsUsed: totalCreditsUsed._sum.creditsUsed || 0,
      todayVideos,
      completionRate: totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0
    }
  } catch (error) {
    console.error(`❌ Failed to get video generation stats:`, error)
    throw new Error(`Failed to get video stats: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get processing videos for a user (to check concurrent limits)
 */
export async function getProcessingVideosCount(userId: string): Promise<number> {
  try {
    const count = await prisma.videoGeneration.count({
      where: {
        userId,
        status: {
          in: [VideoStatus.STARTING, VideoStatus.PROCESSING]
        }
      }
    })
    
    return count
  } catch (error) {
    console.error(`❌ Failed to get processing videos count:`, error)
    throw new Error(`Failed to get processing videos count: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Delete a video generation
 */
export async function deleteVideoGeneration(id: string, userId: string) {
  try {
    // First verify ownership
    const video = await prisma.videoGeneration.findFirst({
      where: { id, userId }
    })
    
    if (!video) {
      throw new Error('Video generation not found or access denied')
    }
    
    // Can only delete if not processing
    if (video.status === VideoStatus.PROCESSING) {
      throw new Error('Cannot delete video while processing')
    }
    
    await prisma.videoGeneration.delete({
      where: { id }
    })
    
    console.log(`✅ Video generation deleted: ${id}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to delete video generation:`, error)
    throw new Error(`Failed to delete video generation: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Cancel a video generation
 */
export async function cancelVideoGeneration(id: string, userId: string) {
  try {
    // First verify ownership and current status
    const video = await prisma.videoGeneration.findFirst({
      where: { id, userId }
    })
    
    if (!video) {
      throw new Error('Video generation not found or access denied')
    }
    
    // Can only cancel if pending or processing
    if (![VideoStatus.STARTING, VideoStatus.PROCESSING].includes(video.status)) {
      throw new Error('Video generation cannot be cancelled in current status')
    }
    
    const updated = await prisma.videoGeneration.update({
      where: { id },
      data: {
        status: VideoStatus.CANCELLED,
        processingCompletedAt: new Date(),
        updatedAt: new Date()
      }
    })
    
    console.log(`✅ Video generation cancelled: ${id}`)
    return updated
  } catch (error) {
    console.error(`❌ Failed to cancel video generation:`, error)
    throw new Error(`Failed to cancel video generation: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Search video generations by prompt or other criteria
 */
export async function searchVideoGenerations(
  userId: string,
  searchQuery: string,
  page: number = 1,
  limit: number = 20
) {
  try {
    const offset = (page - 1) * limit
    
    const where = {
      userId,
      OR: [
        { prompt: { contains: searchQuery, mode: 'insensitive' as const } },
        { negativePrompt: { contains: searchQuery, mode: 'insensitive' as const } }
      ]
    }

    const [videos, totalCount] = await Promise.all([
      prisma.videoGeneration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          // Include all video generation fields
          id: true,
          sourceImageUrl: true, // This is the key field that was missing!
          sourceGenerationId: true,
          prompt: true,
          negativePrompt: true,
          duration: true,
          aspectRatio: true,
          quality: true,
          template: true,
          status: true,
          jobId: true,
          errorMessage: true,
          videoUrl: true,
          thumbnailUrl: true,
          storageProvider: true,
          storageBucket: true,
          storageKey: true,
          posterKey: true,
          publicUrl: true,
          mimeType: true,
          sizeBytes: true,
          durationSec: true,
          creditsUsed: true,
          progress: true,
          processingStartedAt: true,
          estimatedTimeRemaining: true,
          createdAt: true,
          updatedAt: true,
          processingCompletedAt: true,
          metadata: true,
          userId: true,
          // Include related sourceGeneration data
          sourceGeneration: {
            select: {
              id: true,
              prompt: true,
              imageUrls: true
            }
          }
        }
      }),
      prisma.videoGeneration.count({ where })
    ])

    // Convert BigInt fields to strings for JSON serialization
    const videosWithSerializableFields = videos.map(video => ({
      ...video,
      sizeBytes: video.sizeBytes ? video.sizeBytes.toString() : null
    }))

    return {
      videos: videosWithSerializableFields,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    }
  } catch (error) {
    console.error(`❌ Failed to search video generations:`, error)
    throw new Error(`Failed to search video generations: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export interface VideoBatchParams {
  userId: string
  limit?: number
  page?: number
  status?: VideoStatus | string | null
  quality?: string | null
  searchQuery?: string | null
}

export interface VideoBatchResult {
  items: any[]
  page: number
  totalPages: number
  hasMore: boolean
  totalCount: number
}

export async function fetchVideoBatch({
  userId,
  limit = 24,
  page: requestedPage,
  status,
  quality,
  searchQuery
}: VideoBatchParams): Promise<VideoBatchResult> {
  const page = Math.max(requestedPage ?? 1, 1)
  const skip = (page - 1) * limit

  const where: any = {
    userId,
    status: status
      ? typeof status === 'string'
        ? (status.toUpperCase() as VideoStatus)
        : status
      : VideoStatus.COMPLETED,
    ...(quality ? { quality: quality as any } : {}),
    ...(searchQuery && {
      OR: [
        { prompt: { contains: searchQuery, mode: 'insensitive' } },
        { negativePrompt: { contains: searchQuery, mode: 'insensitive' } }
      ]
    })
  }

  const queryArgs: any = {
    where,
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
    select: {
      id: true,
      sourceImageUrl: true,
      sourceGenerationId: true,
      prompt: true,
      negativePrompt: true,
      duration: true,
      aspectRatio: true,
      quality: true,
      template: true,
      status: true,
      jobId: true,
      errorMessage: true,
      videoUrl: true,
      thumbnailUrl: true,
      storageProvider: true,
      storageBucket: true,
      storageKey: true,
      posterKey: true,
      publicUrl: true,
      mimeType: true,
      sizeBytes: true,
      durationSec: true,
      creditsUsed: true,
      progress: true,
      processingStartedAt: true,
      estimatedTimeRemaining: true,
      createdAt: true,
      updatedAt: true,
      processingCompletedAt: true,
      metadata: true,
      userId: true,
      sourceGeneration: {
        select: {
          id: true,
          prompt: true,
          imageUrls: true
        }
      }
    }
  }

  const results = await prisma.videoGeneration.findMany(queryArgs)
  const totalCount = await prisma.videoGeneration.count({ where })
  const totalPages = Math.max(1, Math.ceil(totalCount / limit))
  const hasMore = page < totalPages

  const serializableItems = results.map(video => ({
    ...video,
    sizeBytes: video.sizeBytes ? video.sizeBytes.toString() : null
  }))

  return {
    items: serializableItems,
    page,
    totalPages,
    hasMore,
    totalCount
  }
}