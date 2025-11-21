import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { VideoGenerationRequest } from '@/lib/ai/video/config'
import { validatePrompt } from '@/lib/ai/video/utils'
import Replicate from 'replicate'
import { CreditManager } from '@/lib/credits/manager'
import { getVideoGenerationCost } from '@/lib/credits/pricing'
import { Plan } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    console.log('🎬 [VIDEO-API] Received video generation request')
    console.log('🎬 [VIDEO-API] Request headers:', Object.fromEntries(request.headers.entries()))

    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      console.log('❌ [VIDEO-API] Unauthorized request')
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        plan: true,
        creditsUsed: true,
        creditsLimit: true
      }
    })

    if (!user) {
      console.log('❌ [VIDEO-API] User not found')
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }


    const body: VideoGenerationRequest = await request.json()
    console.log('📝 [VIDEO-API] Request data:', body)

    // Validate prompt
    const promptValidation = validatePrompt(body.prompt)
    if (!promptValidation.isValid) {
      console.log('❌ [VIDEO-API] Invalid prompt:', promptValidation.reason)
      return NextResponse.json({
        error: 'Prompt inválido',
        details: promptValidation.reason
      }, { status: 400 })
    }

    const duration = body.duration || 5
    const creditsNeeded = getVideoGenerationCost(duration)
    const userPlan = (user.plan || 'STARTER') as Plan
    const affordability = await CreditManager.canUserAfford(user.id, creditsNeeded, userPlan)

    if (!affordability.canAfford) {
      console.log('❌ [VIDEO-API] Insufficient credits:', { required: creditsNeeded, plan: userPlan, reason: affordability.reason })
      return NextResponse.json({
        error: affordability.reason || `Créditos insuficientes. Necessário: ${creditsNeeded}`
      }, { status: 402 })
    }

    // Create video generation record in the correct table
    const videoGeneration = await prisma.videoGeneration.create({
      data: {
        userId: user.id,
        prompt: body.prompt,
        negativePrompt: body.negativePrompt || '',
        duration: body.duration || 5,
        aspectRatio: body.aspectRatio || '16:9',
        quality: body.quality === 'pro' ? 'pro' : 'standard',
        sourceImageUrl: body.sourceImageUrl,
        status: 'STARTING'
      }
    })

    console.log('✅ [VIDEO-API] Video generation created:', videoGeneration.id)

    // Initialize Replicate client
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    })

    let chargeResult: Awaited<ReturnType<typeof CreditManager.deductCredits>> | null = null

    try {
      // Prepare input for Kling v2.1 (based on official schema)
      const input: any = {
        prompt: body.prompt, // required
        duration: body.duration || 5, // optional, default 5
        aspect_ratio: body.aspectRatio || '16:9' // optional, default "16:9"
      }

      // Add negative prompt if provided
      if (body.negativePrompt && body.negativePrompt.trim()) {
        input.negative_prompt = body.negativePrompt
      }

      // Add source image for image-to-video if provided
      if (body.sourceImageUrl) {
        input.start_image = body.sourceImageUrl
      }

      console.log('🎬 [VIDEO-API] Sending to Kling v2.1 via Replicate:', input)

      // 🔒 CRITICAL: Use dedicated video webhook endpoint, NOT the unified replicate webhook
      // The unified webhook SKIPS video processing to avoid duplication
      // Videos MUST use /api/webhooks/video endpoint which has proper idempotency and storage handling
      const webhookUrl = process.env.NEXTAUTH_URL?.startsWith('https://')
        ? `${process.env.NEXTAUTH_URL}/api/webhooks/video?videoId=${videoGeneration.id}`
        : undefined
      console.log('📞 [VIDEO-API] Webhook URL configured:', webhookUrl)
      console.log('🔍 [VIDEO-API] Using dedicated video webhook endpoint (not unified replicate webhook)')

      const prediction = await replicate.predictions.create({
        model: "kwaivgi/kling-v2.1-master",
        input,
        ...(webhookUrl && { webhook: webhookUrl })
      })

      console.log('✅ [VIDEO-API] Kling v2.1 prediction created:', prediction.id)

      // 🔒 CRITICAL: Save jobId (prediction.id) to database BEFORE webhook arrives
      // This allows the webhook to find the video generation record by jobId
      await prisma.videoGeneration.update({
        where: { id: videoGeneration.id },
        data: {
          jobId: prediction.id, // 🔒 CRITICAL: Save jobId so webhook can find this record
          status: 'PROCESSING',
          processingStartedAt: new Date()
        }
      })
      console.log('✅ [VIDEO-API] jobId saved to database:', prediction.id)

      chargeResult = await CreditManager.deductCredits(
        user.id,
        creditsNeeded,
        'Geração de vídeo',
        {
          type: 'VIDEO_GENERATION',
          videoId: videoGeneration.id,
          duration,
          resolution: body.aspectRatio
        }
      )

      if (!chargeResult.success) {
        console.error('❌ [VIDEO-API] Credit charge failed:', chargeResult.error)
        await prisma.videoGeneration.update({
          where: { id: videoGeneration.id },
          data: {
            status: 'FAILED',
            errorMessage: chargeResult.error || 'Falha ao debitar créditos'
          }
        })

        return NextResponse.json({
          error: chargeResult.error || 'Créditos insuficientes'
        }, { status: 402 })
      }

      await prisma.usageLog.create({
        data: {
          userId: user.id,
          action: 'video_generation',
          details: {
            videoGenerationId: videoGeneration.id,
            duration,
            aspectRatio: body.aspectRatio
          },
          creditsUsed: creditsNeeded
        }
      })

      // For development (no webhook), start polling manually
      if (!webhookUrl) {
        console.log('🔄 [VIDEO-API] Starting polling for development mode')
        setTimeout(async () => {
          try {
            const { startPolling } = await import('@/lib/services/polling-service')
            await startPolling(prediction.id, videoGeneration.id, user.id, 'replicate', 'video')
            console.log('✅ [VIDEO-API] Polling started for video generation')
          } catch (error) {
            console.error('❌ [VIDEO-API] Failed to start polling:', error)
          }
        }, 1000)
      }

    } catch (replicateError) {
      console.error('❌ [VIDEO-API] Kling v2.1 error:', replicateError)

      // Update video generation status to failed
      await prisma.videoGeneration.update({
        where: { id: videoGeneration.id },
        data: {
          status: 'FAILED',
          errorMessage: replicateError instanceof Error ? replicateError.message : 'Unknown Replicate error'
        }
      })

      return NextResponse.json({
        error: 'Falha na geração de vídeo',
        details: replicateError instanceof Error ? replicateError.message : 'Unknown error'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      videoGenerationId: videoGeneration.id,
      creditsUsed: creditsNeeded,
      remainingCredits: chargeResult?.user
        ? (chargeResult.user.creditsLimit - chargeResult.user.creditsUsed + chargeResult.user.creditsBalance)
        : undefined,
      estimatedTime: body.duration === 5 ? '5 minutos' : '8 minutos'
    })

  } catch (error) {
    console.error('❌ [VIDEO-API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}