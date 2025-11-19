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
      let updatedVideo
      try {
        updatedVideo = await updateVideoGenerationByJobId(
          jobId,
          internalStatus,
          videoUrl,
          errorMessage
        )
      } catch (dbError) {
        console.error(`❌ Database error updating video by jobId ${jobId}:`, dbError)
        // Return 500 so Replicate will retry
        return NextResponse.json(
          { 
            error: 'Database error updating video generation',
            details: dbError instanceof Error ? dbError.message : String(dbError)
          },
          { status: 500 }
        )
      }

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
          // Download and store video in our storage FIRST
          console.log('📥 Downloading and storing video permanently...')
          const storageResult = await downloadAndStoreVideo(
            videoUrl,
            updatedVideo.id,
            updatedVideo.user.id
          )

          // Generate thumbnail from video AFTER video is stored
          // Use permanent video URL if available, otherwise use temporary
          const videoUrlForThumbnail = storageResult.success && storageResult.videoUrl 
            ? storageResult.videoUrl 
            : videoUrl

          console.log('🖼️ Generating video thumbnail from:', videoUrlForThumbnail.substring(0, 100) + '...')
          const thumbnailResult = await generateVideoThumbnail(
            videoUrlForThumbnail,
            updatedVideo.id,
            updatedVideo.user.id
          )

          let finalThumbnailUrl = undefined
          if (thumbnailResult.success && thumbnailResult.thumbnailUrl) {
            finalThumbnailUrl = thumbnailResult.thumbnailUrl
            console.log(`✅ Thumbnail generated and saved: ${finalThumbnailUrl}`)
          } else {
            console.warn('⚠️ Thumbnail generation failed:', thumbnailResult.error)
            // Thumbnail is optional, continue without it
          }

          if (storageResult.success && storageResult.videoUrl) {
            // CRITICAL: Save the permanent videoUrl in the database field (not just metadata)
            // This is required for frontend preview and gallery to work
            const permanentVideoUrl = storageResult.videoUrl
            
            // Update video with permanent URL, thumbnail, status COMPLETED, and metadata
            try {
              await updateVideoGenerationByJobId(
                jobId,
                VideoStatus.COMPLETED,
                permanentVideoUrl, // Save permanent URL in videoUrl field (CRITICAL for frontend)
                undefined, // errorMessage
                finalThumbnailUrl, // Save thumbnail URL
                {
                  originalUrl: videoUrl, // Original Replicate URL
                  temporaryVideoUrl: videoUrl, // Temporary URL for fallback
                  storageProvider: 'aws',
                  storageType: 'public',
                  processedAt: new Date().toISOString(),
                  mimeType: 'video/mp4',
                  fileExtension: 'mp4',
                  stored: true
                }
              )

              console.log(`✅ Video permanently stored and saved to database: ${permanentVideoUrl}`)
            } catch (updateError) {
              console.error(`❌ Failed to update video with permanent URL:`, updateError)
              // Don't throw - video is stored, just DB update failed
              // Return success to prevent webhook retries
            }
          } else {
            // If storage failed, save temporary URL but mark as not stored
            try {
              await updateVideoGenerationByJobId(
                jobId,
                VideoStatus.COMPLETED,
                videoUrl, // Use temporary URL as fallback (better than nothing)
                undefined,
                finalThumbnailUrl,
                {
                  temporaryVideoUrl: videoUrl,
                  storageError: true,
                  storageErrorDetails: storageResult.error,
                  processedAt: new Date().toISOString(),
                  stored: false
                }
              )
              console.error(`❌ Failed to store video permanently: ${storageResult.error}`)
            } catch (updateError) {
              console.error(`❌ Failed to update video with temporary URL:`, updateError)
              // Don't throw - at least we tried to save the temporary URL
            }
          }
        } catch (storageError) {
          console.error('❌ Error storing video permanently:', storageError)
          // Update status to COMPLETED even if storage fails (use temporary URL)
          try {
            await updateVideoGenerationByJobId(
              jobId,
              VideoStatus.COMPLETED,
              videoUrl, // Use temporary URL
              undefined,
              undefined,
              {
                temporaryVideoUrl: videoUrl,
                storageError: true,
                storageErrorDetails: storageError instanceof Error ? storageError.message : String(storageError),
                processedAt: new Date().toISOString(),
                stored: false
              }
            )
          } catch (updateError) {
            console.error(`❌ Failed to update video status after storage error:`, updateError)
            // Return 500 so Replicate will retry
            return NextResponse.json(
              { 
                error: 'Failed to update video status',
                details: updateError instanceof Error ? updateError.message : String(updateError)
              },
              { status: 500 }
            )
          }
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