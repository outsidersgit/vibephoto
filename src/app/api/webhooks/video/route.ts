import { NextRequest, NextResponse } from 'next/server'
import { updateVideoGenerationByJobId } from '@/lib/db/videos'
import { VideoStatus } from '@/lib/ai/video/config'
import { AI_CONFIG } from '@/lib/ai/config'
import { downloadAndStoreVideo } from '@/lib/storage/utils'
import { generateVideoThumbnail } from '@/lib/video/thumbnail-generator'
import { prisma } from '@/lib/db'
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
        console.error(`❌ Error details:`, {
          message: dbError instanceof Error ? dbError.message : String(dbError),
          stack: dbError instanceof Error ? dbError.stack : undefined,
          jobId
        })
        
        // CRITICAL: Return 200 OK even on database errors to prevent infinite retries
        // The error is logged and can be handled manually if needed
        // Returning 500 causes Replicate to retry indefinitely, creating duplicates
        return NextResponse.json({
          success: false,
          error: 'Database error updating video generation',
          message: 'Error logged but webhook acknowledged to prevent retries',
          jobId
        })
      }

      if (!updatedVideo) {
        console.warn(`⚠️ Video generation not found for job ID: ${jobId}`)
        // Return 200 OK even if not found - prevents infinite retries
        return NextResponse.json({
          success: false,
          error: 'Video generation not found',
          message: 'Video generation not found in database',
          jobId
        })
      }

      console.log(`✅ Video generation ${updatedVideo.id} updated:`, {
        status: internalStatus,
        hasVideoUrl: !!videoUrl,
        hasError: !!errorMessage,
        userId: updatedVideo.user?.id || updatedVideo.userId || 'unknown'
      })

      // CRITICAL: Check idempotency BEFORE processing storage
      // If video is already COMPLETED with a permanent URL, skip all processing
      if (updatedVideo.status === VideoStatus.COMPLETED && updatedVideo.videoUrl && updatedVideo.videoUrl.startsWith('http')) {
        // Check if it's already a permanent URL (not temporary Replicate URL)
        const isPermanentUrl = updatedVideo.videoUrl.includes('amazonaws.com') || 
                               updatedVideo.videoUrl.includes('cloudfront.net') ||
                               updatedVideo.videoUrl.includes('s3') ||
                               (updatedVideo.metadata as any)?.stored === true
        
        if (isPermanentUrl) {
          console.log(`⏭️ Video ${updatedVideo.id} already processed and stored, skipping duplicate processing`)
          return NextResponse.json({
            success: true,
            videoId: updatedVideo.id,
            status: VideoStatus.COMPLETED,
            message: 'Video already processed',
            skipped: true
          })
        }
      }

      // Download and store video permanently if completed successfully
      if (internalStatus === VideoStatus.COMPLETED && videoUrl) {
        const userId = updatedVideo.user?.id || updatedVideo.userId
        console.log(`🎉 Video generation completed for user ${userId}: ${updatedVideo.id}`)

        try {
          // CRITICAL: Check if video was already stored by checking database first
          const currentVideo = await prisma.videoGeneration.findUnique({
            where: { id: updatedVideo.id },
            select: { videoUrl: true, status: true, metadata: true, userId: true }
          })

          if (currentVideo?.status === VideoStatus.COMPLETED && currentVideo.videoUrl) {
            const metadata = currentVideo.metadata as any
            const isAlreadyStored = currentVideo.videoUrl.includes('amazonaws.com') || 
                                   currentVideo.videoUrl.includes('cloudfront.net') ||
                                   currentVideo.videoUrl.includes('s3') ||
                                   metadata?.stored === true

            if (isAlreadyStored) {
              console.log(`⏭️ Video ${updatedVideo.id} already stored at ${currentVideo.videoUrl}, skipping storage`)
              
              // Still update status and metadata if needed, but skip storage
              try {
                await updateVideoGenerationByJobId(
                  jobId,
                  VideoStatus.COMPLETED,
                  currentVideo.videoUrl, // Keep existing permanent URL
                  undefined,
                  updatedVideo.thumbnailUrl || undefined,
                  {
                    ...(metadata || {}),
                    lastWebhookAt: new Date().toISOString(),
                    webhookProcessed: true
                  }
                )
              } catch (updateError) {
                console.error(`⚠️ Failed to update metadata for already-stored video:`, updateError)
                // Don't fail - video is already stored
              }

              return NextResponse.json({
                success: true,
                videoId: updatedVideo.id,
                status: VideoStatus.COMPLETED,
                message: 'Video already stored, status updated',
                skipped: true
              })
            }
          }

          // Download and store video in our storage FIRST
          console.log('📥 Downloading and storing video permanently...')
          const storageResult = await downloadAndStoreVideo(
            videoUrl,
            updatedVideo.id,
            userId
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
            userId
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
            // Use transaction to ensure atomicity
            try {
              await prisma.$transaction(async (tx) => {
                // Double-check status before updating (prevent race conditions)
                const current = await tx.videoGeneration.findUnique({
                  where: { id: updatedVideo.id },
                  select: { status: true, videoUrl: true }
                })

                // Only update if not already completed with permanent URL
                if (!(current?.status === VideoStatus.COMPLETED && current.videoUrl && 
                      (current.videoUrl.includes('amazonaws.com') || current.videoUrl.includes('cloudfront.net')))) {
                  
                  // Get video duration and other info from original videoGeneration
                  const originalVideo = await tx.videoGeneration.findUnique({
                    where: { id: updatedVideo.id },
                    select: { 
                      duration: true, 
                      metadata: true, 
                      processingStartedAt: true,
                      storageBucket: true
                    }
                  })
                  
                  const metadata = originalVideo?.metadata as any || {}
                  const durationSec = originalVideo?.duration || metadata?.duration || 5
                  
                  // Use storageKey from storageResult if available, otherwise extract from URL
                  let storageKey = storageResult.storageKey
                  let storageBucket = originalVideo?.storageBucket
                  
                  if (!storageKey) {
                    try {
                      const urlObj = new URL(permanentVideoUrl)
                      const pathParts = urlObj.pathname.split('/').filter(p => p)
                      if (pathParts.length >= 2) {
                        storageBucket = storageBucket || pathParts[0]
                        storageKey = pathParts.slice(1).join('/')
                      } else if (pathParts.length === 1) {
                        storageKey = pathParts[0]
                      }
                    } catch (urlError) {
                      console.warn('⚠️ Could not extract storage key from URL:', urlError)
                    }
                  }

                  await tx.videoGeneration.update({
                    where: { id: updatedVideo.id },
                    data: {
                      status: VideoStatus.COMPLETED,
                      videoUrl: permanentVideoUrl,
                      thumbnailUrl: finalThumbnailUrl || undefined,
                      // CRITICAL: Fill all required fields for frontend
                      storageProvider: 'aws',
                      publicUrl: permanentVideoUrl, // Same as videoUrl for public videos
                      storageKey: storageKey || undefined,
                      storageBucket: storageBucket || undefined,
                      mimeType: storageResult.mimeType || 'video/mp4',
                      sizeBytes: storageResult.sizeBytes ? BigInt(storageResult.sizeBytes) : undefined,
                      durationSec: durationSec,
                      processingCompletedAt: new Date(),
                      progress: 100,
                      // Set processingStartedAt if not already set
                      processingStartedAt: originalVideo?.processingStartedAt || (startedAt ? new Date(startedAt) : undefined),
                      updatedAt: new Date(),
                      // CRITICAL: Also set jobId if not already set (should be set, but ensure it)
                      jobId: jobId || updatedVideo.jobId || undefined,
                      metadata: {
                        ...metadata,
                        originalUrl: videoUrl,
                        temporaryVideoUrl: videoUrl,
                        storageProvider: 'aws',
                        storageType: 'public',
                        processedAt: new Date().toISOString(),
                        mimeType: storageResult.mimeType || 'video/mp4',
                        fileExtension: 'mp4',
                        stored: true,
                        lastWebhookAt: new Date().toISOString(),
                        webhookProcessed: true,
                        completedAt: new Date().toISOString(), // Also save in metadata for compatibility
                        duration: durationSec,
                        sizeBytes: storageResult.sizeBytes
                      }
                    }
                  })
                  console.log(`✅ Video permanently stored and saved to database: ${permanentVideoUrl}`)
                } else {
                  console.log(`⏭️ Video ${updatedVideo.id} already updated by another process, skipping`)
                }
              })
            } catch (updateError) {
              console.error(`❌ Failed to update video with permanent URL:`, updateError)
              // CRITICAL: Even if update fails, try one more time with simpler update
              try {
                await prisma.videoGeneration.update({
                  where: { id: updatedVideo.id },
                  data: {
                    videoUrl: permanentVideoUrl,
                    status: VideoStatus.COMPLETED,
                    thumbnailUrl: finalThumbnailUrl || undefined
                  }
                })
                console.log(`✅ Fallback update succeeded for video ${updatedVideo.id}`)
              } catch (fallbackError) {
                console.error(`❌ Fallback update also failed:`, fallbackError)
                // CRITICAL: Don't return 500 - video is stored, just log the error
                // Return 200 to prevent Replicate from retrying and causing duplicates
                console.error(`⚠️ Video ${updatedVideo.id} stored but DB update failed - will be retried on next webhook`)
                return NextResponse.json({
                  success: true,
                  videoId: updatedVideo.id,
                  status: VideoStatus.COMPLETED,
                  message: 'Video stored but database update failed - will retry',
                  warning: 'Database update failed but video is stored'
                })
              }
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
            // CRITICAL: Don't return 500 - return 200 to prevent infinite retries
            // The video URL is already saved in the first update, so we can acknowledge
            console.error(`⚠️ Could not update video status but video URL is already saved`)
          }
        }
        
        // Additional tasks:
        // 1. Send WebSocket notification to user
        // 2. Send email notification if enabled  
        // 3. Update user credits/usage statistics
      } else if (internalStatus === VideoStatus.FAILED) {
        const userId = updatedVideo.user?.id || updatedVideo.userId
        console.log(`💥 Video generation failed for user ${userId}: ${updatedVideo.id}`)
        
        // Here you would typically:
        // 1. Send failure notification
        // 2. Optionally refund credits
        // 3. Log for debugging
      }

      // Acknowledge webhook - ALWAYS return 200 OK to prevent retries
      return NextResponse.json({
        success: true,
        videoId: updatedVideo.id,
        status: internalStatus,
        message: 'Video status updated'
      })

    } catch (dbError) {
      console.error('❌ Database error processing video webhook:', dbError)
      console.error('❌ Error details:', {
        message: dbError instanceof Error ? dbError.message : String(dbError),
        stack: dbError instanceof Error ? dbError.stack : undefined,
        jobId: webhookData?.id
      })
      
      // CRITICAL: Return 200 OK even on database errors to prevent infinite retries
      // The error is logged and can be handled manually if needed
      // Returning 500 causes Replicate to retry indefinitely, creating duplicates
      return NextResponse.json({
        success: false,
        error: 'Database error processing webhook',
        message: 'Error logged but webhook acknowledged to prevent retries',
        jobId: webhookData?.id
      })
    }

  } catch (error) {
    console.error('❌ Video webhook processing error:', error)
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    
    // CRITICAL: Return 200 OK even on unexpected errors to prevent infinite retries
    // The error is logged and can be handled manually if needed
    // Returning 500 causes Replicate to retry indefinitely, creating duplicates
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: 'Error logged but webhook acknowledged to prevent retries'
    })
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