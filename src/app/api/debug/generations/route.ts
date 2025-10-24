import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || ''
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const action = url.searchParams.get('action')
    const jobId = url.searchParams.get('jobId')

    if (action === 'sync' && jobId) {
      // Sync a specific job with Replicate
      console.log(`🔄 Manual sync requested for job: ${jobId}`)
      
      try {
        const prediction = await replicate.predictions.get(jobId)
        console.log('📋 Replicate status:', {
          id: prediction.id,
          status: prediction.status,
          hasOutput: !!prediction.output,
          error: prediction.error
        })

        // Find the generation in our database
        const generation = await prisma.generation.findFirst({
          where: { jobId }
        })

        if (!generation) {
          return NextResponse.json({ 
            error: 'Generation not found in database',
            replicateStatus: prediction.status
          }, { status: 404 })
        }

        // Update based on Replicate status
        const updateData: any = {}
        
        switch (prediction.status) {
          case 'succeeded':
            if (prediction.output) {
              updateData.status = 'COMPLETED'
              updateData.completedAt = new Date()

              // Handle different output formats
              let temporaryUrls: string[] = []
              if (Array.isArray(prediction.output)) {
                temporaryUrls = prediction.output
              } else if (typeof prediction.output === 'string') {
                temporaryUrls = [prediction.output]
              }

              console.log(`📥 Processing ${temporaryUrls.length} generated images from debug sync`)

              try {
                // Use the same storage process as polling service
                const { processAndStoreReplicateImages } = await import('@/lib/services/auto-image-storage')

                const autoStorageResults = await processAndStoreReplicateImages(
                  temporaryUrls,
                  generation.id,
                  session.user.id
                )

                if (autoStorageResults.length > 0) {
                  const s3Keys = autoStorageResults.map(r => r.key)
                  const permanentUrls = autoStorageResults.map(r => r.url)
                  const thumbnailUrls = autoStorageResults.map(r => r.thumbnailUrl || r.url)

                  // Save permanent URLs like polling service does
                  updateData.imageUrls = permanentUrls
                  updateData.thumbnailUrls = thumbnailUrls
                  updateData.storageKeys = s3Keys
                  updateData.storageProvider = 'aws'
                  updateData.metadata = {
                    s3Keys: s3Keys,
                    originalUrls: temporaryUrls,
                    processedAt: new Date().toISOString(),
                    storageProvider: 'aws',
                    recoveredVia: 'debug-sync'
                  }

                  console.log(`✅ Successfully stored ${s3Keys.length} images permanently via debug sync`)
                } else {
                  throw new Error('Auto-storage returned no results')
                }

              } catch (storageError) {
                console.error(`⚠️ Storage failed during debug sync, using temporary URLs:`, storageError)

                // Fallback to temporary URLs with warning
                updateData.imageUrls = temporaryUrls
                updateData.thumbnailUrls = temporaryUrls
                updateData.storageProvider = 'temporary'
                updateData.metadata = {
                  temporaryUrls: temporaryUrls,
                  storageError: true,
                  errorDetails: storageError.message,
                  recoveredVia: 'debug-sync-fallback'
                }
                updateData.errorMessage = 'Images recovered but storage failed - URLs may expire'
              }
            }
            break
            
          case 'failed':
            updateData.status = 'FAILED'
            updateData.completedAt = new Date()
            updateData.errorMessage = prediction.error || 'Generation failed'
            break
            
          case 'canceled':
            updateData.status = 'CANCELLED'
            updateData.completedAt = new Date()
            break
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.generation.update({
            where: { id: generation.id },
            data: updateData
          })
          
          console.log(`✅ Updated generation ${generation.id} to status: ${updateData.status}`)
        }

        return NextResponse.json({
          success: true,
          jobId,
          replicateStatus: prediction.status,
          databaseStatus: updateData.status || generation.status,
          updated: Object.keys(updateData).length > 0,
          output: prediction.output
        })

      } catch (replicateError) {
        console.error('Error fetching from Replicate:', replicateError)
        return NextResponse.json({
          error: 'Failed to fetch from Replicate',
          details: replicateError instanceof Error ? replicateError.message : 'Unknown error'
        }, { status: 500 })
      }
    }

    if (action === 'list') {
      // List processing generations
      const processingGenerations = await prisma.generation.findMany({
        where: {
          status: 'PROCESSING',
          userId: session.user.id
        },
        select: {
          id: true,
          jobId: true,
          prompt: true,
          status: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      })

      return NextResponse.json({
        processingGenerations: processingGenerations.map(gen => ({
          ...gen,
          ageMinutes: Math.round((Date.now() - new Date(gen.createdAt).getTime()) / 60000)
        }))
      })
    }

    // Default: return debug info
    return NextResponse.json({
      debug: {
        hasReplicateToken: !!process.env.REPLICATE_API_TOKEN,
        hasWebhookSecret: !!process.env.REPLICATE_WEBHOOK_SECRET,
        webhookUrl: process.env.NEXTAUTH_URL + '/api/webhooks/replicate'
      },
      actions: [
        'GET ?action=list - List processing generations',
        'GET ?action=sync&jobId=xxx - Manually sync a job with Replicate'
      ]
    })

  } catch (error) {
    console.error('Debug generations error:', error)
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, jobIds } = await request.json()

    if (action === 'sync-all' && Array.isArray(jobIds)) {
      console.log(`🔄 Bulk sync requested for ${jobIds.length} jobs`)
      
      const results = []
      for (const jobId of jobIds) {
        try {
          const prediction = await replicate.predictions.get(jobId)
          
          const generation = await prisma.generation.findFirst({
            where: { jobId, userId: session.user.id }
          })

          if (generation && prediction.status === 'succeeded' && prediction.output) {
            let outputUrls: string[] = []
            if (Array.isArray(prediction.output)) {
              outputUrls = prediction.output
            } else if (typeof prediction.output === 'string') {
              outputUrls = [prediction.output]
            }

            await prisma.generation.update({
              where: { id: generation.id },
              data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                imageUrls: outputUrls,
                thumbnailUrls: outputUrls
              }
            })

            results.push({
              jobId,
              status: 'synced',
              generationId: generation.id
            })
          } else {
            results.push({
              jobId,
              status: 'no-update-needed',
              replicateStatus: prediction.status
            })
          }
        } catch (error) {
          results.push({
            jobId,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      return NextResponse.json({
        success: true,
        results,
        totalProcessed: results.length
      })
    }

    return NextResponse.json({
      error: 'Invalid action',
      supportedActions: ['sync-all']
    }, { status: 400 })

  } catch (error) {
    console.error('Debug generations POST error:', error)
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}