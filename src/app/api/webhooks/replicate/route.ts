import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { WebhookPayload } from '@/lib/ai/base'
import { downloadAndStoreImages } from '@/lib/storage/utils'
import { broadcastGenerationStatusChange, broadcastModelStatusChange, broadcastNotification } from '@/lib/services/realtime-service'
import Replicate from 'replicate'
import crypto from 'crypto'

/**
 * Webhook unificado do Replicate para todos os tipos de jobs
 * 
 * Este endpoint:
 * 1. Recebe notificações instantâneas do Replicate
 * 2. Detecta automaticamente o tipo de job (generation/training/upscale)
 * 3. Atualiza o banco de dados apropriado
 * 4. Propaga atualizações via WebSocket para UI em tempo real
 * 5. Zero polling necessário - tudo baseado em eventos
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const url = new URL(request.url)

  // Extrair parâmetros de consulta para otimização
  const webhookType = url.searchParams.get('type')
  const recordId = url.searchParams.get('id') || url.searchParams.get('modelId')
  const userId = url.searchParams.get('userId')

  console.log('🔔 Unified Replicate webhook received at:', new Date().toISOString(), {
    type: webhookType,
    recordId,
    userId
  })

  try {
    // Webhook security validation
    let payload: WebhookPayload
    const webhookSecret = process.env.REPLICATE_WEBHOOK_SECRET

    if (webhookSecret) {
      const signature = request.headers.get('webhook-signature')
      const body = await request.text()

      try {
        // Usar validação oficial do Replicate
        const isValid = Replicate.validateWebhook(body, signature || '', webhookSecret)

        if (!isValid) {
          console.log('❌ Replicate webhook: Invalid signature (using official validation)')
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        payload = JSON.parse(body)
        console.log('✅ Webhook signature validated successfully')
      } catch (validationError) {
        console.error('❌ Webhook validation error:', validationError)
        return NextResponse.json({ error: 'Webhook validation failed' }, { status: 401 })
      }
    } else {
      console.warn('⚠️ Replicate webhook: No REPLICATE_WEBHOOK_SECRET configured - webhook not secured')
      payload = await request.json()
    }

    console.log('📥 Replicate webhook payload:', {
      id: payload.id,
      status: payload.status,
      hasOutput: !!payload.output,
      outputType: payload.output ? typeof payload.output : 'none',
      queryParams: { type: webhookType, recordId, userId },
      metrics: payload.metrics ? {
        predict_time: payload.metrics.predict_time,
        total_time: payload.metrics.total_time
      } : null,
      timestamp: new Date().toISOString()
    })

    // Usar parâmetros de consulta para otimização, com fallback para detecção automática
    let jobType
    if (webhookType && recordId) {
      // Busca otimizada usando os parâmetros de consulta
      jobType = await getJobByParameters(webhookType, recordId, userId)
    } else {
      // Fallback para detecção automática
      jobType = await detectJobType(payload.id)
    }
    
    if (!jobType) {
      console.log(`❓ Job ${payload.id} not found in any table - might be external or test job`)
      return NextResponse.json({ 
        success: true, 
        message: 'Job not found - might be external job',
        jobId: payload.id 
      })
    }
    
    console.log(`🎯 Detected job type: ${jobType.type} for job ${payload.id}`)
    
    // Processar baseado no tipo detectado
    let result
    switch (jobType.type) {
      case 'generation':
        result = await processGenerationWebhook(payload, jobType.record)
        break
      case 'upscale':
        result = await processUpscaleWebhook(payload, jobType.record)
        break
      case 'training':
        result = await processTrainingWebhook(payload, jobType.record)
        break
      default:
        throw new Error(`Unknown job type: ${jobType.type}`)
    }
    
    const processingTime = Date.now() - startTime

    // Logs de performance e métricas detalhadas
    const metrics = {
      processingTime,
      jobType: jobType.type,
      optimizedSearch: !!(webhookType && recordId),
      hasUserId: !!userId,
      replicateMetrics: payload.metrics ? {
        predictTime: payload.metrics.predict_time,
        totalTime: payload.metrics.total_time
      } : null,
      payloadSize: JSON.stringify(payload).length,
      resultSuccess: result.success,
      timestamp: new Date().toISOString()
    }

    console.log(`✅ Webhook processed successfully:`, metrics)

    return NextResponse.json({
      success: true,
      jobType: jobType.type,
      processingTime,
      metadata: {
        optimizedLookup: metrics.optimizedSearch,
        replicateJobTime: metrics.replicateMetrics?.totalTime,
        payloadSizeKB: Math.round(metrics.payloadSize / 1024)
      },
      result
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      jobId: payload?.id,
      status: payload?.status,
      processingTime,
      timestamp: new Date().toISOString()
    }
    
    console.error('❌ Replicate webhook critical error:', errorDetails)
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorDetails.message,
        timestamp: errorDetails.timestamp,
        processingTime
      },
      { status: 500 }
    )
  }
}

/**
 * Busca otimizada usando parâmetros de consulta do webhook
 */
async function getJobByParameters(type: string, recordId: string, userId?: string | null) {
  try {
    if (type === 'generation') {
      const generation = await prisma.generation.findFirst({
        where: {
          id: recordId,
          ...(userId && { userId })
        },
        select: {
          id: true,
          userId: true,
          prompt: true,
          createdAt: true,
          jobId: true
        }
      })

      if (generation) {
        const isUpscale = generation.prompt?.startsWith('[UPSCALED]')
        return {
          type: isUpscale ? 'upscale' : 'generation',
          record: generation
        }
      }
    }

    if (type === 'training') {
      const model = await prisma.aIModel.findFirst({
        where: {
          id: recordId,
          ...(userId && { userId })
        },
        select: {
          id: true,
          userId: true,
          name: true,
          createdAt: true,
          jobId: true
        }
      })

      if (model) {
        return {
          type: 'training',
          record: model
        }
      }
    }

    console.log(`🔍 Optimized search failed for type=${type}, recordId=${recordId}, falling back to auto-detection`)
    return null
  } catch (error) {
    console.error('Error in optimized job search:', error)
    return null
  }
}

/**
 * Detecta automaticamente o tipo de job baseado no jobId (fallback)
 */
async function detectJobType(jobId: string) {
  // Verificar se é uma geração (incluindo upscales)
  const generation = await prisma.generation.findFirst({
    where: { jobId },
    select: {
      id: true,
      userId: true,
      prompt: true,
      createdAt: true
    }
  })
  
  if (generation) {
    // Verificar se é upscale baseado no prompt
    const isUpscale = generation.prompt?.startsWith('[UPSCALED]')
    return {
      type: isUpscale ? 'upscale' : 'generation',
      record: generation
    }
  }
  
  // Verificar se é treinamento de modelo
  const model = await prisma.aIModel.findFirst({
    where: { jobId },
    select: {
      id: true,
      userId: true,
      name: true,
      createdAt: true
    }
  })
  
  if (model) {
    return {
      type: 'training',
      record: model
    }
  }
  
  return null
}

/**
 * Processa webhook de geração de imagens
 */
async function processGenerationWebhook(payload: WebhookPayload, generation: any) {
  console.log(`🎨 Processing generation webhook for ${generation.id}`)
  
  const updateData: any = {}
  let creditRefund = false

  switch (payload.status) {
    case 'starting':
      updateData.status = 'PROCESSING'
      break

    case 'processing':
      updateData.status = 'PROCESSING'
      break

    case 'succeeded':
      updateData.status = 'COMPLETED'
      updateData.completedAt = new Date()
      
      if (payload.output) {
        const storageResult = await processAndStoreImages(payload.output, generation.id, generation.userId, generation)
        
        if (storageResult.success) {
          updateData.imageUrls = storageResult.permanentUrls
          updateData.thumbnailUrls = storageResult.thumbnailUrls
          updateData.errorMessage = null
          
          // Salvar contexto de operação no banco
          if (storageResult.context) {
            updateData.operationType = storageResult.context.operationType
            updateData.storageContext = storageResult.context.storageContext
            updateData.metadata = {
              context: storageResult.context,
              webhook: true,
              timestamp: new Date().toISOString()
            }
          }
          
          console.log(`✅ Generation ${generation.id}: ${storageResult.permanentUrls.length} images stored permanently`)
        } else {
          updateData.status = 'FAILED'
          updateData.errorMessage = `Storage failed: ${storageResult.error}`
          creditRefund = true
          
          console.error(`❌ Generation ${generation.id}: Storage failed - ${storageResult.error}`)
        }
      } else {
        updateData.status = 'FAILED'
        updateData.errorMessage = 'No output provided by Replicate'
        creditRefund = true
      }
      
      if (payload.metrics?.total_time) {
        updateData.processingTime = Math.round(payload.metrics.total_time * 1000)
      }
      break

    case 'failed':
      updateData.status = 'FAILED'
      updateData.completedAt = new Date()
      updateData.errorMessage = payload.error || 'Generation failed'
      creditRefund = true
      break

    case 'canceled':
      updateData.status = 'CANCELLED'
      updateData.completedAt = new Date()
      updateData.errorMessage = 'Generation was cancelled'
      creditRefund = true
      break
  }

  // Atualizar banco de dados
  await prisma.generation.update({
    where: { id: generation.id },
    data: updateData
  })

  // Refund de créditos se necessário
  if (creditRefund) {
    await refundGenerationCredits(generation.id, generation.userId)
  }

  // Broadcast via WebSocket
  await broadcastGenerationStatusChange(
    generation.id,
    generation.userId,
    payload.status,
    {
      imageUrls: updateData.imageUrls,
      thumbnailUrls: updateData.thumbnailUrls,
      processingTime: updateData.processingTime,
      errorMessage: updateData.errorMessage,
      webhook: true,
      timestamp: new Date().toISOString()
    }
  )

  // Notificação de sucesso
  if (payload.status === 'succeeded' && updateData.status === 'COMPLETED') {
    await broadcastNotification(
      generation.userId,
      'Fotos Prontas!',
      `${updateData.imageUrls?.length || 1} imagem${(updateData.imageUrls?.length || 1) > 1 ? 's' : ''} gerada${(updateData.imageUrls?.length || 1) > 1 ? 's' : ''} com sucesso!`,
      'success'
    )
  }

  return { success: true, type: 'generation', updated: !!Object.keys(updateData).length }
}

/**
 * Processa webhook de upscale
 */
async function processUpscaleWebhook(payload: WebhookPayload, generation: any) {
  console.log(`🔍 Processing upscale webhook for ${generation.id}`)
  
  const updateData: any = {}
  let creditRefund = false

  switch (payload.status) {
    case 'starting':
      updateData.status = 'PROCESSING'
      break

    case 'processing':
      updateData.status = 'PROCESSING'
      break

    case 'succeeded':
      updateData.status = 'COMPLETED'
      updateData.completedAt = new Date()
      
      if (payload.output) {
        const storageResult = await processAndStoreImages(payload.output, generation.id, generation.userId, generation)
        
        if (storageResult.success) {
          updateData.imageUrls = storageResult.permanentUrls
          updateData.thumbnailUrls = storageResult.thumbnailUrls
          updateData.errorMessage = null
          
          // Salvar contexto de operação no banco
          if (storageResult.context) {
            updateData.operationType = storageResult.context.operationType
            updateData.storageContext = storageResult.context.storageContext
            updateData.metadata = {
              context: storageResult.context,
              webhook: true,
              timestamp: new Date().toISOString()
            }
          }
          
          console.log(`✅ Upscale ${generation.id}: Images stored permanently`)
        } else {
          updateData.status = 'FAILED'
          updateData.errorMessage = `Upscale storage failed: ${storageResult.error}`
          creditRefund = true
        }
      } else {
        updateData.status = 'FAILED'
        updateData.errorMessage = 'Upscale completed but no output provided'
        creditRefund = true
      }
      
      if (payload.metrics?.total_time) {
        updateData.processingTime = Math.round(payload.metrics.total_time * 1000)
      }
      break

    case 'failed':
      updateData.status = 'FAILED'
      updateData.completedAt = new Date()
      updateData.errorMessage = `Upscale failed: ${payload.error || 'Unknown error'}`
      creditRefund = true
      break

    case 'canceled':
      updateData.status = 'CANCELLED'
      updateData.completedAt = new Date()
      updateData.errorMessage = 'Upscale was cancelled'
      creditRefund = true
      break
  }

  // Atualizar banco de dados
  await prisma.generation.update({
    where: { id: generation.id },
    data: updateData
  })

  // Refund de créditos se necessário
  if (creditRefund) {
    await refundUpscaleCredits(generation.id, generation.userId)
  }

  // Broadcast via WebSocket
  await broadcastGenerationStatusChange(
    generation.id,
    generation.userId,
    payload.status,
    {
      imageUrls: updateData.imageUrls,
      thumbnailUrls: updateData.thumbnailUrls,
      processingTime: updateData.processingTime,
      errorMessage: updateData.errorMessage,
      isUpscale: true,
      webhook: true,
      timestamp: new Date().toISOString()
    }
  )

  // Notificação de sucesso
  if (payload.status === 'succeeded' && updateData.status === 'COMPLETED') {
    await broadcastNotification(
      generation.userId,
      'Upscale Concluído!',
      'Sua imagem foi ampliada com sucesso e está pronta para download!',
      'success'
    )
  }

  return { success: true, type: 'upscale', updated: !!Object.keys(updateData).length }
}

/**
 * Processa webhook de treinamento de modelo
 */
async function processTrainingWebhook(payload: WebhookPayload, model: any) {
  console.log(`🤖 Processing training webhook for model ${model.id} (${model.name})`)
  
  const updateData: any = {}
  let creditRefund = false

  switch (payload.status) {
    case 'starting':
      updateData.status = 'TRAINING'
      updateData.progress = 5
      break

    case 'processing':
      updateData.status = 'TRAINING'
      updateData.progress = 50
      break

    case 'succeeded':
      updateData.status = 'READY'
      updateData.trainedAt = new Date()
      updateData.progress = 100
      
      if (payload.output) {
        updateData.modelUrl = payload.output
      }
      
      updateData.qualityScore = calculateTrainingQualityScore(payload)
      updateData.trainingConfig = {
        ...(typeof model.trainingConfig === 'object' && model.trainingConfig !== null ? model.trainingConfig : {}),
        trainingCompleted: true,
        completedAt: new Date().toISOString(),
        version: payload.version,
        webhook: true
      }
      break

    case 'failed':
      updateData.status = 'ERROR'
      updateData.trainedAt = new Date()
      updateData.progress = 0
      updateData.errorMessage = payload.error || 'Training failed'
      creditRefund = true
      break

    case 'canceled':
      updateData.status = 'DRAFT'
      updateData.errorMessage = 'Training was cancelled'
      creditRefund = true
      break
  }

  // Atualizar banco de dados
  await prisma.aIModel.update({
    where: { id: model.id },
    data: updateData
  })

  // Refund de créditos se necessário
  if (creditRefund) {
    await refundTrainingCredits(model.id, model.userId)
  }

  // Broadcast via WebSocket
  await broadcastModelStatusChange(
    model.id,
    model.userId,
    updateData.status || payload.status,
    {
      progress: updateData.progress,
      qualityScore: updateData.qualityScore,
      errorMessage: updateData.errorMessage,
      modelUrl: updateData.modelUrl,
      webhook: true,
      timestamp: new Date().toISOString()
    }
  )

  // Notificação de sucesso
  if (payload.status === 'succeeded') {
    await broadcastNotification(
      model.userId,
      'Modelo Treinado!',
      `Seu modelo "${model.name}" foi treinado com sucesso e está pronto para gerar fotos!`,
      'success'
    )
  }

  return { success: true, type: 'training', updated: !!Object.keys(updateData).length }
}

/**
 * Detecta o tipo de operação e contexto de storage baseado na geração
 */
function detectOperationContext(generation: any): {
  operationType: string
  storageContext: string
} {
  const prompt = generation.prompt || ''
  
  // Detectar por prefixo no prompt
  if (prompt.startsWith('[EDITED]')) {
    return { operationType: 'edit', storageContext: 'edited' }
  }
  if (prompt.startsWith('[UPSCALED]')) {
    return { operationType: 'upscale', storageContext: 'upscaled' }
  }
  if (prompt.startsWith('[VIDEO]')) {
    return { operationType: 'video', storageContext: 'videos' }
  }
  
  // Default: geração normal
  return { operationType: 'generation', storageContext: 'generated' }
}

/**
 * Processa e armazena imagens permanentemente com contexto inteligente
 */
async function processAndStoreImages(output: any, generationId: string, userId: string, generation: any) {
  try {
    let temporaryUrls: string[] = []
    
    if (Array.isArray(output)) {
      temporaryUrls = output
    } else if (typeof output === 'string') {
      temporaryUrls = [output]
    } else if (output.images) {
      temporaryUrls = output.images
    }
    
    if (temporaryUrls.length === 0) {
      return { success: false, error: 'No images in output' }
    }
    
    // Detectar contexto automaticamente
    const context = detectOperationContext(generation)
    
    console.log(`📥 Storing ${temporaryUrls.length} images permanently for generation ${generationId}`)
    console.log(`📁 Context: ${context.operationType} -> ${context.storageContext}`)
    
    const storageResult = await downloadAndStoreImages(
      temporaryUrls,
      generationId,
      userId,
      context.storageContext
    )
    
    if (storageResult.success && storageResult.permanentUrls?.length) {
      return {
        success: true,
        permanentUrls: storageResult.permanentUrls,
        thumbnailUrls: storageResult.thumbnailUrls || storageResult.permanentUrls,
        context: context // Retornar contexto para salvar no banco
      }
    } else {
      return { success: false, error: storageResult.error }
    }
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown storage error' 
    }
  }
}

/**
 * Calcula score de qualidade do treinamento
 */
function calculateTrainingQualityScore(payload: WebhookPayload): number {
  let score = 80
  
  if (payload.status === 'succeeded') {
    score += 15
  }
  
  if (payload.metrics?.total_time) {
    const timeMinutes = payload.metrics.total_time / 60
    if (timeMinutes < 15) score += 10
    else if (timeMinutes < 30) score += 5
    else if (timeMinutes > 60) score -= 5
  }
  
  if (payload.logs && payload.logs.some((log: string) => log.toLowerCase().includes('error'))) {
    score -= 5
  }
  
  if (payload.logs && payload.logs.some((log: string) => 
    log.toLowerCase().includes('lora') || 
    log.toLowerCase().includes('flux'))) {
    score += 5
  }
  
  return Math.max(20, Math.min(100, score))
}

/**
 * Refund de créditos para geração
 */
async function refundGenerationCredits(generationId: string, userId: string) {
  try {
    const originalUsage = await prisma.usageLog.findFirst({
      where: {
        userId,
        action: 'generation',
        details: {
          path: ['generationId'],
          equals: generationId
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (originalUsage && originalUsage.creditsUsed > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.usageLog.create({
          data: {
            userId,
            action: 'generation_refund',
            details: {
              generationId,
              originalCreditsUsed: originalUsage.creditsUsed,
              reason: 'Generation failed/cancelled',
              webhook: true
            },
            creditsUsed: -originalUsage.creditsUsed
          }
        })

        await tx.user.update({
          where: { id: userId },
          data: {
            creditsUsed: {
              decrement: originalUsage.creditsUsed
            }
          }
        })
      })

      console.log(`💰 Refunded ${originalUsage.creditsUsed} credits to user ${userId} for failed generation`)
    }
  } catch (error) {
    console.error('Failed to refund generation credits:', error)
  }
}

/**
 * Refund de créditos para upscale
 */
async function refundUpscaleCredits(generationId: string, userId: string) {
  try {
    const originalUsage = await prisma.usageLog.findFirst({
      where: {
        userId,
        OR: [
          { action: 'upscale' },
          { action: 'generation' }
        ],
        details: {
          path: ['generationId'],
          equals: generationId
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (originalUsage && originalUsage.creditsUsed > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.usageLog.create({
          data: {
            userId,
            action: 'upscale_refund',
            details: {
              generationId,
              originalCreditsUsed: originalUsage.creditsUsed,
              reason: 'Upscale failed/cancelled',
              webhook: true
            },
            creditsUsed: -originalUsage.creditsUsed
          }
        })

        await tx.user.update({
          where: { id: userId },
          data: {
            creditsUsed: {
              decrement: originalUsage.creditsUsed
            }
          }
        })
      })

      console.log(`💰 Refunded ${originalUsage.creditsUsed} credits to user ${userId} for failed upscale`)
    }
  } catch (error) {
    console.error('Failed to refund upscale credits:', error)
  }
}

/**
 * Refund de créditos para treinamento
 */
async function refundTrainingCredits(modelId: string, userId: string) {
  try {
    const originalUsage = await prisma.usageLog.findFirst({
      where: {
        userId,
        action: 'training',
        details: {
          path: ['modelId'],
          equals: modelId
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (originalUsage && originalUsage.creditsUsed > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.usageLog.create({
          data: {
            userId,
            action: 'training_refund',
            details: {
              modelId,
              originalCreditsUsed: originalUsage.creditsUsed,
              reason: 'Training failed/cancelled',
              webhook: true
            },
            creditsUsed: -originalUsage.creditsUsed
          }
        })

        await tx.user.update({
          where: { id: userId },
          data: {
            creditsUsed: {
              decrement: originalUsage.creditsUsed
            }
          }
        })
      })

      console.log(`💰 Refunded ${originalUsage.creditsUsed} credits to user ${userId} for failed training`)
    }
  } catch (error) {
    console.error('Failed to refund training credits:', error)
  }
}

/**
 * Verifica assinatura de segurança do webhook
 */
// Webhook validation is now handled by the official Replicate.validateWebhook() method