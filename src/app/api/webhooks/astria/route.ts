import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { broadcastModelStatusChange } from '@/lib/services/realtime-service'
import { refundModelCreationCredits } from '@/lib/services/model-credit-service'
import { reconcileUserPackageStatus } from '@/lib/services/package-reconciliation'
import { refundPhotoPackageCredits } from '@/lib/services/credit-transaction-service'

interface AstriaWebhookPayload {
  id: string
  status: 'queued' | 'training' | 'trained' | 'generating' | 'generated' | 'failed' | 'cancelled'
  object: 'tune' | 'prompt'
  // Astria pode retornar images como array de strings OU array de objetos
  images?: Array<string | {
    url: string
    nsfw: boolean
    seed?: number
  }>
  logs?: string
  error_message?: string
  created_at: string
  updated_at: string
  completed_at?: string
  trained_at?: string
  // Additional fields for tunes
  name?: string
  model_type?: string
  // Additional fields for prompts
  text?: string
  tune_id?: string
  cfg_scale?: number
  steps?: number
  seed?: number
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔔 Astria webhook received')

    // Security: Validate webhook secret
    const authHeader = request.headers.get('authorization') || request.headers.get('x-astria-secret')
    const webhookSecret = process.env.ASTRIA_WEBHOOK_SECRET
    const url = new URL(request.url)
    const secretParam = url.searchParams.get('secret')

    if (webhookSecret) {
      if (!authHeader && !secretParam) {
        console.error('❌ Astria webhook authentication failed: missing auth')
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
      if (authHeader && authHeader !== webhookSecret && secretParam !== webhookSecret) {
        console.error('❌ Astria webhook authentication failed')
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
      console.log('✅ Astria webhook authenticated')
    } else {
      console.warn('⚠️ ASTRIA_WEBHOOK_SECRET not configured - webhook is INSECURE!')
    }

    // Parse the webhook payload - handle both JSON and form-data
    let payload: AstriaWebhookPayload
    const contentType = request.headers.get('content-type') || ''
    
    try {
      if (contentType.includes('application/json')) {
        payload = await request.json()
      } else {
        // Try to parse as JSON anyway (some webhooks don't set content-type correctly)
        const text = await request.text()
        if (!text || text.trim().length === 0) {
          console.warn('⚠️ Astria webhook received empty body')
          // Return success to avoid webhook retries
          return NextResponse.json({ success: true, message: 'Empty payload ignored' })
        }
        payload = JSON.parse(text)
      }
    } catch (parseError) {
      console.error('❌ Failed to parse Astria webhook payload:', parseError)
      console.error('📋 Raw body (first 500 chars):', await request.text().then(t => t.substring(0, 500)))
      // Return success to avoid webhook retries
      return NextResponse.json({ success: true, message: 'Invalid payload format' })
    }

    // Validate payload has required fields
    if (!payload.id && !payload.object && !payload.status) {
      const keys = Object.keys(payload || {})
      // Many Astria webhooks send transient events like { prompt: { id, text } }
      // These are informational and shouldn't be treated as warnings
      if (keys.includes('prompt')) {
        // Optional: best-effort lookup by prompt.id just to silence retries
        try {
          const prompt: any = (payload as any).prompt
          if (prompt?.id) {
            const generation = await prisma.generation.findFirst({ where: { jobId: String(prompt.id) } })
            // We intentionally do nothing – this is a heartbeat/echo event
            if (generation) {
              console.log(`ℹ️ Astria prompt heartbeat received for generation ${generation.id}`)
            } else {
              console.log(`ℹ️ Astria prompt heartbeat received (jobId: ${prompt.id})`)
            }
          }
        } catch {
          // Ignore lookup errors silently
        }
        return NextResponse.json({ success: true, message: 'Prompt-only event ignored' })
      }

      // Otherwise, log once and ignore
      console.warn('⚠️ Astria webhook received incomplete payload:', {
        hasId: !!(payload as any)?.id,
        hasObject: !!(payload as any)?.object,
        hasStatus: !!(payload as any)?.status,
        keys,
        rawPayload: JSON.stringify(payload).substring(0, 200)
      })
      // Return success to avoid webhook retries
      return NextResponse.json({ success: true, message: 'Incomplete payload ignored' })
    }

    console.log('📋 Astria webhook payload:', {
      id: payload.id,
      status: payload.status,
      object: payload.object,
      hasImages: !!payload.images?.length,
      errorMessage: payload.error_message,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    })

    // Handle different object types
    if (payload.object === 'tune') {
      await handleTuneWebhook(payload)
    } else if (payload.object === 'prompt') {
      await handlePromptWebhook(payload)
    } else {
      console.warn('⚠️ Unknown Astria webhook object type:', payload.object)
      // Still try to process if we have an ID (might be a generation webhook without object field)
      if (payload.id && payload.status) {
        console.log('🔄 Attempting to process as prompt webhook (object field missing)')
        await handlePromptWebhook(payload as AstriaWebhookPayload)
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Webhook processed successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ CRITICAL: Astria webhook error:', error)
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown'
    })
    
    // CRITICAL: Log the full error context for debugging
    if (error instanceof Error) {
      console.error('❌ Error name:', error.name)
      console.error('❌ Error message:', error.message)
      if (error.stack) {
        console.error('❌ Error stack:', error.stack)
      }
    }
    
    // CRITICAL: Return 200 OK even on errors to prevent infinite retries
    // But log the error so we can investigate
    return NextResponse.json(
      { 
        success: false, 
        error: 'Webhook processing failed but acknowledged',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 200 } // Always return 200 to prevent retries
    )
  }
}

async function handleTuneWebhook(payload: AstriaWebhookPayload) {
  try {
    // Find the corresponding AI model in our database
    // Tentar tanto como string quanto como número (Astria pode retornar ambos)
    const tuneId = String(payload.id)
    const tuneIdNum = typeof payload.id === 'number' ? payload.id : parseInt(tuneId)
    
    const model = await prisma.aIModel.findFirst({
      where: {
        OR: [
          { trainingJobId: tuneId },
          { trainingJobId: String(tuneIdNum) },
          // Fallback: buscar por metadata em trainingConfig
          {
            trainingConfig: {
              path: ['trainingId'],
              equals: tuneId
            }
          }
        ]
      }
    })

    if (!model) {
      console.warn(`⚠️ No model found for Astria tune: ${payload.id} (tried as string "${tuneId}" and number ${tuneIdNum})`)
      console.warn('📋 Available trainingJobIds in database:', await prisma.aIModel.findMany({
        where: { status: { in: ['TRAINING', 'PROCESSING'] } },
        select: { id: true, trainingJobId: true, name: true }
      }).then(models => models.map(m => ({ modelId: m.id, trainingJobId: m.trainingJobId, name: m.name }))))
      return
    }

    console.log(`🎯 Processing Astria tune webhook for model: ${model.id}`)
    console.log(`📊 Current model status in DB: ${model.status}`)
    console.log(`📊 Current model progress: ${model.progress}%`)

    // Map Astria status to our internal status
    console.log(`📊 Astria webhook payload status: "${payload.status}" (type: ${typeof payload.status})`)
    
    let internalStatus: 'TRAINING' | 'READY' | 'FAILED'
    const statusLower = String(payload.status).toLowerCase()
    
    if (statusLower === 'trained') {
      internalStatus = 'READY'
      console.log(`✅ Mapping Astria "trained" → READY`)
    } else if (statusLower === 'failed' || statusLower === 'cancelled') {
      internalStatus = 'FAILED'
      console.log(`❌ Mapping Astria "${payload.status}" → FAILED`)
    } else {
      internalStatus = 'TRAINING'
      console.log(`⏳ Mapping Astria "${payload.status}" → TRAINING`)
    }

    // CRITICAL: Check idempotency - if model is already READY and we're receiving "trained" again, skip update
    if (model.status === 'READY' && internalStatus === 'READY') {
      console.log(`⏭️ Model ${model.id} is already READY, skipping duplicate update (idempotency check)`)
      return model // Return existing model without updating
    }

    // Update the model with the new status
    const updateData: any = {
      status: internalStatus as any,
      progress: internalStatus === 'READY' ? 100 : (internalStatus === 'TRAINING' ? model.progress || 20 : 0),
      errorMessage: payload.error_message || undefined,
      aiProvider: 'astria',
      updatedAt: new Date() // Explicitly set updatedAt
    }

    if (statusLower === 'trained') {
      updateData.modelUrl = String(payload.id) // Use tune ID as model URL
      updateData.trainedAt = payload.trained_at ? new Date(payload.trained_at) : new Date()
      console.log(`📝 Setting modelUrl to: ${updateData.modelUrl}`)
      console.log(`📝 Setting trainedAt to: ${updateData.trainedAt}`)
    }

    if (payload.logs) {
      updateData.trainingLogs = [payload.logs]
      console.log(`📝 Adding training logs (length: ${payload.logs.length})`)
    }

    console.log(`💾 Attempting to update model ${model.id} with data:`, {
      status: updateData.status,
      progress: updateData.progress,
      hasModelUrl: !!updateData.modelUrl,
      hasTrainedAt: !!updateData.trainedAt,
      hasLogs: !!updateData.trainingLogs
    })

    let updatedModel
    try {
      updatedModel = await prisma.aIModel.update({
        where: { id: model.id },
        data: updateData
      })
      console.log(`✅ Model ${model.id} successfully updated to status: ${updatedModel.status}, progress: ${updatedModel.progress}%`)
    } catch (updateError) {
      console.error(`❌ CRITICAL: Failed to update model ${model.id}:`, updateError)
      console.error(`❌ Update error details:`, {
        message: updateError instanceof Error ? updateError.message : String(updateError),
        stack: updateError instanceof Error ? updateError.stack : undefined,
        updateData: JSON.stringify(updateData, null, 2)
      })
      // Re-throw to be caught by outer try-catch
      throw updateError
    }

    // Broadcast model status change to the owner
    try {
      console.log(`📡 Broadcasting model status change for model ${model.id}: ${updatedModel.status}`)
      await broadcastModelStatusChange(model.id, updatedModel.userId, updatedModel.status, {
        progress: updatedModel.status === 'READY' ? 100 : updatedModel.progress || 0,
        modelUrl: updatedModel.modelUrl
      })
      console.log(`✅ Broadcast sent successfully for model ${model.id}`)
    } catch (e) {
      console.error('❌ Failed to broadcast model status change:', e)
      console.error('❌ Broadcast error details:', {
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined
      })
      // Don't fail the webhook for broadcast errors, but log them
    }

    // If training completed successfully, generate sample images
    if (internalStatus === 'READY' && payload.status === 'trained') {
      try {
        console.log(`🎨 Starting sample generation for trained model: ${model.id}`)

        // Generate sample images using the trained model
        await generateSampleImages(model.id, payload.id, model.userId)
      } catch (sampleError) {
        console.error('❌ Sample generation failed:', sampleError)
        // Don't fail the webhook for sample generation errors
      }
    }
    
    // If training failed, refund credits (idempotente)
    if (internalStatus === 'FAILED') {
      try {
        const refund = await refundModelCreationCredits(model.userId, model.id, model.name)
        if (refund.success) {
          console.log(`↩️ Credits refunded via webhook for model ${model.id}: +${refund.refundedAmount}`)
        } else {
          console.warn('⚠️ Webhook refund skipped:', refund.message)
        }
      } catch (err) {
        console.error('❌ Webhook refund error:', err)
      }
    }

    return updatedModel
  } catch (error) {
    console.error('❌ Error handling Astria tune webhook:', error)
    throw error
  }
}

async function handlePromptWebhook(payload: AstriaWebhookPayload) {
  try {
    // Find the corresponding generation in our database
    // Astria sends ID as number, but we store it as string in jobId
    const generation = await prisma.generation.findFirst({
      where: {
        jobId: String(payload.id)
      }
    })

    if (!generation) {
      console.warn('⚠️ No generation found for Astria prompt:', payload.id)
      return
    }

    console.log(`🎯 Processing Astria prompt webhook for generation: ${generation.id}`)

    // Map Astria status to our internal status
    let internalStatus: 'PROCESSING' | 'COMPLETED' | 'FAILED'
    switch (payload.status) {
      case 'generated':
        internalStatus = 'COMPLETED'
        break
      case 'failed':
      case 'cancelled':
        internalStatus = 'FAILED'
        break
      default:
        internalStatus = 'PROCESSING'
    }

    // Extract image URLs if generation completed
    let imageUrls: string[] = []
    if (payload.images && payload.images.length > 0) {
      // 🔧 CORREÇÃO: Astria retorna images como array de strings, não objetos
      if (typeof payload.images[0] === 'string') {
        // Nova estrutura: array de strings diretas
        imageUrls = payload.images.filter(url => typeof url === 'string' && url.trim().length > 0)
        console.log(`🎯 [WEBHOOK_ASTRIA_FIX] Extracted ${imageUrls.length} URLs from string array`)
      } else if (payload.images[0]?.url) {
        // Estrutura antiga: array de objetos com propriedade url
        imageUrls = payload.images.map(img => img.url).filter(url => url && url.trim().length > 0)
        console.log(`🎯 [WEBHOOK_ASTRIA_LEGACY] Extracted ${imageUrls.length} URLs from object array`)
      }
    }

    // Calculate processing time
    let processingTime: number | undefined
    if (payload.completed_at) {
      const startTime = new Date(generation.createdAt).getTime()
      const endTime = new Date(payload.completed_at).getTime()
      processingTime = endTime - startTime
    }

    // If generation completed successfully, store images permanently BEFORE updating database
    let finalImageUrls = imageUrls
    if (internalStatus === 'COMPLETED' && imageUrls.length > 0) {
      try {
        console.log(`💾 Storing images permanently for generation: ${generation.id}`)

        // Import storage utility
        const { downloadAndStoreImages } = await import('@/lib/storage/utils')

        // Download and store images permanently
        const storageResult = await downloadAndStoreImages(
          imageUrls,
          generation.id,
          generation.userId
        )

        if (storageResult.success && storageResult.permanentUrls && storageResult.permanentUrls.length > 0) {
          console.log(`✅ Successfully stored ${storageResult.permanentUrls.length} images permanently`)
          // Use permanent URLs for database update
          finalImageUrls = storageResult.permanentUrls
        } else {
          console.error(`⚠️ Storage failed, keeping original URLs:`, storageResult.error)
          // Keep original URLs if storage fails
          finalImageUrls = imageUrls
        }
      } catch (storageError) {
        console.error('❌ Storage failed with exception:', storageError)
        console.error('❌ Error name:', storageError instanceof Error ? storageError.name : 'Unknown')
        console.error('❌ Error message:', storageError instanceof Error ? storageError.message : 'Unknown')
        console.error('❌ Error stack:', storageError instanceof Error ? storageError.stack : 'No stack')

        // Don't fail the webhook for storage errors - images are still accessible via original URLs
        // But mark generation with error message for debugging
        finalImageUrls = imageUrls

        // Store error in generation for debugging
        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            errorMessage: `Warning: Storage failed, images may expire. Error: ${storageError instanceof Error ? storageError.message : 'Unknown'}`
          }
        })
      }
    }

    // Store temporary URLs in metadata for modal display
    const existingMetadata = (generation.metadata as any) || {}
    const updatedMetadata = {
      ...existingMetadata,
      temporaryUrls: imageUrls.length > 0 ? imageUrls : existingMetadata.temporaryUrls || [],
      permanentUrls: finalImageUrls.length > 0 ? finalImageUrls : existingMetadata.permanentUrls || [],
      originalUrls: imageUrls.length > 0 ? imageUrls : existingMetadata.originalUrls || []
    }
    
    // Update the generation with the new status and final image URLs
    const updatedGeneration = await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: internalStatus as any,
        imageUrls: finalImageUrls.length > 0 ? finalImageUrls as any : generation.imageUrls,
        completedAt: payload.completed_at ? new Date(payload.completed_at) : undefined,
        processingTime: processingTime,
        errorMessage: payload.error_message || undefined,
        metadata: updatedMetadata as any, // Store temporary URLs for modal
        // Update seed if provided
        seed: payload.seed || generation.seed
      }
    })
    
    // CRITICAL: Log for debugging modal opening
    console.log(`📊 [ASTRIA_WEBHOOK] Generation updated:`, {
      generationId: updatedGeneration.id,
      status: internalStatus,
      hasTemporaryUrls: updatedMetadata.temporaryUrls.length > 0,
      hasPermanentUrls: updatedMetadata.permanentUrls.length > 0,
      temporaryUrlsCount: updatedMetadata.temporaryUrls.length,
      permanentUrlsCount: updatedMetadata.permanentUrls.length
    })

    console.log(`✅ Astria prompt ${payload.id} updated to status: ${internalStatus}`)
    if (finalImageUrls !== imageUrls) {
      console.log(`✅ Database updated with ${finalImageUrls.length} permanent URLs`)
    }

    // Broadcast real-time status change to user (critical for redirection)
    // Use internalStatus directly to maintain consistency
    // CRITICAL: Always broadcast, even if imageUrls is empty, to ensure frontend knows status changed
    try {
      const { broadcastGenerationStatusChange } = await import('@/lib/services/realtime-service')
      
      // Ensure we always send imageUrls, even if empty (frontend needs to know status)
      // CRITICAL: Include both temporary (for modal) and permanent (for gallery) URLs
      const broadcastData = {
        imageUrls: finalImageUrls.length > 0 ? finalImageUrls : (updatedGeneration.imageUrls as any || []),
        thumbnailUrls: finalImageUrls.length > 0 ? finalImageUrls : (updatedGeneration.imageUrls as any || []),
        // Include temporary URLs for immediate modal display (before S3 upload completes)
        temporaryUrls: imageUrls.length > 0 ? imageUrls : (updatedGeneration.metadata as any)?.temporaryUrls || [],
        permanentUrls: finalImageUrls.length > 0 ? finalImageUrls : [],
        processingTime: processingTime,
        errorMessage: payload.error_message || undefined,
        webhook: true,
        timestamp: new Date().toISOString(),
        // Include additional metadata for frontend
        generationId: updatedGeneration.id,
        userId: updatedGeneration.userId,
        prompt: generation.prompt || undefined,
        modelId: generation.modelId || undefined
      }
      
      console.log(`📡 Broadcasting generation status change:`, {
        generationId: updatedGeneration.id,
        status: internalStatus,
        hasImageUrls: broadcastData.imageUrls.length > 0,
        imageUrlsCount: broadcastData.imageUrls.length
      })
      
      await broadcastGenerationStatusChange(
        updatedGeneration.id,
        updatedGeneration.userId,
        internalStatus, // Send internalStatus directly (COMPLETED/FAILED/PROCESSING)
        broadcastData
      )
      console.log(`✅ Broadcast sent successfully for generation ${updatedGeneration.id} with status: ${internalStatus}`)
    } catch (broadcastError) {
      console.error('❌ Failed to broadcast generation status change:', broadcastError)
      console.error('❌ Broadcast error details:', {
        error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError),
        stack: broadcastError instanceof Error ? broadcastError.stack : undefined
      })
      // Don't fail the webhook for broadcast errors, but log them for debugging
    }

    // CRITICAL: Reconcile UserPackage status if this generation belongs to a package
    // This ensures package status is automatically updated when generations complete/fail
    // Check metadata first (new approach), then packageId as fallback (legacy)
    const generationMetadata = generation.metadata as any
    const isPackageGeneration = generationMetadata?.source === 'package' && generationMetadata?.userPackageId
    const userPackageId = isPackageGeneration 
      ? generationMetadata.userPackageId 
      : generation.packageId // Legacy fallback

    if (userPackageId) {
      try {
        console.log(`🔄 Reconciling UserPackage status for generation ${generation.id} (userPackageId: ${userPackageId})`)
        const reconciliation = await reconcileUserPackageStatus(userPackageId)
        if (reconciliation.updated) {
          console.log(`✅ UserPackage ${userPackageId} status updated: ${reconciliation.previousStatus} → ${reconciliation.newStatus}`)
        }

        // CRITICAL: If generation failed, check if all package generations failed and refund credits
        if (internalStatus === 'FAILED') {
          // Get the user package to check status and price
          const userPackage = await prisma.userPackage.findUnique({
            where: { id: userPackageId },
            include: {
              package: true
            }
          })

          if (userPackage) {
            // Check if all generations failed (no pending/processing, no completed, only failed)
            const stats = reconciliation.stats
            const allFailed = stats.total > 0 && 
                             stats.completed === 0 && 
                             stats.pending === 0 && 
                             stats.processing === 0 && 
                             stats.failed === stats.total

            if (allFailed) {
              console.log(`💰 All ${stats.total} generations failed for package ${userPackageId}, processing refund...`)
              
              // Get package price (credits to refund)
              const packagePrice = userPackage.package?.price || 0
              
              if (packagePrice > 0) {
                try {
                  const refundResult = await refundPhotoPackageCredits(
                    generation.userId,
                    userPackageId,
                    packagePrice,
                    {
                      packageName: userPackage.package?.name,
                      reason: `Todas as ${stats.total} gerações falharam`
                    }
                  )

                  if (refundResult.success) {
                    console.log(`✅ Successfully refunded ${packagePrice} credits for failed package ${userPackageId}`)
                  } else {
                    console.warn(`⚠️ Refund skipped for package ${userPackageId}: ${refundResult.message}`)
                  }
                } catch (refundError) {
                  console.error('❌ Failed to refund package credits:', refundError)
                  // Don't fail the webhook for refund errors, but log them
                }
              } else {
                console.warn(`⚠️ Package ${userPackageId} has no price set, cannot refund`)
              }
            } else {
              console.log(`ℹ️ Package ${userPackageId} has ${stats.completed} completed generations, no refund needed`)
            }
          }
        }
      } catch (reconcileError) {
        console.error('❌ Failed to reconcile UserPackage status:', reconcileError)
        // Don't fail the webhook for reconciliation errors
      }
    }

    return updatedGeneration
  } catch (error) {
    console.error('❌ Error handling Astria prompt webhook:', error)
    throw error
  }
}

async function generateSampleImages(modelId: string, tuneId: string, userId: string) {
  try {
    console.log(`🎨 Generating sample images for model ${modelId} with tune ${tuneId}`)

    // Import Astria provider
    const { AstriaProvider } = await import('@/lib/ai/providers/astria')
    const astriaProvider = new AstriaProvider()

    // Get the model data
    const model = await prisma.aIModel.findUnique({
      where: { id: modelId }
    })

    if (!model) {
      throw new Error('Model not found')
    }

    // Generate sample prompts based on model class
    const samplePrompts = getSamplePrompts(model.class, model.triggerWord || 'TOK')

    const sampleImages: string[] = []

    // Generate one sample image for now (can be expanded)
    for (const prompt of samplePrompts.slice(0, 1)) {
      try {
        const generationRequest = {
          modelUrl: tuneId,
          prompt: prompt,
          params: {
            width: 1024,
            height: 1024,
            steps: 30,
            guidance_scale: 7.5,
            num_outputs: 1
          }
        }

        const generationResponse = await astriaProvider.generateImage(generationRequest)

        // Wait for generation to complete (simplified polling)
        let attempts = 0
        const maxAttempts = 30 // 5 minutes max

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds

          const status = await astriaProvider.getGenerationStatus(generationResponse.id)

          if (status.status === 'succeeded' && status.urls) {
            sampleImages.push(status.urls[0])
            break
          } else if (status.status === 'failed') {
            console.error('Sample generation failed:', status.error)
            break
          }

          attempts++
        }
      } catch (sampleError) {
        console.error('Error generating sample:', sampleError)
      }
    }

    // Update model with sample images
    if (sampleImages.length > 0) {
      await prisma.aIModel.update({
        where: { id: modelId },
        data: {
          sampleImages: sampleImages
        }
      })

      console.log(`✅ Added ${sampleImages.length} sample images to model ${modelId}`)
    }

  } catch (error) {
    console.error('❌ Error generating sample images:', error)
    throw error
  }
}

function getSamplePrompts(modelClass: string, triggerWord: string): string[] {
  const basePrompt = `photo of ${triggerWord} person`

  switch (modelClass) {
    case 'MAN':
    case 'WOMAN':
      return [
        `professional headshot of ${triggerWord} person, studio lighting, clean background`,
        `${triggerWord} person in casual clothing, natural lighting, outdoor setting`,
        `portrait of ${triggerWord} person smiling, warm lighting, bokeh background`
      ]
    case 'BOY':
    case 'GIRL':
      return [
        `school photo of ${triggerWord} person, clean background, natural smile`,
        `${triggerWord} person playing, natural lighting, happy expression`,
        `portrait of ${triggerWord} person, soft lighting, friendly expression`
      ]
    default:
      return [
        `photo of ${triggerWord} person, natural lighting, clear background`,
        `portrait of ${triggerWord} person, professional quality`,
        `${triggerWord} person in natural setting, high quality photo`
      ]
  }
}

// Handle GET requests (for webhook verification if needed)
export async function GET() {
  return NextResponse.json({ status: 'Astria webhook endpoint active' })
}