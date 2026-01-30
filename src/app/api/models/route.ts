import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getModelsByUserId, canUserCreateModel, createAIModel, updateModelStatus } from '@/lib/db/models'
import { getAIProvider } from '@/lib/ai'
import { getStorageProvider } from '@/lib/storage'
import { AIError } from '@/lib/ai/base'
import { prisma } from '@/lib/db'
import { checkModelCreationEligibility, chargeModelCreationCredits, refundModelCreationCredits } from '@/lib/services/model-credit-service'
import { AstriaProvider } from '@/lib/ai/providers/astria'
import { startTrainingPolling } from '@/lib/services/training-polling-service'
import { broadcastModelStatusChange } from '@/lib/services/realtime-service'

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
      ? models.filter((model: any) => model.status === status)
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

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Uploads diretos não são aceitos aqui. Use presign e envie apenas URLs.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const name = body?.name as string
    const modelClass = body?.class as string
    const facePhotoUrls = (body?.facePhotoUrls || []) as string[]
    const halfBodyPhotoUrls = (body?.halfBodyPhotoUrls || []) as string[]
    const fullBodyPhotoUrls = (body?.fullBodyPhotoUrls || []) as string[]

    console.log(`📋 Model data: name=${name}, class=${modelClass}`)
    console.log(`📸 Photo URLs: face=${facePhotoUrls?.length}, half=${halfBodyPhotoUrls?.length}, full=${fullBodyPhotoUrls?.length}`)

    // Validate required fields
    if (!name || !modelClass || !facePhotoUrls || !halfBodyPhotoUrls || !fullBodyPhotoUrls) {
      console.log('❌ Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate photo counts
    if (facePhotoUrls.length < 4 || facePhotoUrls.length > 8) {
      console.log(`❌ Invalid face photos count: ${facePhotoUrls.length}`)
      return NextResponse.json(
        { error: 'Face photos must be between 4-8 images' },
        { status: 400 }
      )
    }

    if (halfBodyPhotoUrls.length < 2 || halfBodyPhotoUrls.length > 4) {
      console.log(`❌ Invalid half body photos count: ${halfBodyPhotoUrls.length}`)
      return NextResponse.json(
        { error: 'Half body photos must be between 2-4 images' },
        { status: 400 }
      )
    }

    if (fullBodyPhotoUrls.length < 2 || fullBodyPhotoUrls.length > 3) {
      console.log(`❌ Invalid full body photos count: ${fullBodyPhotoUrls.length}`)
      return NextResponse.json(
        { error: 'Full body photos must be between 2-3 images' },
        { status: 400 }
      )
    }

    // Step 1: Build photo metadata from URLs for database
    console.log('📝 Preparing photo metadata for database...')
    const toMeta = (urls: string[]) => urls.map((u: string, index: number) => {
      const name = (() => { try { const p = new URL(u).pathname; return p.split('/').pop() || `photo_${index+1}.jpg` } catch { return `photo_${index+1}.jpg` } })()
      return { name, size: 0, type: 'image/jpeg', order: index + 1 }
    })
    const facePhotoData = toMeta(facePhotoUrls)
    const halfBodyPhotoData = toMeta(halfBodyPhotoUrls)
    const fullBodyPhotoData = toMeta(fullBodyPhotoUrls)

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
    let creditsCharged = false
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
      creditsCharged = true
    } else {
      console.log('🎁 First model is free - no credits charged')
    }

    // Step 4: Get AI provider (antes do try para usar na recuperação)
    console.log('🤖 Getting AI provider...')
    const aiProvider = getAIProvider()
    const runtimeProvider = process.env.AI_PROVIDER || 'replicate'
    const trainingProvider = runtimeProvider === 'hybrid' ? 'astria' : runtimeProvider

    try {
      // Step 3: As fotos já estão no storage; seguimos para processamento
      console.log('💾 Using provided photo URLs from direct uploads...')

      // Step 3.1: Inspect images with Astria /images/inspect API
      console.log('🔍 Starting image inspection...')
      await updateModelStatus(model.id, 'PROCESSING', 5)

      const allImageUrls = [...facePhotoUrls, ...halfBodyPhotoUrls, ...fullBodyPhotoUrls]
      const inspectionResults: any[] = []

      // Map model class to Astria className
      const classNameMapping: Record<string, string> = {
        'MAN': 'man',
        'WOMAN': 'woman',
        'BOY': 'boy',
        'GIRL': 'girl',
        'ANIMAL': 'dog'
      }
      const astriaClassName = classNameMapping[modelClass] || 'man'

      console.log(`🔍 [INSPECT] Inspecting ${allImageUrls.length} images (class: ${astriaClassName})...`)

      // Inspect each image
      for (let i = 0; i < allImageUrls.length; i++) {
        const imageUrl = allImageUrls[i]
        console.log(`🔍 [INSPECT] Image ${i + 1}/${allImageUrls.length}: ${imageUrl.substring(0, 60)}...`)

        try {
          const inspectResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/ai/inspect-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': request.headers.get('Cookie') || ''
            },
            body: JSON.stringify({
              imageUrl,
              className: astriaClassName
            })
          })

          if (inspectResponse.ok) {
            const result = await inspectResponse.json()
            if (result.success && result.data) {
              inspectionResults.push({
                imageUrl,
                index: i,
                ...result.data
              })
              console.log(`✅ [INSPECT] Image ${i + 1} inspected successfully`)
            } else {
              console.warn(`⚠️ [INSPECT] Image ${i + 1} inspection returned unexpected format`)
            }
          } else {
            console.warn(`⚠️ [INSPECT] Image ${i + 1} inspection failed (${inspectResponse.status})`)
          }
        } catch (inspectError) {
          console.error(`❌ [INSPECT] Error inspecting image ${i + 1}:`, inspectError)
          // Continue with other images even if one fails
        }

        // Small delay to avoid rate limiting
        if (i < allImageUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }

      console.log(`📊 [INSPECT] Inspection complete: ${inspectionResults.length}/${allImageUrls.length} images inspected`)

      // Step 3.2: Aggregate characteristics from inspection results
      let aggregatedCharacteristics: Record<string, string> = {}

      if (inspectionResults.length > 0) {
        const { aggregateCharacteristics, extractQualityWarnings, logAggregationSummary } =
          await import('@/lib/ai/characteristics-aggregator')

        aggregatedCharacteristics = aggregateCharacteristics(inspectionResults)
        const qualityWarnings = extractQualityWarnings(inspectionResults)

        logAggregationSummary(inspectionResults, aggregatedCharacteristics, qualityWarnings)
      } else {
        console.warn('⚠️ [INSPECT] No inspection results available - proceeding without characteristics')
      }

      // Step 3.3: Prepare training data
      console.log('🔄 Updating model status to PROCESSING...')
      await updateModelStatus(model.id, 'PROCESSING', 10)

      // Create training request
      // 🔍 CORRETO: Callback de treinamento (TUNE) conforme documentação oficial do Astria
      // Formato: https://seu-dominio/api/webhooks/astria?user_id={USER_ID}
      // NOTA: O Astria NÃO aceita placeholders na URL (retorna 422). O tune_id virá no payload do webhook
      // Usando apenas user_id real na URL, tune_id será extraído do payload do webhook
      const callbackUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/astria?user_id=${session.user.id}`

      // Calculate steps dynamically: 27 steps per photo (no floor, max: 810 for 30 photos)
      const totalPhotos = facePhotoUrls.length + halfBodyPhotoUrls.length + fullBodyPhotoUrls.length
      const calculatedSteps = totalPhotos * 27
      const STEPS_MAX = 810  // 30 photos × 27 (ceiling)
      const finalSteps = Math.min(calculatedSteps, STEPS_MAX)

      console.log(`📊 [TRAIN_STEPS_CALC] Photos: ${totalPhotos}, Calculated: ${calculatedSteps}, Final: ${finalSteps} (max: ${STEPS_MAX})`)

      const trainingRequest = {
        modelId: model.id,
        modelName: model.name,
        name: model.name,
        class: model.class as any,
        imageUrls: allImageUrls,
        triggerWord: `${model.name.toLowerCase().replace(/\s+/g, '')}_person`,
        classWord: model.class.toLowerCase(),
        characteristics: aggregatedCharacteristics, // ADD CHARACTERISTICS HERE
        params: {
          steps: finalSteps,
          resolution: 1024,
          learningRate: 1e-4,
          batchSize: 1,
          seed: Math.floor(Math.random() * 1000000)
        },
        webhookUrl: callbackUrl
      }

      console.log('🚀 Starting AI training...')
      console.log(`🔗 [TRAINING_CALLBACK] Callback URL: ${callbackUrl}`)
      console.log(`📊 [TRAINING_CHARACTERISTICS] Characteristics count: ${Object.keys(aggregatedCharacteristics).length}`)
      const trainingResponse = await aiProvider.startTraining(trainingRequest)
      
      console.log(`✅ Training started with ID: ${trainingResponse.id}`)

      // Step 5: Update model with training info and save training ID + inspection results
      await prisma.aIModel.update({
        where: { id: model.id },
        data: {
          status: 'TRAINING',
          progress: 20,
          trainingJobId: String(trainingResponse.id),
          aiProvider: trainingProvider === 'astria' ? 'astria' : runtimeProvider,
          inspectionResults: inspectionResults.length > 0 ? inspectionResults : undefined, // Save raw inspection data
          characteristics: Object.keys(aggregatedCharacteristics).length > 0 ? aggregatedCharacteristics : undefined, // Save aggregated characteristics
          trainingConfig: {
            trainingId: String(trainingResponse.id),
            fluxModel: true,
            startedAt: new Date().toISOString(),
            estimatedTime: trainingResponse.estimatedTime,
            provider: 'astria',
            inspectedImages: inspectionResults.length,
            characteristicsCount: Object.keys(aggregatedCharacteristics).length
          }
        }
      })

      console.log(`💾 [DB] Saved inspection results (${inspectionResults.length}) and characteristics (${Object.keys(aggregatedCharacteristics).length}) to database`)

      // Iniciar polling como fallback caso webhook não funcione
      setTimeout(async () => {
        try {
          await startTrainingPolling(String(trainingResponse.id), model.id, session.user.id, 240, 5000, trainingProvider)
          console.log(`📡 Training polling started for model ${model.id}`)
        } catch (pollError) {
          console.error(`❌ Failed to start polling for model ${model.id}:`, pollError)
        }
      }, 5000)

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
      
      // TENTATIVA DE RECUPERAÇÃO: buscar tune no Astria usando idempotência (title = modelId)
      let recoverySuccess = false
      const astriaRecoveryProvider =
        aiProvider instanceof AstriaProvider
          ? aiProvider
          : (trainingProvider === 'astria' ? new AstriaProvider() : null)

      if (astriaRecoveryProvider) {
        try {
          console.log(`🔄 Attempting Astria tune recovery for model ${model.id}...`)
          const foundTune = await astriaRecoveryProvider.findTuneByTitle(model.id)
          
          if (foundTune) {
            console.log(`✅ Found tune in Astria! ID: ${foundTune.id}, Status: ${foundTune.status}`)
            
            // Mapear status do Astria
            let internalStatus: 'TRAINING' | 'READY' | 'ERROR'
            let progress = 20
            
            if (foundTune.status === 'trained') {
              internalStatus = 'READY'
              progress = 100
            } else if (foundTune.status === 'failed' || foundTune.status === 'cancelled') {
              internalStatus = 'ERROR'
              progress = 0
            } else {
              internalStatus = 'TRAINING'
              progress = 20
            }
            
            // Atualizar modelo no banco
            const updatedModel = await prisma.aIModel.update({
              where: { id: model.id },
              data: {
                status: internalStatus,
                progress,
                trainingJobId: foundTune.id,
                modelUrl: internalStatus === 'READY' ? foundTune.id : undefined,
                trainedAt: internalStatus === 'READY' ? new Date() : undefined,
                trainingConfig: {
                  trainingId: foundTune.id,
                  fluxModel: true,
                  startedAt: new Date().toISOString(),
                  provider: 'astria',
                  recovered: true
                }
              }
            })
            
            // Emitir SSE para atualizar UI
            await broadcastModelStatusChange(model.id, session.user.id, internalStatus, {
              progress,
              modelUrl: foundTune.id,
              recovered: true
            })
            
            // Se TRAINING, iniciar polling
            if (internalStatus === 'TRAINING') {
              setTimeout(() => {
                startTrainingPolling(foundTune.id, model.id, session.user.id, 240, 5000, trainingProvider).catch(err => {
                  console.error('Failed to start polling after recovery:', err)
                })
              }, 2000)
            }
            
            recoverySuccess = true
            console.log(`🎉 Model ${model.id} recovered successfully! Status: ${internalStatus}`)
            
            return NextResponse.json({
              success: true,
              message: 'Model creation started successfully (recovered from Astria)',
              modelId: model.id,
              trainingId: foundTune.id,
              status: internalStatus,
              recovered: true
            })
          } else {
            console.log(`⚠️ Tune not found in Astria for model ${model.id}`)
          }
        } catch (recoveryError) {
          console.error('❌ Recovery attempt failed:', recoveryError)
        }
      }
      
      // Se recuperação falhou, proceder com erro e reembolso
      if (!recoverySuccess) {
        // Update model status to failed
        await updateModelStatus(model.id, 'ERROR', 0, trainingError.message)
        
        // Refund credits if they were charged
        try {
          if (creditsCharged) {
            const refund = await refundModelCreationCredits(session.user.id, model.id, model.name)
            if (refund.success) {
              console.log(`↩️ Credits refunded for model ${model.id}: +${refund.refundedAmount}`)
            } else {
              console.warn('⚠️ Failed to refund credits:', refund.message)
            }
          }
        } catch (refundError) {
          console.error('⚠️ Refund processing error:', refundError)
        }
      }
      
      if (!recoverySuccess) {
        throw trainingError
      }
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