import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { broadcastModelStatusChange } from '@/lib/services/realtime-service'
import { refundModelCreationCredits } from '@/lib/services/model-credit-service'

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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Astria webhook error:', error)
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    })
    // Return success to avoid webhook retries for unexpected errors
    return NextResponse.json(
      { success: true, error: 'Webhook processing failed but acknowledged' },
      { status: 200 }
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

    // Update the model with the new status
    const updateData: any = {
      status: internalStatus as any,
      progress: internalStatus === 'READY' ? 100 : (internalStatus === 'TRAINING' ? model.progress || 20 : 0),
      errorMessage: payload.error_message || undefined
    }

    if (statusLower === 'trained') {
      updateData.modelUrl = String(payload.id) // Use tune ID as model URL
      updateData.trainedAt = payload.trained_at ? new Date(payload.trained_at) : new Date()
    }

    if (payload.logs) {
      updateData.trainingLogs = [payload.logs]
    }

    const updatedModel = await prisma.aIModel.update({
      where: { id: model.id },
      data: updateData
    })

    console.log(`✅ Astria tune ${payload.id} updated to status: ${internalStatus}, progress: ${updateData.progress}%`)

    // Broadcast model status change to the owner
    try {
      await broadcastModelStatusChange(model.id, updatedModel.userId, updatedModel.status, {
        progress: updatedModel.status === 'READY' ? 100 : updatedModel.progress || 0,
        modelUrl: updatedModel.modelUrl
      })
    } catch (e) {
      console.warn('⚠️ Failed to broadcast model status change:', e)
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

    // Update the generation with the new status and final image URLs
    const updatedGeneration = await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: internalStatus as any,
        imageUrls: finalImageUrls.length > 0 ? finalImageUrls as any : generation.imageUrls,
        completedAt: payload.completed_at ? new Date(payload.completed_at) : undefined,
        processingTime: processingTime,
        errorMessage: payload.error_message || undefined,
        // Update seed if provided
        seed: payload.seed || generation.seed
      }
    })

    console.log(`✅ Astria prompt ${payload.id} updated to status: ${internalStatus}`)
    if (finalImageUrls !== imageUrls) {
      console.log(`✅ Database updated with ${finalImageUrls.length} permanent URLs`)
    }

    // Broadcast real-time status change to user (critical for redirection)
    // Use internalStatus directly to maintain consistency
    try {
      const { broadcastGenerationStatusChange } = await import('@/lib/services/realtime-service')
      await broadcastGenerationStatusChange(
        updatedGeneration.id,
        updatedGeneration.userId,
        internalStatus, // Send internalStatus directly (COMPLETED/FAILED/PROCESSING)
        {
          imageUrls: finalImageUrls,
          thumbnailUrls: finalImageUrls, // Use same URLs for thumbnails if separate ones aren't available
          processingTime: processingTime,
          errorMessage: payload.error_message || undefined,
          webhook: true,
          timestamp: new Date().toISOString()
        }
      )
      console.log(`📡 Broadcast sent for generation ${updatedGeneration.id} with status: ${internalStatus}`)
    } catch (broadcastError) {
      console.error('❌ Failed to broadcast generation status change:', broadcastError)
      // Don't fail the webhook for broadcast errors
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