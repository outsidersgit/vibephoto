import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canUserUseCredits } from '@/lib/db/users'
import { recordPhotoPackagePurchase } from '@/lib/services/credit-transaction-service'
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

    // Get package metadata to know the price
    const packages = scanPackagesDirectory()
    const packageMetadata = packages.find(p => p.id === packageId)

    if (!packageMetadata) {
      console.error('❌ Package metadata not found:', packageId)
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    const requiredCredits = packageMetadata.price

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

    // Check if user already activated this package
    const existingUserPackage = await prisma.userPackage.findUnique({
      where: {
        userId_packageId: {
          userId,
          packageId
        }
      }
    })

    if (existingUserPackage) {
      return NextResponse.json({
        error: 'Package already activated',
        userPackage: existingUserPackage
      }, { status: 400 })
    }

    // Validate user has enough credits
    const canUse = await canUserUseCredits(userId, requiredCredits)

    if (!canUse) {
      return NextResponse.json({
        error: `Insufficient credits. You need ${requiredCredits} credits to activate this package.`
      }, { status: 400 })
    }

    // Create UserPackage record and credit transaction
    const userPackage = await prisma.userPackage.create({
      data: {
        userId,
        packageId,
        status: 'ACTIVE',
        totalImages: 20,
        generatedImages: 0,
        failedImages: 0
      },
      include: {
        package: true,
        user: true
      }
    })

    // Register credit transaction for package purchase
    try {
      await recordPhotoPackagePurchase(
        userId,
        userPackage.id,
        requiredCredits,
        { packageName: packageMetadata.name }
      )
      console.log('✅ Credit transaction recorded for package activation')
    } catch (error) {
      console.error('❌ Failed to record credit transaction:', error)
      // Continue even if transaction recording fails
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