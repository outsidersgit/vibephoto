import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface AstriaWebhookPayload {
  id: string
  status: 'queued' | 'training' | 'trained' | 'generating' | 'generated' | 'failed' | 'cancelled'
  object: 'tune' | 'prompt'
  images?: Array<{
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

    if (webhookSecret) {
      if (!authHeader || authHeader !== webhookSecret) {
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

    // Parse the webhook payload
    const payload: AstriaWebhookPayload = await request.json()
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
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Astria webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleTuneWebhook(payload: AstriaWebhookPayload) {
  try {
    // Find the corresponding AI model in our database
    const model = await prisma.aIModel.findFirst({
      where: {
        trainingJobId: payload.id
      }
    })

    if (!model) {
      console.warn('⚠️ No model found for Astria tune:', payload.id)
      return
    }

    console.log(`🎯 Processing Astria tune webhook for model: ${model.id}`)

    // Map Astria status to our internal status
    let internalStatus: 'TRAINING' | 'READY' | 'FAILED'
    switch (payload.status) {
      case 'trained':
        internalStatus = 'READY'
        break
      case 'failed':
      case 'cancelled':
        internalStatus = 'FAILED'
        break
      default:
        internalStatus = 'TRAINING'
    }

    // Update the model with the new status
    const updatedModel = await prisma.aIModel.update({
      where: { id: model.id },
      data: {
        status: internalStatus as any,
        modelUrl: payload.status === 'trained' ? payload.id : model.modelUrl, // Use tune ID as model URL
        trainedAt: payload.trained_at ? new Date(payload.trained_at) : undefined,
        trainingLogs: payload.logs ? [payload.logs] : undefined,
        errorMessage: payload.error_message || undefined
      }
    })

    console.log(`✅ Astria tune ${payload.id} updated to status: ${internalStatus}`)

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

    return updatedModel
  } catch (error) {
    console.error('❌ Error handling Astria tune webhook:', error)
    throw error
  }
}

async function handlePromptWebhook(payload: AstriaWebhookPayload) {
  try {
    // Find the corresponding generation in our database
    const generation = await prisma.generation.findFirst({
      where: {
        jobId: payload.id
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
        console.error('❌ Storage failed:', storageError)
        // Don't fail the webhook for storage errors - images are still accessible via original URLs
        finalImageUrls = imageUrls
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