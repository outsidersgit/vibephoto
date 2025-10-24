import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAIProvider } from '@/lib/ai'
import { uploadMediaWithThumbnail, validateS3Config } from '@/lib/storage/s3-helpers'
import { buildKey } from '@/lib/storage/path-utils'

// Internal polling endpoint for processing pending generations (image + video)
// Protected by x-internal-key header for security
export async function POST(request: NextRequest) {
  try {
    // Security: Check internal key
    const internalKey = request.headers.get('x-internal-key')
    const expectedKey = process.env.DEV_POLL_KEY || 'dev-internal-polling-key'
    
    if (!internalKey || internalKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid internal key' },
        { status: 401 }
      )
    }

    console.log('🔄 Unified Polling: Checking pending jobs...')

    // Validate S3 configuration first
    const s3Config = validateS3Config()
    if (!s3Config.valid) {
      return NextResponse.json(
        { error: `S3 Configuration Error: ${s3Config.error}` },
        { status: 500 }
      )
    }

    const bucket = s3Config.config!.bucket
    const results = []

    // Find processing generations (images) - limit to prevent overload
    const pendingGenerations = await prisma.generation.findMany({
      where: {
        status: { in: ['PROCESSING', 'PENDING'] },
        jobId: { not: null },
        createdAt: {
          lte: new Date(Date.now() - 30 * 1000) // At least 30 seconds old
        }
      },
      orderBy: { createdAt: 'asc' }, // Process oldest first
      take: 10 // Limit batch size
    })

    console.log(`📊 Found ${pendingGenerations.length} pending image generations`)

    // Find processing video generations
    const pendingVideos = await prisma.videoGeneration.findMany({
      where: {
        status: { in: ['PROCESSING', 'STARTING'] },
        jobId: { not: null },
        createdAt: {
          lte: new Date(Date.now() - 30 * 1000) // At least 30 seconds old
        }
      },
      orderBy: { createdAt: 'asc' },
      take: 5 // Smaller batch for videos (they're larger)
    })

    console.log(`📹 Found ${pendingVideos.length} pending video generations`)

    const aiProvider = getAIProvider()
    
    // Process image generations
    for (const generation of pendingGenerations) {
      try {
        console.log(`🖼️ Checking image generation ${generation.id} (job: ${generation.jobId})`)

        // Check status with AI provider
        const status = await aiProvider.getGenerationStatus(generation.jobId!)
        
        console.log(`📋 Image Job ${generation.jobId}: ${status.status}`)

        if (status.status === 'succeeded' && status.output) {
          // Process successful generation
          let imageUrls: string[] = []
          if (Array.isArray(status.output)) {
            imageUrls = status.output
          } else if (typeof status.output === 'string') {
            imageUrls = [status.output]
          }

          if (imageUrls.length > 0) {
            console.log(`✅ Processing ${imageUrls.length} completed images...`)
            
            // Upload all images to S3 with consistent keys
            const uploadPromises = imageUrls.map(async (url, index) => {
              const mediaId = `${generation.id}_${index}`
              return await uploadMediaWithThumbnail(url, 'image', generation.userId, mediaId, bucket)
            })

            const uploadResults = await Promise.all(uploadPromises)
            const successfulUploads = uploadResults.filter(r => r.main.success)

            if (successfulUploads.length > 0) {
              // Update generation with S3 URLs using existing columns
              const permanentUrls = successfulUploads.map(r => r.main.url).filter(Boolean)
              const thumbnailUrls = successfulUploads.map(r => r.thumbnail?.url).filter(Boolean)

              await prisma.generation.update({
                where: { id: generation.id },
                data: {
                  status: 'COMPLETED',
                  completedAt: new Date(),
                  processingTime: Date.now() - generation.createdAt.getTime(),
                  imageUrls: permanentUrls, // Use existing column
                  thumbnailUrls: thumbnailUrls.length > 0 ? thumbnailUrls : permanentUrls, // Use existing column
                  errorMessage: null
                }
              })

              results.push({
                id: generation.id,
                type: 'image',
                status: 'completed',
                imageCount: successfulUploads.length,
                storedInS3: true
              })

              console.log(`✅ Image generation ${generation.id} completed and stored in S3`)
            } else {
              // All uploads failed - mark as failed
              await prisma.generation.update({
                where: { id: generation.id },
                data: {
                  status: 'FAILED',
                  completedAt: new Date(),
                  errorMessage: 'Failed to upload images to S3'
                }
              })

              results.push({
                id: generation.id,
                type: 'image',
                status: 'failed',
                error: 'S3 upload failed'
              })
            }
          }

        } else if (status.status === 'failed') {
          console.log(`❌ Image generation failed: ${status.error || 'Unknown error'}`)
          
          await prisma.generation.update({
            where: { id: generation.id },
            data: {
              status: 'FAILED',
              errorMessage: status.error || 'Generation failed',
              completedAt: new Date()
            }
          })

          results.push({
            id: generation.id,
            type: 'image',
            status: 'failed',
            error: status.error || 'Generation failed'
          })

        } else {
          console.log(`⏳ Image still processing: ${status.status}`)
          results.push({
            id: generation.id,
            type: 'image',
            status: 'still_processing',
            aiStatus: status.status
          })
        }

      } catch (error) {
        console.error(`❌ Error processing image generation ${generation.id}:`, error)
        results.push({
          id: generation.id,
          type: 'image',
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Process video generations  
    for (const video of pendingVideos) {
      try {
        console.log(`📹 Checking video generation ${video.id} (job: ${video.jobId})`)

        const status = await aiProvider.getGenerationStatus(video.jobId!)
        
        console.log(`📋 Video Job ${video.jobId}: ${status.status}`)

        if (status.status === 'succeeded' && status.output) {
          // Process successful video
          let videoUrl: string | undefined
          if (Array.isArray(status.output)) {
            videoUrl = status.output[0]
          } else if (typeof status.output === 'string') {
            videoUrl = status.output
          }

          if (videoUrl) {
            console.log(`✅ Processing completed video...`)
            
            // Upload video to S3 with consistent key
            const uploadResult = await uploadMediaWithThumbnail(videoUrl, 'video', video.userId, video.id, bucket)

            if (uploadResult.main.success) {
              // Update video generation with S3 URLs using existing columns
              await prisma.videoGeneration.update({
                where: { id: video.id },
                data: {
                  status: 'COMPLETED',
                  processingCompletedAt: new Date(),
                  videoUrl: uploadResult.main.url, // Use existing column
                  thumbnailUrl: uploadResult.thumbnail?.url, // Use existing column
                  errorMessage: null
                }
              })

              results.push({
                id: video.id,
                type: 'video',
                status: 'completed',
                storedInS3: true
              })

              console.log(`✅ Video generation ${video.id} completed and stored in S3`)
            } else {
              // Upload failed
              await prisma.videoGeneration.update({
                where: { id: video.id },
                data: {
                  status: 'FAILED',
                  processingCompletedAt: new Date(),
                  errorMessage: `S3 upload failed: ${uploadResult.main.error}`
                }
              })

              results.push({
                id: video.id,
                type: 'video', 
                status: 'failed',
                error: uploadResult.main.error
              })
            }
          }

        } else if (status.status === 'failed') {
          console.log(`❌ Video generation failed: ${status.error || 'Unknown error'}`)
          
          await prisma.videoGeneration.update({
            where: { id: video.id },
            data: {
              status: 'FAILED',
              errorMessage: status.error || 'Video generation failed',
              processingCompletedAt: new Date()
            }
          })

          results.push({
            id: video.id,
            type: 'video',
            status: 'failed',
            error: status.error || 'Generation failed'
          })

        } else {
          console.log(`⏳ Video still processing: ${status.status}`)
          results.push({
            id: video.id,
            type: 'video',
            status: 'still_processing',
            aiStatus: status.status
          })
        }

      } catch (error) {
        console.error(`❌ Error processing video generation ${video.id}:`, error)
        results.push({
          id: video.id,
          type: 'video',
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      // Small delay for videos (they're heavier)
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    const summary = {
      imagesChecked: pendingGenerations.length,
      videosChecked: pendingVideos.length,
      totalProcessed: results.length,
      completed: results.filter(r => r.status === 'completed').length,
      failed: results.filter(r => r.status === 'failed').length,
      stillProcessing: results.filter(r => r.status === 'still_processing').length,
      errors: results.filter(r => r.status === 'error').length
    }

    console.log('📊 Polling Summary:', summary)

    return NextResponse.json({
      success: true,
      summary,
      results,
      s3Config: {
        bucket,
        region: s3Config.config!.region,
        provider: s3Config.config!.provider
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Unified Polling Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process polling',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// GET endpoint for status/info
export async function GET(request: NextRequest) {
  const internalKey = request.headers.get('x-internal-key')
  const expectedKey = process.env.DEV_POLL_KEY || 'dev-internal-polling-key'
  
  if (!internalKey || internalKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Unauthorized - invalid internal key' },
      { status: 401 }
    )
  }

  // Get counts of pending jobs
  const [pendingImages, pendingVideos] = await Promise.all([
    prisma.generation.count({
      where: {
        status: { in: ['PROCESSING', 'PENDING'] },
        jobId: { not: null }
      }
    }),
    prisma.videoGeneration.count({
      where: {
        status: { in: ['PROCESSING', 'STARTING'] },
        jobId: { not: null }
      }
    })
  ])

  const s3Config = validateS3Config()

  return NextResponse.json({
    endpoint: 'Unified Polling Process API',
    environment: process.env.NODE_ENV,
    pendingJobs: {
      images: pendingImages,
      videos: pendingVideos,
      total: pendingImages + pendingVideos
    },
    s3Status: s3Config.valid ? 'configured' : 'error',
    s3Error: s3Config.error,
    usage: 'POST with x-internal-key header to trigger polling',
    timestamp: new Date().toISOString()
  })
}