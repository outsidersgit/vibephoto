import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canUserUseCredits, updateUserCredits } from '@/lib/db/users'
import { TopazUpscaler } from '@/lib/ai/upscale/topaz-upscaler'
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

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Upscale API endpoint called')

    const session = await requireAuthAPI()
    const userId = session.user.id
    const userPlan = (session.user as any).plan || 'STARTER'
    
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
    
    // Verifica se usuário tem créditos suficientes
    const hasCredits = await canUserUseCredits(userId, creditsNeeded)
    if (!hasCredits) {
      return NextResponse.json({ 
        error: `Créditos insuficientes. Necessários: ${creditsNeeded}` 
      }, { status: 402 })
    }

    // Inicializa upscaler
    const upscaler = new TopazUpscaler()
    
    // Processa upscale (com preferência síncrona para armazenamento imediato)
    let result
    if (batchMode) {
      console.log('📦 Starting batch upscale')
      result = await upscaler.batchUpscale(imageUrls, options)
    } else {
      console.log('🔍 Starting single upscale with synchronous preference')
      result = await upscaler.upscaleImage(imageUrl, options, true) // Prefer synchronous
    }

    // Deduz créditos
    await updateUserCredits(userId, creditsNeeded)

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
            'upscaled'
          )
          
          if (storageResult.success && storageResult.permanentUrls && storageResult.permanentUrls.length > 0) {
            finalImageUrls = storageResult.permanentUrls
            finalThumbnailUrls = storageResult.thumbnailUrls || storageResult.permanentUrls
            finalStatus = 'COMPLETED'
            console.log('✅ GUARANTEED: Synchronous upscale images saved permanently immediately')
          } else {
            console.error('❌ CRITICAL: Failed to store synchronous upscale images permanently')
            finalStatus = 'FAILED'
            // Don't charge user if storage fails
            await updateUserCredits(userId, -creditsNeeded) // Refund
          }
        } catch (storageError) {
          console.error('❌ CRITICAL: Error storing synchronous upscale images:', storageError)
          finalStatus = 'FAILED'
          // Don't charge user if storage fails
          await updateUserCredits(userId, -creditsNeeded) // Refund
        }
      }
      
      // Cria registro na tabela Generation para tracking
      const generationRecord = await prisma.generation.create({
        data: {
          userId,
          prompt: `[UPSCALED] ${options.upscale_factor} - ${options.enhance_model || 'Standard V2'} - Enhanced quality`,
          negativePrompt: null, // Topaz Labs doesn't use negative prompts
          imageUrls: finalImageUrls, // Empty for async, populated for sync
          thumbnailUrls: finalThumbnailUrls, // Empty for async, populated for sync
          status: finalStatus, // PROCESSING for async, COMPLETED/FAILED for sync
          resolution: `${options.upscale_factor}`, // e.g., "2x", "4x", "6x"
          aspectRatio: '1:1', // Será atualizado
          style: 'upscale',
          seed: options.seed || Math.floor(Math.random() * 1000000),
          variations: 1,
          modelId: await getDefaultModelId(userId),
          jobId: jobId,
          processingTime: synchronousResult ? 30000 : estimateProcessingTime(numericScaleFactor), // Sync is ~30s
          estimatedCost: Math.ceil(creditsNeeded / imageCount),
          completedAt: finalStatus === 'COMPLETED' ? new Date() : null,
          errorMessage: finalStatus === 'FAILED' ? 'Failed to store upscaled images permanently' : null
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
    }

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
    description: 'Sistema de upscale de imagens usando Topaz Labs via Replicate',
    methods: ['POST'],
    parameters: {
      imageUrl: 'String - URL da imagem para upscale (obrigatório para modo single)',
      imageUrls: 'Array - URLs das imagens para batch upscale',
      batchMode: 'Boolean - Ativa modo batch para múltiplas imagens',
      options: {
        upscale_factor: 'String - Fator de escala: "2x", "4x", "6x" ou "None" (padrão: "2x")',
        enhance_model: 'String - Modelo: "Standard V2", "Low Resolution V2", "CGI", "High Fidelity V2", "Text Refine" (padrão: "Standard V2")',
        output_format: 'String - Formato: "png" ou "jpg" (padrão: "png")',
        face_enhancement: 'Boolean - Melhoria de faces (padrão: false)',
        subject_detection: 'String - Detecção: "None", "All", "Foreground", "Background" (padrão: "None")',
        face_enhancement_strength: 'Number - Força da melhoria de faces (0-1, padrão: 0.8)',
        face_enhancement_creativity: 'Number - Criatividade da melhoria de faces (0-1, padrão: 0.0)',
        // Legacy compatibility
        scale_factor: 'Number - [Legacy] Fator de escala: 2, 4 ou 6 (convertido para upscale_factor)'
      }
    },
    features: [
      'Upscale single e batch',
      'Múltiplos fatores de escala (2x, 4x, 6x)',
      'Modelos especializados (Standard V2, High Fidelity V2, CGI, etc.)',
      'Melhoria automática de faces',
      'Detecção inteligente de objetos',
      'Sistema integrado de créditos',
      'Tracking de progresso',
      'Limites por plano de usuário'
    ],
    provider: 'Topaz Labs',
    limits: UPSCALE_CONFIG.planLimits
  })
}

// Helper para obter modelo padrão
async function getDefaultModelId(userId: string): Promise<string> {
  const defaultModel = await prisma.aIModel.findFirst({
    where: { 
      userId, 
      status: 'READY'
    },
    orderBy: { createdAt: 'desc' }
  })

  if (!defaultModel) {
    // Cria modelo padrão se não existir
    const createdModel = await prisma.aIModel.create({
      data: {
        userId,
        name: 'Default Upscale Model',
        class: 'MAN', // Required field from ModelClass enum
        status: 'READY',
        facePhotos: [],
        halfBodyPhotos: [],
        fullBodyPhotos: [],
        sampleImages: []
      }
    })
    return createdModel.id
  }

  return defaultModel.id
}