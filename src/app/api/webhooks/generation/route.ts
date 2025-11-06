import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { WebhookPayload } from '@/lib/ai/base'
import { downloadAndStoreImages } from '@/lib/storage/utils'
import { processAndStoreReplicateImages } from '@/lib/services/auto-image-storage'
import { broadcastGenerationStatusChange, broadcastGenerationProgress } from '@/lib/services/realtime-service'
import { recordImageGenerationCost } from '@/lib/services/credit-transaction-service'
import { calculateGenerationCost } from '@/lib/ai'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  console.log('🔔 Webhook generation received at:', new Date().toISOString())
  
  try {
    // Webhook security validation
    let payload: WebhookPayload
    const webhookSecret = process.env.REPLICATE_WEBHOOK_SECRET
    
    if (webhookSecret && process.env.NODE_ENV === 'production') {
      const signature = request.headers.get('webhook-signature')
      const body = await request.text()
      
      if (!signature || !verifyWebhookSignature(body, signature, webhookSecret)) {
        console.log('Generation webhook: Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
      
      // Parse JSON after verification
      payload = JSON.parse(body)
    } else {
      // Development mode or no secret configured - skip signature verification
      if (process.env.NODE_ENV === 'development') {
        console.log('Generation webhook: Development mode - skipping signature verification')
      } else {
        console.warn('Generation webhook: No REPLICATE_WEBHOOK_SECRET configured - webhook not secured')
      }
      payload = await request.json()
    }
    
    // Find the generation with this job ID
    const generation = await prisma.generation.findFirst({
      where: {
        jobId: payload.id
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        },
        model: {
          select: {
            name: true
          }
        }
      }
    })

    if (!generation) {
      console.log(`Generation webhook: Generation not found for job ${payload.id}`)
      return NextResponse.json({ success: false, error: 'Generation not found' }, { status: 404 })
    }

    // Update generation based on webhook status
    const updateData: any = {}

    switch (payload.status) {
      case 'starting':
        updateData.status = 'PROCESSING'
        break

      case 'processing':
        updateData.status = 'PROCESSING'
        // Could update progress here if provided
        break

      case 'succeeded':
        updateData.status = 'COMPLETED'
        updateData.completedAt = new Date()
        
        if (payload.output) {
          // Handle different output formats
          let temporaryUrls: string[] = []
          
          if (Array.isArray(payload.output)) {
            temporaryUrls = payload.output
          } else if (typeof payload.output === 'string') {
            temporaryUrls = [payload.output]
          } else if (payload.output.images) {
            temporaryUrls = payload.output.images
          }
          
          console.log(`📥 Processing ${temporaryUrls.length} generated images for storage`)
          console.log(`🔍 Storage provider: ${process.env.STORAGE_PROVIDER}`)
          console.log(`🗂️ Temporary URLs to process:`, temporaryUrls.map(url => ({ url, length: url.length })))
          
          try {
            // Use new auto-storage service for better reliability
            const autoStorageResults = await processAndStoreReplicateImages(
              temporaryUrls,
              generation.id,
              generation.userId
            )
            
            console.log(`📊 Auto-storage result:`, {
              processedCount: autoStorageResults.length,
              permanentUrls: autoStorageResults.map(r => r.url)
            })
            
            if (autoStorageResults.length > 0) {
              const s3Keys = autoStorageResults.map(r => r.key)
              const permanentUrls = autoStorageResults.map(r => r.url)

              // HYBRID APPROACH: Save both for compatibility and future migration
              updateData.imageUrls = permanentUrls  // For immediate frontend compatibility
              updateData.thumbnailUrls = permanentUrls // Thumbnail fallback

              // Save s3 keys and metadata for future signed URL system
              updateData.storageKeys = s3Keys
              updateData.storageProvider = 'aws'
              updateData.metadata = {
                ...updateData.metadata,
                s3Keys: s3Keys,
                originalUrls: temporaryUrls,
                temporaryUrls: temporaryUrls, // Also save as temporaryUrls for consistency
                processedAt: new Date().toISOString(),
                storageProvider: 'aws',
                storageType: 'private'
              }

              console.log(`✅ Successfully stored ${s3Keys.length} images permanently via auto-storage`)
              console.log(`🗂️ S3 Keys:`, s3Keys)
              console.log(`🔗 Permanent URLs:`, permanentUrls.map(url => url.substring(0, 50) + '...'))
            } else {
              throw new Error('Auto-storage returned no results')
            }
          } catch (autoStorageError) {
            console.error(`⚠️ Auto-storage failed, falling back to legacy storage: ${autoStorageError}`)
            
            // Fallback to legacy storage system
            const storageResult = await downloadAndStoreImages(
              temporaryUrls,
              generation.id,
              generation.userId
            )
            
            console.log(`📊 Legacy storage result:`, {
              success: storageResult.success,
              permanentUrlsCount: storageResult.permanentUrls?.length || 0,
              thumbnailUrlsCount: storageResult.thumbnailUrls?.length || 0,
              error: storageResult.error
            })
            
            if (storageResult.success && storageResult.permanentUrls && storageResult.permanentUrls.length > 0) {
              // HYBRID APPROACH: Save URLs directly for immediate compatibility
              updateData.imageUrls = storageResult.permanentUrls
              updateData.thumbnailUrls = storageResult.thumbnailUrls || storageResult.permanentUrls

              // Extract s3 keys for future migration to signed URLs
              const s3Keys = storageResult.permanentUrls.map((url, index) => {
                return `generated/${generation.userId}/${generation.id}/${index}.jpg`
              })

              updateData.storageKeys = s3Keys
              updateData.storageProvider = 'aws'
              updateData.metadata = {
                ...updateData.metadata,
                s3Keys: s3Keys,
                originalUrls: temporaryUrls,
                temporaryUrls: temporaryUrls, // Also save as temporaryUrls for consistency
                processedAt: new Date().toISOString(),
                storageProvider: 'legacy',
                permanentUrls: storageResult.permanentUrls
              }

              console.log(`✅ Successfully stored ${storageResult.permanentUrls.length} images permanently via legacy storage`)
            } else {
              // Final fallback: use temporary URLs directly for immediate access
              console.error(`⚠️ Both storage systems failed`)
              console.log(`🔄 Using temporary URLs (will expire in 1 hour)`)

              updateData.imageUrls = temporaryUrls // Direct temporary URLs for immediate access
              updateData.thumbnailUrls = temporaryUrls
              updateData.storageProvider = 'temporary'
              updateData.metadata = {
                ...updateData.metadata,
                temporaryUrls: temporaryUrls,
                storageError: true,
                errorDetails: {
                  autoStorage: String(autoStorageError),
                  legacyStorage: storageResult.error
                },
                expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour expiry
              }

              // Still mark as completed but add warning in error message
              updateData.errorMessage = `Warning: Images may expire in 1 hour due to storage errors. Auto-storage: ${autoStorageError}, Legacy: ${storageResult.error}`
              
              // Log this for monitoring
              console.error(`🚨 COMPLETE STORAGE FAILURE for generation ${generation.id}:`, {
                userId: generation.userId,
                temporaryUrls: temporaryUrls.length,
                storageProvider: process.env.STORAGE_PROVIDER,
                autoStorageError: String(autoStorageError),
                legacyStorageError: storageResult.error
              })
            }
          }
        }
        
        // Calculate processing time
        if (payload.metrics?.total_time) {
          updateData.processingTime = Math.round(payload.metrics.total_time * 1000) // Convert to milliseconds
        } else {
          updateData.processingTime = new Date().getTime() - new Date(generation.createdAt).getTime()
        }

        // NOTE: Credits are already debited and transaction created on generation creation
        // (src/lib/db/generations.ts) - no need to do anything here
        console.log(`✅ Generation ${generation.id} completed - credits already debited`)

        break

      case 'failed':
        updateData.status = 'FAILED'
        updateData.completedAt = new Date()
        
        if (payload.error) {
          updateData.errorMessage = payload.error
        }
        
        // Refund credits on failure
        await refundGenerationCredits(generation.id, generation.userId)
        break

      case 'canceled':
        updateData.status = 'CANCELLED'
        updateData.completedAt = new Date()
        
        // Refund credits on cancellation
        await refundGenerationCredits(generation.id, generation.userId)
        break
    }

    // Update the generation
    const updatedGeneration = await prisma.generation.update({
      where: { id: generation.id },
      data: updateData
    })

    // Update package progress if this generation is part of a package
    if (generation.packageId) {
      await updatePackageProgress(generation.packageId, payload.status)
    }

    // Extract temporary URLs from metadata for modal display
    const metadata = updateData.metadata as any || {}
    const temporaryUrls = metadata.temporaryUrls || metadata.originalUrls || []
    
    // Broadcast real-time status change to user
    await broadcastGenerationStatusChange(
      generation.id,
      generation.userId,
      payload.status,
      {
        imageUrls: updateData.imageUrls || [], // Permanent URLs for gallery
        thumbnailUrls: updateData.thumbnailUrls || [],
        temporaryUrls: temporaryUrls, // Temporary URLs for immediate modal display
        permanentUrls: updateData.imageUrls || [], // Same as imageUrls (permanent)
        s3Keys: updateData.metadata?.s3Keys || [],
        storageProvider: updateData.storageProvider,
        processingTime: updateData.processingTime,
        errorMessage: updateData.errorMessage
      }
    )

    // Send notification to user for completed generations
    if (payload.status === 'succeeded') {
      const imageCount = Array.isArray(updateData.imageUrls) ? updateData.imageUrls.length :
                        updateData.metadata?.s3Keys?.length ||
                        updateData.metadata?.temporaryUrls?.length ||
                        0
      await sendGenerationNotification(
        generation.user.email,
        generation.model.name,
        imageCount
      )
    }

    // Log detailed processing results
    const logData = {
      generationId: generation.id,
      userId: generation.userId,
      status: payload.status,
      processingTime: updateData.processingTime,
      imageUrlCount: Array.isArray(updateData.imageUrls) ? updateData.imageUrls.length : 0,
      s3KeyCount: updateData.metadata?.s3Keys?.length || 0,
      storageProvider: updateData.storageProvider || 'unknown',
      hasStorageError: !!updateData.metadata?.storageError,
      hasError: !!updateData.errorMessage
    }
    
    console.log(`🎯 Generation webhook processed:`, logData)
    
    // Additional monitoring for storage success/failure
    if (payload.status === 'succeeded') {
      if (updateData.metadata?.storageError) {
        console.warn(`⚠️ Storage error for generation ${generation.id}: Images may expire in 1 hour`)
      } else if (Array.isArray(updateData.imageUrls) && updateData.imageUrls.length > 0) {
        console.log(`✅ Images available for generation ${generation.id}: ${updateData.imageUrls.length} URLs, ${updateData.metadata?.s3Keys?.length || 0} s3 keys`)
      } else {
        console.warn(`⚠️ No image URLs stored for generation ${generation.id}`)
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    // Enhanced error logging with more context
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      jobId: payload?.id,
      status: payload?.status,
      timestamp: new Date().toISOString()
    }
    
    console.error('❌ Generation webhook critical error:', errorDetails)
    
    // Try to log error in database for monitoring
    if (payload?.id) {
      try {
        const generation = await prisma.generation.findFirst({
          where: { jobId: payload.id },
          select: { id: true, userId: true }
        })
        
        if (generation) {
          await prisma.generation.update({
            where: { id: generation.id },
            data: {
              status: 'FAILED',
              errorMessage: `Webhook processing error: ${errorDetails.message}`,
              completedAt: new Date()
            }
          })
          console.log(`📝 Error logged to database for generation ${generation.id}`)
        }
      } catch (dbError) {
        console.error('Failed to log error to database:', dbError)
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorDetails.message,
        timestamp: errorDetails.timestamp
      },
      { status: 500 }
    )
  }
}

async function refundGenerationCredits(generationId: string, userId: string) {
  try {
    // Find the original usage log for this generation
    const originalUsage = await prisma.usageLog.findFirst({
      where: {
        userId,
        action: 'generation',
        details: {
          path: ['generationId'],
          equals: generationId
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (originalUsage && originalUsage.creditsUsed > 0) {
      // Create refund transaction
      await prisma.$transaction(async (tx) => {
        await tx.usageLog.create({
          data: {
            userId,
            action: 'generation_refund',
            details: {
              generationId,
              originalCreditsUsed: originalUsage.creditsUsed,
              reason: 'Generation failed/cancelled'
            },
            creditsUsed: -originalUsage.creditsUsed // Negative to indicate refund
          }
        })

        // Reduce credits used from user (effectively adding credits back)
        await tx.user.update({
          where: { id: userId },
          data: {
            creditsUsed: {
              decrement: originalUsage.creditsUsed
            }
          }
        })
      })

      console.log(`Refunded ${originalUsage.creditsUsed} credits to user ${userId}`)
    }
  } catch (error) {
    console.error('Failed to refund generation credits:', error)
  }
}

async function generateThumbnails(imageUrls: string[]): Promise<string[]> {
  // This function is now handled by downloadAndStoreImages
  // Keeping for backward compatibility if called elsewhere
  console.log('ℹ️ generateThumbnails called - consider using downloadAndStoreImages instead')
  return imageUrls
}

async function sendGenerationNotification(email: string, modelName: string, imageCount: number) {
  // Placeholder for email notification
  console.log(`Would send generation complete notification to ${email}: ${imageCount} images generated with ${modelName}`)
  
  // Example with Resend:
  // await resend.emails.send({
  //   from: 'noreply@ensaiofotos.com',
  //   to: email,
  //   subject: 'Your AI Photos are Ready!',
  //   html: `
  //     <h2>Your photos are ready!</h2>
  //     <p>We've successfully generated ${imageCount} image${imageCount > 1 ? 's' : ''} using your "${modelName}" model.</p>
  //     <p><a href="${process.env.NEXTAUTH_URL}/gallery">View your photos</a></p>
  //   `
  // })
}

async function updatePackageProgress(userPackageId: string, generationStatus: string) {
  try {
    console.log(`📦 Updating package progress for package ${userPackageId}, generation status: ${generationStatus}`)

    const userPackage = await prisma.userPackage.findUnique({
      where: { id: userPackageId },
      include: {
        generations: {
          select: {
            id: true,
            status: true,
            packagePromptIndex: true,
            packageVariationIndex: true
          }
        }
      }
    })

    if (!userPackage) {
      console.error(`UserPackage ${userPackageId} not found`)
      return
    }

    // Count completed and failed generations
    const completedCount = userPackage.generations.filter(g => g.status === 'COMPLETED').length
    const failedCount = userPackage.generations.filter(g => g.status === 'FAILED' || g.status === 'CANCELLED').length
    const totalGenerations = userPackage.generations.length

    console.log(`📊 Package progress: ${completedCount}/${totalGenerations} completed, ${failedCount} failed`)

    const updateData: any = {
      generatedImages: completedCount,
      failedImages: failedCount
    }

    // Determine new package status
    if (completedCount + failedCount >= totalGenerations && totalGenerations > 0) {
      // All generations are complete (either success or failure)
      if (completedCount >= 15) { // At least 75% success rate
        updateData.status = 'COMPLETED'
        updateData.completedAt = new Date()
        console.log(`✅ Package ${userPackageId} completed successfully: ${completedCount}/${totalGenerations} images`)
      } else {
        updateData.status = 'FAILED'
        updateData.completedAt = new Date()
        updateData.errorMessage = `Package failed: only ${completedCount}/${totalGenerations} images generated successfully`
        console.log(`❌ Package ${userPackageId} failed: insufficient success rate`)
      }
    } else if (completedCount > 0 || failedCount > 0) {
      // Some generations are complete, package is still generating
      updateData.status = 'GENERATING'
    }

    // Update the package
    await prisma.userPackage.update({
      where: { id: userPackageId },
      data: updateData
    })

    console.log(`📦 Package ${userPackageId} updated: status=${updateData.status}, completed=${completedCount}, failed=${failedCount}`)

  } catch (error) {
    console.error('Error updating package progress:', error)
  }
}

function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  try {
    // Replicate uses HMAC-SHA256 for webhook signatures
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('hex')

    // Compare signatures (use timing-safe comparison)
    const expectedSignature = `sha256=${computedSignature}`
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch (error) {
    console.error('Error verifying webhook signature:', error)
    return false
  }
}