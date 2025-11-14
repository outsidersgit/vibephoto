import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updateUserCredits } from '@/lib/db/users'
import { generateImage } from '@/lib/ai/generation'

interface BatchGenerationRequest {
  userPackageId: string
  userId: string
  packageId: string
  modelId: string
  aspectRatio: string
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Batch generation API called')
    const body: BatchGenerationRequest = await request.json()
    const { userPackageId, userId, packageId, modelId, aspectRatio } = body

    console.log('📥 Batch generation request:', { userPackageId, userId, packageId, modelId, aspectRatio })

    // Validate request
    if (!userPackageId || !userId || !packageId || !modelId || !aspectRatio) {
      console.error('❌ Missing required fields')
      return NextResponse.json({
        error: 'Missing required fields: userPackageId, userId, packageId, modelId, aspectRatio'
      }, { status: 400 })
    }

    // Get UserPackage and PhotoPackage data
    const userPackage = await prisma.userPackage.findUnique({
      where: { id: userPackageId },
      include: {
        package: true,
        user: true
      }
    })

    if (!userPackage) {
      return NextResponse.json({ error: 'UserPackage not found' }, { status: 404 })
    }

    // Get the selected model with trigger word and class word
    const aiModel = await prisma.aIModel.findFirst({
      where: {
        id: modelId,
        userId: userId,
        status: 'READY'
      }
    })

    if (!aiModel) {
      await prisma.userPackage.update({
        where: { id: userPackageId },
        data: {
          status: 'FAILED',
          errorMessage: 'Selected model not found or not ready.'
        }
      })
      return NextResponse.json({
        error: 'Selected model not found or not ready.'
      }, { status: 404 })
    }

    console.log('🎯 Using model:', {
      id: aiModel.id,
      name: aiModel.name,
      triggerWord: aiModel.triggerWord,
      classWord: aiModel.classWord,
      modelUrl: aiModel.modelUrl
    })
    const packagePrompts = userPackage.package.prompts as Array<{
      text: string
      style?: string
      description?: string
    }>

    if (!packagePrompts || packagePrompts.length === 0) {
      await prisma.userPackage.update({
        where: { id: userPackageId },
        data: {
          status: 'FAILED',
          errorMessage: 'Package has no prompts configured'
        }
      })
      return NextResponse.json({
        error: 'Package has no prompts configured'
      }, { status: 400 })
    }

    // Update status to GENERATING
    await prisma.userPackage.update({
      where: { id: userPackageId },
      data: { status: 'GENERATING' }
    })

    // NOTE: Credits are already deducted in /api/packages/[id]/activate
    // based on package price (200-400 credits depending on package)
    // NO need to deduct again here

    // Map aspect ratio to resolution
    const resolutionMap: Record<string, string> = {
      '1:1': '1024x1024',
      '4:5': '832x1024',
      '16:9': '1024x576',
      '9:16': '576x1024'
    }
    const resolution = resolutionMap[aspectRatio] || '1024x1024'

    // Build prompt prefix with token and className
    // ARQUITETURA CORRETA:
    // - token: sempre "ohwx" (fixo no backend)
    // - className: vem do AIModel.classWord (obrigatório)
    // Format: {token} {className}, {base_prompt}
    const token = 'ohwx' // ✅ Token fixo
    const className = aiModel.classWord // ✅ Obrigatório do modelo

    // Validação: className é obrigatório
    if (!className) {
      throw new Error(`ClassName is required for model ${aiModel.name}. Model data is incomplete.`)
    }

    const promptPrefix = `${token} ${className},`

    console.log('🎯 Prompt injection:', {
      token, // Sempre 'ohwx'
      className, // Do modelo
      promptPrefix,
      aspectRatio,
      resolution
    })

    // Cada prompt do pacote gera 1 foto (variations: 1)
    // Total de fotos = número de prompts do pacote
    const generations = []

    for (let promptIndex = 0; promptIndex < packagePrompts.length; promptIndex++) {
      const promptData = packagePrompts[promptIndex]

      // Inject token and className into prompt
      const fullPrompt = `${promptPrefix} ${promptData.text}`

      console.log(`📝 Prompt ${promptIndex + 1}/20:`, {
        original: promptData.text,
        withTokenAndClass: fullPrompt
      })

      try {
        // Create Generation record (one per prompt, with 1 output)
        const generation = await prisma.generation.create({
          data: {
            userId,
            modelId: aiModel.id,
            prompt: fullPrompt,
            negativePrompt: 'low quality, blurry, distorted, bad anatomy',
            aspectRatio,
            resolution,
            variations: 1, // 1 output per generation for maximum variety
            strength: 0.8,
            style: promptData.style || 'photographic',
            status: 'PENDING',
            // Package-specific fields
            packageId: userPackageId,
            packagePromptIndex: promptIndex,
            packageVariationIndex: 0,
            operationType: 'generation',
            storageContext: 'generated',
            metadata: {
              source: 'package',
              packageId: userPackage.packageId,
              packageName: userPackage.package?.name,
              packagePromptIndex: promptIndex,
              aspectRatio
            }
          }
        })

        generations.push(generation)

        // Start generation asynchronously (don't await to allow parallel processing)
        console.log(`🎨 Starting generation ${promptIndex + 1}/${packagePrompts.length} for prompt: "${fullPrompt.substring(0, 100)}..."`)
        generateImage({
          modelId: aiModel.id,
          prompt: fullPrompt,
          negativePrompt: 'low quality, blurry, distorted, bad anatomy',
          aspectRatio,
          resolution,
          variations: 1, // 1 output per prompt
          strength: 0.8,
          style: promptData.style || 'photographic'
        }, generation.id).then(result => {
          console.log(`✅ Generation ${promptIndex + 1} started successfully:`, result.id)
        }).catch(error => {
          console.error(`❌ Failed to generate image for generation ${generation.id}:`, error)
          // Update generation status to failed
          prisma.generation.update({
            where: { id: generation.id },
            data: {
              status: 'FAILED',
              errorMessage: error.message || 'Generation failed'
            }
          }).catch(updateError => {
            console.error('Failed to update generation status:', updateError)
          })
        })

      } catch (error) {
        console.error(`Failed to create generation for prompt ${promptIndex}:`, error)

        // Update failed images count (increment by 1 since each prompt generates 1 image)
        await prisma.userPackage.update({
          where: { id: userPackageId },
          data: {
            failedImages: {
              increment: 1
            }
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Started generation of ${generations.length} prompts with 1 output each (${generations.length} total images)`,
      userPackageId,
      generationsCreated: generations.length,
      totalImagesExpected: userPackage.totalImages, // Use totalImages from UserPackage
      generations: generations.map(g => ({
        id: g.id,
        promptIndex: g.packagePromptIndex,
        variations: g.variations,
        status: g.status
      }))
    })

  } catch (error) {
    console.error('Batch generation error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}