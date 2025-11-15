import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { CreditManager } from '@/lib/credits/manager'
import { Plan } from '@prisma/client'
import { scanPackagesDirectory } from '@/lib/packages/scanner'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: packageId } = await params
    const userId = session.user.id

    // Get modelId and aspectRatio from request body
    const body = await request.json()
    const { modelId, aspectRatio } = body

    console.log('🔍 Package activation request:', { packageId, userId, modelId, aspectRatio })

    // Validate required parameters
    if (!modelId || !aspectRatio) {
      return NextResponse.json({
        error: 'Missing required parameters: modelId and aspectRatio are required'
      }, { status: 400 })
    }

    // Validate model exists and belongs to user
    const model = await prisma.aIModel.findFirst({
      where: {
        id: modelId,
        userId: userId,
        status: 'READY'
      }
    })

    if (!model) {
      return NextResponse.json({
        error: 'Model not found or not ready. Please select a trained model.'
      }, { status: 404 })
    }

    // Get package metadata (prefer DB, fallback filesystem)
    let requiredCredits: number | null = null
    try {
      const dbPackage = await prisma.photoPackage.findUnique({ where: { id: packageId } })
      if (dbPackage) {
        requiredCredits = dbPackage.price || 0
      }
    } catch (err) {
      console.warn('⚠️ Failed to read package from DB, will try filesystem:', err)
    }

    if (requiredCredits === null) {
      const fsPackages = scanPackagesDirectory()
      const fsMeta = fsPackages.find(p => p.id === packageId)
      if (!fsMeta) {
        console.error('❌ Package metadata not found in DB nor filesystem:', packageId)
        return NextResponse.json({ error: 'Package not found' }, { status: 404 })
      }
      requiredCredits = fsMeta.price
    }

    // Validate package exists and is active
    const photoPackage = await prisma.photoPackage.findUnique({
      where: { id: packageId }
    })

    console.log('📦 Package lookup result:', photoPackage ? 'Found' : 'Not found', { id: packageId, price: requiredCredits })

    if (!photoPackage) {
      console.error('❌ Package not found in database:', packageId)
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    if (!photoPackage.isActive) {
      return NextResponse.json({ error: 'Package is not active' }, { status: 400 })
    }

    // Calculate total images from package prompts
    const packagePrompts = photoPackage.prompts as Array<{ text: string; style?: string; description?: string }> | null
    const totalImages = Array.isArray(packagePrompts) ? packagePrompts.length : 0

    // Validate package has at least one prompt
    if (totalImages === 0) {
      return NextResponse.json({
        error: 'Package has no prompts configured. Cannot activate package without prompts.'
      }, { status: 400 })
    }

    // Validate user has enough credits
    const userPlan = ((session.user as any).plan || 'STARTER') as Plan
    const affordability = await CreditManager.canUserAfford(userId, requiredCredits, userPlan)

    if (!affordability.canAfford) {
      return NextResponse.json({
        error: affordability.reason || `Insufficient credits. You need ${requiredCredits} credits to activate this package.`
      }, { status: 402 })
    }

    // Check if user already has an active package for this packageId
    const existingUserPackage = await prisma.userPackage.findFirst({
      where: {
        userId,
        packageId,
        status: {
          in: ['ACTIVE', 'GENERATING'] // Check for active or generating packages
        }
      },
      include: {
        package: true
      }
    })

    if (existingUserPackage) {
      // Check how many generations are actually being processed for this package
      const activeGenerations = await prisma.generation.count({
        where: {
          userId,
          packageId: existingUserPackage.id,
          status: {
            in: ['PENDING', 'PROCESSING']
          }
        }
      })

      const completedGenerations = await prisma.generation.count({
        where: {
          userId,
          packageId: existingUserPackage.id,
          status: 'COMPLETED'
        }
      })

      const failedGenerations = await prisma.generation.count({
        where: {
          userId,
          packageId: existingUserPackage.id,
          status: 'FAILED'
        }
      })

      console.log('📊 Existing package status:', {
        userPackageId: existingUserPackage.id,
        status: existingUserPackage.status,
        totalImages: existingUserPackage.totalImages,
        generatedImages: existingUserPackage.generatedImages,
        activeGenerations,
        completedGenerations,
        failedGenerations
      })

      // User already has an active package
      if (existingUserPackage.status === 'GENERATING') {
        return NextResponse.json({
          error: 'Este pacote já está sendo processado. Aguarde a conclusão da geração anterior.',
          existingPackage: {
            id: existingUserPackage.id,
            status: existingUserPackage.status,
            generatedImages: existingUserPackage.generatedImages,
            totalImages: existingUserPackage.totalImages,
            progress: {
              active: activeGenerations,
              completed: completedGenerations,
              failed: failedGenerations,
              percentage: Math.round((completedGenerations / existingUserPackage.totalImages) * 100)
            }
          }
        }, { status: 409 }) // 409 Conflict
      } else if (existingUserPackage.status === 'ACTIVE') {
        // If status is ACTIVE but no generations are processing, it might be stuck
        if (activeGenerations === 0 && completedGenerations === 0) {
          console.warn('⚠️ Package is ACTIVE but has no generations. It might be stuck.')
          // Optionally, we could trigger batch generation here, but for now just inform the user
          return NextResponse.json({
            error: 'Este pacote está ativo mas não há gerações em andamento. Entre em contato com o suporte ou aguarde alguns minutos.',
            existingPackage: {
              id: existingUserPackage.id,
              status: existingUserPackage.status,
              generatedImages: existingUserPackage.generatedImages,
              totalImages: existingUserPackage.totalImages,
              progress: {
                active: activeGenerations,
                completed: completedGenerations,
                failed: failedGenerations
              }
            }
          }, { status: 409 })
        }
        
        return NextResponse.json({
          error: 'Este pacote já está ativo. Você não pode ativar o mesmo pacote múltiplas vezes.',
          existingPackage: {
            id: existingUserPackage.id,
            status: existingUserPackage.status,
            generatedImages: existingUserPackage.generatedImages,
            totalImages: existingUserPackage.totalImages,
            progress: {
              active: activeGenerations,
              completed: completedGenerations,
              failed: failedGenerations,
              percentage: Math.round((completedGenerations / existingUserPackage.totalImages) * 100)
            }
          }
        }, { status: 409 }) // 409 Conflict
      }
    }

    const userPackage = await prisma.userPackage.create({
      data: {
        userId,
        packageId,
        status: 'ACTIVE',
        totalImages: totalImages, // Calculated from prompts.length
        generatedImages: 0,
        failedImages: 0
      },
      include: {
        package: true,
        user: true
      }
    })

    // Deduct credits - optimized to fetch data before transaction, so timeout can be shorter
    const chargeResult = await CreditManager.deductCredits(
      userId,
      requiredCredits,
      'Ativação de pacote de fotos',
      {
        type: 'PHOTO_PACKAGE',
        userPackageId: userPackage.id,
        packageName: photoPackage.name
      },
      undefined,
      { timeout: 15000 } // Reduced to 15s since transaction is now optimized
    )

    if (!chargeResult.success) {
      console.error('❌ Failed to charge credits for package activation:', chargeResult.error)
      await prisma.userPackage.delete({ where: { id: userPackage.id } })
      return NextResponse.json({
        error: chargeResult.error || 'Insufficient credits to activate this package'
      }, { status: 402 })
    }

    // Trigger batch generation (call the batch generation API internally)
    // IMPORTANTE: Esta é uma chamada server-to-server, então não precisa de autenticação de sessão
    // Mas precisamos garantir que a URL está correta
    let baseUrl = process.env.NEXTAUTH_URL
    if (!baseUrl) {
      // Fallback para Vercel URL ou localhost
      if (process.env.VERCEL_URL) {
        baseUrl = `https://${process.env.VERCEL_URL}`
      } else {
        baseUrl = 'http://localhost:3000'
      }
    }
    const batchGenerationUrl = `${baseUrl}/api/packages/generate-batch`
    
    console.log('🚀 Triggering batch generation...', {
      userPackageId: userPackage.id,
      userId,
      packageId,
      modelId,
      aspectRatio,
      url: batchGenerationUrl,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      vercelUrl: process.env.VERCEL_URL,
      baseUrl
    })

    try {
      console.log('📤 Sending batch generation request to:', batchGenerationUrl)
      const requestBody = {
        userPackageId: userPackage.id,
        userId,
        packageId,
        modelId,
        aspectRatio
      }
      console.log('📤 Request body:', requestBody)
      
      const batchResponse = await fetch(batchGenerationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add internal request header to identify server-to-server calls
          'X-Internal-Request': 'true'
        },
        body: JSON.stringify(requestBody)
      })

      console.log('📡 Batch generation response status:', batchResponse.status)
      console.log('📡 Batch generation response headers:', Object.fromEntries(batchResponse.headers.entries()))

      if (!batchResponse.ok) {
        const errorText = await batchResponse.text()
        console.error('❌ Failed to trigger batch generation:', {
          status: batchResponse.status,
          statusText: batchResponse.statusText,
          error: errorText
        })
        // Update package status to FAILED
        await prisma.userPackage.update({
          where: { id: userPackage.id },
          data: {
            status: 'FAILED',
            errorMessage: `Failed to start image generation: ${errorText.substring(0, 200)}`
          }
        })
        // Return error to user
        return NextResponse.json({
          success: false,
          error: 'Falha ao iniciar geração de imagens. Verifique os logs para mais detalhes.',
          details: errorText.substring(0, 200)
        }, { status: 500 })
      } else {
        const batchResult = await batchResponse.json()
        console.log('✅ Batch generation triggered successfully:', {
          success: batchResult.success,
          generationsCreated: batchResult.generationsCreated,
          totalImagesExpected: batchResult.totalImagesExpected
        })
        
        // Update package status to GENERATING
        await prisma.userPackage.update({
          where: { id: userPackage.id },
          data: {
            status: 'GENERATING'
          }
        })
      }
    } catch (error) {
      console.error('💥 Error triggering batch generation:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      await prisma.userPackage.update({
        where: { id: userPackage.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Failed to start image generation'
        }
      })
      // Return error to user
      return NextResponse.json({
        success: false,
        error: 'Erro ao iniciar geração de imagens. Tente novamente.',
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Package activated successfully! Generation started.',
      userPackage: {
        id: userPackage.id,
        status: userPackage.status,
        totalImages: userPackage.totalImages,
        generatedImages: userPackage.generatedImages,
        packageName: userPackage.package.name
      }
    })

  } catch (error) {
    console.error('Package activation error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}