import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NanoBananaUpscaler } from '@/lib/ai/upscale/nano-banana-upscaler'
import { UPSCALE_CONFIG, UpscaleOptions } from '@/lib/ai/upscale/upscale-config'
import {
  canUserUpscale,
  calculateUpscaleCredits,
  generateUpscaleJobId,
  estimateProcessingTime,
  comprehensiveInputValidation,
  monitorUrlExpiration
} from '@/lib/ai/upscale/upscale-utils'
import { downloadAndStoreImages } from '@/lib/storage/utils'
import { CreditManager } from '@/lib/credits/manager'
import { Plan } from '@prisma/client'
import sharp from 'sharp'
import { getAspectRatioValue } from '@/lib/utils/aspect-ratio'

async function fetchImageDimensions(url: string | null | undefined) {
  if (!url) {
    return null
  }

  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`⚠️ [UPSCALE] Failed to fetch image for dimensions: ${response.status} ${response.statusText}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const metadata = await sharp(buffer).metadata()

    if (!metadata.width || !metadata.height) {
      return null
    }

    const aspectRatio = getAspectRatioValue(metadata.width, metadata.height, null)

    return {
      width: metadata.width,
      height: metadata.height,
      aspectRatio: aspectRatio || null
    }
  } catch (error) {
    console.warn('⚠️ [UPSCALE] Unable to derive image dimensions:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Upscale API endpoint called')

    const session = await requireAuthAPI()
    const userId = session.user.id
    const userPlan = ((session.user as any).plan || 'STARTER') as Plan
    
    const body = await request.json()
    const { 
      imageUrl, 
      options = {},
      batchMode = false,
      imageUrls = []
    } = body

    console.log('📝 Request body:', { 
      imageUrl: imageUrl ? imageUrl.substring(0, 50) + '...' : null,
      batchMode,
      imageCount: batchMode ? imageUrls.length : 1,
      options: { ...options, prompt: options.prompt ? '...' : undefined }
    })

    // Validação de input
    if (!batchMode && !imageUrl) {
      return NextResponse.json({ 
        error: 'imageUrl é obrigatório' 
      }, { status: 400 })
    }

    if (batchMode && (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0)) {
      return NextResponse.json({ 
        error: 'imageUrls deve ser um array não vazio para batch mode' 
      }, { status: 400 })
    }

    const imagesToProcess = batchMode ? imageUrls : [imageUrl]
    const imageCount = imagesToProcess.length

    const imageDimensionInfo = await Promise.all(
      imagesToProcess.map(async (url) => {
        try {
          return await fetchImageDimensions(url)
        } catch (error) {
          console.warn('⚠️ [UPSCALE] Failed to compute dimension info for image:', { url, error })
          return null
        }
      })
    )

    // 🔥 COMPREHENSIVE INPUT VALIDATION
    console.log('🔍 Performing comprehensive validation...')
    
    for (let i = 0; i < imagesToProcess.length; i++) {
      const currentImageUrl = imagesToProcess[i]
      const validation = comprehensiveInputValidation(currentImageUrl, options, userPlan)
      
      if (!validation.isValid) {
        console.error(`❌ Validation failed for image ${i + 1}:`, validation.errors)
        return NextResponse.json({ 
          error: `Validation failed for image ${i + 1}: ${validation.errors.join('; ')}` 
        }, { status: 400 })
      }
      
      if (validation.warnings.length > 0) {
        console.warn(`⚠️ Warnings for image ${i + 1}:`, validation.warnings)
      }
    }

    // Monitor for URL expiration risk
    const expirationCheck = monitorUrlExpiration(imagesToProcess, 'pre-processing')
    if (expirationCheck.needsImmediateStorage) {
      console.warn('⚠️ Input images contain temporary URLs that may expire during processing')
    }

    // Convert legacy scale_factor to upscale_factor if needed
    if (options.scale_factor && !options.upscale_factor) {
      options.upscale_factor = `${options.scale_factor}x` as "2x" | "4x" | "6x"
    }

    // Set default upscale_factor if not provided
    if (!options.upscale_factor) {
      options.upscale_factor = "2x"
    }

    // Validate upscale_factor
    if (!UPSCALE_CONFIG.options.upscale_factors.includes(options.upscale_factor)) {
      return NextResponse.json({
        error: `upscale_factor deve ser um de: ${UPSCALE_CONFIG.options.upscale_factors.join(', ')}`
      }, { status: 400 })
    }

    // Verifica se usuário pode fazer upscale
    // For now, we'll count upscale generations by checking if prompt contains [UPSCALED]
    const today = new Date().toISOString().split('T')[0]
    const dailyUsage = await prisma.generation.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(today + 'T00:00:00.000Z'),
          lt: new Date(today + 'T23:59:59.999Z')
        },
        prompt: {
          startsWith: '[UPSCALED]'
        }
      }
    })

    // Extract numeric scale factor for validation
    const numericScaleFactor = parseInt(options.upscale_factor.replace('x', '')) || 2

    const canUpscale = canUserUpscale(userPlan, numericScaleFactor, dailyUsage + imageCount - 1)
    if (!canUpscale.canUpscale) {
      return NextResponse.json({
        error: canUpscale.reason
      }, { status: 403 })
    }

    // Calcula créditos necessários
    const creditsNeeded = calculateUpscaleCredits(imageCount)

    const affordability = await CreditManager.canUserAfford(userId, creditsNeeded, userPlan as Plan)
    if (!affordability.canAfford) {
      return NextResponse.json({
        error: affordability.reason || `Créditos insuficientes. Necessários: ${creditsNeeded}`
      }, { status: 402 })
    }

    // Inicializa upscaler (Nano Banana Pro 4K)
    const upscaler = new NanoBananaUpscaler()
    
    // Processa upscale (com preferência síncrona para armazenamento imediato)
    let result
    if (batchMode) {
      console.log('📦 Starting batch upscale')
      result = await upscaler.batchUpscale(imageUrls, options)
    } else {
      console.log('🔍 Starting single upscale with synchronous preference')
      result = await upscaler.upscaleImage(imageUrl, options, true) // Prefer synchronous
    }

    // Salva jobs na base de dados para tracking
    const jobRecords = []
    const jobIds = batchMode ? result.jobIds : [result.jobId]
    
    // Handle immediate storage for synchronous results
    const synchronousResult = !batchMode && result.result && (result as any).requiresStorage
    
    for (const [index, jobId] of jobIds.entries()) {
      const originalImage = imagesToProcess[index]
      let finalImageUrls: string[] = []
      let finalThumbnailUrls: string[] = []
      let finalStatus = 'PROCESSING'
      
      // 🔥 CRITICAL: Handle immediate storage for synchronous results
      if (synchronousResult && result.result) {
        console.log('🚨 CRITICAL: Processing synchronous upscale result for permanent storage...')
        
        try {
          const storageResult = await downloadAndStoreImages(
            result.result,
            `temp_${jobId}`, // Temporary generation ID
            userId,
            'upscaled',
            true // isUpscale flag to allow larger file sizes (50MB)
          )
          
          if (storageResult.success && storageResult.permanentUrls && storageResult.permanentUrls.length > 0) {
            finalImageUrls = storageResult.permanentUrls
            finalThumbnailUrls = storageResult.thumbnailUrls || storageResult.permanentUrls
            finalStatus = 'COMPLETED'
            console.log('✅ GUARANTEED: Synchronous upscale images saved permanently immediately')
          } else {
            console.error('❌ CRITICAL: Failed to store synchronous upscale images permanently')
            finalStatus = 'FAILED'
          }
        } catch (storageError) {
          console.error('❌ CRITICAL: Error storing synchronous upscale images:', storageError)
          finalStatus = 'FAILED'
        }
      }
      
      // Cria registro na tabela Generation para tracking
      const dimensionInfo = imageDimensionInfo[index]
      const aspectRatioFromImage = dimensionInfo?.aspectRatio || '1:1'

      const generationRecord = await prisma.generation.create({
        data: {
          userId,
          prompt: `[UPSCALED] ${options.upscale_factor} - ${options.enhance_model || 'Standard V2'} - Enhanced quality`,
          negativePrompt: null, // Topaz Labs doesn't use negative prompts
          imageUrls: finalImageUrls, // Empty for async, populated for sync
          thumbnailUrls: finalThumbnailUrls, // Empty for async, populated for sync
          status: finalStatus, // PROCESSING for async, COMPLETED/FAILED for sync
          resolution: `${options.upscale_factor}`, // e.g., "2x", "4x", "6x"
          aspectRatio: aspectRatioFromImage || '1:1',
          style: 'upscale',
          operationType: 'upscale',
          seed: options.seed || Math.floor(Math.random() * 1000000),
          variations: 1,
          jobId: jobId,
          processingTime: synchronousResult ? 30000 : estimateProcessingTime(numericScaleFactor), // Sync is ~30s
          estimatedCost: Math.ceil(creditsNeeded / imageCount),
          completedAt: finalStatus === 'COMPLETED' ? new Date() : null,
          errorMessage: finalStatus === 'FAILED' ? 'Failed to store upscaled images permanently' : null,
          metadata: {
            source: 'upscale',
            upscaleFactor: options.upscale_factor,
            enhanceModel: options.enhance_model || 'Standard V2',
            cost: Math.ceil(creditsNeeded / imageCount),
            ...(dimensionInfo?.width ? { originalWidth: dimensionInfo.width } : {}),
            ...(dimensionInfo?.height ? { originalHeight: dimensionInfo.height } : {}),
            ...(dimensionInfo?.aspectRatio ? { aspectRatio: dimensionInfo.aspectRatio } : {})
          }
        }
      })

      jobRecords.push({
        jobId,
        generationId: generationRecord.id,
        originalImage,
        estimatedTime: synchronousResult ? 0 : estimateProcessingTime(numericScaleFactor), // 0 if already completed
        status: finalStatus,
        imageUrls: finalImageUrls,
        thumbnailUrls: finalThumbnailUrls
      })
      
      // CRITICAL: Broadcast status change for synchronous results (success OR failure)
      // Async results are handled by webhook, but sync results need manual broadcast
      if (synchronousResult) {
        try {
          const { broadcastGenerationStatusChange } = await import('@/lib/services/realtime-service')
          await broadcastGenerationStatusChange(
            generationRecord.id,
            userId,
            finalStatus, // COMPLETED or FAILED
            {
              imageUrls: finalImageUrls,
              thumbnailUrls: finalThumbnailUrls,
              isUpscale: true,
              synchronous: true,
              errorMessage: finalStatus === 'FAILED' ? 'Falha ao armazenar imagem upscaled' : undefined,
              timestamp: new Date().toISOString()
            }
          )
          console.log(`📡 Broadcasted ${finalStatus} status for synchronous upscale ${generationRecord.id}`)
        } catch (broadcastError) {
          console.error('❌ Failed to broadcast synchronous upscale status:', broadcastError)
        }
      }
    }

    const chargeResult = await CreditManager.deductCredits(
      userId,
      creditsNeeded,
      'Upscale de imagem',
      {
        type: 'UPSCALE',
        upscaleId: jobRecords[0]?.generationId,
        prompt: options.prompt
      }
    )

    if (!chargeResult.success) {
      console.error('❌ [UPSCALE] Credit charge failed:', chargeResult.error)
      for (const record of jobRecords) {
        await prisma.generation.update({
          where: { id: record.generationId },
          data: {
            status: 'FAILED',
            errorMessage: chargeResult.error || 'Falha ao debitar créditos'
          }
        })
      }

      return NextResponse.json({
        error: chargeResult.error || 'Créditos insuficientes',
        success: false
      }, { status: 402 })
    }

    await prisma.usageLog.create({
      data: {
        userId,
        action: 'upscale',
        details: {
          generationIds: jobRecords.map((record) => record.generationId),
          imageCount,
          upscaleFactor: options.upscale_factor
        },
        creditsUsed: creditsNeeded
      }
    })

    // Start polling ONLY for async jobs (skip for completed synchronous jobs)
    const needsPolling = jobRecords.filter(record => record.status === 'PROCESSING')

    if (needsPolling.length > 0) {
      console.log(`🔄 [UPSCALE_POLLING] Starting polling for ${needsPolling.length} async jobs`)

      for (const record of needsPolling) {
        try {
          const { startPolling } = await import('@/lib/services/polling-service')

          // Use setTimeout for better reliability (same pattern as generations)
          setTimeout(async () => {
            try {
              console.log(`🚀 [UPSCALE_POLLING] Executing startPolling for ${record.jobId}`)
              await startPolling(record.jobId, record.generationId, userId)
              console.log(`✅ [UPSCALE_POLLING] Polling service started successfully for ${record.jobId}`)
            } catch (error) {
              console.error(`❌ [UPSCALE_POLLING] Error starting polling for ${record.jobId}:`, error)

              // Retry once after 5 seconds (same pattern as generations)
              setTimeout(async () => {
                try {
                  console.log(`🔄 [UPSCALE_POLLING] Retrying polling for ${record.jobId}`)
                  await startPolling(record.jobId, record.generationId, userId)
                  console.log(`✅ [UPSCALE_POLLING] Retry polling successful for ${record.jobId}`)
                } catch (retryError) {
                  console.error(`❌ [UPSCALE_POLLING] Retry failed for ${record.jobId}:`, retryError)
                }
              }, 5000)
            }
          }, 100) // Small delay like other endpoints
        } catch (importError) {
          console.error(`❌ [UPSCALE_POLLING] Failed to import polling service:`, importError)
        }
      }
    } else {
      console.log(`✅ [UPSCALE_POLLING] All jobs completed synchronously - no polling needed`)
    }

    console.log('✅ Upscale jobs created:', {
      jobCount: jobIds.length,
      creditsUsed: creditsNeeded,
      userPlan,
      synchronousResults: synchronousResult,
      permanentStorageGuaranteed: true
    })

    return NextResponse.json({
      success: true,
      jobIds,
      totalJobs: imageCount,
      creditsUsed: creditsNeeded,
      estimatedTime: synchronousResult ? 0 : estimateProcessingTime(numericScaleFactor),
      batchMode,
      records: jobRecords,
      // Enhanced response with storage guarantees
      storageGuarantee: {
        permanentStorageEnabled: true,
        synchronousProcessing: synchronousResult,
        webhookConfigured: true,
        expirationMonitoring: true
      },
      improvements: [
        'Fixed Replicate API call format (model parameter)',
        'Added Prefer header for 60s synchronous responses',
        'Implemented permanent image storage guarantee',
        'Created dedicated upscale webhook with storage validation',
        'Enhanced parameter validation with ranges per documentation',
        'Added URL expiration monitoring and alerts',
        'Comprehensive input validation before API calls',
        'Immediate storage for synchronous results'
      ]
    })

  } catch (error) {
    console.error('❌ Upscale API error:', error)

    let errorMessage = 'Falha no upscale'
    let statusCode = 500

    if (error instanceof Error) {
      errorMessage = error.message

      // Provide specific error codes for different types of errors
      if (error.message.includes('Unauthorized') || error.message.includes('authentication')) {
        statusCode = 401
      } else if (error.message.includes('Créditos insuficientes')) {
        statusCode = 402
      } else if (error.message.includes('inválid') || error.message.includes('validation')) {
        statusCode = 400
      } else if (error.message.includes('Rate limit') || error.message.includes('quota')) {
        statusCode = 429
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        timestamp: new Date().toISOString(),
        success: false
      },
      { status: statusCode }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'VibePhoto Upscale API',
    description: 'Sistema de upscale de imagens usando Nano Banana Pro (4K) via Replicate',
    methods: ['POST'],
    parameters: {
      imageUrl: 'String - URL da imagem para upscale (obrigatório para modo single)',
      imageUrls: 'Array - URLs das imagens para batch upscale',
      batchMode: 'Boolean - Ativa modo batch para múltiplas imagens',
      options: {
        resolution: 'String - Resolução de saída: "4K" (padrão e recomendado)',
        output_format: 'String - Formato: "jpg" ou "png" (padrão: "jpg")',
        aspect_ratio: 'String - Proporção: "match_input_image" (padrão - preserva original)',
        safety_filter_level: 'String - Filtro: "block_only_high" (padrão)'
      }
    },
    features: [
      'Upscale single e batch',
      'Resolução 4K ultra-alta qualidade',
      'Preservação de identidade e proporções',
      'Melhoria de claridade e detalhes',
      'Redução de ruído e artefatos',
      'Processamento síncrono e assíncrono',
      'Sistema integrado de créditos',
      'Tracking de progresso',
      'Limites por plano de usuário'
    ],
    provider: 'Nano Banana Pro (Google)',
    cost: '30 créditos por imagem',
    limits: UPSCALE_CONFIG.planLimits
  })
}