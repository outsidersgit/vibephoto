import { NextRequest, NextResponse } from 'next/server'
import { updateVideoGenerationByJobId } from '@/lib/db/videos'
import { VideoStatus } from '@/lib/ai/video/config'
import { AI_CONFIG } from '@/lib/ai/config'
import { downloadAndStoreVideo } from '@/lib/storage/utils'
import { generateVideoThumbnail } from '@/lib/video/thumbnail-generator'
import crypto from 'crypto'

/**
 * POST /api/webhooks/video
 * Webhook endpoint for Replicate video generation updates
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('webhook-signature')
    
    console.log('🎬 Received video webhook:', {
      hasSignature: !!signature,
      bodyLength: body.length,
      timestamp: new Date().toISOString()
    })

    // Verify webhook signature if secret is configured
    if (AI_CONFIG.replicate.webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', AI_CONFIG.replicate.webhookSecret)
        .update(body)
        .digest('hex')

      if (signature !== `sha256=${expectedSignature}`) {
        console.error('❌ Invalid webhook signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    }

    // Parse webhook data
    let webhookData
    try {
      webhookData = JSON.parse(body)
    } catch (parseError) {
      console.error('❌ Invalid webhook JSON:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      )
    }

    console.log('📥 Video webhook data:', {
      id: webhookData.id,
      status: webhookData.status,
      hasOutput: !!webhookData.output,
      hasError: !!webhookData.error
    })

    // Extract key information
    const jobId = webhookData.id
    const replicateStatus = webhookData.status
    const output = webhookData.output
    const error = webhookData.error
    const startedAt = webhookData.started_at
    const completedAt = webhookData.completed_at

    if (!jobId) {
      console.error('❌ No job ID in webhook data')
      return NextResponse.json(
        { error: 'No job ID provided' },
        { status: 400 }
      )
    }

    // Map Replicate status to our internal status
    let internalStatus: VideoStatus
    switch (replicateStatus) {
      case 'starting':
      case 'processing':
        internalStatus = VideoStatus.PROCESSING
        break
      case 'succeeded':
        internalStatus = VideoStatus.COMPLETED
        break
      case 'failed':
        internalStatus = VideoStatus.FAILED
        break
      case 'canceled':
        internalStatus = VideoStatus.CANCELLED
        break
      default:
        console.warn(`⚠️ Unknown Replicate status: ${replicateStatus}`)
        internalStatus = VideoStatus.PROCESSING
    }

    try {
      // Extract video URL from output
      let videoUrl: string | undefined
      if (output && internalStatus === VideoStatus.COMPLETED) {
        if (typeof output === 'string') {
          videoUrl = output
        } else if (Array.isArray(output) && output.length > 0) {
          videoUrl = output[0]
        } else if (output.url) {
          videoUrl = output.url
        }

        console.log('🎥 Video URL extracted:', videoUrl ? 'Yes' : 'No')
      }

      // Extract error message
      let errorMessage: string | undefined
      if (error && internalStatus === VideoStatus.FAILED) {
        errorMessage = typeof error === 'string' ? error : JSON.stringify(error)
        console.log('❌ Error message:', errorMessage)
      }

      // Update video generation in database (temporarily with URL, will be replaced with s3_key)
      const updatedVideo = await updateVideoGenerationByJobId(
        jobId,
        internalStatus,
        videoUrl,
        errorMessage
      )

      if (!updatedVideo) {
        console.warn(`⚠️ Video generation not found for job ID: ${jobId}`)
        return NextResponse.json(
          { error: 'Video generation not found' },
          { status: 404 }
        )
      }

      console.log(`✅ Video generation ${updatedVideo.id} updated:`, {
        status: internalStatus,
        hasVideoUrl: !!videoUrl,
        hasError: !!errorMessage,
        userId: updatedVideo.user.id
      })

      // Download and store video permanently if completed successfully
      if (internalStatus === VideoStatus.COMPLETED && videoUrl) {
        console.log(`🎉 Video generation completed for user ${updatedVideo.user.id}: ${updatedVideo.id}`)

        try {
          // Generate thumbnail from video
          console.log('🖼️ Generating video thumbnail...')
          const thumbnailResult = await generateVideoThumbnail(
            videoUrl,
            updatedVideo.id,
            updatedVideo.user.id
          )

          let finalThumbnailUrl = undefined
          if (thumbnailResult.success && thumbnailResult.thumbnailUrl) {
            finalThumbnailUrl = thumbnailResult.thumbnailUrl
            console.log(`✅ Thumbnail generated: ${finalThumbnailUrl}`)
          } else {
            console.warn('⚠️ Thumbnail generation failed, will use video URL for preview')
          }

          // Download and store video in our storage
          console.log('📥 Downloading and storing video permanently...')
          const storageResult = await downloadAndStoreVideo(
            videoUrl,
            updatedVideo.id,
            updatedVideo.user.id
          )

          if (storageResult.success && storageResult.videoUrl) {
            // Extract s3 key from the storage result
            // The downloadAndStoreVideo function should return s3 key, but currently returns URL
            // We'll extract the key from the known pattern: generated/{userId}/{videoGenId}/0.mp4
            const s3Key = `generated/${updatedVideo.user.id}/${updatedVideo.id}/0.mp4`

            // Update video with metadata containing s3_key instead of storing URL directly
            await updateVideoGenerationByJobId(
              jobId,
              VideoStatus.COMPLETED,
              null, // Clear the direct videoUrl
              undefined,
              undefined, // Clear direct thumbnailUrl
              {
                s3Key: s3Key,
                originalUrl: videoUrl,
                storageProvider: 'aws',
                storageType: 'private',
                processedAt: new Date().toISOString(),
                mimeType: 'video/mp4',
                fileExtension: 'mp4'
              }
            )

            console.log(`✅ Video permanently stored with s3 key: ${s3Key}`)
          } else {
            // Store temporary URL in metadata with error flag
            await updateVideoGenerationByJobId(
              jobId,
              VideoStatus.COMPLETED,
              null, // Clear direct URL
              undefined,
              undefined,
              {
                temporaryVideoUrl: videoUrl,
                storageError: true,
                storageErrorDetails: storageResult.error,
                processedAt: new Date().toISOString()
              }
            )
            console.error(`❌ Failed to store video permanently: ${storageResult.error}`)
          }
        } catch (storageError) {
          console.error('❌ Error storing video permanently:', storageError)
          // Continue processing even if storage fails - temporary URL still works
        }
        
        // Additional tasks:
        // 1. Send WebSocket notification to user
        // 2. Send email notification if enabled  
        // 3. Update user credits/usage statistics
      } else if (internalStatus === VideoStatus.FAILED) {
        console.log(`💥 Video generation failed for user ${updatedVideo.user.id}: ${updatedVideo.id}`)
        
        // Here you would typically:
        // 1. Send failure notification
        // 2. Optionally refund credits
        // 3. Log for debugging
      }

      // Acknowledge webhook
      return NextResponse.json({
        success: true,
        videoId: updatedVideo.id,
        status: internalStatus,
        message: 'Video status updated'
      })

    } catch (dbError) {
      console.error('❌ Database error processing video webhook:', dbError)
      
      // Return 500 so Replicate will retry
      return NextResponse.json(
        { error: 'Database error processing webhook' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('❌ Video webhook processing error:', error)
    
    // Return 500 so Replicate will retry
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/webhooks/video
 * Health check endpoint for video webhooks
 */
export async function GET() {
  return NextResponse.json({
    service: 'Video Webhook Handler',
    status: 'active',
    timestamp: new Date().toISOString(),
    accepts: ['POST'],
    description: 'Handles video generation status updates from Kling AI via Replicate'
  })
}