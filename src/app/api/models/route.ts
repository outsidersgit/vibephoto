import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getModelsByUserId, canUserCreateModel, createAIModel, updateModelStatus } from '@/lib/db/models'
import { getAIProvider } from '@/lib/ai'
import { getStorageProvider } from '@/lib/storage'
import { AIError } from '@/lib/ai/base'
import { prisma } from '@/lib/db'
import { checkModelCreationEligibility, chargeModelCreationCredits } from '@/lib/services/model-credit-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const models = await getModelsByUserId(session.user.id)
    
    // Filter by status if provided
    const filteredModels = status 
      ? models.filter(model => model.status === status)
      : models

    // Apply pagination
    const paginatedModels = filteredModels.slice(offset, offset + limit)

    return NextResponse.json({
      models: paginatedModels,
      total: filteredModels.length,
      pagination: {
        limit,
        offset,
        hasMore: (offset + limit) < filteredModels.length
      }
    })

  } catch (error: any) {
    console.error('Error fetching models:', error)
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    )
  }
}

// Helper function to save photos using storage provider
async function savePhotosToStorage(photos: any[], category: string, modelId: string): Promise<string[]> {
  console.log(`💾 Saving ${photos.length} ${category} photos for model ${modelId}...`)
  
  const storage = getStorageProvider()
  const savedUrls: string[] = []

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]
    
    console.log(`📤 Uploading ${category} photo ${i + 1}/${photos.length}: ${photo.name}`)
    
    try {
      // Create File object from photo data if needed
      // Note: This assumes photos come as File objects from FormData
      // If they come as base64 or other format, we'd need to convert
      
      const filename = `training/${modelId}/${category}/${category}_${i + 1}_${photo.name}`
      
      const uploadResult = await storage.upload(photo, filename, {
        folder: `training/${modelId}`,
        makePublic: true, // Important: needs to be public for Replicate access
        quality: 90
      })
      
      console.log(`✅ Photo uploaded: ${uploadResult.url}`)
      savedUrls.push(uploadResult.url)
      
    } catch (uploadError) {
      console.error(`❌ Failed to upload ${photo.name}:`, uploadError)
      const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown upload error'
      throw new Error(`Failed to upload photo ${photo.name}: ${errorMessage}`)
    }
  }

  console.log(`✅ All ${category} photos saved successfully`)
  return savedUrls
}

export async function POST(request: NextRequest) {
  console.log('🚀 Starting model creation process...')
  
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      console.log('❌ Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log(`👤 User ${session.user.id} creating model...`)

    // Check if user can create more models (plan limits)
    const canCreate = await canUserCreateModel(session.user.id)
    if (!canCreate) {
      console.log('❌ Model limit reached for user plan')
      return NextResponse.json(
        { error: 'Model limit reached for your plan' },
        { status: 403 }
      )
    }

    // Check credit eligibility for extra models
    console.log('💰 Checking credit eligibility for model creation...')
    const eligibility = await checkModelCreationEligibility(session.user.id)

    if (!eligibility.canCreate) {
      console.log('❌ Insufficient credits for model creation')
      return NextResponse.json(
        {
          error: eligibility.message || 'Insufficient credits for model creation',
          needsCredits: true,
          creditsRequired: eligibility.creditsRequired,
          creditsAvailable: eligibility.creditsAvailable,
          currentModels: eligibility.currentModels
        },
        { status: 402 } // Payment Required
      )
    }

    console.log(`✅ Credit check passed. Free model: ${!eligibility.needsPayment}, Credits required: ${eligibility.creditsRequired}`)

    const formData = await request.formData()
    const name = formData.get('name') as string
    const modelClass = formData.get('class') as string
    
    // Extract photos from FormData
    const facePhotos = formData.getAll('facePhotos') as File[]
    const halfBodyPhotos = formData.getAll('halfBodyPhotos') as File[]
    const fullBodyPhotos = formData.getAll('fullBodyPhotos') as File[]

    console.log(`📋 Model data: name=${name}, class=${modelClass}`)
    console.log(`📸 Photos: face=${facePhotos?.length}, half=${halfBodyPhotos?.length}, full=${fullBodyPhotos?.length}`)

    // Validate required fields
    if (!name || !modelClass || !facePhotos || !halfBodyPhotos || !fullBodyPhotos) {
      console.log('❌ Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate photo counts
    if (facePhotos.length < 5 || facePhotos.length > 10) {
      console.log(`❌ Invalid face photos count: ${facePhotos.length}`)
      return NextResponse.json(
        { error: 'Face photos must be between 5-10 images' },
        { status: 400 }
      )
    }

    if (halfBodyPhotos.length < 5 || halfBodyPhotos.length > 10) {
      console.log(`❌ Invalid half body photos count: ${halfBodyPhotos.length}`)
      return NextResponse.json(
        { error: 'Half body photos must be between 5-10 images' },
        { status: 400 }
      )
    }

    if (fullBodyPhotos.length < 5 || fullBodyPhotos.length > 10) {
      console.log(`❌ Invalid full body photos count: ${fullBodyPhotos.length}`)
      return NextResponse.json(
        { error: 'Full body photos must be between 5-10 images' },
        { status: 400 }
      )
    }

    // Step 1: Convert File objects to serializable format for database
    console.log('📝 Preparing photo metadata for database...')
    const facePhotoData = facePhotos.map((file: File, index: number) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      order: index + 1
    }))
    
    const halfBodyPhotoData = halfBodyPhotos.map((file: File, index: number) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      order: index + 1
    }))
    
    const fullBodyPhotoData = fullBodyPhotos.map((file: File, index: number) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      order: index + 1
    }))

    // Step 2: Create model in database with photo metadata
    console.log('💾 Creating model in database...')
    const model = await createAIModel({
      name,
      class: modelClass as any,
      userId: session.user.id,
      facePhotos: facePhotoData,
      halfBodyPhotos: halfBodyPhotoData,
      fullBodyPhotos: fullBodyPhotoData
    })

    console.log(`✅ Model created in database with ID: ${model.id}`)

    // Step 2.5: Charge credits if needed (for extra models)
    if (eligibility.needsPayment) {
      console.log('💳 Charging credits for extra model...')
      const chargeResult = await chargeModelCreationCredits(session.user.id, model.id, model.name)

      if (!chargeResult.success) {
        console.error('❌ Failed to charge credits, rolling back model creation')
        // Delete the model since we can't charge
        await prisma.aIModel.delete({ where: { id: model.id } })

        return NextResponse.json(
          {
            error: chargeResult.message || 'Failed to charge credits',
            needsCredits: true
          },
          { status: 402 }
        )
      }

      console.log(`✅ Credits charged successfully. New balance: ${chargeResult.newBalance}`)
    } else {
      console.log('🎁 First model is free - no credits charged')
    }

    try {
      // Step 3: Save photos to storage (using File objects)
      console.log('💾 Saving photos to storage...')
      const facePaths = await savePhotosToStorage(facePhotos, 'face', model.id)
      const halfBodyPaths = await savePhotosToStorage(halfBodyPhotos, 'half-body', model.id)
      const fullBodyPaths = await savePhotosToStorage(fullBodyPhotos, 'full-body', model.id)

      console.log(`✅ Photos saved: ${facePaths.length + halfBodyPaths.length + fullBodyPaths.length} files`)

      // Step 3: Prepare training data
      console.log('🔄 Updating model status to PROCESSING...')
      await updateModelStatus(model.id, 'PROCESSING', 10)

      // Step 4: Get AI provider and start training
      console.log('🤖 Getting AI provider...')
      const aiProvider = getAIProvider()

      // Create training request
      const trainingRequest = {
        modelId: model.id,
        modelName: model.name,
        name: model.name,
        class: model.class as any,
        imageUrls: [...facePaths, ...halfBodyPaths, ...fullBodyPaths],
        triggerWord: `${model.name.toLowerCase().replace(/\s+/g, '')}_person`,
        classWord: model.class.toLowerCase(),
        params: {
          steps: 1000,
          resolution: 1024,
          learningRate: 1e-4,
          batchSize: 1,
          seed: Math.floor(Math.random() * 1000000)
        },
        webhookUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/replicate?type=training&modelId=${model.id}&userId=${session.user.id}`
      }

      console.log('🚀 Starting AI training...')
      const trainingResponse = await aiProvider.startTraining(trainingRequest)
      
      console.log(`✅ Training started with ID: ${trainingResponse.id}`)

      // Step 5: Update model with training info and save training ID
      await prisma.aIModel.update({
        where: { id: model.id },
        data: {
          status: 'TRAINING',
          progress: 20,
          trainingConfig: {
            trainingId: trainingResponse.id,
            fluxModel: true,
            startedAt: new Date().toISOString(),
            estimatedTime: trainingResponse.estimatedTime,
            provider: 'replicate'
          }
        }
      })

      console.log('🎉 Model creation process completed successfully!')

      return NextResponse.json({
        success: true,
        message: 'Model creation started successfully',
        modelId: model.id,
        trainingId: trainingResponse.id,
        estimatedTime: trainingResponse.estimatedTime,
        status: 'TRAINING'
      })

    } catch (trainingError: any) {
      console.error('❌ Error during training setup:', trainingError)
      
      // Update model status to failed
      await updateModelStatus(model.id, 'ERROR', 0, trainingError.message)
      
      throw trainingError
    }

  } catch (error: any) {
    console.error('❌ Error creating model:', error)
    
    if (error instanceof AIError) {
      return NextResponse.json(
        { error: `AI Provider Error: ${error.message}` },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create model' },
      { status: 500 }
    )
  }
}