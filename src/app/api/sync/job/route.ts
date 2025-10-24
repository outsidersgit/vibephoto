import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { ReplicateProvider } from '@/lib/ai/providers/replicate'
import { downloadAndStoreImages } from '@/lib/storage/utils'
import { prisma } from '@/lib/prisma'
import { isReplicateStatusCompleted, isDatabaseStatusProcessing } from '@/lib/utils/status-mapping'

/**
 * Force sync a specific job by ID
 * Useful for development when webhooks don't work and for production recovery
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = await requireAuth()
    const userId = session.user.id

    const { jobId, generationId } = await request.json()

    if (!jobId && !generationId) {
      return NextResponse.json(
        { error: 'Either jobId or generationId is required' },
        { status: 400 }
      )
    }

    console.log(`🔄 Force sync requested by user ${userId}:`, { jobId, generationId })

    // Find generation by jobId or generationId
    let generation
    if (generationId) {
      generation = await prisma.generation.findUnique({
        where: { id: generationId },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      })
    } else if (jobId) {
      generation = await prisma.generation.findFirst({
        where: { jobId },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      })
    }

    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      )
    }

    // Security check - only allow sync of own generations (or admin)
    if (generation.userId !== userId && session.user.plan !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - can only sync own generations' },
        { status: 403 }
      )
    }

    if (!generation.jobId) {
      return NextResponse.json(
        { error: 'Generation has no jobId to sync' },
        { status: 400 }
      )
    }

    console.log(`🔍 Checking Replicate status for job: ${generation.jobId}`)

    // Check current status with Replicate
    const replicate = new ReplicateProvider()
    const replicateStatus = await replicate.getGenerationStatus(generation.jobId)

    console.log(`📊 Replicate status: ${replicateStatus.status}`, {
      hasResult: !!replicateStatus.result,
      resultCount: Array.isArray(replicateStatus.result) ? replicateStatus.result.length : 0
    })

    const response = {
      generationId: generation.id,
      jobId: generation.jobId,
      currentDbStatus: generation.status,
      replicateStatus: replicateStatus.status,
      updated: false,
      message: ''
    }

    if (isReplicateStatusCompleted(replicateStatus.status) && replicateStatus.result) {
      const results = Array.isArray(replicateStatus.result) ? replicateStatus.result : [replicateStatus.result]
      
      if (results.length > 0) {
        console.log(`💾 Downloading and storing ${results.length} images...`)
        
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

          response.updated = true
          response.message = `Successfully synced ${storageResult.permanentUrls.length} images`
          response.imageUrls = storageResult.permanentUrls
          response.thumbnailUrls = storageResult.thumbnailUrls

          console.log(`✅ Generation ${generation.id} successfully synced!`)
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

          response.updated = true
          response.message = `Sync completed but storage failed: ${storageResult.error}. Using temporary URLs.`
          response.imageUrls = results
          response.warning = 'Storage failed - using temporary URLs'

          console.log(`⚠️ Generation ${generation.id} synced with temporary URLs due to storage failure`)
        }
      } else {
        response.message = 'Replicate job succeeded but no images in result'
      }
    } else if (replicateStatus.status === 'failed') {
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

      response.updated = true
      response.message = `Generation marked as failed: ${replicateStatus.error}`
      response.error = replicateStatus.error

      console.log(`❌ Generation ${generation.id} marked as failed`)
    } else if (replicateStatus.status === 'processing' || replicateStatus.status === 'starting') {
      response.message = `Generation still ${replicateStatus.status} on Replicate`
    } else {
      response.message = `Unknown Replicate status: ${replicateStatus.status}`
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Force sync error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * Get sync status for a generation
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const generationId = searchParams.get('generationId')

    if (!jobId && !generationId) {
      return NextResponse.json(
        { error: 'Either jobId or generationId is required' },
        { status: 400 }
      )
    }

    // Find generation
    let generation
    if (generationId) {
      generation = await prisma.generation.findUnique({
        where: { id: generationId }
      })
    } else if (jobId) {
      generation = await prisma.generation.findFirst({
        where: { jobId }
      })
    }

    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      )
    }

    // Security check
    if (generation.userId !== userId && session.user.plan !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Get current Replicate status if we have a jobId
    let replicateStatus = null
    if (generation.jobId) {
      try {
        const replicate = new ReplicateProvider()
        replicateStatus = await replicate.getGenerationStatus(generation.jobId)
      } catch (error) {
        console.error('Error checking Replicate status:', error)
      }
    }

    return NextResponse.json({
      generationId: generation.id,
      jobId: generation.jobId,
      dbStatus: generation.status,
      replicateStatus: replicateStatus?.status || null,
      hasImages: generation.imageUrls && generation.imageUrls.length > 0,
      imageCount: generation.imageUrls?.length || 0,
      createdAt: generation.createdAt,
      updatedAt: generation.updatedAt,
      completedAt: generation.completedAt,
      errorMessage: generation.errorMessage,
      needsSync: isDatabaseStatusProcessing(generation.status) && isReplicateStatusCompleted(replicateStatus?.status || '')
    })

  } catch (error) {
    console.error('❌ Sync status error:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}