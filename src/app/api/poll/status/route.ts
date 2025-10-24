import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { ReplicateProvider } from '@/lib/ai/providers/replicate'
import { downloadAndStoreImages } from '@/lib/storage/utils'
import { prisma } from '@/lib/prisma'
import { isReplicateStatusCompleted, isReplicateStatusFailed, isReplicateStatusProcessing } from '@/lib/utils/status-mapping'

/**
 * Polling endpoint for checking generation status
 * Used in development when webhooks aren't available
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    const { searchParams } = new URL(request.url)
    const generationId = searchParams.get('generationId')

    if (!generationId) {
      return NextResponse.json(
        { error: 'generationId is required' },
        { status: 400 }
      )
    }

    // Find generation
    const generation = await prisma.generation.findUnique({
      where: { id: generationId }
    })

    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      )
    }

    // Security check
    if (generation.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // If already completed, return current status
    if (generation.status === 'COMPLETED') {
      return NextResponse.json({
        status: 'COMPLETED',
        imageUrls: generation.imageUrls,
        thumbnailUrls: generation.thumbnailUrls,
        completedAt: generation.completedAt,
        processingTime: generation.processingTime,
        updated: false,
        message: 'Already completed'
      })
    }

    // If failed, return error status
    if (generation.status === 'FAILED') {
      return NextResponse.json({
        status: 'FAILED',
        errorMessage: generation.errorMessage,
        updated: false,
        message: 'Generation failed'
      })
    }

    // If no jobId, can't poll
    if (!generation.jobId) {
      return NextResponse.json({
        status: generation.status,
        updated: false,
        message: 'No jobId available for polling'
      })
    }

    // Check status with Replicate
    console.log(`🔄 Polling status for generation ${generationId}, job ${generation.jobId}`)

    const replicate = new ReplicateProvider()
    let replicateStatus
    try {
      replicateStatus = await replicate.getGenerationStatus(generation.jobId)
    } catch (error: any) {
      // Handle 404 errors for expired/non-existent jobs
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        // Check if generation already has permanent URLs (especially for upscales)
        const hasPermanentUrls = generation.imageUrls &&
          generation.imageUrls.length > 0 &&
          !generation.imageUrls.some((url: string) =>
            url.includes('replicate.delivery') ||
            url.includes('pbxt.replicate.delivery') ||
            url.includes('mp.astria.ai') ||
            url.includes('cdn.astria.ai') ||
            url.includes('tmp.astria.ai')
          )

        if (hasPermanentUrls) {
          console.log(`✅ Generation ${generationId} job expired but has permanent URLs - keeping current status`)
          return NextResponse.json({
            status: generation.status,
            imageUrls: generation.imageUrls,
            thumbnailUrls: generation.thumbnailUrls,
            updated: false,
            message: 'Job expired but has permanent URLs - preserved'
          })
        }

        // Mark as failed only if no permanent URLs
        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            status: 'FAILED',
            errorMessage: 'Job expired or not found',
            completedAt: new Date()
          }
        })

        return NextResponse.json({
          status: 'FAILED',
          errorMessage: 'Job expired or not found',
          updated: true,
          message: 'Job expired and no permanent URLs found'
        })
      }

      // Re-throw other errors
      throw error
    }

    console.log(`📊 Replicate status: ${replicateStatus.status}`)

    if (isReplicateStatusCompleted(replicateStatus.status) && replicateStatus.result) {
      const results = Array.isArray(replicateStatus.result) ? replicateStatus.result : [replicateStatus.result]
      
      if (results.length > 0) {
        console.log(`💾 Generation completed! Downloading and storing ${results.length} images...`)
        
        // Download and store images permanently
        const storageResult = await downloadAndStoreImages(
          results,
          generation.id,
          generation.userId
        )

        if (storageResult.success && storageResult.permanentUrls && storageResult.permanentUrls.length > 0) {
          // Update generation with permanent URLs
          await prisma.generation.update({
            where: { id: generation.id },
            data: {
              status: 'COMPLETED',
              imageUrls: storageResult.permanentUrls,
              thumbnailUrls: storageResult.thumbnailUrls || storageResult.permanentUrls,
              completedAt: new Date(),
              processingTime: replicateStatus.processingTime || null,
              errorMessage: null,
              updatedAt: new Date()
            }
          })

          console.log(`✅ Generation ${generation.id} completed successfully!`)

          return NextResponse.json({
            status: 'COMPLETED',
            imageUrls: storageResult.permanentUrls,
            thumbnailUrls: storageResult.thumbnailUrls || storageResult.permanentUrls,
            completedAt: new Date(),
            processingTime: replicateStatus.processingTime,
            updated: true,
            message: `Successfully saved ${storageResult.permanentUrls.length} images`
          })
        } else {
          // Update with temporary URLs if storage failed
          await prisma.generation.update({
            where: { id: generation.id },
            data: {
              status: 'COMPLETED',
              imageUrls: results,
              thumbnailUrls: results,
              completedAt: new Date(),
              errorMessage: `Storage failed: ${storageResult.error}. Using temporary URLs.`,
              processingTime: replicateStatus.processingTime || null,
              updatedAt: new Date()
            }
          })

          console.log(`⚠️ Generation ${generation.id} completed but storage failed`)

          return NextResponse.json({
            status: 'COMPLETED',
            imageUrls: results,
            thumbnailUrls: results,
            completedAt: new Date(),
            processingTime: replicateStatus.processingTime,
            updated: true,
            warning: 'Storage failed - using temporary URLs',
            message: `Completed with temporary URLs: ${storageResult.error}`
          })
        }
      }
    } else if (isReplicateStatusFailed(replicateStatus.status)) {
      // Update generation as failed
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED',
          errorMessage: replicateStatus.error || 'Generation failed on Replicate',
          completedAt: new Date(),
          updatedAt: new Date()
        }
      })

      console.log(`❌ Generation ${generation.id} failed: ${replicateStatus.error}`)

      return NextResponse.json({
        status: 'FAILED',
        errorMessage: replicateStatus.error || 'Generation failed on Replicate',
        updated: true,
        message: 'Generation failed on Replicate'
      })
    } else if (isReplicateStatusProcessing(replicateStatus.status)) {
      // Still processing - update database status if needed
      if (generation.status !== 'PROCESSING') {
        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            status: 'PROCESSING',
            updatedAt: new Date()
          }
        })
      }

      return NextResponse.json({
        status: 'PROCESSING',
        replicateStatus: replicateStatus.status,
        updated: generation.status !== 'PROCESSING',
        message: `Still ${replicateStatus.status} on Replicate`
      })
    }

    // Unknown status
    return NextResponse.json({
      status: generation.status,
      replicateStatus: replicateStatus.status,
      updated: false,
      message: `Unknown Replicate status: ${replicateStatus.status}`
    })

  } catch (error) {
    console.error('❌ Polling error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'ERROR',
        updated: false
      },
      { status: 500 }
    )
  }
}

/**
 * Poll multiple generations at once (for efficiency)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    const { generationIds } = await request.json()

    if (!generationIds || !Array.isArray(generationIds)) {
      return NextResponse.json(
        { error: 'generationIds array is required' },
        { status: 400 }
      )
    }

    if (generationIds.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 generations per batch' },
        { status: 400 }
      )
    }

    console.log(`🔄 Batch polling for ${generationIds.length} generations`)

    // Find all generations
    const generations = await prisma.generation.findMany({
      where: {
        id: { in: generationIds },
        userId // Security: only poll own generations
      }
    })

    const results = []
    const replicate = new ReplicateProvider()

    for (const generation of generations) {
      try {
        if (generation.status === 'COMPLETED' || generation.status === 'FAILED') {
          results.push({
            generationId: generation.id,
            status: generation.status,
            imageUrls: generation.imageUrls,
            thumbnailUrls: generation.thumbnailUrls,
            updated: false,
            message: `Already ${generation.status.toLowerCase()}`
          })
          continue
        }

        if (!generation.jobId) {
          results.push({
            generationId: generation.id,
            status: generation.status,
            updated: false,
            message: 'No jobId available'
          })
          continue
        }

        // Check Replicate status
        const replicateStatus = await replicate.getGenerationStatus(generation.jobId)
        
        // Process based on status (similar logic to GET endpoint)
        if (isReplicateStatusCompleted(replicateStatus.status) && replicateStatus.result) {
          // Handle success...
          const result_urls = Array.isArray(replicateStatus.result) ? replicateStatus.result : [replicateStatus.result]
          
          if (result_urls.length > 0) {
            const storageResult = await downloadAndStoreImages(
              result_urls,
              generation.id,
              generation.userId
            )

            if (storageResult.success && storageResult.permanentUrls) {
              await prisma.generation.update({
                where: { id: generation.id },
                data: {
                  status: 'COMPLETED',
                  imageUrls: storageResult.permanentUrls,
                  thumbnailUrls: storageResult.thumbnailUrls || storageResult.permanentUrls,
                  completedAt: new Date(),
                  processingTime: replicateStatus.processingTime || null
                }
              })

              results.push({
                generationId: generation.id,
                status: 'COMPLETED',
                imageUrls: storageResult.permanentUrls,
                thumbnailUrls: storageResult.thumbnailUrls,
                updated: true,
                message: `Successfully saved ${storageResult.permanentUrls.length} images`
              })
            }
          }
        } else if (isReplicateStatusFailed(replicateStatus.status)) {
          await prisma.generation.update({
            where: { id: generation.id },
            data: {
              status: 'FAILED',
              errorMessage: replicateStatus.error,
              completedAt: new Date()
            }
          })

          results.push({
            generationId: generation.id,
            status: 'FAILED',
            errorMessage: replicateStatus.error,
            updated: true,
            message: 'Generation failed'
          })
        } else {
          results.push({
            generationId: generation.id,
            status: 'PROCESSING',
            replicateStatus: replicateStatus.status,
            updated: false,
            message: `Still ${replicateStatus.status}`
          })
        }

      } catch (error) {
        console.error(`Error polling generation ${generation.id}:`, error)
        results.push({
          generationId: generation.id,
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          updated: false
        })
      }
    }

    return NextResponse.json({
      results,
      total: results.length,
      updated: results.filter(r => r.updated).length
    })

  } catch (error) {
    console.error('❌ Batch polling error:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}