import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { WebhookPayload } from '@/lib/ai/base'
import { broadcastModelStatusChange, broadcastTrainingProgress } from '@/lib/services/realtime-service'
import { recordModelTrainingCost } from '@/lib/services/credit-transaction-service'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    // Webhook security validation
    let payload: WebhookPayload
    const webhookSecret = process.env.REPLICATE_WEBHOOK_SECRET
    
    if (webhookSecret) {
      const signature = request.headers.get('webhook-signature')
      const body = await request.text()
      
      if (!signature || !verifyWebhookSignature(body, signature, webhookSecret)) {
        console.log('Training webhook: Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
      
      // Parse JSON after verification
      payload = JSON.parse(body)
    } else {
      // No secret configured, parse normally but log warning
      console.warn('Training webhook: No REPLICATE_WEBHOOK_SECRET configured - webhook not secured')
      payload = await request.json()
    }
    
    // Find the model with this specific job ID
    const model = await prisma.aIModel.findFirst({
      where: {
        jobId: payload.id
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            plan: true
          }
        }
      }
    })

    if (!model) {
      console.log(`Training webhook: Model not found for job ${payload.id}`)
      return NextResponse.json({ success: false, error: 'Model not found' }, { status: 404 })
    }

    // Update model based on webhook status
    const updateData: any = {}

    switch (payload.status) {
      case 'starting':
        updateData.status = 'TRAINING'
        break

      case 'processing':
        updateData.status = 'TRAINING'
        // Could update progress here if provided
        break

      case 'succeeded':
        updateData.status = 'READY'
        updateData.trainedAt = new Date()
        updateData.progress = 100
        
        // For FLUX training, the model URL is the destination we created
        // Get the model destination from the training logs or construct from payload
        const modelUrl = payload.output
        
        // If output is not available, try to construct from webhook data
        if (!modelUrl && payload.id) {
          // Try to extract model name from training logs or metadata
          console.log('🔍 Training completed, payload:', JSON.stringify(payload, null, 2))
        }
        
        if (modelUrl) {
          updateData.modelUrl = modelUrl
          console.log('✅ Model URL updated:', modelUrl)
        } else {
          console.warn('⚠️ No model URL found in payload, model may not be ready for generation')
        }
        
        // Calculate quality score based on training metrics
        updateData.qualityScore = calculateQualityScore(payload)
        
        // Store FLUX-specific metadata
        updateData.trainingConfig = {
          ...(typeof model.trainingConfig === 'object' && model.trainingConfig !== null ? model.trainingConfig : {}),
          trainingCompleted: true,
          fluxModel: true,
          trainingId: payload.id,
          completedAt: new Date().toISOString(),
          version: payload.version
        }

        // Debit credits and register transaction for successful training
        // First model is free, subsequent models cost 500 credits
        try {
          // Check if this is the user's first model
          const userModelCount = await prisma.aIModel.count({
            where: {
              userId: model.userId,
              status: 'READY'
            }
          })

          // If this will be the first ready model, training is free
          const isFirstModel = userModelCount === 0

          if (!isFirstModel) {
            const creditsUsed = 500 // Training cost for non-first models

            await prisma.user.update({
              where: { id: model.userId },
              data: { creditsUsed: { increment: creditsUsed } }
            })

            await recordModelTrainingCost(
              model.userId,
              model.id,
              creditsUsed,
              {
                modelName: model.name,
                steps: (model.trainingConfig as any)?.steps || 2500
              }
            )

            console.log(`✅ Debited ${creditsUsed} credits for model training ${model.id}`)
          } else {
            console.log(`🎁 First model training is free for user ${model.userId}`)
          }
        } catch (error) {
          console.error(`❌ Failed to debit credits for training ${model.id}:`, error)
        }

        break

      case 'failed':
        updateData.status = 'ERROR'
        updateData.trainedAt = new Date()
        updateData.progress = 0
        
        if (payload.error) {
          updateData.errorMessage = payload.error
        }
        
        // Refund credits on failure
        await refundTrainingCredits(model.id, model.userId)
        break

      case 'canceled':
        updateData.status = 'DRAFT'
        // trainingJobId field doesn't exist in schema, skipping this update
        
        // Refund credits on cancellation
        await refundTrainingCredits(model.id, model.userId)
        break
    }

    // Update the model
    await prisma.aIModel.update({
      where: { id: model.id },
      data: updateData
    })

    // Broadcast real-time status change to user
    await broadcastModelStatusChange(
      model.id,
      model.userId,
      updateData.status || payload.status,
      {
        progress: updateData.progress,
        qualityScore: updateData.qualityScore,
        errorMessage: updateData.errorMessage,
        modelUrl: updateData.modelUrl
      }
    )

    // Send notification to user (if you have email setup)
    if (payload.status === 'succeeded' || payload.status === 'failed') {
      await sendTrainingNotification(model.user.email, model.name, payload.status)
    }

    console.log(`Training webhook processed for model ${model.id}: ${payload.status}`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Training webhook error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

async function refundTrainingCredits(modelId: string, userId: string) {
  try {
    // Find the original usage log for this training
    const originalUsage = await prisma.usageLog.findFirst({
      where: {
        userId,
        action: 'training',
        details: {
          path: ['modelId'],
          equals: modelId
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
            action: 'training_refund',
            details: {
              modelId,
              originalCreditsUsed: originalUsage.creditsUsed,
              reason: 'Training failed/cancelled'
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
    console.error('Failed to refund training credits:', error)
  }
}

function calculateQualityScore(payload: WebhookPayload): number {
  // Calculate quality score based on FLUX training metrics
  // FLUX training is typically faster and more efficient
  
  let score = 80 // Higher base score for FLUX
  
  // Check if training completed successfully
  if (payload.status === 'succeeded') {
    score += 15 // Higher bonus for FLUX success
  }
  
  // FLUX training time optimization (FLUX is typically faster)
  if (payload.metrics?.total_time) {
    const trainingTimeMinutes = payload.metrics.total_time / 60
    if (trainingTimeMinutes < 15) {
      score += 10 // FLUX can train very quickly
    } else if (trainingTimeMinutes < 30) {
      score += 5
    } else if (trainingTimeMinutes > 60) {
      score -= 5 // Still good but slower than expected for FLUX
    }
  }
  
  // Check for any errors in logs
  if (payload.logs && payload.logs.some(log => log.toLowerCase().includes('error'))) {
    score -= 5
  }
  
  // FLUX-specific quality indicators
  if (payload.logs && payload.logs.some(log => 
    log.toLowerCase().includes('lora') || 
    log.toLowerCase().includes('flux'))) {
    score += 5 // Bonus for proper FLUX/LoRA training
  }
  
  return Math.max(20, Math.min(100, score))
}

async function sendTrainingNotification(email: string, modelName: string, status: string) {
  // Placeholder for email notification
  // You would integrate with your email service here (Resend, SendGrid, etc.)
  console.log(`Would send ${status} notification to ${email} for model ${modelName}`)
  
  // Example with Resend:
  // await resend.emails.send({
  //   from: 'noreply@ensaiofotos.com',
  //   to: email,
  //   subject: `Model Training ${status === 'succeeded' ? 'Completed' : 'Failed'}`,
  //   html: `Your model "${modelName}" training has ${status}.`
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
    console.error('Error verifying webhook signature:', error)
    return false
  }
}