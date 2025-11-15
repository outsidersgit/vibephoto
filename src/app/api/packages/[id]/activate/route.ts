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
      { timeout: 20000 }
    )

    if (!chargeResult.success) {
      console.error('❌ Failed to charge credits for package activation:', chargeResult.error)
      await prisma.userPackage.delete({ where: { id: userPackage.id } })
      return NextResponse.json({
        error: chargeResult.error || 'Insufficient credits to activate this package'
      }, { status: 402 })
    }

    // Trigger batch generation (call the batch generation API)
    console.log('🚀 Triggering batch generation...', {
      userPackageId: userPackage.id,
      userId,
      packageId,
      modelId,
      aspectRatio,
      url: `${process.env.NEXTAUTH_URL}/api/packages/generate-batch`
    })

    try {
      const batchResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/packages/generate-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userPackageId: userPackage.id,
          userId,
          packageId,
          modelId,
          aspectRatio
        })
      })

      console.log('📡 Batch generation response status:', batchResponse.status)

      if (!batchResponse.ok) {
        const errorText = await batchResponse.text()
        console.error('❌ Failed to trigger batch generation:', errorText)
        // Don't fail the activation, just log the error
        await prisma.userPackage.update({
          where: { id: userPackage.id },
          data: {
            status: 'FAILED',
            errorMessage: 'Failed to start image generation'
          }
        })
      } else {
        const batchResult = await batchResponse.json()
        console.log('✅ Batch generation triggered successfully:', batchResult)
      }
    } catch (error) {
      console.error('💥 Error triggering batch generation:', error)
      await prisma.userPackage.update({
        where: { id: userPackage.id },
        data: {
          status: 'FAILED',
          errorMessage: 'Failed to start image generation'
        }
      })
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