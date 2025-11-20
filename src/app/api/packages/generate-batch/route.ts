import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { executeGenerationFlow } from '@/lib/ai/generation-flow'
import { Plan } from '@prisma/client'

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

    // 🔒 CRITICAL: Use prompts EXACTLY as they are in the package
    // Do NOT add "ohwx" or className automatically - the prompts in packages are already complete
    // The AI provider (AstriaProvider) will handle token/triggerWord injection if needed
    
    console.log('🎯 Using package prompts as-is (no automatic token injection):', {
      totalPrompts: packagePrompts.length,
      aspectRatio,
      resolution
    })

    // Get user plan for generation parameters
    const userPlan = ((userPackage.user as any)?.plan || 'STARTER') as Plan

    // Cada prompt do pacote gera 1 foto (variations: 1)
    // Total de fotos = número de prompts do pacote
    // Processamento SEQUENCIAL com delay de 1s entre requisições (evita rate limiting)
    const generations = []

    for (let promptIndex = 0; promptIndex < packagePrompts.length; promptIndex++) {
      const promptData = packagePrompts[promptIndex]

      // Use prompt EXACTLY as it is in the package - no modifications
      const fullPrompt = promptData.text.trim()

      console.log(`📝 Prompt ${promptIndex + 1}/${packagePrompts.length}:`, {
        original: promptData.text,
        withTokenAndClass: fullPrompt
      })

      try {
        // Use executeGenerationFlow - same flow as normal generation
        console.log(`🎨 Starting generation ${promptIndex + 1}/${packagePrompts.length} for prompt: "${fullPrompt.substring(0, 100)}..."`)
        
        const result = await executeGenerationFlow({
          userId,
          modelId: aiModel.id,
          prompt: fullPrompt,
          negativePrompt: 'low quality, blurry, distorted, bad anatomy',
          aspectRatio,
          resolution,
          variations: 1, // 1 output per prompt
          strength: 0.8,
          style: promptData.style || 'photographic',
          userPlan,
          skipCreditDeduction: true, // Credits already deducted in /activate
          packageMetadata: {
            source: 'package',
            userPackageId,
            packageId: userPackage.packageId,
            packageName: userPackage.package?.name || undefined,
            packagePromptIndex: promptIndex
          }
        })

        generations.push(result.generation)
        console.log(`✅ Generation ${promptIndex + 1} started successfully:`, result.generation.id)

        // Delay of 1 second between requests to avoid rate limiting (same as Astria batchGenerate)
        if (promptIndex < packagePrompts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

      } catch (error) {
        console.error(`❌ Failed to create generation for prompt ${promptIndex + 1}/${packagePrompts.length}:`, error)
        console.error(`❌ Error details:`, {
          promptIndex,
          promptText: promptData.text.substring(0, 100),
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        })

        // Update failed images count (increment by 1 since each prompt generates 1 image)
        try {
          await prisma.userPackage.update({
            where: { id: userPackageId },
            data: {
              failedImages: {
                increment: 1
              }
            }
          })
        } catch (updateError) {
          console.error(`❌ Failed to update failedImages count:`, updateError)
        }
      }
    }

    console.log(`✅ Batch generation summary:`, {
      totalPrompts: packagePrompts.length,
      generationsCreated: generations.length,
      expectedImages: userPackage.totalImages,
      successRate: `${Math.round((generations.length / packagePrompts.length) * 100)}%`
    })

    if (generations.length < packagePrompts.length) {
      console.warn(`⚠️ Only ${generations.length} of ${packagePrompts.length} generations were created successfully`)
    }

    return NextResponse.json({
      success: true,
      message: `Started generation of ${generations.length} prompts with 1 output each (${generations.length} total images)`,
      userPackageId,
      generationsCreated: generations.length,
      totalImagesExpected: userPackage.totalImages, // Use totalImages from UserPackage
      totalPrompts: packagePrompts.length,
      generations: generations.map(g => ({
        id: g.id,
        promptIndex: (g.metadata as any)?.packagePromptIndex,
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