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
 * Emergency recovery endpoint for completed generations with expired URLs
 * This will re-fetch images from Replicate and store them permanently
 */
export async function POST(request: NextRequest) {
  console.log('🚨 Emergency recovery endpoint called')
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    
    // Find completed generations with potential expired URLs or missing images
    const problematicGenerations = await prisma.generation.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        jobId: { not: null },
        OR: [
          { imageUrls: { equals: [] } }, // No images
          { imageUrls: null }, // Null images
          { 
            // URLs that look like temporary Replicate URLs
            imageUrls: {
              path: ['0'],
              string_contains: 'replicate.delivery'
            }
          }
        ]
      },
      select: {
        id: true,
        jobId: true,
        prompt: true,
        createdAt: true,
        imageUrls: true,
        status: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20 // Limit to prevent overload
    })

    console.log(`🔍 Found ${problematicGenerations.length} generations needing recovery`)

    if (problematicGenerations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No generations need recovery',
        recovered: 0
      })
    }

    const recoveryResults = []
    let recoveredCount = 0
    let errorCount = 0

    for (const generation of problematicGenerations) {
      if (!generation.jobId) continue

      try {
        console.log(`🔄 Attempting recovery for generation ${generation.id}, job ${generation.jobId}`)
        
        // Get fresh data from Replicate
        const prediction = await replicate.predictions.get(generation.jobId)
        
        console.log(`📊 Replicate status for ${generation.jobId}:`, {
          status: prediction.status,
          hasOutput: !!prediction.output,
          hasError: !!prediction.error
        })

        if (prediction.status === 'succeeded' && prediction.output) {
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
            console.log(`📥 Recovering ${temporaryUrls.length} images for generation ${generation.id}`)
            
            // Download and store images permanently with retry
            let storageResult
            let attempts = 0
            const maxAttempts = 3
            
            while (attempts < maxAttempts) {
              attempts++
              console.log(`📤 Storage attempt ${attempts}/${maxAttempts} for generation ${generation.id}`)
              
              storageResult = await downloadAndStoreImages(
                temporaryUrls,
                generation.id,
                userId,
                'recovered' // Special folder for recovered images
              )
              
              if (storageResult.success) {
                break
              } else {
                console.warn(`⚠️ Storage attempt ${attempts} failed: ${storageResult.error}`)
                if (attempts < maxAttempts) {
                  await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2s before retry
                }
              }
            }

            if (storageResult && storageResult.success && storageResult.permanentUrls && storageResult.permanentUrls.length > 0) {
              // Update database with permanent URLs
              await prisma.generation.update({
                where: { id: generation.id },
                data: {
                  imageUrls: storageResult.permanentUrls,
                  thumbnailUrls: storageResult.thumbnailUrls || storageResult.permanentUrls,
                  errorMessage: null // Clear any previous errors
                }
              })
              
              recoveredCount++
              console.log(`✅ RECOVERY SUCCESS: Generation ${generation.id} - ${storageResult.permanentUrls.length} images stored permanently`)
              
              recoveryResults.push({
                generationId: generation.id,
                jobId: generation.jobId,
                status: 'recovered',
                imageCount: storageResult.permanentUrls.length,
                urls: storageResult.permanentUrls.map(url => url.substring(0, 100) + '...')
              })
            } else {
              errorCount++
              console.error(`❌ RECOVERY FAILED: Generation ${generation.id} - Storage failed after ${maxAttempts} attempts`)
              
              recoveryResults.push({
                generationId: generation.id,
                jobId: generation.jobId,
                status: 'failed',
                error: storageResult?.error || 'Storage failed after multiple attempts'
              })
            }
          } else {
            console.warn(`⚠️ No output URLs for generation ${generation.id}`)
            recoveryResults.push({
              generationId: generation.id,
              jobId: generation.jobId,
              status: 'no-output',
              error: 'No output URLs from Replicate'
            })
          }
        } else if (prediction.status === 'failed') {
          console.warn(`⚠️ Generation ${generation.id} failed on Replicate: ${prediction.error}`)
          recoveryResults.push({
            generationId: generation.id,
            jobId: generation.jobId,
            status: 'replicate-failed',
            error: prediction.error
          })
        } else {
          console.warn(`⚠️ Generation ${generation.id} in unexpected state: ${prediction.status}`)
          recoveryResults.push({
            generationId: generation.id,
            jobId: generation.jobId,
            status: prediction.status,
            error: 'Unexpected Replicate status'
          })
        }

      } catch (error) {
        errorCount++
        console.error(`❌ Error recovering generation ${generation.id}:`, error)
        recoveryResults.push({
          generationId: generation.id,
          jobId: generation.jobId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      // Small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    console.log(`📊 Recovery completed: ${recoveredCount} recovered, ${errorCount} errors`)

    return NextResponse.json({
      success: true,
      totalProcessed: problematicGenerations.length,
      recoveredCount,
      errorCount,
      results: recoveryResults
    })

  } catch (error) {
    console.error('❌ Emergency recovery error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown recovery error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Count generations that might need recovery
    const problematicCount = await prisma.generation.count({
      where: {
        userId,
        status: 'COMPLETED',
        jobId: { not: null },
        OR: [
          { imageUrls: { equals: [] } },
          { imageUrls: null },
          { 
            imageUrls: {
              path: ['0'],
              string_contains: 'replicate.delivery'
            }
          }
        ]
      }
    })

    // Recent recovery activity
    const recentGenerations = await prisma.generation.findMany({
      where: { 
        userId,
        status: 'COMPLETED'
      },
      select: {
        id: true,
        prompt: true,
        completedAt: true,
        imageUrls: true
      },
      orderBy: { completedAt: 'desc' },
      take: 5
    })

    return NextResponse.json({
      problematicCount,
      recentGenerations: recentGenerations.map(gen => ({
        ...gen,
        prompt: gen.prompt?.substring(0, 50) + '...',
        hasImages: gen.imageUrls && gen.imageUrls.length > 0,
        imageCount: gen.imageUrls ? gen.imageUrls.length : 0
      })),
      storageInfo: {
        provider: process.env.STORAGE_PROVIDER,
        hasAWSConfig: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
        bucket: process.env.AWS_S3_BUCKET
      }
    })

  } catch (error) {
    console.error('❌ Emergency recovery status error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}