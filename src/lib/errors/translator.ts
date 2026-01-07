/**
 * Error Translator - Camada centralizada de tratamento de erros
 *
 * REGRAS CRÍTICAS:
 * - NUNCA exibir error.message cru do backend
 * - NUNCA mostrar mensagens técnicas ou stack trace
 * - Toda mensagem deve ser amigável e acionável
 */

export type ErrorSeverity = 'low' | 'high' | 'critical'

export interface TranslatedError {
  userMessage: string
  severity: ErrorSeverity
  toastDurationMs: number
  shouldPersist: boolean // Se true, mostrar modal/banner além do toast
  cta?: {
    label: string
    action: string // URL ou ação
  }
  debugMeta: {
    originalMessage?: string
    statusCode?: number
    errorCode?: string
    stack?: string
  }
}

/**
 * Traduz qualquer erro para mensagem amigável
 */
export function translateError(error: unknown): TranslatedError {
  const errorString = getErrorString(error)
  const statusCode = getStatusCode(error)
  const errorCode = getErrorCode(error)

  // 1. ERROS DE VALIDAÇÃO / FORMATO
  if (isValidationError(errorString, errorCode)) {
    return {
      userMessage: 'Algum dado foi preenchido em formato inválido. Revise e tente novamente.',
      severity: 'low',
      toastDurationMs: 8000,
      shouldPersist: false,
      debugMeta: {
        originalMessage: errorString,
        statusCode,
        errorCode
      }
    }
  }

  // 2. ERROS DE MODERAÇÃO / CONTEÚDO
  if (isModerationError(errorString, errorCode)) {
    return {
      userMessage: 'Não foi possível gerar por causa das diretrizes de conteúdo. Ajuste o prompt e tente novamente.',
      severity: 'high',
      toastDurationMs: 10000,
      shouldPersist: false,
      cta: {
        label: 'Ver diretrizes',
        action: '/help/content-policy'
      },
      debugMeta: {
        originalMessage: errorString,
        statusCode,
        errorCode
      }
    }
  }

  // 3. ERROS DE CRÉDITO / PAGAMENTO
  if (isCreditError(errorString, errorCode)) {
    return {
      userMessage: 'Você não tem créditos suficientes para esta ação.',
      severity: 'critical',
      toastDurationMs: 10000,
      shouldPersist: true, // Modal de compra de créditos
      cta: {
        label: 'Comprar créditos',
        action: '/billing?tab=credits'
      },
      debugMeta: {
        originalMessage: errorString,
        statusCode,
        errorCode
      }
    }
  }

  // 4. ERROS DE NETWORK / TIMEOUT
  if (isNetworkError(errorString, statusCode)) {
    return {
      userMessage: 'Falha de conexão. Verifique sua internet e tente novamente.',
      severity: 'high',
      toastDurationMs: 8000,
      shouldPersist: false,
      debugMeta: {
        originalMessage: errorString,
        statusCode,
        errorCode
      }
    }
  }

  // 5. ERROS DE AUTENTICAÇÃO
  if (isAuthError(errorString, statusCode)) {
    return {
      userMessage: 'Sua sessão expirou. Por favor, faça login novamente.',
      severity: 'critical',
      toastDurationMs: 10000,
      shouldPersist: true,
      cta: {
        label: 'Fazer login',
        action: '/auth/signin'
      },
      debugMeta: {
        originalMessage: errorString,
        statusCode,
        errorCode
      }
    }
  }

  // 6. ERROS DE ASSINATURA
  if (isSubscriptionError(errorString, errorCode)) {
    return {
      userMessage: 'Você precisa de uma assinatura ativa para usar este recurso.',
      severity: 'critical',
      toastDurationMs: 10000,
      shouldPersist: true,
      cta: {
        label: 'Ver planos',
        action: '/pricing'
      },
      debugMeta: {
        originalMessage: errorString,
        statusCode,
        errorCode
      }
    }
  }

  // 7. ERROS DE MODELO / TREINAMENTO
  if (isModelError(errorString, errorCode)) {
    return {
      userMessage: 'Erro ao processar seu modelo. Tente novamente ou entre em contato com o suporte.',
      severity: 'high',
      toastDurationMs: 10000,
      shouldPersist: false,
      cta: {
        label: 'Suporte',
        action: '/support'
      },
      debugMeta: {
        originalMessage: errorString,
        statusCode,
        errorCode
      }
    }
  }

  // 8. ERROS DE GERAÇÃO (COM GARANTIA DE NÃO COBRANÇA)
  if (isGenerationError(errorString, errorCode)) {
    return {
      userMessage: 'A geração falhou e seus créditos não foram cobrados. Tente novamente.',
      severity: 'high',
      toastDurationMs: 10000,
      shouldPersist: false,
      debugMeta: {
        originalMessage: errorString,
        statusCode,
        errorCode
      }
    }
  }

  // 9. ERRO DESCONHECIDO (FALLBACK)
  return {
    userMessage: 'Algo deu errado. Tente novamente em instantes ou entre em contato com o suporte.',
    severity: 'high',
    toastDurationMs: 8000,
    shouldPersist: false,
    cta: {
      label: 'Suporte',
      action: '/support'
    },
    debugMeta: {
      originalMessage: errorString,
      statusCode,
      errorCode,
      stack: error instanceof Error ? error.stack : undefined
    }
  }
}

// ============================================================================
// HELPERS DE DETECÇÃO DE TIPO DE ERRO
// ============================================================================

function isValidationError(message: string, code?: string): boolean {
  const validationPatterns = [
    /pattern/i,
    /zod/i,
    /invalid/i,
    /formato/i,
    /validation/i,
    /expected pattern/i,
    /match/i,
    /required/i,
    /must be/i
  ]

  return validationPatterns.some(pattern => pattern.test(message)) ||
         code === 'VALIDATION_ERROR' ||
         code === 'INVALID_INPUT'
}

function isModerationError(message: string, code?: string): boolean {
  const moderationPatterns = [
    /moderation/i,
    /content policy/i,
    /inappropriate/i,
    /violates/i,
    /nsfw/i,
    /blocked/i
  ]

  return moderationPatterns.some(pattern => pattern.test(message)) ||
         code === 'CONTENT_MODERATION' ||
         code === 'POLICY_VIOLATION'
}

function isCreditError(message: string, code?: string): boolean {
  const creditPatterns = [
    /insufficient.*credit/i,
    /not enough.*credit/i,
    /créditos insuficientes/i,
    /sem créditos/i,
    /credit.*required/i
  ]

  return creditPatterns.some(pattern => pattern.test(message)) ||
         code === 'INSUFFICIENT_CREDITS' ||
         code === 'NO_CREDITS'
}

function isNetworkError(message: string, statusCode?: number): boolean {
  const networkPatterns = [
    /network/i,
    /timeout/i,
    /connection/i,
    /fetch failed/i,
    /econnrefused/i,
    /enotfound/i
  ]

  return networkPatterns.some(pattern => pattern.test(message)) ||
         statusCode === 0 ||
         statusCode === 503 ||
         statusCode === 504
}

function isAuthError(message: string, statusCode?: number): boolean {
  const authPatterns = [
    /unauthorized/i,
    /unauthenticated/i,
    /not authenticated/i,
    /session.*expired/i,
    /login.*required/i
  ]

  return authPatterns.some(pattern => pattern.test(message)) ||
         statusCode === 401
}

function isSubscriptionError(message: string, code?: string): boolean {
  const subscriptionPatterns = [
    /subscription.*required/i,
    /active subscription/i,
    /assinatura.*necessária/i,
    /upgrade.*required/i
  ]

  return subscriptionPatterns.some(pattern => pattern.test(message)) ||
         code === 'SUBSCRIPTION_REQUIRED' ||
         code === 'NO_ACTIVE_SUBSCRIPTION'
}

function isModelError(message: string, code?: string): boolean {
  const modelPatterns = [
    /model.*not found/i,
    /model.*failed/i,
    /training.*failed/i,
    /modelo.*erro/i
  ]

  return modelPatterns.some(pattern => pattern.test(message)) ||
         code === 'MODEL_ERROR' ||
         code === 'TRAINING_FAILED'
}

function isGenerationError(message: string, code?: string): boolean {
  const generationPatterns = [
    /generation.*failed/i,
    /image.*failed/i,
    /geração.*falhou/i,
    /failed to generate/i
  ]

  return generationPatterns.some(pattern => pattern.test(message)) ||
         code === 'GENERATION_FAILED' ||
         code === 'IMAGE_GENERATION_ERROR'
}

// ============================================================================
// HELPERS DE EXTRAÇÃO
// ============================================================================

function getErrorString(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return 'Unknown error'
}

function getStatusCode(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    if ('status' in error && typeof error.status === 'number') {
      return error.status
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return error.statusCode
    }
  }
  return undefined
}

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object') {
    if ('code' in error && typeof error.code === 'string') {
      return error.code
    }
    if ('errorCode' in error && typeof error.errorCode === 'string') {
      return error.errorCode
    }
  }
  return undefined
}
