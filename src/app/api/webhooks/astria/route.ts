import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { broadcastModelStatusChange } from '@/lib/services/realtime-service'
import { refundModelCreationCredits } from '@/lib/services/model-credit-service'
import { reconcileUserPackageStatus } from '@/lib/services/package-reconciliation'
import { refundPhotoPackageCredits } from '@/lib/services/credit-transaction-service'

interface AstriaWebhookPayload {
  id: string
  status: 'queued' | 'training' | 'trained' | 'generating' | 'generated' | 'failed' | 'cancelled'
  object: 'tune' | 'prompt'
  // Astria pode retornar images como array de strings OU array de objetos
  images?: Array<string | {
    url: string
    nsfw: boolean
    seed?: number
  }>
  logs?: string
  error_message?: string
  created_at: string
  updated_at: string
  completed_at?: string
  trained_at?: string
  // Additional fields for tunes
  name?: string
  model_type?: string
  // Additional fields for prompts
  text?: string
  tune_id?: string
  cfg_scale?: number
  steps?: number
  seed?: number
}

export async function POST(request: NextRequest) {
  // 🔍 CRITICAL: Log ALL webhook requests immediately (even before parsing)
  const requestUrl = request.url
  const requestMethod = request.method
  const requestHeaders = Object.fromEntries(request.headers.entries())
  
  console.log(`📥 [WEBHOOK_ASTRIA] Webhook request received:`, {
    method: requestMethod,
    url: requestUrl,
    headers: {
      'content-type': requestHeaders['content-type'],
      'user-agent': requestHeaders['user-agent'],
      'x-forwarded-for': requestHeaders['x-forwarded-for']
    },
    timestamp: new Date().toISOString()
  })
  
  // 🔍 DEBUG: Log URL parameters for debugging
  const url = new URL(requestUrl)
  const urlParams = {
    userId: url.searchParams.get('user_id'),
    tuneId: url.searchParams.get('tune_id'),
    promptId: url.searchParams.get('prompt_id')
  }
  console.log(`🔍 [WEBHOOK_ASTRIA_DEBUG] URL parameters:`, urlParams)
  
  try {
    console.log('🔔 Astria webhook received')

    // 🔍 CORRETO: Extrair parâmetros da URL conforme formato correto
    // TUNE: ?user_id={USER_ID}&tune_id={TUNE_ID}
    // PROMPT: ?prompt_id={PROMPT_ID}
    const url = new URL(request.url)
    const userId = url.searchParams.get('user_id')
    const tuneId = url.searchParams.get('tune_id')
    const promptId = url.searchParams.get('prompt_id')
    
    console.log(`🔍 [WEBHOOK_ASTRIA] URL parameters extracted:`, {
      userId,
      tuneId,
      promptId,
      hasUserId: !!userId,
      hasTuneId: !!tuneId,
      hasPromptId: !!promptId,
      webhookType: tuneId ? 'TUNE' : (promptId ? 'PROMPT' : 'UNKNOWN')
    })

    // 🔍 NOTA: Removido validação de secret conforme especificação
    // Callbacks do Astria não usam secret na URL, apenas user_id/tune_id ou prompt_id

    // Parse the webhook payload - handle both JSON and form-data
    // According to Astria docs: "Callbacks for prompts and tunes are POST requests containing the entity object in the request body"
    let rawPayload: any
    const contentType = request.headers.get('content-type') || ''
    
    // 🔍 CRITICAL: Read body once and store it
    let bodyText: string | null = null
    
    try {
      if (contentType.includes('application/json')) {
        rawPayload = await request.json()
      } else {
        // Try to parse as JSON anyway (some webhooks don't set content-type correctly)
        bodyText = await request.text()
        if (!bodyText || bodyText.trim().length === 0) {
          console.warn('⚠️ [WEBHOOK_ASTRIA] Empty body received')
          // According to Astria docs: "Callbacks are currently not retried if they fail"
          // So we return 200 OK to acknowledge receipt
          return NextResponse.json({ success: true, message: 'Empty payload ignored' })
        }
        rawPayload = JSON.parse(bodyText)
      }
    } catch (parseError) {
      console.error('❌ [WEBHOOK_ASTRIA] Failed to parse payload:', parseError)
      console.error('📋 [WEBHOOK_ASTRIA] Raw body (first 500 chars):', bodyText?.substring(0, 500) || 'Body already consumed')
      // According to Astria docs: "Callbacks are currently not retried if they fail"
      // So we return 200 OK to acknowledge receipt even if parsing fails
      return NextResponse.json({ success: true, message: 'Invalid payload format' })
    }
    
    // 🔍 CRITICAL: Normalize payload - Astria pode enviar payload nested { prompt: { id, ... } } ou { tune: { id, ... } } ou flat { id, ... }
    let payload: AstriaWebhookPayload
    if (rawPayload.prompt && typeof rawPayload.prompt === 'object') {
      // Payload nested: { prompt: { id, status, images, ... } }
      console.log(`🔍 [WEBHOOK_ASTRIA] Normalizing nested prompt payload structure`)
      payload = {
        ...rawPayload.prompt,
        object: rawPayload.prompt.object || 'prompt'
      } as AstriaWebhookPayload
      console.log(`✅ [WEBHOOK_ASTRIA] Normalized prompt payload:`, {
        id: payload.id,
        status: payload.status,
        object: payload.object,
        hasImages: !!(payload.images && payload.images.length > 0)
      })
    } else if (rawPayload.tune && typeof rawPayload.tune === 'object') {
      // Payload nested: { tune: { id, status, trained_at, ... } }
      console.log(`🔍 [WEBHOOK_ASTRIA] Normalizing nested tune payload structure`)
      payload = {
        ...rawPayload.tune,
        object: rawPayload.tune.object || 'tune'
      } as AstriaWebhookPayload
      console.log(`✅ [WEBHOOK_ASTRIA] Normalized tune payload:`, {
        id: payload.id,
        status: payload.status,
        object: payload.object,
        trainedAt: (payload as any).trained_at,
        hasTrainedAt: !!(payload as any).trained_at
      })
    } else {
      // Payload flat: { id, status, images, ... }
      payload = rawPayload as AstriaWebhookPayload
    }

    // Validate payload has required fields
    // 🔍 CRITICAL: Após normalização, o payload deve ter id, object ou status
    // Se não tiver nenhum, pode ser um formato diferente que precisa ser tratado
    if (!payload.id && !payload.object && !payload.status) {
      const keys = Object.keys(payload || {})
      console.warn('⚠️ [WEBHOOK_ASTRIA] Payload sem id/object/status após normalização:', {
        keys,
        payloadStructure: JSON.stringify(payload).substring(0, 500)
      })
      
      // Many Astria webhooks send transient events like { prompt: { id, text } } or { tune: { id, ... } }
      // These are informational and shouldn't be treated as warnings
      if (keys.includes('tune')) {
        // Handle nested tune payload that wasn't normalized above
        try {
          const tune: any = (payload as any).tune
          if (tune?.id) {
            console.log(`🔔 [WEBHOOK_ASTRIA] Tune payload detected, normalizing:`, {
              tuneId: tune.id,
              status: tune.status,
              trainedAt: tune.trained_at,
              hasTrainedAt: !!tune.trained_at
            })
            // Normalizar payload para estrutura plana
            payload = {
              ...tune,
              object: tune.object || 'tune'
            } as AstriaWebhookPayload
            console.log(`✅ [WEBHOOK_ASTRIA] Tune payload normalized, continuing processing`)
            // Não retornar early - continuar para processar
          }
        } catch (tuneError) {
          console.error('❌ [WEBHOOK_ASTRIA] Error normalizing tune payload:', tuneError)
        }
      } else if (keys.includes('prompt')) {
        // Optional: best-effort lookup by prompt.id just to silence retries
        try {
          const prompt: any = (payload as any).prompt
          if (prompt?.id) {
            const generation = await prisma.generation.findFirst({ where: { jobId: String(prompt.id) } })
            // 🔍 CRITICAL: Verificar se é heartbeat ou callback final
            // Se tem imagens, é callback final e deve ser processado
            const hasImages = prompt.images && Array.isArray(prompt.images) && prompt.images.length > 0
            const isFinal = prompt.status === 'generated' || prompt.status === 'failed'
            
            if (hasImages || isFinal) {
              console.log(`🔔 [WEBHOOK_ASTRIA] Callback final detected (not heartbeat) - normalizing and processing:`, {
                promptId: prompt.id,
                status: prompt.status,
                hasImages,
                imageCount: prompt.images?.length || 0
              })
              // Normalizar payload para estrutura plana
              payload = {
                ...prompt,
                object: prompt.object || 'prompt'
              } as AstriaWebhookPayload
              console.log(`✅ [WEBHOOK_ASTRIA] Payload normalized, continuing processing`)
              // Não retornar early - continuar para processar
            } else {
              // We intentionally do nothing – this is a heartbeat/echo event
              if (generation) {
                console.log(`ℹ️ Astria prompt heartbeat received for generation ${generation.id}`)
              } else {
                console.log(`ℹ️ Astria prompt heartbeat received (jobId: ${prompt.id})`)
              }
              return NextResponse.json({ success: true, message: 'Prompt-only event ignored' })
            }
          }
        } catch {
          // Ignore lookup errors silently
        }
        
        // Se chegou aqui e não retornou, é porque tem imagens ou é final - continuar processamento
        if (!keys.includes('prompt') || !(payload as any).prompt?.id) {
          return NextResponse.json({ success: true, message: 'Prompt-only event ignored' })
        }
      }

      // Otherwise, log once and ignore
      console.warn('⚠️ Astria webhook received incomplete payload:', {
        hasId: !!(payload as any)?.id,
        hasObject: !!(payload as any)?.object,
        hasStatus: !!(payload as any)?.status,
        keys,
        rawPayload: JSON.stringify(payload).substring(0, 200)
      })
      // Return success to avoid webhook retries
      return NextResponse.json({ success: true, message: 'Incomplete payload ignored' })
    }

    console.log('📋 Astria webhook payload:', {
      id: payload.id,
      status: payload.status,
      object: payload.object,
      hasImages: !!payload.images?.length,
      imageCount: payload.images?.length || 0,
      errorMessage: payload.error_message,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      isHeartbeat: payload.status === 'generating' || payload.status === 'queued',
      isFinal: payload.status === 'generated' || payload.status === 'failed',
      willProcess: (payload.status === 'generated' && payload.images && payload.images.length > 0) || payload.status === 'failed'
    })

    // 🔒 CRITICAL: Handle different object types and ensure processing completes
    let processingResult: { success: boolean; error?: string } = { success: false }
    
    try {
      // 🔍 CORRETO: Determinar tipo de webhook baseado em object ou parâmetros da URL
      const webhookType = payload.object || (tuneId ? 'tune' : (promptId ? 'prompt' : null))
      
      if (webhookType === 'tune' || tuneId) {
        // TUNE webhook: usar tune_id da URL, do payload.id, ou extrair da URL do payload
        let actualTuneId = tuneId || String(payload.id)
        
        // 🔍 CRITICAL: Se tuneId da URL é literalmente o placeholder, usar payload.id
        if (actualTuneId === '{TUNE_ID}' || actualTuneId === '%7BTUNE_ID%7D') {
          console.log(`⚠️ [WEBHOOK_ASTRIA] URL contains literal placeholder, using payload.id instead`)
          actualTuneId = String(payload.id)
        }
        
        // 🔍 CRITICAL: Se não temos tune_id, tentar extrair da URL do payload
        if (!actualTuneId || actualTuneId === '{TUNE_ID}' || actualTuneId === '%7BTUNE_ID%7D') {
          if (payload.url) {
            const extractedIds = extractIdsFromAstriaUrl(payload.url)
            if (extractedIds.tuneId) {
              actualTuneId = extractedIds.tuneId
              console.log(`🔍 [WEBHOOK_ASTRIA] Extracted tune_id from payload.url: ${actualTuneId}`)
            }
          }
        }
        
        // 🔍 CRITICAL: Se ainda não temos tune_id, usar payload.id como fallback
        if (!actualTuneId || actualTuneId === '{TUNE_ID}' || actualTuneId === '%7BTUNE_ID%7D') {
          if (payload.id) {
            actualTuneId = String(payload.id)
            console.log(`🔍 [WEBHOOK_ASTRIA] Using payload.id as tune_id: ${actualTuneId}`)
          }
        }
        
        if (actualTuneId && actualTuneId !== '{TUNE_ID}' && actualTuneId !== '%7BTUNE_ID%7D') {
          await handleTuneWebhook(payload, actualTuneId, userId)
          processingResult.success = true
          console.log('✅ [WEBHOOK_ASTRIA] Tune webhook processed successfully')
        } else {
          console.error('❌ [WEBHOOK_ASTRIA] Cannot process tune webhook - no valid tune_id available')
          processingResult.error = 'No valid tune_id available in URL or payload'
        }
      } else if (webhookType === 'prompt' || promptId || (!tuneId && payload.id)) {
        // PROMPT webhook: usar prompt_id da URL, do payload.id, ou extrair da URL do payload
        let actualPromptId = promptId || String(payload.id)
        
        // 🔍 CRITICAL: Se promptId da URL é literalmente o placeholder, usar payload.id
        if (actualPromptId === '{PROMPT_ID}' || actualPromptId === '%7BPROMPT_ID%7D') {
          console.log(`⚠️ [WEBHOOK_ASTRIA] URL contains literal placeholder, using payload.id instead`)
          actualPromptId = String(payload.id)
        }
        
        // 🔍 CRITICAL: Se não temos prompt_id, tentar extrair da URL do payload
        if (!actualPromptId || actualPromptId === '{PROMPT_ID}' || actualPromptId === '%7BPROMPT_ID%7D') {
          if (payload.url) {
            const extractedIds = extractIdsFromAstriaUrl(payload.url)
            if (extractedIds.promptId) {
              actualPromptId = extractedIds.promptId
              console.log(`🔍 [WEBHOOK_ASTRIA] Extracted prompt_id from payload.url: ${actualPromptId}`)
            }
          }
        }
        
        // 🔍 CRITICAL: Se ainda não temos prompt_id, usar payload.id como fallback
        if (!actualPromptId || actualPromptId === '{PROMPT_ID}' || actualPromptId === '%7BPROMPT_ID%7D') {
          if (payload.id) {
            actualPromptId = String(payload.id)
            console.log(`🔍 [WEBHOOK_ASTRIA] Using payload.id as prompt_id: ${actualPromptId}`)
          }
        }
        
        if (actualPromptId && actualPromptId !== '{PROMPT_ID}' && actualPromptId !== '%7BPROMPT_ID%7D') {
          await handlePromptWebhook(payload, actualPromptId)
          processingResult.success = true
          console.log('✅ [WEBHOOK_ASTRIA] Prompt webhook processed successfully')
        } else {
          console.error('❌ [WEBHOOK_ASTRIA] Cannot process prompt webhook - no valid prompt_id available')
          processingResult.error = 'No valid prompt_id available in URL or payload'
        }
      } else {
        console.warn('⚠️ Unknown Astria webhook type:', { object: payload.object, tuneId, promptId })
        // Still try to process if we have an ID (might be a generation webhook without object field)
        if (payload.id && payload.status) {
          console.log('🔄 Attempting to process as prompt webhook (object field missing)')
          await handlePromptWebhook(payload, String(payload.id))
          processingResult.success = true
          console.log('✅ [WEBHOOK_ASTRIA] Prompt webhook (fallback) processed successfully')
        } else {
          processingResult.error = 'Unknown object type and no ID/status to process'
        }
      }
    } catch (processingError) {
      console.error('❌ [WEBHOOK_ASTRIA] Error during webhook processing:', processingError)
      processingResult.error = processingError instanceof Error ? processingError.message : String(processingError)
      // Don't throw - we'll return 200 but log the error
    }

    // 🔒 CRITICAL: Always return 200 to prevent retries, but log if processing failed
    const response = NextResponse.json({
      success: processingResult.success,
      message: processingResult.success
        ? 'Webhook processed successfully'
        : `Webhook acknowledged but processing failed: ${processingResult.error}`,
      timestamp: new Date().toISOString()
    })

    console.log(`✅ [WEBHOOK_ASTRIA] Returning HTTP 200 OK - success: ${processingResult.success}`)
    return response
  } catch (error) {
    console.error('❌ CRITICAL: Astria webhook error:', error)
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown'
    })
    
    // CRITICAL: Log the full error context for debugging
    if (error instanceof Error) {
      console.error('❌ Error name:', error.name)
      console.error('❌ Error message:', error.message)
      if (error.stack) {
        console.error('❌ Error stack:', error.stack)
      }
    }
    
    // CRITICAL: Return 200 OK even on errors to prevent infinite retries
    // But log the error so we can investigate
    return NextResponse.json(
      { 
        success: false, 
        error: 'Webhook processing failed but acknowledged',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 200 } // Always return 200 to prevent retries
    )
  }
}

/**
 * 🔍 CORRETO: Extrair tune_id e prompt_id de URLs do Astria
 * Formato: https://api.astria.ai/tunes/{TUNE_ID}/prompts/{PROMPT_ID}.json
 */
function extractIdsFromAstriaUrl(url: string | null | undefined): { tuneId?: string; promptId?: string } {
  if (!url) return {}
  
  const tuneMatch = url.match(/\/tunes\/(\d+)\//)
  const promptMatch = url.match(/\/prompts\/(\d+)/)
  
  return {
    tuneId: tuneMatch ? tuneMatch[1] : undefined,
    promptId: promptMatch ? promptMatch[1] : undefined
  }
}

async function handleTuneWebhook(payload: AstriaWebhookPayload, tuneIdFromUrl?: string, userIdFromUrl?: string | null) {
  try {
    // 🔍 CORRETO: Extrair tune_id da URL do payload (conforme documentação Astria)
    // O output do Astria mostra: url: "https://www.astria.ai/tunes/788416.json"
    // O tune_id real está na URL, não no base_tune_id (que vem como null no output)
    let tuneId = tuneIdFromUrl || String(payload.id)
    
    // 🔍 CRITICAL: Se não temos tune_id válido, tentar extrair da URL do payload
    if (!tuneId || tuneId === '{TUNE_ID}' || tuneId === '%7BTUNE_ID%7D') {
      if (payload.url) {
        const extractedIds = extractIdsFromAstriaUrl(payload.url)
        if (extractedIds.tuneId) {
          tuneId = extractedIds.tuneId
          console.log(`🔍 [WEBHOOK_ASTRIA_TUNE] Extracted tune_id from payload.url: ${tuneId}`)
        }
      }
    }
    
    // 🔍 CRITICAL: Se ainda não temos tune_id, usar payload.id como fallback
    if (!tuneId || tuneId === '{TUNE_ID}' || tuneId === '%7BTUNE_ID%7D') {
      if (payload.id) {
        tuneId = String(payload.id)
        console.log(`🔍 [WEBHOOK_ASTRIA_TUNE] Using payload.id as tune_id: ${tuneId}`)
      }
    }
    
    const tuneIdNum = typeof payload.id === 'number' ? payload.id : parseInt(tuneId)
    
    console.log(`🔍 [WEBHOOK_ASTRIA_TUNE] Processing tune webhook:`, {
      tuneIdFromUrl,
      tuneIdFromPayload: payload.id,
      tuneIdFromPayloadUrl: payload.url ? extractIdsFromAstriaUrl(payload.url).tuneId : undefined,
      finalTuneId: tuneId,
      userIdFromUrl,
      payloadUrl: payload.url
    })
    
    const model = await prisma.aIModel.findFirst({
      where: {
        OR: [
          { trainingJobId: tuneId },
          { trainingJobId: String(tuneIdNum) },
          // Fallback: buscar por metadata em trainingConfig
          {
            trainingConfig: {
              path: ['trainingId'],
              equals: tuneId
            }
          }
        ]
      }
    })

    if (!model) {
      console.warn(`⚠️ No model found for Astria tune: ${payload.id} (tried as string "${tuneId}" and number ${tuneIdNum})`)
      console.warn('📋 Available trainingJobIds in database:', await prisma.aIModel.findMany({
        where: { status: { in: ['TRAINING', 'PROCESSING'] } },
        select: { id: true, trainingJobId: true, name: true }
      }).then(models => models.map(m => ({ modelId: m.id, trainingJobId: m.trainingJobId, name: m.name }))))
      return
    }

    console.log(`🎯 Processing Astria tune webhook for model: ${model.id}`)
    console.log(`📊 Current model status in DB: ${model.status}`)
    console.log(`📊 Current model progress: ${model.progress}%`)

    // Map Astria status to our internal status
    console.log(`📊 Astria webhook payload status: "${payload.status}" (type: ${typeof payload.status})`)
    console.log(`📊 Astria webhook payload trained_at: "${(payload as any).trained_at}"`)
    
    let internalStatus: 'TRAINING' | 'READY' | 'FAILED'
    const statusLower = payload.status ? String(payload.status).toLowerCase() : ''
    const hasTrainedAt = !!(payload as any).trained_at
    
    // 🔍 CRITICAL: Se não há status mas há trained_at, inferir que está "trained" (READY)
    if (statusLower === 'trained' || (!statusLower && hasTrainedAt)) {
      internalStatus = 'READY'
      if (!statusLower && hasTrainedAt) {
        console.log(`✅ Inferring status from trained_at → READY (trained_at: ${(payload as any).trained_at})`)
      } else {
        console.log(`✅ Mapping Astria "trained" → READY`)
      }
    } else if (statusLower === 'failed' || statusLower === 'cancelled') {
      internalStatus = 'FAILED'
      console.log(`❌ Mapping Astria "${payload.status}" → FAILED`)
    } else {
      internalStatus = 'TRAINING'
      console.log(`⏳ Mapping Astria "${payload.status || 'unknown'}" → TRAINING`)
    }

    // CRITICAL: Check idempotency - if model is already READY and we're receiving "trained" again, skip update
    if (model.status === 'READY' && internalStatus === 'READY') {
      console.log(`⏭️ Model ${model.id} is already READY, skipping duplicate update (idempotency check)`)
      return model // Return existing model without updating
    }

    // Update the model with the new status
    const updateData: any = {
      status: internalStatus as any,
      progress: internalStatus === 'READY' ? 100 : (internalStatus === 'TRAINING' ? model.progress || 20 : 0),
      errorMessage: payload.error_message || undefined,
      aiProvider: 'astria',
      updatedAt: new Date() // Explicitly set updatedAt
    }

    if (internalStatus === 'READY') {
      // When training is complete (READY), set modelUrl and trainedAt
      updateData.modelUrl = String(payload.id) // Use tune ID as model URL
      updateData.trainedAt = (payload as any).trained_at ? new Date((payload as any).trained_at) : new Date()
      console.log(`📝 Setting modelUrl to: ${updateData.modelUrl}`)
      console.log(`📝 Setting trainedAt to: ${updateData.trainedAt}`)
    }

    if (payload.logs) {
      updateData.trainingLogs = [payload.logs]
      console.log(`📝 Adding training logs (length: ${payload.logs.length})`)
    }

    console.log(`💾 Attempting to update model ${model.id} with data:`, {
      status: updateData.status,
      progress: updateData.progress,
      hasModelUrl: !!updateData.modelUrl,
      hasTrainedAt: !!updateData.trainedAt,
      hasLogs: !!updateData.trainingLogs
    })

    let updatedModel
    try {
      updatedModel = await prisma.aIModel.update({
        where: { id: model.id },
        data: updateData
      })
      console.log(`✅ Model ${model.id} successfully updated to status: ${updatedModel.status}, progress: ${updatedModel.progress}%`)

      // Broadcast to admins when model status changes
      try {
        const { broadcastAdminModelUpdated } = await import('@/lib/services/realtime-service')
        await broadcastAdminModelUpdated(model.id, {
          status: updatedModel.status,
          progress: updatedModel.progress,
          modelUrl: updatedModel.modelUrl,
          trainedAt: updatedModel.trainedAt?.toISOString()
        })
      } catch (broadcastError) {
        console.error('❌ Failed to broadcast model updated event:', broadcastError)
        // Don't fail webhook if broadcast fails
      }
    } catch (updateError) {
      console.error(`❌ CRITICAL: Failed to update model ${model.id}:`, updateError)
      console.error(`❌ Update error details:`, {
        message: updateError instanceof Error ? updateError.message : String(updateError),
        stack: updateError instanceof Error ? updateError.stack : undefined,
        updateData: JSON.stringify(updateData, null, 2)
      })
      // Re-throw to be caught by outer try-catch
      throw updateError
    }

    // Broadcast model status change to the owner
    try {
      console.log(`📡 Broadcasting model status change for model ${model.id}: ${updatedModel.status}`)
      await broadcastModelStatusChange(model.id, updatedModel.userId, updatedModel.status, {
        progress: updatedModel.status === 'READY' ? 100 : updatedModel.progress || 0,
        modelUrl: updatedModel.modelUrl
      })
      console.log(`✅ Broadcast sent successfully for model ${model.id}`)
    } catch (e) {
      console.error('❌ Failed to broadcast model status change:', e)
      console.error('❌ Broadcast error details:', {
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined
      })
      // Don't fail the webhook for broadcast errors, but log them
    }

    // If training completed successfully, generate sample images
    if (internalStatus === 'READY' && payload.status === 'trained') {
      try {
        console.log(`🎨 Starting sample generation for trained model: ${model.id}`)

        // Generate sample images using the trained model
        await generateSampleImages(model.id, payload.id, model.userId)
      } catch (sampleError) {
        console.error('❌ Sample generation failed:', sampleError)
        // Don't fail the webhook for sample generation errors
      }
    }
    
    // If training failed, refund credits (idempotente)
    if (internalStatus === 'FAILED') {
      try {
        const refund = await refundModelCreationCredits(model.userId, model.id, model.name)
        if (refund.success) {
          console.log(`↩️ Credits refunded via webhook for model ${model.id}: +${refund.refundedAmount}`)
        } else {
          console.warn('⚠️ Webhook refund skipped:', refund.message)
        }
      } catch (err) {
        console.error('❌ Webhook refund error:', err)
      }
    }

    return updatedModel
  } catch (error) {
    console.error('❌ Error handling Astria tune webhook:', error)
    throw error
  }
}

async function handlePromptWebhook(payload: AstriaWebhookPayload, promptIdFromUrl?: string) {
  try {
    // 🔍 CORRETO: Usar prompt_id da URL (prioridade) ou do payload
    const promptId = promptIdFromUrl || String(payload.id)
    
    // 🔍 CORRETO: Extrair tune_id da URL do Astria se disponível
    // Formato: https://api.astria.ai/tunes/{TUNE_ID}/prompts/{PROMPT_ID}.json
    let tuneIdFromAstriaUrl: string | undefined
    if (payload.url) {
      const extractedIds = extractIdsFromAstriaUrl(payload.url)
      tuneIdFromAstriaUrl = extractedIds.tuneId
      console.log(`🔍 [WEBHOOK_ASTRIA_PROMPT] Extracted IDs from Astria URL:`, {
        url: payload.url,
        tuneId: extractedIds.tuneId,
        promptId: extractedIds.promptId,
        matchesPayloadPromptId: extractedIds.promptId === promptId
      })
    }
    
    console.log(`🔍 [WEBHOOK_ASTRIA_PROMPT] Looking for generation with prompt_id:`, {
      promptIdFromUrl,
      promptIdFromPayload: payload.id,
      finalPromptId: promptId,
      tuneIdFromAstriaUrl,
      status: payload.status,
      object: payload.object,
      astriaUrl: payload.url
    })
    
    // 🔍 CORRETO: Buscar geração por prompt_id (jobId)
    const generation = await prisma.generation.findFirst({
      where: {
        jobId: promptId
      }
    })

    if (!generation) {
      // Try alternative formats (number as string, etc.)
      console.error('❌ [WEBHOOK_ASTRIA] CRITICAL: No generation found for Astria prompt:', {
        payloadId: payload.id,
        promptId,
        payloadIdType: typeof payload.id,
        // Try to find any generation with similar jobId
        recentGenerations: await prisma.generation.findMany({
          where: {
            status: 'PROCESSING',
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          },
          select: {
            id: true,
            jobId: true,
            status: true,
            createdAt: true,
            metadata: true
          },
          take: 5,
          orderBy: { createdAt: 'desc' }
        }).then(gens => gens.map(g => ({
          id: g.id,
          jobId: g.jobId,
          status: g.status,
          metadata: (g.metadata as any)?.source
        })))
      })
      throw new Error(`Generation not found for jobId: ${payload.id} (as string: ${promptId})`)
    }

    console.log(`🎯 Processing Astria prompt webhook for generation: ${generation.id}`)

    // Map Astria status to our internal status
    let internalStatus: 'PROCESSING' | 'COMPLETED' | 'FAILED'
    
    // 🔍 CRITICAL: Se status é undefined mas há imagens, tratar como COMPLETED
    if (!payload.status && payload.images && payload.images.length > 0) {
      console.log(`🔍 [WEBHOOK_ASTRIA_PROMPT] Status is undefined but images present - treating as COMPLETED`)
      internalStatus = 'COMPLETED'
    } else {
      switch (payload.status) {
        case 'generated':
          internalStatus = 'COMPLETED'
          break
        case 'failed':
        case 'cancelled':
          internalStatus = 'FAILED'
          break
        case 'generating':
        case 'queued':
        default:
          internalStatus = 'PROCESSING'
      }
    }
    
    // 🔍 CRITICAL: Log webhook status for debugging
    console.log(`📊 [WEBHOOK_ASTRIA_PROMPT] Webhook status:`, {
      astriaStatus: payload.status,
      internalStatus,
      hasImages: !!(payload.images && payload.images.length > 0),
      imageCount: payload.images?.length || 0,
      isHeartbeat: payload.status === 'generating' || payload.status === 'queued',
      isFinal: payload.status === 'generated' || payload.status === 'failed' || (!payload.status && payload.images && payload.images.length > 0)
    })
    
    // ⚠️ CRITICAL: Se é apenas heartbeat (generating/queued) sem imagens, retornar early mas não processar storage
    if ((payload.status === 'generating' || payload.status === 'queued') && (!payload.images || payload.images.length === 0)) {
      console.log(`ℹ️ [WEBHOOK_ASTRIA_PROMPT] Heartbeat received (status: ${payload.status}), skipping storage processing`)
      // Ainda atualizar status para PROCESSING se necessário, mas não processar storage
      // Não retornar early - continuar para atualizar status se necessário
    }

    // Extract image URLs if generation completed
    let imageUrls: string[] = []
    if (payload.images && payload.images.length > 0) {
      // 🔧 CORREÇÃO: Astria retorna images como array de strings, não objetos
      if (typeof payload.images[0] === 'string') {
        // Nova estrutura: array de strings diretas
        imageUrls = payload.images.filter(url => typeof url === 'string' && url.trim().length > 0)
        console.log(`🎯 [WEBHOOK_ASTRIA_FIX] Extracted ${imageUrls.length} URLs from string array`)
      } else if (payload.images[0]?.url) {
        // Estrutura antiga: array de objetos com propriedade url
        imageUrls = payload.images.map(img => img.url).filter(url => url && url.trim().length > 0)
        console.log(`🎯 [WEBHOOK_ASTRIA_LEGACY] Extracted ${imageUrls.length} URLs from object array`)
      }
    }

    // Calculate processing time
    let processingTime: number | undefined
    if (payload.completed_at) {
      const startTime = new Date(generation.createdAt).getTime()
      const endTime = new Date(payload.completed_at).getTime()
      processingTime = endTime - startTime
    }

    // If generation completed successfully, store images permanently BEFORE updating database
    let finalImageUrls = imageUrls
    let finalThumbnailUrls: string[] = [] // Initialize thumbnail URLs
    let storageResult: any = null // Initialize storageResult
    
    // CRITICAL: Check if this is a package generation for logging
    const generationMetadata = generation.metadata as any
    const isPackageGeneration = generationMetadata?.source === 'package' && generationMetadata?.userPackageId
    
    console.log(`💾 [WEBHOOK_ASTRIA] Storage check for generation ${generation.id}:`, {
      status: internalStatus,
      imageUrlsCount: imageUrls.length,
      isPackageGeneration,
      userPackageId: isPackageGeneration ? generationMetadata.userPackageId : null,
      packageId: generation.packageId || null
    })
    
    if (internalStatus === 'COMPLETED' && imageUrls.length > 0) {
      try {
        console.log(`💾 [WEBHOOK_ASTRIA] Storing ${imageUrls.length} images permanently for generation: ${generation.id}${isPackageGeneration ? ` (PACKAGE: ${generationMetadata.userPackageId})` : ''}`)

        // Import storage utility
        const { downloadAndStoreImages } = await import('@/lib/storage/utils')

        // Download and store images permanently
        console.log(`📥 [WEBHOOK_ASTRIA] Calling downloadAndStoreImages with:`, {
          imageUrlsCount: imageUrls.length,
          generationId: generation.id,
          userId: generation.userId,
          firstUrl: imageUrls[0]?.substring(0, 100) + '...'
        })
        
        storageResult = await downloadAndStoreImages(
          imageUrls,
          generation.id,
          generation.userId
        )

        console.log(`📊 [WEBHOOK_ASTRIA] Storage result:`, {
          success: storageResult.success,
          permanentUrlsCount: storageResult.permanentUrls?.length || 0,
          error: storageResult.error,
          hasPermanentUrls: !!(storageResult.permanentUrls && storageResult.permanentUrls.length > 0),
          thumbnailUrlsCount: storageResult.thumbnailUrls?.length || 0,
          thumbnailUrls: storageResult.thumbnailUrls?.map((url: string) => url.substring(0, 100) + '...') || [],
          // 🔒 CRITICAL: Verify thumbnail count matches image count
          thumbnailMatch: storageResult.thumbnailUrls?.length === storageResult.permanentUrls?.length
        })
        
        // 🔒 CRITICAL: Log warning if thumbnail count doesn't match image count
        if (storageResult.thumbnailUrls && storageResult.permanentUrls) {
          if (storageResult.thumbnailUrls.length !== storageResult.permanentUrls.length) {
            console.warn(`⚠️ [WEBHOOK_ASTRIA] Thumbnail count mismatch: ${storageResult.thumbnailUrls.length} thumbnails for ${storageResult.permanentUrls.length} images`)
          }
        }

        if (storageResult.success && storageResult.permanentUrls && storageResult.permanentUrls.length > 0) {
          console.log(`✅ [WEBHOOK_ASTRIA] Successfully stored ${storageResult.permanentUrls.length} images permanently for generation ${generation.id}`)
          console.log(`📸 [WEBHOOK_ASTRIA] Permanent URLs saved:`, storageResult.permanentUrls.map((url: string) => url.substring(0, 100) + '...'))
          // Use permanent URLs for database update
          finalImageUrls = storageResult.permanentUrls
          
          // 🔒 CRITICAL: Save thumbnail URLs if available
          if (storageResult.thumbnailUrls && storageResult.thumbnailUrls.length > 0) {
            finalThumbnailUrls = storageResult.thumbnailUrls
            console.log(`✅ [WEBHOOK_ASTRIA] Thumbnail URLs saved: ${finalThumbnailUrls.length} thumbnails`)
            console.log(`🖼️ [WEBHOOK_ASTRIA] Thumbnail URLs:`, finalThumbnailUrls.map((url: string) => url.substring(0, 100) + '...'))
            
            // 🔒 CRITICAL: Verify thumbnail count matches image count
            if (finalThumbnailUrls.length !== finalImageUrls.length) {
              console.warn(`⚠️ [WEBHOOK_ASTRIA] Thumbnail count mismatch: ${finalThumbnailUrls.length} thumbnails for ${finalImageUrls.length} images`)
            }
          } else {
            console.warn(`⚠️ [WEBHOOK_ASTRIA] No thumbnail URLs in storage result for generation ${generation.id}`)
            console.warn(`⚠️ [WEBHOOK_ASTRIA] Thumbnails will be generated from permanent URLs as fallback`)
          }
        } else {
          console.error(`❌ [WEBHOOK_ASTRIA] CRITICAL: Storage failed for generation ${generation.id}:`, {
            success: storageResult.success,
            error: storageResult.error,
            hasPermanentUrls: !!(storageResult.permanentUrls && storageResult.permanentUrls.length > 0),
            permanentUrlsCount: storageResult.permanentUrls?.length || 0,
            originalUrlsCount: imageUrls.length,
            storageResultKeys: Object.keys(storageResult || {})
          })
          // Keep original URLs if storage fails
          finalImageUrls = imageUrls
          console.warn(`⚠️ [WEBHOOK_ASTRIA] Using temporary URLs from Astria (storage failed)`)
        }
      } catch (storageError) {
        console.error(`❌ [WEBHOOK_ASTRIA] Storage failed with exception for generation ${generation.id}:`, storageError)
        console.error('❌ Error name:', storageError instanceof Error ? storageError.name : 'Unknown')
        console.error('❌ Error message:', storageError instanceof Error ? storageError.message : 'Unknown')
        console.error('❌ Error stack:', storageError instanceof Error ? storageError.stack : 'No stack')

        // Don't fail the webhook for storage errors - images are still accessible via original URLs
        // But mark generation with error message for debugging
        finalImageUrls = imageUrls
        storageResult = { success: false, error: storageError instanceof Error ? storageError.message : 'Unknown error' }

        // Store error in generation for debugging
        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            errorMessage: `Warning: Storage failed, images may expire. Error: ${storageError instanceof Error ? storageError.message : 'Unknown'}`
          }
        })
      }
    } else {
      console.warn(`⚠️ [WEBHOOK_ASTRIA] Skipping storage for generation ${generation.id}:`, {
        status: internalStatus,
        imageUrlsCount: imageUrls.length,
        reason: internalStatus !== 'COMPLETED' ? 'Status is not COMPLETED' : 'No image URLs'
      })
    }

    // 🔍 CORRETO: Extrair tune_id da URL do Astria se disponível
    // Formato: https://api.astria.ai/tunes/{TUNE_ID}/prompts/{PROMPT_ID}.json
    let extractedTuneId: string | undefined
    if (payload.url) {
      const extractedIds = extractIdsFromAstriaUrl(payload.url)
      extractedTuneId = extractedIds.tuneId
      console.log(`🔍 [WEBHOOK_ASTRIA_PROMPT] Extracted tune_id from Astria URL:`, {
        url: payload.url,
        tuneId: extractedTuneId,
        promptId: extractedIds.promptId
      })
    }
    
    // Store temporary URLs in metadata for modal display
    const existingMetadata = (generation.metadata as any) || {}
    const updatedMetadata = {
      ...existingMetadata,
      temporaryUrls: imageUrls.length > 0 ? imageUrls : existingMetadata.temporaryUrls || [],
      permanentUrls: finalImageUrls.length > 0 ? finalImageUrls : existingMetadata.permanentUrls || [],
      originalUrls: imageUrls.length > 0 ? imageUrls : existingMetadata.originalUrls || [],
      // 🔍 CORRETO: Armazenar tune_id e prompt_id extraídos
      tune_id: extractedTuneId || existingMetadata.tune_id,
      prompt_id: promptId, // 🔍 CORRETO: prompt_id é o ID do prompt
      // 🔒 CRITICAL: Mark that webhook processed this generation
      webhookProcessed: true,
      processedVia: 'webhook',
      processedAt: new Date().toISOString(),
      stored: storageResult?.success && storageResult?.permanentUrls?.length > 0,
      storedAt: storageResult?.success ? new Date().toISOString() : undefined
    }
    
    // 🔒 CRITICAL: Update the generation with the new status and final image URLs
    // ⚠️ CRITICAL: Only update status to COMPLETED if we have URLs (permanent or temporary)
    if (internalStatus === 'COMPLETED' && finalImageUrls.length === 0) {
      console.error(`❌ [WEBHOOK_ASTRIA] CRITICAL: Cannot update status to COMPLETED - no URLs available for generation ${generation.id}`)
      console.error(`❌ [WEBHOOK_ASTRIA] Details:`, {
        status: internalStatus,
        imageUrlsCount: imageUrls.length,
        finalImageUrlsCount: finalImageUrls.length,
        hasStorageResult: !!storageResult,
        storageSuccess: storageResult?.success,
        storageError: storageResult?.error
      })
      // Don't update status to COMPLETED if there are no URLs
      internalStatus = 'FAILED'
    }
    
    console.log(`💾 [WEBHOOK_ASTRIA] Updating generation ${generation.id} in database:`, {
      status: internalStatus,
      finalImageUrlsCount: finalImageUrls.length,
      hasStorageResult: !!storageResult,
      storageSuccess: storageResult?.success,
      permanentUrlsCount: storageResult?.permanentUrls?.length || 0,
      willUpdateStatus: internalStatus,
      hasUrls: finalImageUrls.length > 0
    })
    
    let updatedGeneration
    try {
      // 🔍 VERIFICATION: Before updating, verify we have URLs if status is COMPLETED
      if (internalStatus === 'COMPLETED' && finalImageUrls.length === 0) {
        console.error(`❌ [WEBHOOK_ASTRIA] CRITICAL: Attempting to update with COMPLETED status but no URLs! This should not happen.`)
        throw new Error(`Cannot update generation to COMPLETED status without image URLs`)
      }
      
      // 🔒 CRITICAL: Prepare update data with thumbnail URLs
      const updateData: any = {
        status: internalStatus as any,
        imageUrls: finalImageUrls.length > 0 ? finalImageUrls as any : generation.imageUrls,
        completedAt: payload.completed_at ? new Date(payload.completed_at) : undefined,
        processingTime: processingTime,
        errorMessage: payload.error_message || undefined,
        metadata: updatedMetadata as any, // Includes webhookProcessed: true
        // Update seed if provided
        seed: payload.seed || generation.seed
      }
      
      // 🔒 CRITICAL: Update thumbnailUrls if available (for gallery performance)
      // Thumbnails are essential for gallery performance - always try to save them
      // Priority: finalThumbnailUrls > storageResult.thumbnailUrls > generate from permanent URLs
      if (finalThumbnailUrls.length > 0) {
        updateData.thumbnailUrls = finalThumbnailUrls as any
        console.log(`✅ [WEBHOOK_ASTRIA] Updating thumbnailUrls in database: ${finalThumbnailUrls.length} thumbnails`)
      } else if (storageResult?.thumbnailUrls && storageResult.thumbnailUrls.length > 0) {
        // Fallback: use thumbnailUrls from storageResult if finalThumbnailUrls is empty
        updateData.thumbnailUrls = storageResult.thumbnailUrls as any
        console.log(`✅ [WEBHOOK_ASTRIA] Using thumbnailUrls from storageResult: ${storageResult.thumbnailUrls.length} thumbnails`)
      } else if (finalImageUrls.length > 0) {
        // 🔒 CRITICAL: If thumbnails are missing, generate them from permanent URLs BEFORE updating database
        // This ensures thumbnails are ALWAYS available for gallery performance
        console.warn(`⚠️ [WEBHOOK_ASTRIA] CRITICAL: No thumbnailUrls in storage result for generation ${generation.id}`)
        console.log(`🔄 [WEBHOOK_ASTRIA] Generating thumbnails from permanent URLs as fallback...`)
        
        try {
          // Generate thumbnails from permanent URLs
          const { downloadAndStoreImages } = await import('@/lib/storage/utils')
          const thumbnailGenerationResult = await downloadAndStoreImages(
            finalImageUrls, // Use permanent URLs to generate thumbnails
            generation.id,
            generation.userId
          )
          
          if (thumbnailGenerationResult.thumbnailUrls && thumbnailGenerationResult.thumbnailUrls.length > 0) {
            updateData.thumbnailUrls = thumbnailGenerationResult.thumbnailUrls as any
            console.log(`✅ [WEBHOOK_ASTRIA] Successfully generated ${thumbnailGenerationResult.thumbnailUrls.length} thumbnails from permanent URLs`)
          } else {
            console.error(`❌ [WEBHOOK_ASTRIA] Failed to generate thumbnails from permanent URLs. Gallery will use full images (performance impact).`)
            // Don't set thumbnailUrls - let it remain null/empty so gallery knows to use imageUrls
          }
        } catch (thumbnailGenError) {
          console.error(`❌ [WEBHOOK_ASTRIA] Error generating thumbnails from permanent URLs:`, thumbnailGenError)
          // Don't fail the entire update, but log error
        }
      } else {
        console.warn(`⚠️ [WEBHOOK_ASTRIA] No thumbnailUrls and no imageUrls to save for generation ${generation.id}`)
      }
      
      updatedGeneration = await prisma.generation.update({
        where: { id: generation.id },
        data: updateData
      })
      
      console.log(`✅ [WEBHOOK_ASTRIA] Generation ${generation.id} successfully updated in database:`, {
        generationId: updatedGeneration.id,
        status: updatedGeneration.status,
        imageUrlsCount: Array.isArray(updatedGeneration.imageUrls) ? (updatedGeneration.imageUrls as string[]).length : 0,
        thumbnailUrlsCount: Array.isArray(updatedGeneration.thumbnailUrls) ? (updatedGeneration.thumbnailUrls as string[]).length : 0,
        hasCompletedAt: !!updatedGeneration.completedAt,
        hasMetadata: !!updatedGeneration.metadata
      })

      // Broadcast to admins when generation is updated
      try {
        const { broadcastAdminGenerationUpdated } = await import('@/lib/services/realtime-service')
        await broadcastAdminGenerationUpdated(generation.id, {
          status: updatedGeneration.status,
          imageUrlsCount: Array.isArray(updatedGeneration.imageUrls) ? (updatedGeneration.imageUrls as string[]).length : 0,
          completedAt: updatedGeneration.completedAt?.toISOString()
        })
      } catch (broadcastError) {
        console.error('❌ Failed to broadcast generation updated event:', broadcastError)
        // Don't fail webhook if broadcast fails
      }
      
      // 🔒 CRITICAL: Verify the update actually happened
      const verification = await prisma.generation.findUnique({
        where: { id: generation.id },
        select: { status: true, imageUrls: true, thumbnailUrls: true, completedAt: true }
      })
      
      if (!verification) {
        throw new Error(`Generation ${generation.id} not found after update`)
      }
      
      if (verification.status !== internalStatus) {
        throw new Error(`Generation status mismatch: expected ${internalStatus}, got ${verification.status}`)
      }
      
      const verificationUrls = Array.isArray(verification.imageUrls) ? (verification.imageUrls as string[]) : []
      if (internalStatus === 'COMPLETED' && verificationUrls.length === 0 && finalImageUrls.length > 0) {
        throw new Error(`Generation imageUrls not saved: expected ${finalImageUrls.length} URLs, got ${verificationUrls.length}`)
      }
      
      // 🔒 CRITICAL: Verify thumbnailUrls were saved
      const verificationThumbnails = Array.isArray(verification.thumbnailUrls) ? (verification.thumbnailUrls as string[]) : []
      if (internalStatus === 'COMPLETED' && finalImageUrls.length > 0) {
        // 🔒 CRITICAL: Thumbnails MUST be saved for gallery performance
        // If thumbnails are missing, try to generate them from permanent URLs
        if (verificationThumbnails.length === 0) {
          console.error(`❌ [WEBHOOK_ASTRIA] CRITICAL: thumbnailUrls not saved in database for generation ${generation.id}`)
          console.error(`❌ [WEBHOOK_ASTRIA] Expected ${finalThumbnailUrls.length || storageResult?.thumbnailUrls?.length || 0} thumbnails, got ${verificationThumbnails.length}`)
          console.error(`❌ [WEBHOOK_ASTRIA] Attempting to generate thumbnails from permanent URLs as fallback...`)
          
          // 🔒 FALLBACK: Generate thumbnails from permanent URLs if they weren't saved
          try {
            const { downloadAndStoreImages } = await import('@/lib/storage/utils')
            const fallbackStorageResult = await downloadAndStoreImages(
              finalImageUrls, // Use all permanent URLs to generate thumbnails
              generation.id,
              generation.userId
            )
            
            if (fallbackStorageResult.thumbnailUrls && fallbackStorageResult.thumbnailUrls.length > 0) {
              // Update database with generated thumbnails
              await prisma.generation.update({
                where: { id: generation.id },
                data: {
                  thumbnailUrls: fallbackStorageResult.thumbnailUrls as any
                }
              })
              console.log(`✅ [WEBHOOK_ASTRIA] Successfully generated and saved ${fallbackStorageResult.thumbnailUrls.length} thumbnails as fallback`)
            } else {
              console.error(`❌ [WEBHOOK_ASTRIA] Fallback thumbnail generation also failed. Gallery will use full images (performance impact).`)
            }
          } catch (fallbackError) {
            console.error(`❌ [WEBHOOK_ASTRIA] Fallback thumbnail generation failed:`, fallbackError)
          }
        } else {
          console.log(`✅ [WEBHOOK_ASTRIA] Verified: ${verificationThumbnails.length} thumbnails saved to database`)
        }
      }
      
      console.log(`✅ [WEBHOOK_ASTRIA] Database update verified successfully for generation ${generation.id}`, {
        imageUrlsCount: verificationUrls.length,
        thumbnailUrlsCount: verificationThumbnails.length
      })
      
    } catch (updateError) {
      console.error(`❌ [WEBHOOK_ASTRIA] CRITICAL: Failed to update generation ${generation.id} in database:`, updateError)
      console.error(`❌ [WEBHOOK_ASTRIA] Update error details:`, {
        message: updateError instanceof Error ? updateError.message : String(updateError),
        stack: updateError instanceof Error ? updateError.stack : undefined,
        generationId: generation.id,
        internalStatus,
        finalImageUrlsCount: finalImageUrls.length
      })
      
      // Re-throw to be caught by outer handler
      throw updateError
    }
    
    // CRITICAL: Log for debugging
    console.log(`📊 [ASTRIA_WEBHOOK] Generation updated:`, {
      generationId: updatedGeneration.id,
      status: internalStatus,
      hasTemporaryUrls: updatedMetadata.temporaryUrls.length > 0,
      hasPermanentUrls: updatedMetadata.permanentUrls.length > 0,
      temporaryUrlsCount: updatedMetadata.temporaryUrls.length,
      permanentUrlsCount: updatedMetadata.permanentUrls.length
    })

    console.log(`✅ Astria prompt ${payload.id} updated to status: ${internalStatus}`)
    if (finalImageUrls !== imageUrls) {
      console.log(`✅ Database updated with ${finalImageUrls.length} permanent URLs`)
    }

    // Broadcast real-time status change to user (critical for redirection)
    // Use internalStatus directly to maintain consistency
    // CRITICAL: Always broadcast, even if imageUrls is empty, to ensure frontend knows status changed
    try {
      const { broadcastGenerationStatusChange } = await import('@/lib/services/realtime-service')
      
      // Ensure we always send imageUrls, even if empty (frontend needs to know status)
      // CRITICAL: Include both temporary (for modal) and permanent (for gallery) URLs
      // 🔒 CRITICAL: Use actual thumbnailUrls from database (not imageUrls) for gallery performance
      const broadcastData = {
        imageUrls: finalImageUrls.length > 0 ? finalImageUrls : (updatedGeneration.imageUrls as any || []),
        thumbnailUrls: finalThumbnailUrls.length > 0 
          ? finalThumbnailUrls 
          : (Array.isArray(updatedGeneration.thumbnailUrls) && updatedGeneration.thumbnailUrls.length > 0
              ? updatedGeneration.thumbnailUrls as any
              : finalImageUrls.length > 0 ? finalImageUrls : (updatedGeneration.imageUrls as any || [])), // Fallback to imageUrls if no thumbnails
        // Include temporary URLs for immediate modal display (before S3 upload completes)
        temporaryUrls: imageUrls.length > 0 ? imageUrls : (updatedGeneration.metadata as any)?.temporaryUrls || [],
        permanentUrls: finalImageUrls.length > 0 ? finalImageUrls : [],
        processingTime: processingTime,
        errorMessage: payload.error_message || undefined,
        webhook: true,
        timestamp: new Date().toISOString(),
        // Include additional metadata for frontend
        generationId: updatedGeneration.id,
        userId: updatedGeneration.userId,
        prompt: generation.prompt || undefined,
        modelId: generation.modelId || undefined
      }
      
      console.log(`📡 Broadcasting generation status change:`, {
        generationId: updatedGeneration.id,
        status: internalStatus,
        hasImageUrls: broadcastData.imageUrls.length > 0,
        imageUrlsCount: broadcastData.imageUrls.length
      })
      
      await broadcastGenerationStatusChange(
        updatedGeneration.id,
        updatedGeneration.userId,
        internalStatus, // Send internalStatus directly (COMPLETED/FAILED/PROCESSING)
        broadcastData
      )
      console.log(`✅ Broadcast sent successfully for generation ${updatedGeneration.id} with status: ${internalStatus}`)
    } catch (broadcastError) {
      console.error('❌ Failed to broadcast generation status change:', broadcastError)
      console.error('❌ Broadcast error details:', {
        error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError),
        stack: broadcastError instanceof Error ? broadcastError.stack : undefined
      })
      // Don't fail the webhook for broadcast errors, but log them for debugging
    }

    // CRITICAL: Reconcile UserPackage status if this generation belongs to a package
    // This ensures package status is automatically updated when generations complete/fail
    // Check metadata first (new approach), then packageId as fallback (legacy)
    // Reuse generationMetadata and isPackageGeneration already declared above
    const userPackageId = isPackageGeneration 
      ? generationMetadata.userPackageId 
      : generation.packageId // Legacy fallback

    if (userPackageId) {
      try {
        console.log(`🔄 [WEBHOOK_ASTRIA] Reconciling UserPackage status for generation ${generation.id} (userPackageId: ${userPackageId})`)
        const reconciliation = await reconcileUserPackageStatus(userPackageId)
        
        console.log(`📊 [WEBHOOK_ASTRIA] Reconciliation result:`, {
          userPackageId,
          success: reconciliation.success,
          updated: reconciliation.updated,
          previousStatus: reconciliation.previousStatus,
          newStatus: reconciliation.newStatus,
          stats: reconciliation.stats
        })
        
        if (reconciliation.updated) {
          console.log(`✅ [WEBHOOK_ASTRIA] UserPackage ${userPackageId} status updated: ${reconciliation.previousStatus} → ${reconciliation.newStatus}`)
          
          // 🔒 CRITICAL: Verify the update actually happened
          const verification = await prisma.userPackage.findUnique({
            where: { id: userPackageId },
            select: { status: true, generatedImages: true, failedImages: true }
          })
          
          if (verification) {
            console.log(`✅ [WEBHOOK_ASTRIA] UserPackage update verified:`, {
              userPackageId,
              status: verification.status,
              generatedImages: verification.generatedImages,
              failedImages: verification.failedImages
            })
          } else {
            console.error(`❌ [WEBHOOK_ASTRIA] UserPackage ${userPackageId} not found after reconciliation`)
          }
        } else {
          console.log(`ℹ️ [WEBHOOK_ASTRIA] UserPackage ${userPackageId} reconciliation: no update needed (status: ${reconciliation.newStatus})`)
        }

        // CRITICAL: If generation failed, check if all package generations failed and refund credits
        if (internalStatus === 'FAILED') {
          // Get the user package to check status and price
          const userPackage = await prisma.userPackage.findUnique({
            where: { id: userPackageId },
            include: {
              package: true
            }
          })

          if (userPackage) {
            // Check if all generations failed (no pending/processing, no completed, only failed)
            const stats = reconciliation.stats
            const allFailed = stats.total > 0 && 
                             stats.completed === 0 && 
                             stats.pending === 0 && 
                             stats.processing === 0 && 
                             stats.failed === stats.total

            if (allFailed) {
              console.log(`💰 All ${stats.total} generations failed for package ${userPackageId}, processing refund...`)
              
              // Get package price (credits to refund)
              const packagePrice = userPackage.package?.price || 0
              
              if (packagePrice > 0) {
                try {
                  const refundResult = await refundPhotoPackageCredits(
                    generation.userId,
                    userPackageId,
                    packagePrice,
                    {
                      packageName: userPackage.package?.name,
                      reason: `Todas as ${stats.total} gerações falharam`
                    }
                  )

                  if (refundResult.success) {
                    console.log(`✅ Successfully refunded ${packagePrice} credits for failed package ${userPackageId}`)
                  } else {
                    console.warn(`⚠️ Refund skipped for package ${userPackageId}: ${refundResult.message}`)
                  }
                } catch (refundError) {
                  console.error('❌ Failed to refund package credits:', refundError)
                  // Don't fail the webhook for refund errors, but log them
                }
              } else {
                console.warn(`⚠️ Package ${userPackageId} has no price set, cannot refund`)
              }
            } else {
              console.log(`ℹ️ Package ${userPackageId} has ${stats.completed} completed generations, no refund needed`)
            }
          }
        }
      } catch (reconcileError) {
        console.error('❌ [WEBHOOK_ASTRIA] Failed to reconcile UserPackage status:', reconcileError)
        console.error('❌ [WEBHOOK_ASTRIA] Reconciliation error details:', {
          message: reconcileError instanceof Error ? reconcileError.message : String(reconcileError),
          stack: reconcileError instanceof Error ? reconcileError.stack : undefined
        })
        // Don't fail the webhook for reconciliation errors, but log them
      }
    }

    // 🔒 CRITICAL: Final verification before returning
    const finalCheck = await prisma.generation.findUnique({
      where: { id: generation.id },
      select: { status: true, imageUrls: true, metadata: true }
    })
    
    if (!finalCheck) {
      throw new Error(`Generation ${generation.id} not found after processing`)
    }
    
    const finalMetadata = finalCheck.metadata as any
    console.log(`✅ [WEBHOOK_ASTRIA] Final verification for generation ${generation.id}:`, {
      status: finalCheck.status,
      hasImageUrls: Array.isArray(finalCheck.imageUrls) && (finalCheck.imageUrls as string[]).length > 0,
      imageUrlsCount: Array.isArray(finalCheck.imageUrls) ? (finalCheck.imageUrls as string[]).length : 0,
      webhookProcessed: finalMetadata?.webhookProcessed === true,
      stored: finalMetadata?.stored === true
    })
    
    // 🔒 CRITICAL: Verify that update actually happened
    if (internalStatus === 'COMPLETED' && finalCheck.status !== 'COMPLETED') {
      throw new Error(`Generation status mismatch: expected COMPLETED, got ${finalCheck.status}`)
    }
    
    if (internalStatus === 'COMPLETED' && (!Array.isArray(finalCheck.imageUrls) || (finalCheck.imageUrls as string[]).length === 0)) {
      console.error(`❌ [WEBHOOK_ASTRIA] CRITICAL: Generation ${generation.id} marked as COMPLETED but has no imageUrls!`)
      throw new Error(`Generation ${generation.id} completed but imageUrls not saved`)
    }
    
    return updatedGeneration
  } catch (error) {
    console.error('❌ [WEBHOOK_ASTRIA] CRITICAL: Error handling Astria prompt webhook:', error)
    console.error('❌ [WEBHOOK_ASTRIA] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      jobId: payload.id
    })
    // Re-throw so outer handler can log and return 200
    throw error
  }
}

async function generateSampleImages(modelId: string, tuneId: string, userId: string) {
  try {
    console.log(`🎨 Generating sample images for model ${modelId} with tune ${tuneId}`)

    // Import Astria provider
    const { AstriaProvider } = await import('@/lib/ai/providers/astria')
    const astriaProvider = new AstriaProvider()

    // Get the model data
    const model = await prisma.aIModel.findUnique({
      where: { id: modelId }
    })

    if (!model) {
      throw new Error('Model not found')
    }

    // Generate sample prompts based on model class
    const samplePrompts = getSamplePrompts(model.class, model.triggerWord || 'TOK')

    const sampleImages: string[] = []

    // Generate one sample image for now (can be expanded)
    for (const prompt of samplePrompts.slice(0, 1)) {
      try {
        const generationRequest = {
          modelUrl: tuneId,
          prompt: prompt,
          params: {
            width: 1024,
            height: 1024,
            steps: 30,
            guidance_scale: 7.5,
            num_outputs: 1
          }
        }

        const generationResponse = await astriaProvider.generateImage(generationRequest)

        // Wait for generation to complete (simplified polling)
        let attempts = 0
        const maxAttempts = 30 // 5 minutes max

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds

          const status = await astriaProvider.getGenerationStatus(generationResponse.id)

          if (status.status === 'succeeded' && status.urls) {
            sampleImages.push(status.urls[0])
            break
          } else if (status.status === 'failed') {
            console.error('Sample generation failed:', status.error)
            break
          }

          attempts++
        }
      } catch (sampleError) {
        console.error('Error generating sample:', sampleError)
      }
    }

    // Update model with sample images
    if (sampleImages.length > 0) {
      await prisma.aIModel.update({
        where: { id: modelId },
        data: {
          sampleImages: sampleImages
        }
      })

      console.log(`✅ Added ${sampleImages.length} sample images to model ${modelId}`)
    }

  } catch (error) {
    console.error('❌ Error generating sample images:', error)
    throw error
  }
}

function getSamplePrompts(modelClass: string, triggerWord: string): string[] {
  const basePrompt = `photo of ${triggerWord} person`

  switch (modelClass) {
    case 'MAN':
    case 'WOMAN':
      return [
        `professional headshot of ${triggerWord} person, studio lighting, clean background`,
        `${triggerWord} person in casual clothing, natural lighting, outdoor setting`,
        `portrait of ${triggerWord} person smiling, warm lighting, bokeh background`
      ]
    case 'BOY':
    case 'GIRL':
      return [
        `school photo of ${triggerWord} person, clean background, natural smile`,
        `${triggerWord} person playing, natural lighting, happy expression`,
        `portrait of ${triggerWord} person, soft lighting, friendly expression`
      ]
    default:
      return [
        `photo of ${triggerWord} person, natural lighting, clear background`,
        `portrait of ${triggerWord} person, professional quality`,
        `${triggerWord} person in natural setting, high quality photo`
      ]
  }
}

// Handle GET requests (for webhook verification if needed)
export async function GET() {
  return NextResponse.json({ status: 'Astria webhook endpoint active' })
}