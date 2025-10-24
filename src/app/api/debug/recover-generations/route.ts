import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAIProvider } from '@/lib/ai'
import { processAndStoreReplicateImages } from '@/lib/services/auto-image-storage'

export async function POST(request: NextRequest) {
  try {
    // Dev only endpoint
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Development only' }, { status: 403 })
    }

    const { generationId, forceAll } = await request.json()

    console.log(`🔄 Starting recovery process...`)

    // Find generations that need recovery
    let generations
    if (generationId) {
      // Specific generation
      generations = await prisma.generation.findMany({
        where: {
          id: generationId,
          status: { in: ['COMPLETED', 'PROCESSING'] }
        },
        include: { user: true }
      })
    } else {
      // All problematic generations
      generations = await prisma.generation.findMany({
        where: {
          status: 'COMPLETED',
          OR: [
            { imageUrls: { equals: [] } }, // Empty array
            { imageUrls: { equals: null } }, // Null
          ]
        },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        take: forceAll ? undefined : 10 // Limit to 10 unless forced
      })
    }

    console.log(`📊 Found ${generations.length} generations to recover`)

    const results = []
    const aiProvider = getAIProvider()

    for (const generation of generations) {
      try {
        console.log(`🔍 Checking generation ${generation.id} (${generation.jobId})`)

        if (!generation.jobId) {
          console.log(`⚠️ Generation ${generation.id} has no jobId, skipping`)
          continue
        }

        // Get status from Replicate
        const prediction = await aiProvider.getPredictionStatus(generation.jobId)
        console.log(`📊 Prediction ${generation.jobId} status: ${prediction.status}`)

        if (prediction.status === 'succeeded') {
          console.log(`🔍 Prediction output:`, prediction.output)

          // Process URLs
          let temporaryUrls: string[] = []

          if (prediction.output) {
            if (Array.isArray(prediction.output)) {
              temporaryUrls = prediction.output
            } else if (typeof prediction.output === 'string') {
              temporaryUrls = [prediction.output]
            }
          }

          console.log(`📊 Found ${temporaryUrls.length} URLs:`, temporaryUrls.slice(0, 2))

          if (temporaryUrls.length > 0) {
            console.log(`📥 Processing ${temporaryUrls.length} images for generation ${generation.id}`)

            try {
              // Process and store images
              const storageResults = await processAndStoreReplicateImages(
                temporaryUrls,
                generation.id,
                generation.userId
              )

              if (storageResults.length > 0) {
                const permanentUrls = storageResults.map(r => r.url)
                const s3Keys = storageResults.map(r => r.key)

                // Update generation in database
                await prisma.generation.update({
                  where: { id: generation.id },
                  data: {
                    imageUrls: permanentUrls,
                    thumbnailUrls: permanentUrls,
                    storageKeys: s3Keys,
                    storageProvider: 'aws',
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    metadata: {
                      ...((generation.metadata as any) || {}),
                      recoveryProcessed: true,
                      recoveredAt: new Date().toISOString(),
                      originalUrls: temporaryUrls,
                      s3Keys: s3Keys,
                      storageProvider: 'aws'
                    }
                  }
                })

                console.log(`✅ Recovered generation ${generation.id} with ${permanentUrls.length} images`)

                results.push({
                  generationId: generation.id,
                  jobId: generation.jobId,
                  status: 'recovered',
                  imageCount: permanentUrls.length,
                  urls: permanentUrls
                })
              } else {
                console.log(`❌ Storage failed for generation ${generation.id}`)
                results.push({
                  generationId: generation.id,
                  jobId: generation.jobId,
                  status: 'storage_failed',
                  error: 'Storage processing failed'
                })
              }
            } catch (storageError) {
              console.error(`❌ Storage error for generation ${generation.id}:`, storageError)
              results.push({
                generationId: generation.id,
                jobId: generation.jobId,
                status: 'storage_error',
                error: storageError instanceof Error ? storageError.message : 'Unknown storage error'
              })
            }
          } else {
            console.log(`⚠️ No output URLs found for generation ${generation.id}`)
            results.push({
              generationId: generation.id,
              jobId: generation.jobId,
              status: 'no_output',
              error: 'No output URLs from Replicate'
            })
          }
        } else if (prediction.status === 'processing') {
          // Still processing, update status
          await prisma.generation.update({
            where: { id: generation.id },
            data: { status: 'PROCESSING' }
          })

          results.push({
            generationId: generation.id,
            jobId: generation.jobId,
            status: 'still_processing'
          })
        } else if (prediction.status === 'failed') {
          // Failed, update status
          await prisma.generation.update({
            where: { id: generation.id },
            data: {
              status: 'FAILED',
              errorMessage: prediction.error || 'Generation failed',
              completedAt: new Date()
            }
          })

          results.push({
            generationId: generation.id,
            jobId: generation.jobId,
            status: 'failed',
            error: prediction.error
          })
        } else {
          results.push({
            generationId: generation.id,
            jobId: generation.jobId,
            status: prediction.status,
            error: 'Unexpected status'
          })
        }
      } catch (error) {
        console.error(`❌ Error processing generation ${generation.id}:`, error)
        results.push({
          generationId: generation.id,
          jobId: generation.jobId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const recovered = results.filter(r => r.status === 'recovered').length
    const failed = results.filter(r => r.status !== 'recovered').length

    console.log(`🏁 Recovery complete: ${recovered} recovered, ${failed} failed/skipped`)

    return NextResponse.json({
      success: true,
      totalProcessed: generations.length,
      recovered,
      failed,
      results
    })

  } catch (error) {
    console.error('❌ Recovery process error:', error)

    return NextResponse.json({
      error: 'Recovery failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}