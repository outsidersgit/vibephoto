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

    // Get modelId, aspectRatio, and gender from request body
    const body = await request.json()
    const { modelId, aspectRatio, gender } = body

    console.log('🚀 Package generation request:', { packageId, userId, modelId, aspectRatio, gender })

    // Validate required parameters
    if (!modelId || !aspectRatio) {
      return NextResponse.json({
        error: 'Missing required parameters: modelId and aspectRatio are required'
      }, { status: 400 })
    }

    // Validate gender
    if (!gender || !['MALE', 'FEMALE'].includes(gender)) {
      return NextResponse.json({
        error: 'Invalid gender. Must be MALE or FEMALE'
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

    // Calculate total images from package prompts based on selected gender
    const genderField = gender === 'MALE' ? 'promptsMale' : 'promptsFemale'
    let packagePrompts = photoPackage[genderField] as Array<{ text: string; style?: string; description?: string }> | null

    // Fallback to legacy prompts field if gender-specific prompts don't exist
    if (!packagePrompts || !Array.isArray(packagePrompts) || packagePrompts.length === 0) {
      console.log(`⚠️ No ${genderField} prompts found, falling back to legacy prompts field`)
      packagePrompts = photoPackage.prompts as Array<{ text: string; style?: string; description?: string }> | null
    }

    const totalImages = Array.isArray(packagePrompts) ? packagePrompts.length : 0

    // Validate package has at least one prompt
    if (totalImages === 0) {
      return NextResponse.json({
        error: `Package has no prompts configured for ${gender === 'MALE' ? 'male' : 'female'} gender. Cannot generate package without prompts.`
      }, { status: 400 })
    }

    console.log(`📋 Using ${totalImages} prompts from ${genderField} for generation`)

    // Validate user has enough credits
    const userPlan = ((session.user as any).plan || 'STARTER') as Plan
    const affordability = await CreditManager.canUserAfford(userId, requiredCredits, userPlan)

    if (!affordability.canAfford) {
      return NextResponse.json({
        error: affordability.reason || `Insufficient credits. You need ${requiredCredits} credits to generate this package.`
      }, { status: 402 })
    }

    // SIMPLIFIED: Always create a new UserPackage (no checking for existing ones)
    console.log('📦 Creating new UserPackage...', { userId, packageId, totalImages })
    
    let userPackage
    try {
      userPackage = await prisma.userPackage.create({
        data: {
          userId,
          packageId,
          status: 'ACTIVE',
          selectedGender: gender, // Store selected gender
          totalImages: totalImages,
          generatedImages: 0,
          failedImages: 0
        },
        include: {
          package: true,
          user: true
        }
      })
      console.log('✅ UserPackage created successfully:', { id: userPackage.id, status: userPackage.status })
    } catch (createError: any) {
      // Handle unique constraint error (P2002)
      if (createError.code === 'P2002') {
        console.error('❌ CRITICAL: Database constraint error:', {
          code: createError.code,
          meta: createError.meta,
          target: createError.meta?.target,
          constraintName: createError.meta?.target?.[0] || 'unknown',
          fullError: JSON.stringify(createError, null, 2)
        })
        
        // Check if it's the userId/packageId constraint
        if (createError.meta?.target?.includes('userId') && createError.meta?.target?.includes('packageId')) {
          console.error('❌ This constraint prevents multiple package generations per user')
          console.error('❌ SOLUTION: Execute this SQL in your database:')
          console.error('   ALTER TABLE "user_packages" DROP CONSTRAINT IF EXISTS "user_packages_userId_packageId_key";')
          console.error('❌ Or check for unique indexes:')
          console.error('   SELECT indexname, indexdef FROM pg_indexes WHERE tablename = \'user_packages\' AND indexdef LIKE \'%UNIQUE%\';')
          
          return NextResponse.json({
            error: 'Database constraint error: The unique constraint on user_packages must be removed to allow multiple package generations.',
            details: 'Please execute this SQL in your database: ALTER TABLE "user_packages" DROP CONSTRAINT IF EXISTS "user_packages_userId_packageId_key";',
            constraintName: createError.meta?.target?.[0] || 'unknown',
            code: 'CONSTRAINT_ERROR',
            migrationFile: 'prisma/migrations/20251119_remove_user_package_unique_constraint/migration.sql'
          }, { status: 500 })
        }
      }
      // Re-throw other errors
      throw createError
    }

    // Deduct credits
    const chargeResult = await CreditManager.deductCredits(
      userId,
      requiredCredits,
      'Geração de pacote de fotos',
      {
        type: 'PHOTO_PACKAGE',
        userPackageId: userPackage.id,
        packageName: photoPackage.name
      },
      undefined,
      { timeout: 15000 }
    )

    if (!chargeResult.success) {
      console.error('❌ Failed to charge credits for package generation:', chargeResult.error)
      // Rollback: delete the UserPackage if credit deduction failed
      await prisma.userPackage.delete({ where: { id: userPackage.id } })
      return NextResponse.json({
        error: chargeResult.error || 'Insufficient credits to generate this package'
      }, { status: 402 })
    }

    // Trigger batch generation (fire-and-forget for instant response)
    let baseUrl = process.env.NEXTAUTH_URL
    if (!baseUrl) {
      if (process.env.VERCEL_URL) {
        baseUrl = `https://${process.env.VERCEL_URL}`
      } else {
        baseUrl = 'http://localhost:3000'
      }
    }
    const batchGenerationUrl = `${baseUrl}/api/packages/generate-batch`

    console.log('🚀 Triggering batch generation (async)...', {
      userPackageId: userPackage.id,
      userId,
      packageId,
      modelId,
      aspectRatio,
      gender,
      url: batchGenerationUrl
    })

    // Update status to GENERATING immediately
    await prisma.userPackage.update({
      where: { id: userPackage.id },
      data: {
        status: 'GENERATING'
      }
    })

    // Fire-and-forget: trigger batch generation without waiting
    // This allows immediate response to user while generation happens in background
    fetch(batchGenerationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Request': 'true'
      },
      body: JSON.stringify({
        userPackageId: userPackage.id,
        userId,
        packageId,
        modelId,
        aspectRatio,
        gender
      })
    }).then(async (batchResponse) => {
      if (!batchResponse.ok) {
        const errorText = await batchResponse.text()
        console.error('❌ Failed to trigger batch generation:', {
          status: batchResponse.status,
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
        return
      }

      const batchResult = await batchResponse.json()
      console.log('✅ Batch generation triggered successfully:', {
        success: batchResult.success,
        generationsCreated: batchResult.generationsCreated,
        totalImagesExpected: batchResult.totalImagesExpected
      })
    }).catch(async (error) => {
      console.error('💥 Error triggering batch generation:', {
        error: error instanceof Error ? error.message : String(error)
      })
      await prisma.userPackage.update({
        where: { id: userPackage.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Failed to start image generation'
        }
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Geração de pacote iniciada com sucesso!',
      userPackage: {
        id: userPackage.id,
        status: userPackage.status,
        totalImages: userPackage.totalImages,
        generatedImages: userPackage.generatedImages,
        packageName: userPackage.package.name
      }
    })

  } catch (error) {
    console.error('Package generation error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}
