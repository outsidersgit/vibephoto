import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { WebhookPayload } from '@/lib/ai/base'
import { downloadAndStoreImages } from '@/lib/storage/utils'
import { broadcastGenerationStatusChange, broadcastGenerationProgress } from '@/lib/services/realtime-service'
import { recordUpscaleCost } from '@/lib/services/credit-transaction-service'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  console.log('🔔 Webhook upscale received at:', new Date().toISOString())
  
  try {
    // Webhook security validation
    let payload: WebhookPayload
    const webhookSecret = process.env.REPLICATE_WEBHOOK_SECRET
    
    if (webhookSecret) {
      const signature = request.headers.get('webhook-signature')
      const body = await request.text()
      
      if (!signature || !verifyWebhookSignature(body, signature, webhookSecret)) {
        console.log('Upscale webhook: Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
      
      // Parse JSON after verification
      payload = JSON.parse(body)
    } else {
      // No secret configured, parse normally but log warning
      console.warn('Upscale webhook: No REPLICATE_WEBHOOK_SECRET configured - webhook not secured')
      payload = await request.json()
    }
    
    console.log('📥 Upscale webhook payload:', {
      id: payload.id,
      status: payload.status,
      hasOutput: !!payload.output,
      outputType: payload.output ? typeof payload.output : 'none'
    })
    
    // Find the generation with this job ID (upscale jobs are stored as generations)
    const generation = await prisma.generation.findFirst({
      where: {
        jobId: payload.id,
        prompt: {
          startsWith: '[UPSCALED]' // Filter for upscale jobs
        }
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
      console.log(`Upscale webhook: Generation not found for job ${payload.id}`)
      return NextResponse.json({ success: false, error: 'Upscale job not found' }, { status: 404 })
    }

    console.log('🎯 Processing upscale for generation:', generation.id)

    // Update generation based on webhook status
    const updateData: any = {}

    switch (payload.status) {
      case 'starting':
        updateData.status = 'PROCESSING'
        console.log('🚀 Upscale job starting:', generation.id)
        break

      case 'processing':
        updateData.status = 'PROCESSING'
        console.log('⚙️ Upscale job processing:', generation.id)
        // Could update progress here if provided
        break

      case 'succeeded':
        console.log('✅ Upscale job succeeded:', generation.id)
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
          
          console.log(`📥 Processing ${temporaryUrls.length} upscaled images for PERMANENT storage`)
          console.log(`🔍 Storage provider: ${process.env.STORAGE_PROVIDER}`)
          console.log(`🗂️ Temporary URLs to process:`, temporaryUrls.map((url, i) => `${i+1}: ${url.substring(0, 100)}...`))
          
          // 🔥 CRITICAL: Download and store images permanently - GUARANTEED
          console.log('🚨 CRITICAL: Starting permanent storage process...')
          const storageResult = await downloadAndStoreImages(
            temporaryUrls,
            generation.id,
            generation.userId,
            'upscaled' // Special folder for upscaled images
          )
          
          console.log(`📊 Storage result:`, {
            success: storageResult.success,
            permanentUrlsCount: storageResult.permanentUrls?.length || 0,
            thumbnailUrlsCount: storageResult.thumbnailUrls?.length || 0,
            error: storageResult.error
          })
          
          // 🔥 GUARANTEE PERMANENT STORAGE SUCCESS
          if (storageResult.success && storageResult.permanentUrls && storageResult.permanentUrls.length > 0) {
            updateData.imageUrls = storageResult.permanentUrls
            updateData.thumbnailUrls = storageResult.thumbnailUrls || storageResult.permanentUrls
            console.log(`✅ GUARANTEED: Successfully stored ${storageResult.permanentUrls.length} upscaled images PERMANENTLY`)
            console.log(`🔗 Permanent URLs confirmed:`, storageResult.permanentUrls.map(url => url.substring(0, 150) + '...'))
            
            // Mark successful permanent storage
            updateData.errorMessage = null // Clear any previous errors
          } else {
            // 🚨 CRITICAL ERROR: Storage failed - DO NOT MARK AS COMPLETED
            console.error(`🚨 CRITICAL STORAGE FAILURE for upscale ${generation.id}:`)
            console.error(`❌ Storage error: ${storageResult.error}`)
            console.error(`❌ Provider: ${process.env.STORAGE_PROVIDER}`)
            console.error(`❌ Temporary URLs count: ${temporaryUrls.length}`)
            
            // Mark as failed due to storage error
            updateData.status = 'FAILED'
            updateData.errorMessage = `STORAGE FAILURE: Unable to save upscaled images permanently. Error: ${storageResult.error}`
            
            // Refund credits since storage failed
            console.log('💰 Refunding credits due to storage failure...')
            await refundGenerationCredits(generation.id, generation.userId)
            
            // Alert administrators
            console.error(`🚨 ADMIN ALERT: Upscale storage failure for user ${generation.userId}, generation ${generation.id}`)
          }
        } else {
          console.error('⚠️ Upscale succeeded but no output provided')
          updateData.status = 'FAILED'
          updateData.errorMessage = 'Upscale completed but no output was provided by Replicate'
          await refundGenerationCredits(generation.id, generation.userId)
        }
        
        // Calculate processing time
        if (payload.metrics?.total_time) {
          updateData.processingTime = Math.round(payload.metrics.total_time * 1000) // Convert to milliseconds
        } else {
          updateData.processingTime = new Date().getTime() - new Date(generation.createdAt).getTime()
        }

        // Debit credits and register transaction for successful upscale
        if (updateData.status === 'COMPLETED') {
          try {
            const creditsUsed = 10 // Upscale cost

            await prisma.user.update({
              where: { id: generation.userId },
              data: { creditsUsed: { increment: creditsUsed } }
            })

            await recordUpscaleCost(
              generation.userId,
              generation.id,
              creditsUsed,
              {
                originalResolution: generation.resolution,
                prompt: generation.prompt
              }
            )

            console.log(`✅ Debited ${creditsUsed} credits for upscale ${generation.id}`)
          } catch (error) {
            console.error(`❌ Failed to debit credits for upscale ${generation.id}:`, error)
          }
        }

        break

      case 'failed':
        console.error('❌ Upscale job failed:', generation.id)
        updateData.status = 'FAILED'
        updateData.completedAt = new Date()
        
        if (payload.error) {
          updateData.errorMessage = `Upscale failed: ${payload.error}`
        } else {
          updateData.errorMessage = 'Upscale failed without specific error message'
        }
        
        // Refund credits on failure
        console.log('💰 Refunding credits due to upscale failure...')
        await refundGenerationCredits(generation.id, generation.userId)
        break

      case 'canceled':
        console.log('🛑 Upscale job canceled:', generation.id)
        updateData.status = 'CANCELLED'
        updateData.completedAt = new Date()
        updateData.errorMessage = 'Upscale was cancelled'
        
        // Refund credits on cancellation
        console.log('💰 Refunding credits due to upscale cancellation...')
        await refundGenerationCredits(generation.id, generation.userId)
        break

      default:
        console.warn(`⚠️ Unknown upscale status: ${payload.status}`)
        break
    }

    // Update the generation in database
    console.log('💾 Updating database with upscale results...')
    await prisma.generation.update({
      where: { id: generation.id },
      data: updateData
    })

    // Broadcast real-time status change to user
    await broadcastGenerationStatusChange(
      generation.id,
      generation.userId,
      payload.status,
      {
        imageUrls: updateData.imageUrls,
        thumbnailUrls: updateData.thumbnailUrls,
        processingTime: updateData.processingTime,
        errorMessage: updateData.errorMessage,
        isUpscale: true // Flag to indicate this is an upscale result
      }
    )

    // Send notification to user for completed upscales
    if (payload.status === 'succeeded' && updateData.status === 'COMPLETED') {
      await sendUpscaleNotification(
        generation.user.email, 
        updateData.imageUrls?.length || 0,
        generation.prompt?.replace('[UPSCALED]', '').trim() || 'upscale'
      )
    }

    // Log detailed processing results with upscale-specific info
    const logData = {
      generationId: generation.id,
      userId: generation.userId,
      status: payload.status,
      finalStatus: updateData.status,
      processingTime: updateData.processingTime,
      imageCount: Array.isArray(updateData.imageUrls) ? updateData.imageUrls.length : 0,
      thumbnailCount: Array.isArray(updateData.thumbnailUrls) ? updateData.thumbnailUrls.length : 0,
      hasError: !!updateData.errorMessage,
      storageSuccess: updateData.status === 'COMPLETED',
      isUpscale: true
    }
    
    console.log(`🎯 Upscale webhook processed:`, logData)
    
    // Additional monitoring for storage success/failure
    if (payload.status === 'succeeded') {
      if (updateData.status === 'FAILED') {
        console.error(`🚨 UPSCALE STORAGE FAILURE for generation ${generation.id}: Images NOT saved permanently`)
      } else {
        console.log(`✅ UPSCALE STORAGE SUCCESS for generation ${generation.id}: Images saved permanently and accessible`)
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    // Enhanced error logging with upscale-specific context
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      jobId: payload?.id,
      status: payload?.status,
      timestamp: new Date().toISOString(),
      isUpscale: true
    }
    
    console.error('❌ Upscale webhook CRITICAL error:', errorDetails)
    
    // Try to log error in database for monitoring
    if (payload?.id) {
      try {
        const generation = await prisma.generation.findFirst({
          where: { 
            jobId: payload.id,
            prompt: { startsWith: '[UPSCALED]' }
          },
          select: { id: true, userId: true }
        })
        
        if (generation) {
          await prisma.generation.update({
            where: { id: generation.id },
            data: {
              status: 'FAILED',
              errorMessage: `Upscale webhook processing error: ${errorDetails.message}`,
              completedAt: new Date()
            }
          })
          console.log(`📝 Upscale error logged to database for generation ${generation.id}`)
          
          // Refund credits for webhook processing errors
          await refundGenerationCredits(generation.id, generation.userId)
        }
      } catch (dbError) {
        console.error('Failed to log upscale error to database:', dbError)
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorDetails.message,
        timestamp: errorDetails.timestamp,
        isUpscale: true
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
        OR: [
          { action: 'generation' },
          { action: 'upscale' }
        ],
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
            action: 'upscale_refund',
            details: {
              generationId,
              originalCreditsUsed: originalUsage.creditsUsed,
              reason: 'Upscale failed/cancelled or storage error'
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

      console.log(`💰 Refunded ${originalUsage.creditsUsed} credits to user ${userId} for failed upscale`)
    }
  } catch (error) {
    console.error('Failed to refund upscale credits:', error)
  }
}

async function sendUpscaleNotification(email: string, imageCount: number, originalPrompt: string) {
  // Placeholder for upscale completion notification
  console.log(`Would send upscale complete notification to ${email}: ${imageCount} images upscaled (${originalPrompt})`)
  
  // Example with email service:
  // await emailService.send({
  //   from: 'noreply@vibephoto.com',
  //   to: email,
  //   subject: 'Your Upscaled Images are Ready!',
  //   html: `
  //     <h2>Your upscaled images are ready!</h2>
  //     <p>We've successfully upscaled ${imageCount} image${imageCount > 1 ? 's' : ''} with enhanced quality.</p>
  //     <p>Original request: "${originalPrompt}"</p>
  //     <p><a href="${process.env.NEXTAUTH_URL}/gallery">View your upscaled images</a></p>
  //   `
  // })
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
    console.error('Error verifying upscale webhook signature:', error)
    return false
  }
}