/**
 * Sistema de tratamento de erros para geração de vídeo
 * 
 * ⚠️ DEPRECATED: Use o handler unificado em @/lib/media/error-handler
 * Este arquivo mantém retrocompatibilidade mas redireciona para o handler unificado.
 * 
 * Este módulo:
 * 1. Detecta e categoriza erros do provider (Replicate)
 * 2. Gerencia estornos automáticos de créditos com idempotência
 * 3. Gera mensagens amigáveis para o usuário
 * 4. Registra logs detalhados para debug
 */

import { prisma } from '@/lib/db'
import { CreditManager } from '@/lib/credits/manager'
import { 
  MediaType, 
  MediaFailureReason as UnifiedFailureReason,
  handleMediaFailure,
  categorizeMediaError as unifiedCategorize,
  getUserFriendlyMessage as unifiedGetMessage
} from '@/lib/media/error-handler'

/**
 * Categorias de erro para geração de vídeo
 * ⚠️ DEPRECATED: Use MediaFailureReason de @/lib/media/error-handler
 */
export enum VideoFailureReason {
  SAFETY_BLOCKED = 'SAFETY_BLOCKED',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  QUOTA_ERROR = 'QUOTA_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Mapeamento de palavras-chave para detecção de erros de safety/moderação
 */
const SAFETY_KEYWORDS = [
  'nsfw',
  'safety',
  'moderation',
  'content policy',
  'inappropriate',
  'violation',
  'blocked',
  'restricted',
  'prohibited',
  'unsafe',
  'sensitive content',
  'policy violation',
  'content filter',
  'flagged',
  'censored',
  // Termos adicionais de moderação
  'safety system',
  'content moderation',
  'policy filter',
  'adult content',
  'explicit content',
  'inappropriate content',
  'violates policy',
  'content blocked',
  'filter triggered',
  'moderation filter',
  'safety filter',
  'content safety',
  'safety check',
  'policy check',
  'content violation',
  'terms of service',
  'community guidelines',
  'safety violation',
  'banned content',
  'disallowed content',
  // Termos em português (caso o erro venha traduzido)
  'conteúdo sensível',
  'conteúdo inapropriado',
  'conteúdo bloqueado',
  'bloqueado por segurança',
  'violação de política',
  'política de segurança',
  'filtro de segurança',
  'moderação de conteúdo'
]

/**
 * Mapeamento de palavras-chave para outros tipos de erro
 */
const ERROR_PATTERNS = {
  [VideoFailureReason.QUOTA_ERROR]: ['quota', 'limit exceeded', 'rate limit', 'too many requests'],
  [VideoFailureReason.TIMEOUT_ERROR]: ['timeout', 'timed out', 'deadline exceeded'],
  [VideoFailureReason.NETWORK_ERROR]: ['network', 'connection', 'unreachable', 'dns'],
  [VideoFailureReason.INVALID_INPUT]: ['invalid input', 'invalid parameter', 'validation error', 'bad request'],
  [VideoFailureReason.PROVIDER_ERROR]: ['model error', 'prediction failed', 'processing failed']
}

/**
 * Mensagens amigáveis para cada tipo de erro
 */
export const USER_FRIENDLY_MESSAGES: Record<VideoFailureReason, string> = {
  [VideoFailureReason.SAFETY_BLOCKED]: 
    '⚠️ Não foi possível gerar o vídeo porque o conteúdo do prompt foi bloqueado pela política de segurança. Por favor, revise o texto, remova termos sensíveis ou inapropriados e tente novamente. Seus créditos foram devolvidos automaticamente.',
  
  [VideoFailureReason.PROVIDER_ERROR]: 
    'Houve um erro no serviço de geração de vídeo. Nossa equipe foi notificada. Seus créditos foram devolvidos. Por favor, tente novamente em alguns minutos.',
  
  [VideoFailureReason.INTERNAL_ERROR]: 
    'Ocorreu um erro interno ao processar seu vídeo. Seus créditos foram devolvidos automaticamente. Por favor, tente novamente.',
  
  [VideoFailureReason.STORAGE_ERROR]: 
    'O vídeo foi gerado mas houve erro ao salvá-lo em nosso armazenamento. Seus créditos foram devolvidos. Por favor, tente novamente.',
  
  [VideoFailureReason.TIMEOUT_ERROR]: 
    'O processamento do vídeo excedeu o tempo limite. Seus créditos foram devolvidos. Por favor, tente novamente.',
  
  [VideoFailureReason.QUOTA_ERROR]: 
    'O serviço de vídeo atingiu o limite temporário. Por favor, aguarde alguns minutos e tente novamente. Seus créditos foram devolvidos.',
  
  [VideoFailureReason.NETWORK_ERROR]: 
    'Erro de conexão com o serviço de vídeo. Seus créditos foram devolvidos. Por favor, verifique sua conexão e tente novamente.',
  
  [VideoFailureReason.INVALID_INPUT]: 
    'Os parâmetros fornecidos são inválidos. Seus créditos foram devolvidos. Por favor, verifique suas configurações e tente novamente.',
  
  [VideoFailureReason.UNKNOWN_ERROR]: 
    'Ocorreu um erro inesperado. Seus créditos foram devolvidos automaticamente. Por favor, tente novamente ou entre em contato com o suporte.'
}

/**
 * Detecta o tipo de erro baseado na mensagem de erro do provider
 * ⚠️ DEPRECATED: Use categorizeMediaError de @/lib/media/error-handler
 */
export function categorizeVideoError(errorMessage: string | null | undefined): VideoFailureReason {
  // Usar handler unificado
  const unifiedReason = unifiedCategorize(errorMessage)
  return unifiedReason as unknown as VideoFailureReason
}

/**
 * Obtém a mensagem amigável para exibir ao usuário
 * ⚠️ DEPRECATED: Use getUserFriendlyMessage de @/lib/media/error-handler
 */
export function getUserFriendlyMessage(failureReason: VideoFailureReason): string {
  return unifiedGetMessage(MediaType.VIDEO_GENERATION, failureReason as unknown as UnifiedFailureReason)
}

/**
 * Interface para resultado do processamento de erro
 */
export interface VideoErrorHandlingResult {
  success: boolean
  refunded: boolean
  failureReason: VideoFailureReason
  userMessage: string
  error?: string
}

/**
 * Processa erro de vídeo e faz estorno de créditos se necessário
 * 
 * ⚠️ DEPRECATED: Use handleMediaFailure de @/lib/media/error-handler
 * 
 * GARANTIAS:
 * - Idempotência: estorno só ocorre uma vez por vídeo
 * - Atomicidade: usa transação do banco
 * - Logging: registra todos os passos para auditoria
 */
export async function handleVideoFailure(
  videoId: string,
  errorMessage: string | null | undefined,
  options: {
    skipRefund?: boolean
    userId?: string
  } = {}
): Promise<VideoErrorHandlingResult> {
  
  // Usar handler unificado
  const result = await handleMediaFailure(
    MediaType.VIDEO_GENERATION,
    videoId,
    errorMessage,
    options
  )
  
  // Converter resultado para formato esperado
  return {
    success: result.success,
    refunded: result.refunded,
    failureReason: result.failureReason as unknown as VideoFailureReason,
    userMessage: result.userMessage,
    error: result.error
  }
}

/**
 * Verifica se um vídeo precisa de estorno de créditos
 * Útil para processos de recuperação/limpeza
 */
export async function needsRefund(videoId: string): Promise<boolean> {
  const video = await prisma.videoGeneration.findUnique({
    where: { id: videoId },
    select: {
      status: true,
      creditsUsed: true,
      creditsRefunded: true,
      videoUrl: true
    }
  })

  if (!video) return false

  // Precisa de estorno se:
  // - Status é FAILED
  // - Créditos foram debitados (> 0)
  // - Ainda não foi feito estorno
  // - Não tem videoUrl válido (não entregou o produto)
  const needsRefund = 
    video.status === 'FAILED' &&
    video.creditsUsed > 0 &&
    !video.creditsRefunded &&
    (!video.videoUrl || !video.videoUrl.includes('amazonaws.com'))

  return needsRefund
}

/**
 * Processa estornos em lote (útil para recuperação)
 */
export async function processFailedVideosRefunds(
  limit: number = 100
): Promise<{ processed: number; refunded: number; errors: string[] }> {
  console.log(`🔄 [processFailedVideosRefunds] Starting batch refund process (limit: ${limit})`)

  const failedVideos = await prisma.videoGeneration.findMany({
    where: {
      status: 'FAILED',
      creditsUsed: { gt: 0 },
      creditsRefunded: false
    },
    take: limit,
    select: {
      id: true,
      errorMessage: true
    }
  })

  console.log(`📊 [processFailedVideosRefunds] Found ${failedVideos.length} videos needing refund`)

  let processed = 0
  let refunded = 0
  const errors: string[] = []

  for (const video of failedVideos) {
    try {
      const result = await handleVideoFailure(video.id, video.errorMessage)
      processed++
      if (result.refunded) refunded++
    } catch (error) {
      const errorMsg = `Video ${video.id}: ${error instanceof Error ? error.message : String(error)}`
      errors.push(errorMsg)
      console.error(`❌ [processFailedVideosRefunds] ${errorMsg}`)
    }

    // Pequeno delay para não sobrecarregar o banco
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  console.log(`✅ [processFailedVideosRefunds] Completed: ${processed} processed, ${refunded} refunded, ${errors.length} errors`)

  return { processed, refunded, errors }
}

