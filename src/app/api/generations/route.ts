import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createGeneration } from '@/lib/db/generations'
import { getModelById } from '@/lib/db/models'
import { getAIProvider } from '@/lib/ai'
import { prisma } from '@/lib/db'
import { CreditManager } from '@/lib/credits/manager'
import { getImageGenerationCost } from '@/lib/credits/pricing'
import { Plan } from '@prisma/client'

// Helper functions for optimal generation parameters
function calculateOptimalSteps(userPlan: string, megapixels: number, modelType: 'custom' | 'base'): number {
  // Base steps by plan for quality (temporarily max quality for STARTER testing)
  const planSteps = {
    'STARTER': 40,  // Temporarily max quality for testing
    'PREMIUM': 20,  // FLUX Dev - balanced
    'GOLD': 28      // FLUX Pro - highest quality
  }
  
  let baseSteps = planSteps[userPlan as keyof typeof planSteps] || 40
  
  // Increase steps for higher resolutions
  if (megapixels > 2.25) {
    baseSteps = Math.min(baseSteps + 12, 50) // Higher cap for very high res
  } else if (megapixels > 1.5) {
    baseSteps = Math.min(baseSteps + 8, 40) // Cap at 40 steps max
  }
  
  // Custom models may need more steps for quality
  if (modelType === 'custom') {
    baseSteps = Math.min(baseSteps + 4, 35)
  }
  
  return baseSteps
}

function calculateOptimalGuidance(userPlan: string, megapixels: number): number {
  // Base guidance by plan (optimized for FLUX - max 5.0 to prevent over-saturation)
  const planGuidance = {
    'STARTER': 3,   // Optimized for FLUX - reduced from 5.5 to prevent artifacts
    'PREMIUM': 3,   // FLUX Dev optimal - consistent with config
    'GOLD': 3       // FLUX Pro for highest quality - capped at safe value
  }
  
  let baseGuidance = planGuidance[userPlan as keyof typeof planGuidance] || 4.0
  
  // Slightly increase guidance for higher resolutions but cap at FLUX maximum (5.0)
  if (megapixels > 1.5) {
    baseGuidance = Math.min(baseGuidance + 0.5, 5.0) // FLUX maximum for quality
  }
  
  return baseGuidance
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      modelId,
      prompt,
      negativePrompt,
      aspectRatio = '1:1',
      resolution = '512x512',
      variations = 1,
      strength = 0.8,
      seed,
      style = 'photographic',
      // FLUX-specific parameters
      steps,
      guidance_scale,
      safety_tolerance,
      raw_mode,
      output_format,
      output_quality
    } = body

    // Validate required fields
    if (!modelId || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: modelId and prompt' },
        { status: 400 }
      )
    }

    // Validate prompt length
    if (prompt.length > 2500) {
      return NextResponse.json(
        { error: 'Prompt must be 2500 characters or less' },
        { status: 400 }
      )
    }

    // Validate variations
    if (variations < 1 || variations > 4) {
      return NextResponse.json(
        { error: 'Variations must be between 1 and 4' },
        { status: 400 }
      )
    }

    // Check if user owns the model
    const model = await getModelById(modelId, session.user.id)
    if (!model) {
      return NextResponse.json(
        { error: 'Model not found or access denied' },
        { status: 404 }
      )
    }

    // Check if model is ready
    if (model.status !== 'READY') {
      return NextResponse.json(
        { error: `Model is not ready for generation. Current status: ${model.status}` },
        { status: 400 }
      )
    }

    // Para Astria, o modelUrl deve ser o trainingJobId (tune ID)
    // Se modelUrl não existir, usar trainingJobId como fallback
    const effectiveModelUrl = model.modelUrl || model.trainingJobId

    if (!effectiveModelUrl) {
      console.error(`❌ Model ${modelId} is READY but has no modelUrl or trainingJobId`)
      return NextResponse.json(
        { 
          error: 'Model configuration error: missing model URL. Please contact support.',
          details: {
            modelId: model.id,
            status: model.status,
            hasModelUrl: !!model.modelUrl,
            hasTrainingJobId: !!model.trainingJobId
          }
        },
        { status: 500 }
      )
    }

    console.log(`✅ Model URL resolved:`, {
      modelId: model.id,
      modelUrl: model.modelUrl || '(null)',
      trainingJobId: model.trainingJobId || '(null)',
      effectiveModelUrl,
      provider: process.env.AI_PROVIDER || 'hybrid'
    })

    const creditsNeeded = getImageGenerationCost(variations)
    const userPlan = ((session.user as any)?.plan || 'STARTER') as Plan
    const affordability = await CreditManager.canUserAfford(session.user.id, creditsNeeded, userPlan)

    if (!affordability.canAfford) {
      return NextResponse.json(
        { error: affordability.reason || 'Insufficient credits. Upgrade your plan ou adquira créditos adicionais.' },
        { status: 402 }
      )
    }

    // Get current AI provider
    const currentProvider = process.env.AI_PROVIDER || 'hybrid'
    console.log(`🎯 [GENERATIONS_CREATE] Using AI provider: ${currentProvider}`)

    // Create generation record with AI provider info

    // Prepare Astria enhancements for hybrid/astria providers
    const astriaEnhancements = (currentProvider === 'astria' || currentProvider === 'hybrid') ? {
      super_resolution: true,
      inpaint_faces: true,
      face_correct: true,
      face_swap: true,
      hires_fix: true,
      model_type: 'flux-lora',
      cfg_scale: guidance_scale || 7.5,
      steps: steps || 30,
      output_quality: output_quality || 95
    } : undefined

    const generation = await createGeneration({
      userId: session.user.id,
      modelId,
      prompt,
      negativePrompt,
      aspectRatio,
      resolution,
      variations,
      strength,
      seed,
      style,
      aiProvider: currentProvider,
      astriaEnhancements
    })

    // NOTE: Credits are already debited inside createGeneration()
    // No need to debit again here

    try {
      // Get AI provider and start real generation
      console.log(`🎨 Starting generation for model ${model.name} (${model.id})`)
      const aiProvider = getAIProvider()

    // Derivar width/height do aspectRatio (sobrepõe qualquer width/height anterior)
    const base = 1024
    const ratioMap: Record<string, [number, number]> = {
      '1:1': [base, base],
      '4:3': [Math.round(base * 4/3), base],
      '3:4': [base, Math.round(base * 4/3)],
      '16:9': [Math.round(base * 16/9), base],
      '9:16': [base, Math.round(base * 16/9)]
    }
    const [width, height] = (ratioMap[aspectRatio] || ratioMap['1:1'])
      // width/height já definidos a partir do aspectRatio acima

      // Get user plan from session for quality optimization
      const userPlan = (session.user as any).plan || 'FREE'
      
      // Calculate optimal parameters based on resolution and user plan
      const megapixels = (width * height) / (1024 * 1024)
      const optimalSteps = calculateOptimalSteps(userPlan, megapixels, effectiveModelUrl ? 'custom' : 'base')
      const optimalGuidance = calculateOptimalGuidance(userPlan, megapixels)
      
      // Build generation request - parâmetros serão mapeados conforme provider (Astria/Replicate)
      const generationRequest = {
        modelUrl: effectiveModelUrl, // Usa modelUrl ou trainingJobId como fallback
        prompt,
        negativePrompt,
        triggerWord: model.triggerWord || undefined,
        classWord: model.classWord || undefined, // CRÍTICO: passar classWord para construção do prompt
        params: {
          width,
          height,
          aspectRatio: aspectRatio, // Para Astria usar aspect_ratio quando disponível
          // Core parameters (serão mapeados conforme provider)
          steps: steps || optimalSteps,
          guidance_scale: guidance_scale || optimalGuidance,
          num_outputs: variations,
          seed: seed || Math.floor(Math.random() * 1000000),
          scheduler: 'euler_a', // Default para Astria
          // Astria-specific enhancements (fixos conforme configuração)
          super_resolution: true, // Sempre true
          inpaint_faces: true, // Sempre true
          // NOTA: style, color_grading, film_grain, use_lpw não são enviados (conforme configuração)
          // cfg_scale será fixado em 3 no provider
          // Replicate/FLUX-specific parameters (serão ignorados pelo Astria)
          safety_tolerance: safety_tolerance || 2,
          raw_mode: raw_mode || false,
          output_format: output_format || 'webp'
          // NOTA: output_quality removido - não é suportado pela API Astria
        },
        webhookUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/astria?type=prompt&id=${generation.id}&userId=${session.user.id}&secret=${process.env.ASTRIA_WEBHOOK_SECRET}`,
        userPlan // Pass user plan for model selection
      }

      console.log(`🚀 Sending generation request to AI provider...`)
      console.log(`🔑 [GENERATION_DEBUG] Model details for prompt construction:`, {
        modelId: model.id,
        modelName: model.name,
        triggerWord: model.triggerWord,
        classWord: model.classWord,
        hasTriggerWord: !!model.triggerWord,
        hasClassWord: !!model.classWord,
        willUseFallbacks: !model.triggerWord || !model.classWord
      })
      const generationResponse = await aiProvider.generateImage(generationRequest)
      
      console.log(`✅ Generation started with job ID: ${generationResponse.id}`)

      // Extract tune_id - for Astria use trainingJobId (contains tune_id), for Replicate use modelUrl
      const tuneId = (currentProvider === 'astria' || currentProvider === 'hybrid')
        ? model.trainingJobId || effectiveModelUrl
        : effectiveModelUrl

      console.log(`🔍 [GENERATIONS_DEBUG] Tune ID resolution:`, {
        modelUrl: model.modelUrl,
        trainingJobId: model.trainingJobId,
        effectiveModelUrl,
        metadataTuneId: generationResponse.metadata?.tune_id,
        finalTuneId: tuneId,
        generationResponseId: generationResponse.id
      })

      // Update astriaEnhancements with tune_id for proper polling
      const updatedAstriaEnhancements = (currentProvider === 'astria' || currentProvider === 'hybrid') ? {
        ...astriaEnhancements,
        tune_id: tuneId // CRÍTICO: armazenar tune_id para polling
      } : astriaEnhancements

      console.log(`📝 [GENERATIONS_DB] Storing tune_id for polling: ${tuneId}`)

      // Update generation with job ID, status and tune_id
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          jobId: String(generationResponse.id), // Convert to string for Prisma
          status: 'PROCESSING',
          astriaEnhancements: updatedAstriaEnhancements
          // Note: estimatedCompletionTime is a DateTime field, not Int
          // We'll store completion time estimates in a different way if needed
        }
      })

      // 🔥 IMPLEMENTAR POLLING PARA ASTRIA/HYBRID 🔥
      console.log(`🔄 [GENERATIONS_DEBUG] About to check polling logic...`)
      console.log(`🔄 [GENERATIONS_DEBUG] Current provider: ${currentProvider}`)
      console.log(`🔄 [GENERATIONS_DEBUG] Generation response ID: ${generationResponse.id}`)

      // 🎯 DETECTAR PROVIDER REAL PARA JOBS HYBRID
      let actualProvider = currentProvider
      if (currentProvider === 'hybrid') {
        // Para hybrid, detectar provider real baseado no jobId
        const jobIdStr = String(generationResponse.id)
        if (/^\d+$/.test(jobIdStr) && jobIdStr.length > 6) {
          // JobId numérico longo = Astria
          actualProvider = 'astria'
          console.log(`🎯 [PROVIDER_DETECTION] Hybrid job routed to Astria (jobId: ${jobIdStr})`)
        } else if (jobIdStr.includes('-') || jobIdStr.length === 36) {
          // JobId UUID = Replicate
          actualProvider = 'replicate'
          console.log(`🎯 [PROVIDER_DETECTION] Hybrid job routed to Replicate (jobId: ${jobIdStr})`)
        } else {
          // Fallback: usar Astria como default para hybrid
          actualProvider = 'astria'
          console.log(`🎯 [PROVIDER_DETECTION] Hybrid job defaulting to Astria (unknown jobId format: ${jobIdStr})`)
        }
      }

      // 💾 SALVAR PROVIDER REAL NO BANCO (para hybrid)
      if (currentProvider === 'hybrid' && actualProvider !== currentProvider) {
        console.log(`💾 [PROVIDER_UPDATE] Updating aiProvider from '${currentProvider}' to '${actualProvider}' in database`)
        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            aiProvider: actualProvider
          }
        })
        console.log(`✅ [PROVIDER_UPDATE] aiProvider updated to '${actualProvider}' for generation ${generation.id}`)
      }

      // For Astria/Hybrid, we need polling (not webhooks)
      const shouldPoll = actualProvider === 'astria' || currentProvider === 'hybrid'

      console.log(`🔍 [GENERATIONS_DECISION] Generation flow decision:`, {
        currentProvider,
        actualProvider,
        shouldPoll,
        environment: process.env.NODE_ENV,
        predictionId: generationResponse.id,
        generationId: generation.id
      })

      // Start polling for Astria/Hybrid providers
      if (shouldPoll && generationResponse.id) {
        console.log(`🔄 [GENERATIONS_POLLING] Starting polling for prediction ${generationResponse.id}`)
        console.log(`📊 [GENERATIONS_POLLING] Config: provider=${actualProvider}, generationId=${generation.id}`)

        // Start polling in background with improved error handling
        try {
          const { startPolling } = await import('@/lib/services/polling-service')

          // Use setTimeout instead of setImmediate for better reliability
          setTimeout(async () => {
            try {
              console.log(`🚀 [GENERATIONS_POLLING] Executing startPolling for ${generationResponse.id}`)
              console.log(`🎯 [GENERATIONS_POLLING] Provider details:`, {
                currentProvider,
                actualProvider,
                willUseProvider: actualProvider,
                jobId: generationResponse.id,
                isNumericJobId: /^\d+$/.test(String(generationResponse.id))
              })
              await startPolling(generationResponse.id, generation.id, session.user.id, actualProvider)
              console.log(`✅ [GENERATIONS_POLLING] Polling service started successfully for ${generationResponse.id} with provider ${actualProvider}`)
            } catch (error) {
              console.error(`❌ [GENERATIONS_POLLING] Failed to start polling for ${generationResponse.id}:`, error)

              // Retry once after a longer delay
              setTimeout(async () => {
                try {
                  console.log(`🔄 [GENERATIONS_POLLING] Retrying polling for ${generationResponse.id} with provider ${actualProvider}`)
                  await startPolling(generationResponse.id, generation.id, session.user.id, actualProvider)
                  console.log(`✅ [GENERATIONS_POLLING] Retry polling successful for ${generationResponse.id}`)
                } catch (retryError) {
                  console.error(`❌ [GENERATIONS_POLLING] Retry failed for ${generationResponse.id}:`, retryError)
                }
              }, 5000) // 5 second delay for retry
            }
          }, 500) // Increased delay to ensure transaction completion

          console.log(`📝 [GENERATIONS_POLLING] Polling startup scheduled for ${generationResponse.id}`)
        } catch (importError) {
          console.error(`❌ [GENERATIONS_POLLING] Failed to import polling service for ${generationResponse.id}:`, importError)
        }
      } else {
        console.log(`⚠️ [GENERATIONS_POLLING] Polling skipped for ${generationResponse.id}:`, {
          shouldPoll,
          hasGenerationId: !!generationResponse.id,
          currentProvider
        })
      }

    } catch (generationError) {
      console.error('❌ Error starting generation:', generationError)
      
      // Detailed error logging for debugging
      if (generationError instanceof Error) {
        console.error('Error details:', {
          message: generationError.message,
          stack: generationError.stack,
          modelId: model.id,
          modelUrl: model.modelUrl,
          trainingJobId: model.trainingJobId,
          effectiveModelUrl,
          userId: session.user.id,
          prompt: prompt.substring(0, 100)
        })
      }
      
      // Update generation status to failed with detailed error
      const errorMessage = generationError instanceof Error 
        ? generationError.message 
        : 'Unknown error occurred during generation startup'
      
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED',
          errorMessage,
          completedAt: new Date()
        }
      })
      
      // Refund credits since generation failed
      const refundResult = await CreditManager.addCredits(
        session.user.id,
        creditsNeeded,
        'Reembolso por falha na geração',
        {
          refundSource: 'REFUND',
          referenceId: generation.id
        }
      )

      if (!refundResult.success) {
        console.error('❌ Failed to refund credits after generation error:', refundResult.error)
      }
      
      // Return specific error instead of generic one
      return NextResponse.json({
        success: false,
        error: `Generation failed: ${errorMessage}`,
        details: {
          errorType: 'GENERATION_START_ERROR',
          modelStatus: model.status,
          hasModelUrl: !!model.modelUrl,
          hasTrainingJobId: !!model.trainingJobId,
          effectiveModelUrl: effectiveModelUrl || null
        }
      }, { status: 500 })
    }

    // CRITICAL: Buscar geração atualizada do banco para garantir status correto
    const updatedGeneration = await prisma.generation.findUnique({
      where: { id: generation.id },
      select: {
        id: true,
        status: true,
        prompt: true,
        variations: true,
        createdAt: true,
        jobId: true
      }
    })

    return NextResponse.json({
      success: true,
      generation: {
        id: updatedGeneration?.id || generation.id,
        status: updatedGeneration?.status || 'PROCESSING', // Garantir PROCESSING se não encontrado
        prompt: updatedGeneration?.prompt || generation.prompt,
        variations: updatedGeneration?.variations || generation.variations,
        createdAt: updatedGeneration?.createdAt || generation.createdAt,
        jobId: updatedGeneration?.jobId || null
      }
    })

  } catch (error: any) {
    console.error('Error creating generation:', error)
    return NextResponse.json(
      { error: 'Failed to create generation' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const modelId = searchParams.get('modelId')

    // This would use the getGenerationsByUserId function
    // For now, return a placeholder response
    return NextResponse.json({
      generations: [],
      pagination: {
        page,
        limit,
        total: 0,
        pages: 0
      }
    })

  } catch (error: any) {
    console.error('Error fetching generations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch generations' },
      { status: 500 }
    )
  }
}