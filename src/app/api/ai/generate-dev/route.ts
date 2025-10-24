import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAIProvider } from '@/lib/ai'
import { RateLimiter } from '@/lib/security/rate-limiter'
// import { requirePlan } from '@/lib/auth/plans' // Removed for dev simplicity

// Development version of generation API without webhooks
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 DEV Generation API called - webhooks disabled')
    
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting check
    const rateLimitResult = await RateLimiter.checkLimit(
      session.user.id, 
      'generation', 
      session.user.plan || 'FREE'
    )

    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime
      }, { status: 429 })
    }

    const body = await request.json()
    const { modelId, prompt, negativePrompt, ...settings } = body

    if (!modelId || !prompt) {
      return NextResponse.json({ 
        error: 'Model ID and prompt are required' 
      }, { status: 400 })
    }

    // Get model
    const model = await prisma.aIModel.findUnique({
      where: { id: modelId },
      select: {
        id: true,
        name: true,
        modelUrl: true,
        userId: true,
        status: true,
        type: true
      }
    })

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 })
    }

    // Check model access
    if (model.userId !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (model.status !== 'COMPLETED') {
      return NextResponse.json({ 
        error: 'Model not ready for generation',
        status: model.status
      }, { status: 400 })
    }

    // Plan requirement check - removed for dev simplicity
    // if (!requirePlan(session.user.plan, 'generation')) {
    //   return NextResponse.json({
    //     error: 'Premium plan required for AI generation',
    //     userPlan: session.user.plan,
    //     requiredPlan: 'PREMIUM'
    //   }, { status: 403 })
    // }

    // Basic parameter validation and defaults
    const finalParams = {
      width: settings.width || 1024,
      height: settings.height || 1024,
      steps: Math.min(settings.steps || 20, 50),
      guidance_scale: settings.guidance_scale || 7.5,
      seed: settings.seed || Math.floor(Math.random() * 1000000),
      num_outputs: 1,
      safety_tolerance: settings.safety_tolerance || 2,
      raw_mode: settings.raw_mode ?? false,
      output_format: settings.output_format || 'jpg',
      output_quality: Math.min(settings.output_quality || 95, 100)
    }

    console.log('🎨 DEV Generation parameters:', {
      model: model.name,
      prompt: prompt.substring(0, 50) + '...',
      params: finalParams
    })

    // Get current AI provider name
    const currentProvider = process.env.AI_PROVIDER || 'replicate'

    // Create generation record
    const generation = await prisma.generation.create({
      data: {
        userId: session.user.id,
        modelId: model.id,
        prompt,
        negativePrompt: negativePrompt || null,
        status: 'PROCESSING',
        aspectRatio: settings.aspectRatio || '1:1',
        resolution: `${finalParams.width}x${finalParams.height}`,
        variations: finalParams.num_outputs,
        seed: finalParams.seed,
        aiProvider: currentProvider,
        metadata: {
          provider: currentProvider,
          timestamp: new Date().toISOString(),
          source: 'api-generate-dev'
        }
      }
    })

    console.log('📝 Created generation record:', generation.id)

    // Prepare generation request (NO WEBHOOK!)
    const generationRequest = {
      modelUrl: model.modelUrl || undefined,
      prompt: prompt.trim(),
      negativePrompt: negativePrompt?.trim(),
      params: finalParams,
      webhookUrl: undefined // EXPLICITLY NO WEBHOOK!
    }

    console.log('🚀 Starting generation WITHOUT webhook...')

    // Start generation
    const aiProvider = getAIProvider()
    const generationResponse = await aiProvider.generateImage(generationRequest)

    console.log('✅ Generation started:', {
      id: generationResponse.id,
      status: generationResponse.status,
      metadata: generationResponse.metadata
    })

    // Detect actual provider if using hybrid
    let actualProvider = currentProvider
    if (currentProvider === 'hybrid' && generationResponse.metadata?.actualProvider) {
      actualProvider = generationResponse.metadata.actualProvider
      console.log(`🎯 Hybrid routing detected actual provider: ${actualProvider}`)
    }

    // Update generation with job ID and actual provider
    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        jobId: generationResponse.id,
        aiProvider: actualProvider, // Use actual provider, not hybrid
        status: generationResponse.status === 'starting' ? 'PROCESSING' : generationResponse.status,
        metadata: {
          provider: actualProvider,
          originalProvider: currentProvider,
          hybridRouting: generationResponse.metadata?.hybridRouting,
          timestamp: new Date().toISOString(),
          source: 'api-generate-dev'
        }
      }
    })

    // Record the generation attempt
    await RateLimiter.recordAttempt(session.user.id, 'generation', {
      modelId: model.id,
      generationId: generation.id,
      jobId: generationResponse.id,
      credits: 1
    })

    return NextResponse.json({
      success: true,
      generation: {
        id: generation.id,
        jobId: generationResponse.id,
        status: generationResponse.status,
        prompt: generation.prompt,
        model: model.name,
        estimatedTime: generationResponse.estimatedTime || 30000
      },
      message: 'DEV: Generation started without webhook - use polling to check status'
    })

  } catch (error) {
    console.error('❌ DEV Generation error:', error)
    
    return NextResponse.json({
      error: 'Generation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      type: 'dev_generation_error'
    }, { status: 500 })
  }
}