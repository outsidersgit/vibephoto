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
      '🚫 Conteúdo Bloqueado por Segurança\n\nSeu prompt contém termos que violam as políticas de conteúdo sensível do serviço de IA. Revise sua descrição, remova palavras ou conceitos inadequados/explícitos, e tente novamente com um prompt mais apropriado.\n\n✅ Seus créditos foram devolvidos automaticamente.',
    [MediaFailureReason.PROVIDER_ERROR]: 
      '⚠️ Erro no Serviço de IA\n\nO servidor de geração de imagens está temporariamente instável. Aguarde 1-2 minutos e tente novamente. Se o erro persistir, tente usar outro modelo ou entre em contato com o suporte.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.INTERNAL_ERROR]: 
      '❌ Erro Interno do Sistema\n\nOcorreu uma falha no processamento interno (não relacionada ao seu prompt). Tente novamente. Se o problema continuar, reporte ao suporte técnico.\n\n✅ Seus créditos foram devolvidos automaticamente.',
    [MediaFailureReason.STORAGE_ERROR]: 
      '💾 Erro ao Salvar a Imagem\n\nA imagem foi gerada com sucesso, mas falhou ao ser salva no servidor. Tente gerar novamente - dessa vez será salva corretamente.\n\n✅ Seus créditos foram devolvidos (você não foi cobrado).',
    [MediaFailureReason.TIMEOUT_ERROR]: 
      '⏱️ Tempo Limite Excedido\n\nA geração demorou mais que o esperado e foi cancelada. Isso pode acontecer com prompts muito complexos. Simplifique sua descrição ou reduza o número de imagens.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.QUOTA_ERROR]: 
      '📊 Limite Temporário Atingido\n\nO serviço atingiu o máximo de processamentos simultâneos. Aguarde 5-10 minutos e tente novamente quando houver capacidade disponível.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.NETWORK_ERROR]: 
      '🌐 Erro de Conexão\n\nFalha na comunicação com o servidor de IA. Verifique sua conexão e tente novamente. Se sua conexão estiver estável, o problema é temporário no serviço.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.INVALID_INPUT]: 
      '❓ Parâmetros Inválidos\n\nAs configurações escolhidas (resolução, quantidade, modelo) estão incompatíveis ou o prompt está vazio. Verifique todos os campos e tente novamente.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.UNKNOWN_ERROR]: 
      '❌ Erro Desconhecido\n\nOcorreu um erro inesperado que não identificamos. Tente novamente. Se repetir com o mesmo prompt, altere levemente o texto ou entre em contato com o suporte.\n\n✅ Seus créditos foram devolvidos automaticamente.'
  },
  [MediaType.IMAGE_EDIT]: {
    [MediaFailureReason.SAFETY_BLOCKED]: 
      '🚫 Edição Bloqueada por Segurança\n\nO prompt de edição ou a imagem original contém conteúdo inadequado. Revise sua instrução de edição, use termos mais apropriados, ou escolha outra imagem para editar.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.PROVIDER_ERROR]: 
      '⚠️ Erro no Serviço de Edição\n\nO servidor de edição de imagens está com problemas. Aguarde alguns minutos e tente novamente. Se persistir, use outra imagem ou ferramenta.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.INTERNAL_ERROR]: 
      '❌ Erro Interno ao Editar\n\nFalha no processamento da edição (não relacionada ao conteúdo). Tente novamente. Se continuar, tente com outra imagem ou reporte ao suporte.\n\n✅ Seus créditos foram devolvidos automaticamente.',
    [MediaFailureReason.STORAGE_ERROR]: 
      '💾 Erro ao Salvar Edição\n\nA edição foi concluída, mas não conseguimos salvar o resultado. Tente editar novamente - dessa vez será salva corretamente.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.TIMEOUT_ERROR]: 
      '⏱️ Edição Demorou Demais\n\nA edição foi cancelada por exceder o tempo limite. Use uma imagem menor ou uma instrução de edição mais simples.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.QUOTA_ERROR]: 
      '📊 Limite de Edições Atingido\n\nMuitas edições estão sendo processadas simultaneamente. Aguarde alguns minutos e tente novamente.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.NETWORK_ERROR]: 
      '🌐 Erro de Conexão na Edição\n\nProblema de comunicação com o servidor. Verifique sua internet e tente novamente em instantes.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.INVALID_INPUT]: 
      '❓ Imagem ou Prompt Inválido\n\nA imagem está corrompida, muito grande, ou o prompt de edição está vazio/inválido. Verifique a imagem e suas instruções.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.UNKNOWN_ERROR]: 
      '❌ Erro Desconhecido na Edição\n\nErro inesperado durante a edição. Tente com outra imagem ou prompt. Se repetir, entre em contato com o suporte.\n\n✅ Seus créditos foram devolvidos automaticamente.'
  },
  [MediaType.VIDEO_GENERATION]: {
    [MediaFailureReason.SAFETY_BLOCKED]: 
      '🚫 Conteúdo Bloqueado por Segurança\n\nSeu prompt contém termos que violam as políticas de conteúdo sensível do serviço de IA. Revise sua descrição, remova palavras ou conceitos inadequados/explícitos, e tente novamente com um prompt mais apropriado.\n\n✅ Seus créditos foram devolvidos automaticamente.',
    [MediaFailureReason.PROVIDER_ERROR]: 
      '⚠️ Erro no Serviço de IA\n\nO servidor de geração de vídeos está temporariamente instável ou sobrecarregado. Aguarde 2-3 minutos e tente novamente. Se o erro persistir, entre em contato com o suporte.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.INTERNAL_ERROR]: 
      '❌ Erro Interno do Sistema\n\nOcorreu uma falha no processamento interno da sua solicitação (não relacionada ao conteúdo do seu prompt). Tente novamente. Se o problema continuar, reporte ao suporte técnico.\n\n✅ Seus créditos foram devolvidos automaticamente.',
    [MediaFailureReason.STORAGE_ERROR]: 
      '💾 Erro ao Salvar o Vídeo\n\nO vídeo foi gerado com sucesso pela IA, mas falhou ao ser salvo no nosso servidor de armazenamento. Tente gerar novamente - dessa vez o vídeo será salvo corretamente.\n\n✅ Seus créditos foram devolvidos (você não foi cobrado).',
    [MediaFailureReason.TIMEOUT_ERROR]: 
      '⏱️ Tempo Limite Excedido\n\nA geração do vídeo demorou mais que o esperado e foi cancelada automaticamente. Isso pode acontecer com prompts muito complexos ou imagens muito pesadas. Simplifique sua descrição ou use uma imagem menor.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.QUOTA_ERROR]: 
      '📊 Limite Temporário Atingido\n\nO serviço de vídeos atingiu o limite máximo de processamentos simultâneos. Aguarde 5-10 minutos e tente novamente quando houver capacidade disponível.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.NETWORK_ERROR]: 
      '🌐 Erro de Conexão\n\nHouve uma falha na comunicação com o servidor de geração de vídeos. Verifique sua conexão com a internet e tente novamente. Se sua conexão estiver estável, o problema é temporário no serviço.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.INVALID_INPUT]: 
      '❓ Parâmetros Inválidos\n\nAs configurações escolhidas (duração, proporção, qualidade) ou a imagem enviada estão em formato/resolução incompatível. Verifique se a imagem não está corrompida e se os parâmetros estão dentro dos limites permitidos.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.UNKNOWN_ERROR]: 
      '❌ Erro Desconhecido\n\nOcorreu um erro inesperado que não pudemos identificar. Tente novamente. Se o erro se repetir com o mesmo prompt/imagem, tente alterar levemente o conteúdo ou entre em contato com o suporte.\n\n✅ Seus créditos foram devolvidos automaticamente.'
  },
  [MediaType.UPSCALE]: {
    [MediaFailureReason.SAFETY_BLOCKED]: 
      '🚫 Upscale Bloqueado\n\nA imagem contém conteúdo inadequado que viola as políticas de segurança. Escolha outra imagem para aumentar a resolução.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.PROVIDER_ERROR]: 
      '⚠️ Erro no Serviço de Upscale\n\nO servidor de upscale está com problemas técnicos. Aguarde alguns minutos e tente novamente.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.INTERNAL_ERROR]: 
      '❌ Erro Interno no Upscale\n\nFalha no processamento (não relacionada à imagem). Tente novamente ou escolha outra imagem.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.STORAGE_ERROR]: 
      '💾 Erro ao Salvar Upscale\n\nO upscale foi feito, mas não conseguimos salvar o resultado. Tente novamente - será salvo corretamente.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.TIMEOUT_ERROR]: 
      '⏱️ Upscale Demorou Demais\n\nO processamento foi cancelado. Use uma imagem menor ou com menos detalhes, ou tente um upscale menor (ex: 2x ao invés de 4x).\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.QUOTA_ERROR]: 
      '📊 Limite de Upscales Atingido\n\nMuitos upscales simultâneos. Aguarde 5-10 minutos e tente novamente.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.NETWORK_ERROR]: 
      '🌐 Erro de Conexão\n\nProblema de comunicação com o servidor. Verifique sua internet e tente em instantes.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.INVALID_INPUT]: 
      '❓ Imagem Inválida para Upscale\n\nA imagem está corrompida, já é muito grande, ou está em formato incompatível. Use uma imagem válida em JPG/PNG.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.UNKNOWN_ERROR]: 
      '❌ Erro Desconhecido no Upscale\n\nErro inesperado. Tente com outra imagem. Se repetir, entre em contato com o suporte.\n\n✅ Seus créditos foram devolvidos.'
  },
  [MediaType.MODEL_TRAINING]: {
    [MediaFailureReason.SAFETY_BLOCKED]: 
      '🚫 Treinamento Bloqueado\n\nUma ou mais fotos contêm conteúdo inadequado. Revise as imagens, remova as problemáticas, e envie apenas fotos apropriadas para treinar seu modelo.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.PROVIDER_ERROR]: 
      '⚠️ Erro no Serviço de Treinamento\n\nO servidor de IA está com problemas. Aguarde alguns minutos e inicie o treinamento novamente.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.INTERNAL_ERROR]: 
      '❌ Erro Interno no Treinamento\n\nFalha no processamento do seu modelo (não relacionada às fotos). Tente novamente. Se persistir, reporte ao suporte.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.STORAGE_ERROR]: 
      '💾 Erro ao Salvar o Modelo\n\nO modelo foi treinado, mas não conseguimos salvá-lo. Inicie o treinamento novamente - dessa vez será salvo.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.TIMEOUT_ERROR]: 
      '⏱️ Treinamento Cancelado (Tempo Limite)\n\nO treinamento demorou demais. Use fotos menores (máx 1MB cada) ou reduza a quantidade de imagens. Qualidade importa mais que quantidade.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.QUOTA_ERROR]: 
      '📊 Limite de Treinamentos Atingido\n\nMuitos modelos sendo treinados agora. Aguarde 10-15 minutos e tente novamente.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.NETWORK_ERROR]: 
      '🌐 Erro de Conexão no Treinamento\n\nProblema ao enviar as fotos ou comunicar com o servidor. Verifique sua internet e tente novamente.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.INVALID_INPUT]: 
      '❓ Fotos Inválidas para Treinamento\n\nAs fotos estão corrompidas, muito pequenas (mín 512x512), em formato incompatível, ou são insuficientes (mín 10 fotos). Verifique os requisitos.\n\n✅ Seus créditos foram devolvidos.',
    [MediaFailureReason.UNKNOWN_ERROR]: 
      '❌ Erro Desconhecido no Treinamento\n\nErro inesperado. Tente com outras fotos. Se repetir, entre em contato com o suporte técnico.\n\n✅ Seus créditos foram devolvidos.'
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
    // Mapear MediaType para CreditTransactionSource
    const sourceMapping: Record<string, string> = {
      'IMAGE_GENERATION': 'GENERATION',
      'IMAGE_EDIT': 'EDIT',
      'VIDEO_GENERATION': 'VIDEO',
      'UPSCALE': 'UPSCALE',
      'MODEL_TRAINING': 'TRAINING'
    }
    
    const transactionSource = sourceMapping[mediaType] || 'REFUND'
    
    const refundResult = await CreditManager.addCredits(
      media.userId,
      media.creditsUsed,
      `Estorno por falha em ${mediaType}: ${failureReason}`,
      {
        referenceId: mediaId,
        refundSource: transactionSource
      }
    )

    if (!refundResult.success) {
      console.error(`❌ [handleMediaFailure] Failed to refund credits: ${refundResult.error}`)
      
      // Atualizar status mesmo se refund falhar (para não travar)
      await updateMediaRecord(mediaType, mediaId, {
        failureReason,
        errorMessage: userMessage, // ✅ SEMPRE usar mensagem amigável
        status: 'FAILED',
        metadata: {
          errorHandledAt: new Date().toISOString(),
          errorCategory: failureReason,
          refundAttempted: true,
          refundFailed: true,
          refundError: refundResult.error,
          originalErrorMessage: errorMessage || '', // 🔒 Guardar mensagem original aqui
          refundErrorDetails: `Refund failed: ${refundResult.error}`
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
      errorMessage: userMessage, // ✅ SEMPRE usar mensagem amigável para exibir ao usuário
      status: 'FAILED',
      metadata: {
        errorHandledAt: new Date().toISOString(),
        errorCategory: failureReason,
        creditsRefundedAt: new Date().toISOString(),
        creditsRefundedAmount: media.creditsUsed,
        originalErrorMessage: errorMessage || '' // 🔒 Guardar mensagem original do provider aqui
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

