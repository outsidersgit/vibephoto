import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { VideoGenerationRequest } from '@/lib/ai/video/config'
import { calculateVideoCredits, validatePrompt } from '@/lib/ai/video/utils'
import Replicate from 'replicate'

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

    // Calculate credits
    const requiredCredits = calculateVideoCredits(body.duration, 'pro')
    const remainingCredits = user.creditsLimit - user.creditsUsed

    if (requiredCredits > remainingCredits) {
      console.log('❌ [VIDEO-API] Insufficient credits:', { required: requiredCredits, remaining: remainingCredits })
      return NextResponse.json({
        error: `Créditos insuficientes. Necessário: ${requiredCredits}, Disponível: ${remainingCredits}`
      }, { status: 400 })
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

    // Update user credits
    await prisma.user.update({
      where: { id: user.id },
      data: {
        creditsUsed: user.creditsUsed + requiredCredits
      }
    })

    console.log('✅ [VIDEO-API] Video generation created:', videoGeneration.id)

    // Initialize Replicate client
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    })

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

      // Call Kling v2.1 model via Replicate
      const webhookUrl = process.env.NEXTAUTH_URL?.startsWith('https://')
        ? `${process.env.NEXTAUTH_URL}/api/webhooks/replicate?type=video&id=${videoGeneration.id}&userId=${user.id}`
        : undefined

      const prediction = await replicate.predictions.create({
        model: "kwaivgi/kling-v2.1-master",
        input,
        ...(webhookUrl && { webhook: webhookUrl })
      })

      console.log('✅ [VIDEO-API] Kling v2.1 prediction created:', prediction.id)

      // Update video generation with prediction ID
      await prisma.videoGeneration.update({
        where: { id: videoGeneration.id },
        data: {
          jobId: prediction.id,
          status: 'PROCESSING'
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

      // Refund credits since generation failed
      await prisma.user.update({
        where: { id: user.id },
        data: {
          creditsUsed: user.creditsUsed - requiredCredits
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
      creditsUsed: requiredCredits,
      remainingCredits: remainingCredits - requiredCredits,
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