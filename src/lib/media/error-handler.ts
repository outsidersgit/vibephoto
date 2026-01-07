/**
 * Sistema unificado de tratamento de erros para TODAS as mídias geradas
 * 
 * Este módulo:
 * 1. Detecta e categoriza erros de qualquer tipo de mídia (imagem, vídeo, upscale, edit, training)
 * 2. Gerencia estornos automáticos de créditos com idempotência
 * 3. Gera mensagens amigáveis para o usuário
 * 4. Registra logs detalhados para debug
 */

import { prisma } from '@/lib/db'
import { CreditManager } from '@/lib/credits/manager'

/**
 * Tipos de mídia suportados
 */
export enum MediaType {
  IMAGE_GENERATION = 'IMAGE_GENERATION',
  IMAGE_EDIT = 'IMAGE_EDIT',
  VIDEO_GENERATION = 'VIDEO_GENERATION',
  UPSCALE = 'UPSCALE',
  MODEL_TRAINING = 'MODEL_TRAINING'
}

/**
 * Categorias de erro unificadas
 */
export enum MediaFailureReason {
  SAFETY_BLOCKED = 'SAFETY_BLOCKED',        // Conteúdo bloqueado por moderação/safety
  PROVIDER_ERROR = 'PROVIDER_ERROR',        // Erro do provider (Replicate/modelo)
  INTERNAL_ERROR = 'INTERNAL_ERROR',        // Erro interno do app
  STORAGE_ERROR = 'STORAGE_ERROR',          // Falha ao armazenar mídia
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',          // Timeout do processamento
  QUOTA_ERROR = 'QUOTA_ERROR',              // Quota/limite do provider excedido
  NETWORK_ERROR = 'NETWORK_ERROR',          // Erro de rede/conectividade
  INVALID_INPUT = 'INVALID_INPUT',          // Input inválido
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'           // Erro desconhecido
}

/**
 * Palavras-chave para detecção de erros de safety/moderação
 */
const SAFETY_KEYWORDS = [
  'nsfw', 'safety', 'moderation', 'content policy', 'inappropriate', 'violation',
  'blocked', 'restricted', 'prohibited', 'unsafe', 'sensitive content',
  'policy violation', 'content filter', 'flagged', 'censored',
  'safety system', 'content moderation', 'policy filter', 'adult content',
  'explicit content', 'inappropriate content', 'violates policy', 'content blocked',
  'filter triggered', 'moderation filter', 'safety filter', 'content safety',
  'safety check', 'policy check', 'content violation', 'terms of service',
  'community guidelines', 'safety violation', 'banned content', 'disallowed content',
  // Termos em português
  'conteúdo sensível', 'conteúdo inapropriado', 'conteúdo bloqueado',
  'bloqueado por segurança', 'violação de política', 'política de segurança',
  'filtro de segurança', 'moderação de conteúdo'
]

/**
 * Padrões de erro por categoria
 */
const ERROR_PATTERNS = {
  [MediaFailureReason.QUOTA_ERROR]: ['quota', 'limit exceeded', 'rate limit', 'too many requests'],
  [MediaFailureReason.TIMEOUT_ERROR]: ['timeout', 'timed out', 'deadline exceeded'],
  [MediaFailureReason.NETWORK_ERROR]: ['network', 'connection', 'unreachable', 'dns'],
  [MediaFailureReason.INVALID_INPUT]: ['invalid input', 'invalid parameter', 'validation error', 'bad request'],
  [MediaFailureReason.PROVIDER_ERROR]: ['model error', 'prediction failed', 'processing failed']
}

/**
 * Mensagens amigáveis por tipo de mídia e erro
 */
const USER_FRIENDLY_MESSAGES: Record<MediaType, Record<MediaFailureReason, string>> = {
  [MediaType.IMAGE_GENERATION]: {
    [MediaFailureReason.SAFETY_BLOCKED]: 
      '⚠️ Não foi possível gerar a imagem porque o conteúdo do prompt foi bloqueado pela política de segurança. Por favor, revise o texto, remova termos sensíveis e tente novamente. Seus créditos foram devolvidos automaticamente.',
    [MediaFailureReason.PROVIDER_ERROR]: 
      'Houve um erro no serviço de geração de imagens. Seus créditos foram devolvidos. Por favor, tente novamente em alguns minutos.',
    [MediaFailureReason.INTERNAL_ERROR]: 
      'Ocorreu um erro interno ao processar sua imagem. Seus créditos foram devolvidos automaticamente. Por favor, tente novamente.',
    [MediaFailureReason.STORAGE_ERROR]: 
      'A imagem foi gerada mas houve erro ao salvá-la. Seus créditos foram devolvidos. Por favor, tente novamente.',
    [MediaFailureReason.TIMEOUT_ERROR]: 
      'O processamento da imagem excedeu o tempo limite. Seus créditos foram devolvidos. Por favor, tente novamente.',
    [MediaFailureReason.QUOTA_ERROR]: 
      'O serviço de imagens atingiu o limite temporário. Seus créditos foram devolvidos. Por favor, aguarde alguns minutos.',
    [MediaFailureReason.NETWORK_ERROR]: 
      'Erro de conexão com o serviço de imagens. Seus créditos foram devolvidos. Por favor, tente novamente.',
    [MediaFailureReason.INVALID_INPUT]: 
      'Os parâmetros fornecidos são inválidos. Seus créditos foram devolvidos. Por favor, verifique suas configurações.',
    [MediaFailureReason.UNKNOWN_ERROR]: 
      'Ocorreu um erro inesperado. Seus créditos foram devolvidos automaticamente. Por favor, tente novamente.'
  },
  [MediaType.IMAGE_EDIT]: {
    [MediaFailureReason.SAFETY_BLOCKED]: 
      '⚠️ Não foi possível editar a imagem porque o conteúdo foi bloqueado pela política de segurança. Por favor, revise o prompt de edição e tente novamente. Seus créditos foram devolvidos.',
    [MediaFailureReason.PROVIDER_ERROR]: 
      'Houve um erro no serviço de edição de imagens. Seus créditos foram devolvidos. Por favor, tente novamente.',
    [MediaFailureReason.INTERNAL_ERROR]: 
      'Ocorreu um erro interno ao editar sua imagem. Seus créditos foram devolvidos automaticamente.',
    [MediaFailureReason.STORAGE_ERROR]: 
      'A imagem foi editada mas houve erro ao salvá-la. Seus créditos foram devolvidos.',
    [MediaFailureReason.TIMEOUT_ERROR]: 
      'A edição da imagem excedeu o tempo limite. Seus créditos foram devolvidos.',
    [MediaFailureReason.QUOTA_ERROR]: 
      'O serviço de edição atingiu o limite temporário. Seus créditos foram devolvidos.',
    [MediaFailureReason.NETWORK_ERROR]: 
      'Erro de conexão com o serviço de edição. Seus créditos foram devolvidos.',
    [MediaFailureReason.INVALID_INPUT]: 
      'A imagem ou parâmetros fornecidos são inválidos. Seus créditos foram devolvidos.',
    [MediaFailureReason.UNKNOWN_ERROR]: 
      'Ocorreu um erro inesperado na edição. Seus créditos foram devolvidos automaticamente.'
  },
  [MediaType.VIDEO_GENERATION]: {
    [MediaFailureReason.SAFETY_BLOCKED]: 
      '⚠️ Não foi possível gerar o vídeo porque o conteúdo do prompt foi bloqueado pela política de segurança. Por favor, revise o texto, remova termos sensíveis e tente novamente. Seus créditos foram devolvidos automaticamente.',
    [MediaFailureReason.PROVIDER_ERROR]: 
      'Houve um erro no serviço de geração de vídeo. Seus créditos foram devolvidos. Por favor, tente novamente em alguns minutos.',
    [MediaFailureReason.INTERNAL_ERROR]: 
      'Ocorreu um erro interno ao processar seu vídeo. Seus créditos foram devolvidos automaticamente.',
    [MediaFailureReason.STORAGE_ERROR]: 
      'O vídeo foi gerado mas houve erro ao salvá-lo. Seus créditos foram devolvidos.',
    [MediaFailureReason.TIMEOUT_ERROR]: 
      'O processamento do vídeo excedeu o tempo limite. Seus créditos foram devolvidos.',
    [MediaFailureReason.QUOTA_ERROR]: 
      'O serviço de vídeo atingiu o limite temporário. Seus créditos foram devolvidos.',
    [MediaFailureReason.NETWORK_ERROR]: 
      'Erro de conexão com o serviço de vídeo. Seus créditos foram devolvidos.',
    [MediaFailureReason.INVALID_INPUT]: 
      'Os parâmetros fornecidos são inválidos. Seus créditos foram devolvidos.',
    [MediaFailureReason.UNKNOWN_ERROR]: 
      'Ocorreu um erro inesperado. Seus créditos foram devolvidos automaticamente.'
  },
  [MediaType.UPSCALE]: {
    [MediaFailureReason.SAFETY_BLOCKED]: 
      '⚠️ Não foi possível fazer upscale porque o conteúdo foi bloqueado pela política de segurança. Seus créditos foram devolvidos.',
    [MediaFailureReason.PROVIDER_ERROR]: 
      'Houve um erro no serviço de upscale. Seus créditos foram devolvidos.',
    [MediaFailureReason.INTERNAL_ERROR]: 
      'Ocorreu um erro interno ao processar o upscale. Seus créditos foram devolvidos.',
    [MediaFailureReason.STORAGE_ERROR]: 
      'O upscale foi concluído mas houve erro ao salvar. Seus créditos foram devolvidos.',
    [MediaFailureReason.TIMEOUT_ERROR]: 
      'O upscale excedeu o tempo limite. Seus créditos foram devolvidos.',
    [MediaFailureReason.QUOTA_ERROR]: 
      'O serviço de upscale atingiu o limite temporário. Seus créditos foram devolvidos.',
    [MediaFailureReason.NETWORK_ERROR]: 
      'Erro de conexão com o serviço de upscale. Seus créditos foram devolvidos.',
    [MediaFailureReason.INVALID_INPUT]: 
      'A imagem fornecida é inválida para upscale. Seus créditos foram devolvidos.',
    [MediaFailureReason.UNKNOWN_ERROR]: 
      'Ocorreu um erro inesperado no upscale. Seus créditos foram devolvidos.'
  },
  [MediaType.MODEL_TRAINING]: {
    [MediaFailureReason.SAFETY_BLOCKED]: 
      '⚠️ O treinamento foi bloqueado por conter conteúdo sensível. Seus créditos foram devolvidos.',
    [MediaFailureReason.PROVIDER_ERROR]: 
      'Houve um erro no serviço de treinamento. Seus créditos foram devolvidos.',
    [MediaFailureReason.INTERNAL_ERROR]: 
      'Ocorreu um erro interno durante o treinamento. Seus créditos foram devolvidos.',
    [MediaFailureReason.STORAGE_ERROR]: 
      'O modelo foi treinado mas houve erro ao salvar. Seus créditos foram devolvidos.',
    [MediaFailureReason.TIMEOUT_ERROR]: 
      'O treinamento excedeu o tempo limite. Seus créditos foram devolvidos.',
    [MediaFailureReason.QUOTA_ERROR]: 
      'O serviço de treinamento atingiu o limite temporário. Seus créditos foram devolvidos.',
    [MediaFailureReason.NETWORK_ERROR]: 
      'Erro de conexão com o serviço de treinamento. Seus créditos foram devolvidos.',
    [MediaFailureReason.INVALID_INPUT]: 
      'As fotos fornecidas são inválidas para treinamento. Seus créditos foram devolvidos.',
    [MediaFailureReason.UNKNOWN_ERROR]: 
      'Ocorreu um erro inesperado no treinamento. Seus créditos foram devolvidos.'
  }
}

/**
 * Detecta o tipo de erro baseado na mensagem
 */
export function categorizeMediaError(errorMessage: string | null | undefined): MediaFailureReason {
  if (!errorMessage) {
    return MediaFailureReason.UNKNOWN_ERROR
  }

  const errorLower = errorMessage.toLowerCase()

  // 1. Verificar erro de safety/moderação (prioridade alta)
  for (const keyword of SAFETY_KEYWORDS) {
    if (errorLower.includes(keyword)) {
      console.log(`🚨 Safety error detected: keyword "${keyword}" found in error message`)
      return MediaFailureReason.SAFETY_BLOCKED
    }
  }

  // 2. Verificar outros padrões de erro
  for (const [reason, keywords] of Object.entries(ERROR_PATTERNS)) {
    for (const keyword of keywords) {
      if (errorLower.includes(keyword)) {
        console.log(`⚠️ Error categorized as ${reason}: keyword "${keyword}" found`)
        return reason as MediaFailureReason
      }
    }
  }

  // 3. Erro desconhecido
  console.log(`❓ Unknown error type: ${errorMessage.substring(0, 100)}`)
  return MediaFailureReason.UNKNOWN_ERROR
}

/**
 * Obtém a mensagem amigável para exibir ao usuário
 */
export function getUserFriendlyMessage(mediaType: MediaType, failureReason: MediaFailureReason): string {
  return USER_FRIENDLY_MESSAGES[mediaType][failureReason]
}

/**
 * Interface para resultado do processamento de erro
 */
export interface MediaErrorHandlingResult {
  success: boolean
  refunded: boolean
  failureReason: MediaFailureReason
  userMessage: string
  error?: string
}

/**
 * Processa erro de mídia e faz estorno de créditos se necessário
 * SUPORTA TODOS OS TIPOS DE MÍDIA
 */
export async function handleMediaFailure(
  mediaType: MediaType,
  mediaId: string,
  errorMessage: string | null | undefined,
  options: {
    skipRefund?: boolean
    userId?: string
  } = {}
): Promise<MediaErrorHandlingResult> {
  
  console.log(`🔧 [handleMediaFailure] Processing ${mediaType} failure for ${mediaId}`)
  console.log(`🔧 [handleMediaFailure] Error: ${errorMessage?.substring(0, 200)}`)

  try {
    // 1. Buscar mídia no banco baseado no tipo
    const media = await getMediaRecord(mediaType, mediaId)

    if (!media) {
      console.error(`❌ [handleMediaFailure] ${mediaType} ${mediaId} not found`)
      return {
        success: false,
        refunded: false,
        failureReason: MediaFailureReason.INTERNAL_ERROR,
        userMessage: getUserFriendlyMessage(mediaType, MediaFailureReason.INTERNAL_ERROR),
        error: 'Media not found'
      }
    }

    // 2. Categorizar o erro
    const failureReason = categorizeMediaError(errorMessage)
    const userMessage = getUserFriendlyMessage(mediaType, failureReason)

    console.log(`📊 [handleMediaFailure] Categorized as: ${failureReason}`)
    console.log(`💬 [handleMediaFailure] User message: ${userMessage}`)

    // 3. Verificar se já foi feito estorno (idempotência)
    if (media.creditsRefunded) {
      console.log(`⏭️ [handleMediaFailure] Credits already refunded for ${mediaType} ${mediaId}`)
      
      // Atualizar mensagem de erro se necessário
      await updateMediaRecord(mediaType, mediaId, {
        failureReason,
        errorMessage: errorMessage || userMessage,
        status: 'FAILED'
      })
      
      return {
        success: true,
        refunded: false,
        failureReason,
        userMessage
      }
    }

    // 4. Verificar se deve fazer estorno
    const shouldRefund = !options.skipRefund && media.creditsUsed > 0

    if (!shouldRefund) {
      console.log(`⏭️ [handleMediaFailure] Skipping refund: skipRefund=${options.skipRefund}, creditsUsed=${media.creditsUsed}`)
      
      await updateMediaRecord(mediaType, mediaId, {
        failureReason,
        errorMessage: errorMessage || userMessage,
        status: 'FAILED'
      })

      return {
        success: true,
        refunded: false,
        failureReason,
        userMessage
      }
    }

    // 5. Fazer estorno de créditos COM idempotência
    console.log(`💰 [handleMediaFailure] Refunding ${media.creditsUsed} credits to user ${media.userId}`)

    // a) Fazer estorno via CreditManager (ele já usa transação internamente)
    const refundResult = await CreditManager.addCredits(
      media.userId,
      media.creditsUsed,
      `Estorno por falha em ${mediaType}: ${failureReason}`,
      {
        referenceId: mediaId,
        refundSource: mediaType
      }
    )

    if (!refundResult.success) {
      console.error(`❌ [handleMediaFailure] Failed to refund credits: ${refundResult.error}`)
      
      // Atualizar status mesmo se refund falhar (para não travar)
      await updateMediaRecord(mediaType, mediaId, {
        failureReason,
        errorMessage: `Refund failed: ${refundResult.error}. Original error: ${errorMessage || userMessage}`,
        status: 'FAILED',
        metadata: {
          errorHandledAt: new Date().toISOString(),
          errorCategory: failureReason,
          refundAttempted: true,
          refundFailed: true,
          refundError: refundResult.error
        }
      })
      
      return {
        success: false,
        refunded: false,
        failureReason,
        userMessage,
        error: `Failed to refund credits: ${refundResult.error}`
      }
    }

    // b) Marcar mídia como refunded (separado, não em transação aninhada)
    await updateMediaRecord(mediaType, mediaId, {
      creditsRefunded: true,
      failureReason,
      errorMessage: errorMessage || userMessage,
      status: 'FAILED',
      metadata: {
        errorHandledAt: new Date().toISOString(),
        errorCategory: failureReason,
        creditsRefundedAt: new Date().toISOString(),
        creditsRefundedAmount: media.creditsUsed
      }
    })

    console.log(`✅ [handleMediaFailure] Credits refunded successfully for ${mediaType} ${mediaId}`)

    return {
      success: true,
      refunded: true,
      failureReason,
      userMessage
    }

  } catch (error) {
    console.error(`❌ [handleMediaFailure] Error processing failure:`, error)
    return {
      success: false,
      refunded: false,
      failureReason: MediaFailureReason.INTERNAL_ERROR,
      userMessage: getUserFriendlyMessage(mediaType, MediaFailureReason.INTERNAL_ERROR),
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Busca registro de mídia por tipo
 */
async function getMediaRecord(mediaType: MediaType, mediaId: string) {
  switch (mediaType) {
    case MediaType.IMAGE_GENERATION:
      return await prisma.generation.findUnique({
        where: { id: mediaId },
        select: {
          id: true,
          userId: true,
          creditsUsed: true,
          creditsRefunded: true,
          failureReason: true,
          status: true,
          errorMessage: true,
          metadata: true
        }
      })

    case MediaType.VIDEO_GENERATION:
      return await prisma.videoGeneration.findUnique({
        where: { id: mediaId },
        select: {
          id: true,
          userId: true,
          creditsUsed: true,
          creditsRefunded: true,
          failureReason: true,
          status: true,
          errorMessage: true,
          metadata: true
        }
      })

    case MediaType.IMAGE_EDIT:
      return await prisma.editHistory.findUnique({
        where: { id: mediaId },
        select: {
          id: true,
          userId: true,
          creditsUsed: true,
          creditsRefunded: true,
          failureReason: true,
          status: true,
          errorMessage: true,
          metadata: true
        }
      })

    case MediaType.MODEL_TRAINING:
      return await prisma.aIModel.findUnique({
        where: { id: mediaId },
        select: {
          id: true,
          userId: true,
          creditsUsed: true,
          creditsRefunded: true,
          failureReason: true,
          status: true,
          errorMessage: true
        }
      }) as any // Cast para compatibilidade com interface unificada

    case MediaType.UPSCALE:
      // Upscale usa Generation model
      return await prisma.generation.findUnique({
        where: { id: mediaId },
        select: {
          id: true,
          userId: true,
          creditsUsed: true,
          creditsRefunded: true,
          failureReason: true,
          status: true,
          errorMessage: true,
          metadata: true
        }
      })

    default:
      return null
  }
}

/**
 * Atualiza registro de mídia
 */
async function updateMediaRecord(
  mediaType: MediaType,
  mediaId: string,
  data: {
    failureReason?: string
    errorMessage?: string
    status?: string
    creditsRefunded?: boolean
    metadata?: any
  }
) {
  switch (mediaType) {
    case MediaType.IMAGE_GENERATION:
    case MediaType.UPSCALE:
      return await prisma.generation.update({
        where: { id: mediaId },
        data
      })

    case MediaType.VIDEO_GENERATION:
      return await prisma.videoGeneration.update({
        where: { id: mediaId },
        data: data as any
      })

    case MediaType.IMAGE_EDIT:
      return await prisma.editHistory.update({
        where: { id: mediaId },
        data
      })

    case MediaType.MODEL_TRAINING:
      return await prisma.aIModel.update({
        where: { id: mediaId },
        data: data as any
      })
  }
}

/**
 * Atualiza registro dentro de transação
 */
async function updateMediaRecordInTransaction(
  tx: any,
  mediaType: MediaType,
  mediaId: string,
  data: any
) {
  switch (mediaType) {
    case MediaType.IMAGE_GENERATION:
    case MediaType.UPSCALE:
      return await tx.generation.update({
        where: { id: mediaId },
        data
      })

    case MediaType.VIDEO_GENERATION:
      return await tx.videoGeneration.update({
        where: { id: mediaId },
        data
      })

    case MediaType.IMAGE_EDIT:
      return await tx.editHistory.update({
        where: { id: mediaId },
        data
      })

    case MediaType.MODEL_TRAINING:
      return await tx.aIModel.update({
        where: { id: mediaId },
        data
      })
  }
}

// Exportar também as funções específicas de vídeo para retrocompatibilidade
export { categorizeMediaError as categorizeVideoError }
export { MediaFailureReason as VideoFailureReason }
export const handleVideoFailure = (videoId: string, errorMessage: string | null | undefined, options: any = {}) =>
  handleMediaFailure(MediaType.VIDEO_GENERATION, videoId, errorMessage, options)

