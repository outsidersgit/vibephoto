import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getVideoGenerationsByUserId, searchVideoGenerations, deleteVideoGeneration } from '@/lib/db/videos'
import { VideoStatus, VideoQuality } from '@prisma/client'

/**
 * GET /api/video/history
 * Get video generation history for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await requireAuth()
    const userId = session.user.id

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') as VideoStatus | undefined
    const quality = searchParams.get('quality') as VideoQuality | undefined
    const search = searchParams.get('search')

    console.log(`📄 Getting video history for user ${userId}:`, {
      page,
      limit,
      status,
      quality,
      hasSearch: !!search
    })

    let result

    if (search && search.trim().length > 0) {
      // Search videos by prompt
      result = await searchVideoGenerations(userId, search.trim(), page, limit)
    } else {
      // Get videos with optional filters
      result = await getVideoGenerationsByUserId(userId, page, limit, status, quality)
    }

    // Transform data for frontend
    const transformedVideos = result.videos.map(video => ({
      id: video.id,
      status: video.status,
      prompt: video.prompt,
      negativePrompt: video.negativePrompt,
      duration: video.duration,
      aspectRatio: video.aspectRatio,
      quality: video.quality,
      template: video.template,
      videoUrl: video.videoUrl,
      thumbnailUrl: video.thumbnailUrl,
      sourceImageUrl: video.sourceImageUrl,
      creditsUsed: video.creditsUsed,
      progress: video.progress,
      errorMessage: video.errorMessage,
      processingTime: video.processingTime,
      fileSize: video.fileSize,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt,
      completedAt: video.completedAt,
      startedAt: video.startedAt,
      // Include source generation info if available
      sourceGeneration: video.sourceGeneration ? {
        id: video.sourceGeneration.id,
        prompt: video.sourceGeneration.prompt,
        imageUrls: video.sourceGeneration.imageUrls
      } : null
    }))

    return NextResponse.json({
      videos: transformedVideos,
      pagination: {
        page: result.page,
        limit: result.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        hasNextPage: result.page < result.totalPages,
        hasPrevPage: result.page > 1
      },
      filters: {
        status,
        quality,
        search
      }
    })

  } catch (error) {
    console.error('❌ Video history API error:', error)
    
    return NextResponse.json(
      { error: 'Failed to get video history' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/video/history
 * Delete a video generation (requires videoId in body)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const session = await requireAuth()
    const userId = session.user.id

    // Parse request body
    const body = await request.json()
    const videoId = body.videoId

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      )
    }

    console.log(`🗑️ Deleting video ${videoId} for user ${userId}`)

    // Delete video generation (includes ownership check)
    await deleteVideoGeneration(videoId, userId)

    console.log(`✅ Video ${videoId} deleted successfully`)

    return NextResponse.json({
      success: true,
      message: 'Video deleted successfully',
      videoId
    })

  } catch (error) {
    console.error('❌ Video delete API error:', error)
    
    // Check if it's a known error
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        )
      }
      if (error.message.includes('Cannot delete')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to delete video' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/video/history
 * Update video metadata (for now, just used for marking as favorite, etc.)
 */
export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const session = await requireAuth()
    const userId = session.user.id

    // Parse request body
    const body = await request.json()
    const { videoId, action } = body

    if (!videoId || !action) {
      return NextResponse.json(
        { error: 'Video ID and action are required' },
        { status: 400 }
      )
    }

    console.log(`📝 Updating video ${videoId} for user ${userId}: ${action}`)

    // For now, we only support basic actions
    // This can be extended for favorite/unfavorite, rename, etc.
    switch (action) {
      case 'refresh_status':
        // This could trigger a manual status refresh from provider
        return NextResponse.json({
          success: true,
          message: 'Status refresh requested',
          videoId
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Video update API error:', error)
    
    return NextResponse.json(
      { error: 'Failed to update video' },
      { status: 500 }
    )
  }
}