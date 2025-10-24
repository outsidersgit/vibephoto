import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getAIProvider } from '@/lib/ai'
import { downloadAndStoreImages } from '@/lib/storage/utils'

/**
 * Polling endpoint to check and update stale generations
 * Used as fallback when webhooks don't work (development, HTTP URLs, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔄 Polling for stale generations...')

    // Find generations that are stuck in PROCESSING for more than 5 minutes
    const staleGenerations = await prisma.generation.findMany({
      where: {
        userId: session.user.id,
        status: 'PROCESSING',
        jobId: { not: null },
        createdAt: {
          lt: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
        }
      },
      take: 10 // Limit to prevent overload
    })

    console.log(`📊 Found ${staleGenerations.length} stale generations`)

    const results = []
    const aiProvider = getAIProvider()

    for (const generation of staleGenerations) {
      try {
        console.log(`🔍 Checking generation ${generation.id} (Job: ${generation.jobId})`)
        
        // Get status from AI provider
        const status = await aiProvider.getGenerationStatus(generation.jobId!)
        
        console.log(`📋 Job ${generation.jobId} status: ${status.status}`)
        
        let updateData: any = {}
        let shouldRefund = false

        switch (status.status) {
          case 'succeeded':
            if (status.urls && status.urls.length > 0) {
              console.log(`📥 Downloading and storing ${status.urls.length} images...`)
              
              const storageResult = await downloadAndStoreImages(
                status.urls,
                generation.id,
                generation.userId
              )
              
              if (storageResult.success) {
                updateData = {
                  status: 'COMPLETED',
                  imageUrls: storageResult.permanentUrls,
                  thumbnailUrls: storageResult.thumbnailUrls,
                  completedAt: status.completedAt ? new Date(status.completedAt) : new Date(),
                  errorMessage: null
                }
                console.log(`✅ Generation ${generation.id} completed successfully`)
              } else {
                updateData = {
                  status: 'FAILED',
                  errorMessage: `Storage failed: ${storageResult.error}`,
                  completedAt: new Date()
                }
                shouldRefund = true
                console.log(`❌ Generation ${generation.id} storage failed`)
              }
            } else {
              updateData = {
                status: 'FAILED',
                errorMessage: 'No output from AI provider',
                completedAt: new Date()
              }
              shouldRefund = true
            }
            break

          case 'failed':
            updateData = {
              status: 'FAILED',
              errorMessage: status.error || 'Generation failed',
              completedAt: status.completedAt ? new Date(status.completedAt) : new Date()
            }
            shouldRefund = true
            break

          case 'canceled':
            updateData = {
              status: 'CANCELLED',
              errorMessage: 'Generation was cancelled',
              completedAt: new Date()
            }
            shouldRefund = true
            break

          case 'processing':
          case 'starting':
            // Still processing, no update needed
            console.log(`⏳ Generation ${generation.id} still processing`)
            continue

          default:
            console.log(`⚠️ Unknown status: ${status.status}`)
            continue
        }

        // Update the generation
        if (Object.keys(updateData).length > 0) {
          await prisma.generation.update({
            where: { id: generation.id },
            data: updateData
          })

          // Handle credit refund if needed
          if (shouldRefund) {
            const creditsUsed = generation.variations * 10
            await prisma.user.update({
              where: { id: generation.userId },
              data: {
                creditsUsed: {
                  decrement: creditsUsed
                }
              }
            })
            console.log(`💰 Refunded ${creditsUsed} credits for failed generation`)
          }
        }

        results.push({
          generationId: generation.id,
          jobId: generation.jobId,
          status: status.status,
          updated: Object.keys(updateData).length > 0
        })

      } catch (error) {
        console.error(`❌ Error checking generation ${generation.id}:`, error)
        results.push({
          generationId: generation.id,
          jobId: generation.jobId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log(`✅ Polling completed. Updated ${results.filter(r => r.updated).length}/${results.length} generations`)

    return NextResponse.json({
      success: true,
      checked: staleGenerations.length,
      results
    })

  } catch (error) {
    console.error('❌ Polling error:', error)
    return NextResponse.json(
      { error: 'Polling failed' },
      { status: 500 }
    )
  }
}
