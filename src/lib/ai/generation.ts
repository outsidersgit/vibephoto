import { getAIProvider } from '@/lib/ai'
import { prisma } from '@/lib/db'
import { GenerationRequest, GenerationParams } from './base'

interface SimpleGenerationParams {
  modelId: string
  prompt: string
  negativePrompt?: string
  aspectRatio?: string
  resolution?: string
  variations?: number
  strength?: number
  seed?: number
  style?: string
}

/**
 * Helper function to generate images - used by package generation system
 * This function mirrors the logic from /api/generations/route.ts
 */
export async function generateImage(params: SimpleGenerationParams, generationId: string) {
  const {
    modelId,
    prompt,
    negativePrompt,
    aspectRatio = '1:1',
    resolution = '1024x1024',
    variations = 1,
    strength = 0.8,
    seed,
    style = 'photographic'
  } = params

  // Get the model
  const model = await prisma.aIModel.findFirst({
    where: { id: modelId }
  })

  if (!model || !model.modelUrl) {
    throw new Error('Model not found or not ready')
  }

  // Get AI provider
  const aiProvider = getAIProvider()

  // Parse resolution
  const [width, height] = resolution.split('x').map(Number)

  // Calculate optimal parameters (aligned with normal generations)
  const megapixels = (width * height) / (1024 * 1024)

  // Use same calculation logic as normal generations
  const optimalSteps = calculateOptimalSteps('STARTER', megapixels, 'custom') // Default to STARTER quality for packages
  const optimalGuidance = calculateOptimalGuidance('STARTER', megapixels)

  // Build generation request with same parameters as normal generations
  const generationRequest: GenerationRequest = {
    modelUrl: model.modelUrl,
    prompt,
    negativePrompt,
    triggerWord: model.triggerWord || undefined,
    classWord: model.classWord || undefined, // CRÍTICO: passar classWord para construção do prompt
    params: {
      width,
      height,
      steps: optimalSteps,
      guidance_scale: optimalGuidance,
      num_outputs: variations,
      seed: seed || Math.floor(Math.random() * 1000000),
      // FLUX-specific parameters (same as normal generations)
      safety_tolerance: 2,
      raw_mode: false,
      output_format: 'png',
      output_quality: 95
    },
    webhookUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/generation`
  }

  console.log(`🚀 Starting package generation for model ${model.name}...`)
  console.log('📋 Generation request details:', {
    modelUrl: generationRequest.modelUrl,
    prompt: generationRequest.prompt.substring(0, 100) + '...',
    params: generationRequest.params,
    webhookUrl: generationRequest.webhookUrl
  })

  const generationResponse = await aiProvider.generateImage(generationRequest)

  console.log(`✅ Package generation started with job ID: ${generationResponse.id}`)
  console.log('🔗 Replicate response:', generationResponse)

  // Update generation with job ID and status (same as normal generations)
  await prisma.generation.update({
    where: { id: generationId },
    data: {
      jobId: String(generationResponse.id),
      status: 'PROCESSING'
    }
  })

  return generationResponse
}

// Helper functions (copied from /api/generations/route.ts to maintain consistency)
function calculateOptimalSteps(userPlan: string, megapixels: number, modelType: 'custom' | 'base'): number {
  // Base steps by plan for quality (same as normal generations)
  const planSteps = {
    'STARTER': 40,  // Same as normal generations
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
  // Base guidance by plan (same as normal generations)
  const planGuidance = {
    'STARTER': 4.0,
    'PREMIUM': 4.0,
    'GOLD': 4.5
  }

  let baseGuidance = planGuidance[userPlan as keyof typeof planGuidance] || 4.0

  // Slightly increase guidance for higher resolutions
  if (megapixels > 1.5) {
    baseGuidance = Math.min(baseGuidance + 0.5, 5.0)
  }

  return baseGuidance
}