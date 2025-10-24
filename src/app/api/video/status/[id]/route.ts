import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { KlingVideoProvider } from '@/lib/ai/providers/kling'
import { getVideoGenerationById, updateVideoGenerationStatus } from '@/lib/db/videos'
import { VideoStatus } from '@/lib/ai/video/config'

interface RouteParams {
  params: {
    id: string
  }
}

/**
 * GET /api/video/status/[id]
 * Get video generation status and details
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Authenticate user
    const session = await requireAuth()
    const userId = session.user.id
    const videoId = params.id

    console.log(`📊 Getting video status for ${videoId} by user ${userId}`)

    // Get video generation from database
    const videoGeneration = await getVideoGenerationById(videoId)
    
    if (!videoGeneration) {
      return NextResponse.json(
        { error: 'Video generation not found' },
        { status: 404 }
      )
    }

    // Check ownership
    if (videoGeneration.userId !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // If video is completed or failed, return current status
    if ([VideoStatus.COMPLETED, VideoStatus.FAILED, VideoStatus.CANCELLED].includes(videoGeneration.status as VideoStatus)) {
      return NextResponse.json({
        id: videoGeneration.id,
        status: videoGeneration.status,
        progress: videoGeneration.progress,
        videoUrl: videoGeneration.videoUrl,
        thumbnailUrl: videoGeneration.thumbnailUrl,
        errorMessage: videoGeneration.errorMessage,
        duration: videoGeneration.duration,
        aspectRatio: videoGeneration.aspectRatio,
        quality: videoGeneration.quality,
        creditsUsed: videoGeneration.creditsUsed,
        processingTime: videoGeneration.processingTime,
        createdAt: videoGeneration.createdAt,
        completedAt: videoGeneration.completedAt,
        sourceImageUrl: videoGeneration.sourceImageUrl,
        prompt: videoGeneration.prompt
      })
    }

    // If video is still processing, check with provider
    if (videoGeneration.jobId && [VideoStatus.STARTING, VideoStatus.PROCESSING].includes(videoGeneration.status as VideoStatus)) {
      try {
        const provider = new KlingVideoProvider()
        const providerStatus = await provider.getVideoStatus(videoGeneration.jobId)

        console.log(`🔍 Provider status for job ${videoGeneration.jobId}:`, providerStatus.status)

        // Update database if status changed
        if (providerStatus.status !== videoGeneration.status as VideoStatus) {
          await updateVideoGenerationStatus(
            videoGeneration.id,
            providerStatus.status,
            providerStatus.progress,
            providerStatus.videoUrl,
            providerStatus.thumbnailUrl,
            providerStatus.errorMessage
          )
        }

        // Return updated status
        return NextResponse.json({
          id: videoGeneration.id,
          status: providerStatus.status,
          progress: providerStatus.progress || videoGeneration.progress,
          videoUrl: providerStatus.videoUrl || videoGeneration.videoUrl,
          thumbnailUrl: providerStatus.thumbnailUrl || videoGeneration.thumbnailUrl,
          errorMessage: providerStatus.errorMessage || videoGeneration.errorMessage,
          estimatedTimeRemaining: providerStatus.estimatedTimeRemaining,
          duration: videoGeneration.duration,
          aspectRatio: videoGeneration.aspectRatio,
          quality: videoGeneration.quality,
          creditsUsed: videoGeneration.creditsUsed,
          processingTime: videoGeneration.processingTime,
          createdAt: videoGeneration.createdAt,
          completedAt: videoGeneration.completedAt,
          sourceImageUrl: videoGeneration.sourceImageUrl,
          prompt: videoGeneration.prompt
        })

      } catch (providerError) {
        console.error('❌ Error checking provider status:', providerError)
        
        // Return database status if provider check fails
        return NextResponse.json({
          id: videoGeneration.id,
          status: videoGeneration.status,
          progress: videoGeneration.progress,
          videoUrl: videoGeneration.videoUrl,
          thumbnailUrl: videoGeneration.thumbnailUrl,
          errorMessage: videoGeneration.errorMessage,
          duration: videoGeneration.duration,
          aspectRatio: videoGeneration.aspectRatio,
          quality: videoGeneration.quality,
          creditsUsed: videoGeneration.creditsUsed,
          processingTime: videoGeneration.processingTime,
          createdAt: videoGeneration.createdAt,
          completedAt: videoGeneration.completedAt,
          sourceImageUrl: videoGeneration.sourceImageUrl,
          prompt: videoGeneration.prompt,
          statusCheckError: 'Failed to check current status'
        })
      }
    }

    // Return current database status
    return NextResponse.json({
      id: videoGeneration.id,
      status: videoGeneration.status,
      progress: videoGeneration.progress,
      videoUrl: videoGeneration.videoUrl,
      thumbnailUrl: videoGeneration.thumbnailUrl,
      errorMessage: videoGeneration.errorMessage,
      duration: videoGeneration.duration,
      aspectRatio: videoGeneration.aspectRatio,
      quality: videoGeneration.quality,
      creditsUsed: videoGeneration.creditsUsed,
      processingTime: videoGeneration.processingTime,
      createdAt: videoGeneration.createdAt,
      completedAt: videoGeneration.completedAt,
      sourceImageUrl: videoGeneration.sourceImageUrl,
      prompt: videoGeneration.prompt
    })

  } catch (error) {
    console.error('❌ Video status API error:', error)
    
    return NextResponse.json(
      { error: 'Failed to get video status' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/video/status/[id] 
 * Cancel a video generation
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Authenticate user
    const session = await requireAuth()
    const userId = session.user.id
    const videoId = params.id

    console.log(`⏹️ Cancelling video ${videoId} for user ${userId}`)

    // Get video generation from database
    const videoGeneration = await getVideoGenerationById(videoId)
    
    if (!videoGeneration) {
      return NextResponse.json(
        { error: 'Video generation not found' },
        { status: 404 }
      )
    }

    // Check ownership
    if (videoGeneration.userId !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Check if video can be cancelled
    if (![VideoStatus.STARTING, VideoStatus.PROCESSING].includes(videoGeneration.status as VideoStatus)) {
      return NextResponse.json(
        { error: `Cannot cancel video in ${videoGeneration.status} status` },
        { status: 400 }
      )
    }

    try {
      // Try to cancel with provider if we have job ID
      if (videoGeneration.jobId) {
        const provider = new KlingVideoProvider()
        const cancelled = await provider.cancelVideo(videoGeneration.jobId)
        
        if (!cancelled) {
          console.warn(`⚠️ Failed to cancel video with provider, but updating database anyway`)
        }
      }

      // Update database status
      await updateVideoGenerationStatus(
        videoGeneration.id,
        VideoStatus.CANCELLED
      )

      console.log(`✅ Video generation cancelled: ${videoId}`)

      return NextResponse.json({
        success: true,
        message: 'Video generation cancelled',
        videoId: videoGeneration.id
      })

    } catch (providerError) {
      console.error('❌ Error cancelling with provider:', providerError)
      
      // Still update database even if provider cancel fails
      await updateVideoGenerationStatus(
        videoGeneration.id,
        VideoStatus.CANCELLED
      )

      return NextResponse.json({
        success: true,
        message: 'Video generation cancelled (provider cancellation may have failed)',
        videoId: videoGeneration.id
      })
    }

  } catch (error) {
    console.error('❌ Video cancel API error:', error)
    
    return NextResponse.json(
      { error: 'Failed to cancel video generation' },
      { status: 500 }
    )
  }
}