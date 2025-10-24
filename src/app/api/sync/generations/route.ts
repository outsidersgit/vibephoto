import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Replicate from 'replicate'
import { downloadAndStoreImages } from '@/lib/storage/utils'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || ''
})

/**
 * Endpoint para sincronizar gerações pendentes com o Replicate
 * Este é um fallback quando os webhooks não funcionam corretamente
 */
export async function POST(request: NextRequest) {
  console.log('🔄 Generation sync endpoint called')
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Find all processing generations for this user
    const processingGenerations = await prisma.generation.findMany({
      where: {
        userId,
        status: 'PROCESSING',
        jobId: {
          not: null
        }
      },
      select: {
        id: true,
        jobId: true,
        prompt: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10 // Limit to prevent overload
    })

    console.log(`📋 Found ${processingGenerations.length} processing generations for user ${userId}`)

    if (processingGenerations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No processing generations found',
        synced: 0
      })
    }

    const syncResults = []
    let syncedCount = 0
    let errorCount = 0

    for (const generation of processingGenerations) {
      if (!generation.jobId) continue

      try {
        console.log(`🔍 Checking status for generation ${generation.id}, job ${generation.jobId}`)
        
        // Get status from Replicate
        const prediction = await replicate.predictions.get(generation.jobId)
        
        console.log(`📊 Replicate status for ${generation.jobId}:`, {
          status: prediction.status,
          hasOutput: !!prediction.output,
          hasError: !!prediction.error
        })

        let updateData: any = {}
        let needsUpdate = false

        switch (prediction.status) {
          case 'succeeded':
            if (prediction.output) {
              console.log(`✅ Generation ${generation.id} succeeded, processing output...`)
              
              // Handle different output formats
              let temporaryUrls: string[] = []
              if (Array.isArray(prediction.output)) {
                temporaryUrls = prediction.output
              } else if (typeof prediction.output === 'string') {
                temporaryUrls = [prediction.output]
              } else if (prediction.output.images) {
                temporaryUrls = prediction.output.images
              }

              if (temporaryUrls.length > 0) {
                console.log(`📥 Processing ${temporaryUrls.length} images for permanent storage`)
                
                // Download and store images permanently
                const storageResult = await downloadAndStoreImages(
                  temporaryUrls,
                  generation.id,
                  userId
                )

                if (storageResult.success && storageResult.permanentUrls && storageResult.permanentUrls.length > 0) {
                  updateData = {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    imageUrls: storageResult.permanentUrls,
                    thumbnailUrls: storageResult.thumbnailUrls || storageResult.permanentUrls,
                    errorMessage: null
                  }
                  needsUpdate = true
                  console.log(`✅ Images stored permanently for generation ${generation.id}`)
                } else {
                  // Storage failed, mark as failed
                  updateData = {
                    status: 'FAILED',
                    completedAt: new Date(),
                    errorMessage: `Storage failed: ${storageResult.error}`
                  }
                  needsUpdate = true
                  console.error(`❌ Storage failed for generation ${generation.id}: ${storageResult.error}`)
                }
              } else {
                // No output URLs, mark as failed
                updateData = {
                  status: 'FAILED',
                  completedAt: new Date(),
                  errorMessage: 'No output URLs received from Replicate'
                }
                needsUpdate = true
              }
            }
            break

          case 'failed':
            console.log(`❌ Generation ${generation.id} failed:`, prediction.error)
            updateData = {
              status: 'FAILED',
              completedAt: new Date(),
              errorMessage: prediction.error || 'Generation failed without error message'
            }
            needsUpdate = true
            break

          case 'canceled':
            console.log(`🛑 Generation ${generation.id} was canceled`)
            updateData = {
              status: 'CANCELLED',
              completedAt: new Date(),
              errorMessage: 'Generation was cancelled'
            }
            needsUpdate = true
            break

          case 'starting':
          case 'processing':
            // Still processing, check if it's been too long
            const ageHours = (Date.now() - new Date(generation.createdAt).getTime()) / (1000 * 60 * 60)
            if (ageHours > 2) { // If processing for more than 2 hours
              console.warn(`⚠️ Generation ${generation.id} has been processing for ${ageHours.toFixed(1)} hours`)
              // Could optionally mark as failed or timeout
            }
            console.log(`⏳ Generation ${generation.id} still ${prediction.status}`)
            break

          default:
            console.warn(`❓ Unknown status ${prediction.status} for generation ${generation.id}`)
            break
        }

        // Update database if needed
        if (needsUpdate) {
          await prisma.generation.update({
            where: { id: generation.id },
            data: updateData
          })
          syncedCount++
          console.log(`💾 Updated generation ${generation.id} to status: ${updateData.status}`)
        }

        syncResults.push({
          generationId: generation.id,
          jobId: generation.jobId,
          replicateStatus: prediction.status,
          databaseStatus: updateData.status || 'PROCESSING',
          updated: needsUpdate,
          hasImages: !!updateData.imageUrls?.length
        })

      } catch (error) {
        errorCount++
        console.error(`❌ Error syncing generation ${generation.id}:`, error)
        syncResults.push({
          generationId: generation.id,
          jobId: generation.jobId,
          error: error instanceof Error ? error.message : 'Unknown error',
          updated: false
        })
      }

      // Small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log(`📊 Sync completed: ${syncedCount} updated, ${errorCount} errors`)

    return NextResponse.json({
      success: true,
      totalProcessed: processingGenerations.length,
      syncedCount,
      errorCount,
      results: syncResults
    })

  } catch (error) {
    console.error('❌ Generation sync error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown sync error'
    }, { status: 500 })
  }
}

/**
 * GET endpoint to check sync status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Count processing generations
    const processingCount = await prisma.generation.count({
      where: {
        userId,
        status: 'PROCESSING',
        jobId: { not: null }
      }
    })

    // Get recent generations
    const recentGenerations = await prisma.generation.findMany({
      where: { userId },
      select: {
        id: true,
        jobId: true,
        status: true,
        createdAt: true,
        completedAt: true,
        prompt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    })

    return NextResponse.json({
      processingCount,
      recentGenerations: recentGenerations.map(gen => ({
        ...gen,
        prompt: gen.prompt?.substring(0, 50) + '...',
        ageMinutes: Math.round((Date.now() - new Date(gen.createdAt).getTime()) / 60000),
        processingTime: gen.completedAt 
          ? Math.round((new Date(gen.completedAt).getTime() - new Date(gen.createdAt).getTime()) / 1000)
          : null
      })),
      webhookInfo: {
        hasWebhookSecret: !!process.env.REPLICATE_WEBHOOK_SECRET,
        webhookUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/replicate`
      }
    })

  } catch (error) {
    console.error('❌ Generation sync status error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}