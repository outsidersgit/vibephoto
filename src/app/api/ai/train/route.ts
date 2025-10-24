import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAIProvider, calculateTrainingCost } from '@/lib/ai'
import { ContentModerator } from '@/lib/security/content-moderator'
import { RateLimiter } from '@/lib/security/rate-limiter'
import { prisma } from '@/lib/db'
import { z } from 'zod'

/**
 * Schema for FLUX model training with maximum quality parameters
 * Based on Replicate's official documentation and best practices
 */
const trainModelSchema = z.object({
  modelId: z.string(),
  triggerWord: z.string().optional(),
  classWord: z.string().optional(),
  trainingParams: z.object({
    // Core training parameters - optimized for maximum quality
    steps: z.number().min(500).max(4000).default(2500),
    learningRate: z.number().min(5e-6).max(5e-4).default(1e-4),
    batchSize: z.number().min(1).max(8).default(1),
    resolution: z.string().default("512,768,1024"), // Multiple resolutions for better training
    
    // Advanced FLUX parameters for maximum quality
    loraRank: z.number().min(16).max(64).default(48),
    networkAlpha: z.number().min(8).max(32).default(24), // Half of lora_rank
    loraType: z.enum(["subject", "style", "concept"]).default("subject"),
    
    // Training optimization
    optimizer: z.enum(["adamw8bit", "prodigy", "lion", "adamw"]).default("adamw8bit"),
    mixedPrecision: z.enum(["fp16", "bf16", "no"]).default("fp16"),
    gradientCheckpointing: z.boolean().default(true),
    cacheLatents: z.boolean().default(true),
    
    // Quality parameters
    captionDropoutRate: z.number().min(0).max(0.1).default(0.03),
    noiseOffset: z.number().min(0).max(0.2).default(0.05),
    shuffleTokens: z.boolean().default(true),
    autocaption: z.boolean().default(true),
    
    // Optional parameters
    seed: z.number().optional()
  }).optional()
})

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const validationResult = trainModelSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { modelId, triggerWord, classWord, trainingParams } = validationResult.data
    const userId = session.user.id
    const userPlan = session.user.plan || 'FREE'

    // Check rate limits for training
    const trainingLimit = await RateLimiter.checkLimit(userId, 'training', userPlan)
    if (!trainingLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Training rate limit exceeded',
          resetTime: trainingLimit.resetTime,
          retryAfter: trainingLimit.retryAfter
        },
        { status: 429 }
      )
    }

    // Moderate trigger word and class word if provided
    if (triggerWord) {
      const triggerModeration = await ContentModerator.moderateContent(triggerWord, userId)
      if (!triggerModeration.isAllowed) {
        return NextResponse.json(
          { 
            error: 'Trigger word violates content policy',
            reason: triggerModeration.reason
          },
          { status: 400 }
        )
      }
    }

    if (classWord) {
      const classModeration = await ContentModerator.moderateContent(classWord, userId)
      if (!classModeration.isAllowed) {
        return NextResponse.json(
          { 
            error: 'Class word violates content policy',
            reason: classModeration.reason
          },
          { status: 400 }
        )
      }
    }

    // Get model from database
    const model = await prisma.aIModel.findUnique({
      where: { 
        id: modelId,
        userId: session.user.id
      },
      include: {
        user: {
          select: {
            id: true,
            plan: true,
            creditsUsed: true,
            creditsLimit: true
          }
        }
      }
    })

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found or access denied' },
        { status: 404 }
      )
    }

    // Check if model is ready for training
    if (model.status !== 'UPLOADING') {
      return NextResponse.json(
        { error: 'Model is not ready for training' },
        { status: 400 }
      )
    }

    // Check if model has enough photos
    const totalPhotos = (model.facePhotos?.length || 0) + (model.halfBodyPhotos?.length || 0) + (model.fullBodyPhotos?.length || 0);
    if (totalPhotos < 3) {
      return NextResponse.json(
        { error: 'At least 3 training photos are required' },
        { status: 400 }
      )
    }

    // Calculate training cost with optimized parameters for maximum quality
    const finalParams = {
      // Core parameters
      steps: trainingParams?.steps || 2500,
      learningRate: trainingParams?.learningRate || 1e-4,
      batchSize: trainingParams?.batchSize || 1,
      resolution: trainingParams?.resolution || "512,768,1024",
      
      // Advanced FLUX parameters for maximum quality
      lora_rank: trainingParams?.loraRank || 48,
      network_alpha: trainingParams?.networkAlpha || 24,
      lora_type: trainingParams?.loraType || "subject",
      
      // Training optimization
      optimizer: trainingParams?.optimizer || "adamw8bit",
      mixed_precision: trainingParams?.mixedPrecision || "fp16",
      gradient_checkpointing: trainingParams?.gradientCheckpointing !== false,
      cache_latents: trainingParams?.cacheLatents !== false,
      
      // Quality parameters
      caption_dropout_rate: trainingParams?.captionDropoutRate || 0.03,
      noise_offset: trainingParams?.noiseOffset || 0.05,
      shuffle_tokens: trainingParams?.shuffleTokens !== false,
      autocaption: trainingParams?.autocaption !== false,
      
      // Optional
      seed: trainingParams?.seed
    }

    // Calculate estimated cost for maximum quality training
    // Higher quality parameters increase training time and cost
    const estimatedCost = calculateTrainingCost(finalParams)
    const cost = 0 // Training remains free, but we track estimated cost

    // Get AI provider
    const aiProvider = getAIProvider()
    const currentProvider = process.env.AI_PROVIDER || 'replicate'

    // Determine correct webhook URL based on provider
    // Para Astria, usar undefined para forçar polling via auto-storage service
    const webhookUrl = currentProvider === 'astria'
      ? undefined // Force polling for Astria
      : `${process.env.NEXTAUTH_URL}/api/webhooks/replicate?type=training&modelId=${model.id}&userId=${session.user.id}`

    // Prepare training request
    const trainingRequest = {
      modelId: model.id,
      modelName: model.name,
      name: model.name,
      triggerWord: triggerWord || 'ohwx', // Padrão Astria
      classWord: classWord || model.class.toLowerCase(),
      imageUrls: [...(model.facePhotos || []), ...(model.halfBodyPhotos || []), ...(model.fullBodyPhotos || [])].filter((url): url is string => typeof url === 'string'),
      params: finalParams,
      webhookUrl: webhookUrl
    }

    // Start training
    console.log('🚀 TA AQUI: Starting AI training...')
    console.log('🚀 TA AQUI: Training request...', trainingRequest)
    const trainingResponse = await aiProvider.startTraining(trainingRequest)
    console.log('🚀 TA AQUI: Training response...', trainingResponse)
    

    // Record the training attempt
    await RateLimiter.recordAttempt(userId, 'training', {
      modelId: model.id,
      cost,
      trainingId: trainingResponse.id
    })

    // Update model in database
    await prisma.$transaction(async (tx) => {
      // Determine AI provider being used
      const currentProvider = process.env.AI_PROVIDER || 'replicate'

      // Update model status and training info
      await tx.aIModel.update({
        where: { id: model.id },
        data: {
          status: 'TRAINING',
          progress: 0,
          trainingConfig: finalParams as any,
          // Store provider and training job info
          aiProvider: currentProvider,
          trainingJobId: trainingResponse.id,
          triggerWord: triggerWord || 'ohwx', // Padrão Astria
          classWord: classWord || model.class.toLowerCase(),
          // Store Astria specific info if using Astria
          astriaModelType: currentProvider === 'astria' ? 'faceid' : null
        }
      })

      // Log the usage (no credits deducted for training)
      await tx.usageLog.create({
        data: {
          userId: session.user.id,
          action: 'training',
          details: {
            modelId: model.id,
            modelName: model.name,
            cost: 0,
            trainingId: trainingResponse.id
          },
          creditsUsed: 0
        }
      })
    })

    // Start polling for training completion if using Astria (no webhook)
    if (currentProvider === 'astria' && trainingResponse.id) {
      console.log(`🔄 Starting training polling for Astria model ${model.id}`)

      try {
        // Import polling service and start training polling
        const { startTrainingPolling } = await import('@/lib/services/training-polling-service')

        // Start polling in background
        setTimeout(async () => {
          try {
            await startTrainingPolling(trainingResponse.id, model.id, session.user.id)
            console.log(`📝 Training polling started for model ${model.id}`)
          } catch (pollingError) {
            console.error(`❌ Failed to start training polling for ${model.id}:`, pollingError)
          }
        }, 5000) // Start after 5 seconds
      } catch (importError) {
        console.error(`❌ Failed to import training polling service:`, importError)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        trainingId: trainingResponse.id,
        estimatedTime: trainingResponse.estimatedTime,
        cost,
        status: trainingResponse.status
      }
    })

  } catch (error) {
    console.error('Training start error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to start training',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Get training status
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const trainingId = searchParams.get('trainingId')

    if (!trainingId) {
      return NextResponse.json(
        { error: 'Training ID is required' },
        { status: 400 }
      )
    }

    // Find model with this training ID - using trainingConfig to store the job ID
    const model = await prisma.aIModel.findFirst({
      where: {
        userId: session.user.id,
        status: 'TRAINING'
      }
    })

    if (!model) {
      return NextResponse.json(
        { error: 'Training job not found or access denied' },
        { status: 404 }
      )
    }

    // Get training status from AI provider
    const aiProvider = getAIProvider()
    const trainingStatus = await aiProvider.getTrainingStatus(trainingId)

    // Update model status if needed
    if (trainingStatus.status === 'succeeded' && model.status === 'TRAINING') {
      await prisma.aIModel.update({
        where: { id: model.id },
        data: {
          status: 'READY',
          modelUrl: trainingStatus.model?.url,
          trainedAt: new Date(),
          qualityScore: 95 // Maximum quality configuration expected score
        }
      })
    } else if (trainingStatus.status === 'failed' && model.status === 'TRAINING') {
      await prisma.aIModel.update({
        where: { id: model.id },
        data: {
          status: 'ERROR',
          trainedAt: new Date()
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: trainingStatus
    })

  } catch (error) {
    console.error('Training status error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to get training status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}