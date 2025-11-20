import { prisma } from '@/lib/db'
import { createGeneration } from '@/lib/db/generations'
import { getModelById } from '@/lib/db/models'
import { getAIProvider } from '@/lib/ai'
import { GenerationRequest } from './base'

// Helper functions for optimal generation parameters (same as /api/generations)
function calculateOptimalSteps(userPlan: string, megapixels: number, modelType: 'custom' | 'base'): number {
  const planSteps = {
    'STARTER': 40,
    'PREMIUM': 20,
    'GOLD': 28
  }
  
  let baseSteps = planSteps[userPlan as keyof typeof planSteps] || 40
  
  // Increase steps for higher resolutions
  if (megapixels > 2.25) {
    baseSteps = Math.min(baseSteps + 12, 50)
  } else if (megapixels > 1.5) {
    baseSteps = Math.min(baseSteps + 8, 40)
  }
  
  // Custom models may need more steps for quality
  if (modelType === 'custom') {
    baseSteps = Math.min(baseSteps + 4, 35)
  }
  
  return baseSteps
}

function calculateOptimalGuidance(userPlan: string, megapixels: number): number {
  const planGuidance = {
    'STARTER': 3,
    'PREMIUM': 3,
    'GOLD': 3
  }
  
  let baseGuidance = planGuidance[userPlan as keyof typeof planGuidance] || 4.0
  
  // Slightly increase guidance for higher resolutions but cap at FLUX maximum (5.0)
  if (megapixels > 1.5) {
    baseGuidance = Math.min(baseGuidance + 0.5, 5.0)
  }
  
  return baseGuidance
}

export interface ExecuteGenerationFlowParams {
  userId: string
  modelId: string
  prompt: string
  negativePrompt?: string
  aspectRatio?: string
  resolution?: string
  variations?: number
  strength?: number
  seed?: number
  style?: string
  steps?: number
  guidance_scale?: number
  safety_tolerance?: number
  raw_mode?: boolean
  output_format?: string
  userPlan?: string
  // Package-specific options
  skipCreditDeduction?: boolean
  packageMetadata?: {
    source: 'package'
    userPackageId: string
    packageId: string
    packageName?: string
    packagePromptIndex?: number
  }
}

/**
 * Executes the complete generation flow:
 * 1. Creates generation record (with optional credit deduction skip)
 * 2. Calls AI provider to start generation
 * 3. Updates generation with job ID and status
 * 
 * This function encapsulates the same logic used in /api/generations/route.ts
 * to ensure consistency between normal and package generations.
 */
export async function executeGenerationFlow(params: ExecuteGenerationFlowParams) {
  const {
    userId,
    modelId,
    prompt,
    negativePrompt,
    aspectRatio = '1:1',
    resolution,
    variations = 1,
    strength,
    seed,
    style,
    steps,
    guidance_scale,
    safety_tolerance,
    raw_mode,
    output_format,
    userPlan = 'STARTER',
    skipCreditDeduction = false,
    packageMetadata
  } = params

  // Get current AI provider
  const currentProvider = process.env.AI_PROVIDER || 'hybrid'
  
  // Get model
  const model = await getModelById(modelId, userId)
  if (!model) {
    throw new Error('Model not found or access denied')
  }

  // Check if model is ready
  if (model.status !== 'READY') {
    throw new Error(`Model is not ready for generation. Current status: ${model.status}`)
  }

  // Resolve effective model URL (same logic as /api/generations)
  const effectiveModelUrl = model.modelUrl || model.trainingJobId
  if (!effectiveModelUrl) {
    throw new Error('Model configuration error: missing model URL. Please contact support.')
  }

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
    output_quality: 95
  } : undefined

  // Create generation record (with optional credit deduction skip)
  const generation = await createGeneration({
    userId,
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
    astriaEnhancements,
    skipCreditDeduction,
    packageMetadata
  })

  try {
    // Get AI provider and start real generation
    console.log(`🎨 Starting generation for model ${model.name} (${model.id})`)
    const aiProvider = getAIProvider()

    // Derive width/height from aspectRatio
    const base = 1024
    const ratioMap: Record<string, [number, number]> = {
      '1:1': [base, base],
      '4:3': [Math.round(base * 4/3), base],
      '3:4': [base, Math.round(base * 4/3)],
      '16:9': [Math.round(base * 16/9), base],
      '9:16': [base, Math.round(base * 16/9)]
    }
    const [width, height] = (ratioMap[aspectRatio] || ratioMap['1:1'])

    // Calculate optimal parameters based on resolution and user plan
    const megapixels = (width * height) / (1024 * 1024)
    const optimalSteps = calculateOptimalSteps(userPlan, megapixels, effectiveModelUrl ? 'custom' : 'base')
    const optimalGuidance = calculateOptimalGuidance(userPlan, megapixels)
    
    // Build generation request - same parameters as /api/generations
    const generationRequest: GenerationRequest = {
      modelUrl: effectiveModelUrl,
      prompt,
      negativePrompt,
      triggerWord: model.triggerWord || undefined,
      classWord: model.classWord || undefined,
      params: {
        width,
        height,
        aspectRatio: aspectRatio,
        steps: steps || optimalSteps,
        guidance_scale: guidance_scale || optimalGuidance,
        num_outputs: variations,
        seed: seed || Math.floor(Math.random() * 1000000),
        scheduler: 'euler_a',
        super_resolution: true,
        inpaint_faces: true,
        safety_tolerance: safety_tolerance || 2,
        raw_mode: raw_mode || false,
        output_format: output_format || 'webp'
      },
      webhookUrl: (() => {
        const baseUrl = process.env.NEXTAUTH_URL
        if (!baseUrl) {
          console.warn('⚠️ [GENERATION_FLOW] NEXTAUTH_URL not configured - callback will not work')
          return undefined
        }
        // 🔍 CORRETO: Callback de geração (PROMPT) usa apenas prompt_id
        // Formato: https://seu-dominio/api/webhooks/astria?prompt_id={PROMPT_ID}
        // NOTA: prompt_id será preenchido pelo Astria após criar o prompt (será passado no callback)
        // Por enquanto, usamos generation.id como placeholder, mas o Astria enviará o prompt_id real no payload
        const callbackUrl = `${baseUrl}/api/webhooks/astria`
        
        console.log(`🔗 [GENERATION_FLOW] Callback URL configured (prompt_id virá no payload do Astria):`, {
          baseUrl,
          callbackUrl,
          isHttps: callbackUrl.startsWith('https://'),
          note: 'Astria will send prompt_id in webhook payload, not in URL'
        })
        
        return callbackUrl
      })(),
      userPlan
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
    
    console.log(`✅ Generation started with job ID: ${generationResponse.id}`, {
      generationId: generation.id,
      jobId: generationResponse.id,
      jobIdType: typeof generationResponse.id,
      jobIdAsString: String(generationResponse.id),
      webhookUrl: generationRequest.webhookUrl?.substring(0, 100) + '...'
    })

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
      tune_id: tuneId
    } : astriaEnhancements

    console.log(`📝 [GENERATIONS_DB] Storing tune_id for polling: ${tuneId}`)

    // Update generation with job ID, status and tune_id
    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        jobId: String(generationResponse.id),
        status: 'PROCESSING',
        astriaEnhancements: updatedAstriaEnhancements
      }
    })

    // Detect actual provider if using hybrid
    let actualProvider = currentProvider
    if (currentProvider === 'hybrid') {
      const jobIdStr = String(generationResponse.id)
      if (/^\d+$/.test(jobIdStr) && jobIdStr.length > 6) {
        actualProvider = 'astria'
      } else {
        actualProvider = 'replicate'
      }
      
      // Update generation with actual provider
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          aiProvider: actualProvider,
          metadata: {
            ...(generation.metadata as any || {}),
            provider: actualProvider,
            originalProvider: currentProvider,
            hybridRouting: generationResponse.metadata?.hybridRouting
          }
        }
      })
    }

    // 🔥 CRITICAL: Start polling for Astria/Hybrid (same as common generation)
    // Astria callbacks are unreliable, so polling is the primary mechanism
    const shouldPoll = actualProvider === 'astria' || currentProvider === 'hybrid'

    if (shouldPoll && generationResponse.id) {
      console.log(`🔄 [GENERATION_FLOW] Starting polling for Astria generation ${generationResponse.id}`)
      
      // Start polling in background (same logic as /api/generations)
      setTimeout(async () => {
        try {
          const { startPolling } = await import('@/lib/services/polling-service')
          await startPolling(generationResponse.id, generation.id, userId, actualProvider)
          console.log(`✅ [GENERATION_FLOW] Polling started successfully for ${generationResponse.id}`)
        } catch (pollingError) {
          console.error(`❌ [GENERATION_FLOW] Failed to start polling for ${generationResponse.id}:`, pollingError)
          
          // Retry once after delay
          setTimeout(async () => {
            try {
              const { startPolling } = await import('@/lib/services/polling-service')
              await startPolling(generationResponse.id, generation.id, userId, actualProvider)
              console.log(`✅ [GENERATION_FLOW] Retry polling successful for ${generationResponse.id}`)
            } catch (retryError) {
              console.error(`❌ [GENERATION_FLOW] Retry polling failed for ${generationResponse.id}:`, retryError)
            }
          }, 5000)
        }
      }, 500)
    } else {
      console.log(`⚠️ [GENERATION_FLOW] Polling skipped:`, {
        shouldPoll,
        hasJobId: !!generationResponse.id,
        actualProvider,
        currentProvider
      })
    }

    return {
      generation,
      generationResponse,
      actualProvider
    }
  } catch (error) {
    // If generation fails, update status to FAILED
    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Generation failed'
      }
    }).catch(updateError => {
      console.error('Failed to update generation status to FAILED:', updateError)
    })
    
    throw error
  }
}

