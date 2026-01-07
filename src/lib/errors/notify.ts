/**
 * Notification Helper - Exibição padronizada de erros
 *
 * USO:
 * - notifyError(error) → Traduz e exibe automaticamente
 * - NUNCA usar toast(error.message) diretamente
 */

import { translateError, type TranslatedError } from './translator'

// Tipos para callbacks de UI
type ToastFunction = (params: {
  title: string
  description?: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  action?: { label: string; onClick: () => void }
}) => void

type PersistentErrorHandler = (error: TranslatedError) => void

// Estado global para injeção de dependências
let globalToastFn: ToastFunction | null = null
let globalPersistentHandler: PersistentErrorHandler | null = null

/**
 * Configura funções de toast e modal (chamar no App root)
 */
export function configureErrorNotifications(
  toastFn: ToastFunction,
  persistentHandler?: PersistentErrorHandler
) {
  globalToastFn = toastFn
  globalPersistentHandler = persistentHandler || null
}

/**
 * Exibe erro traduzido para o usuário
 *
 * CRITICAL: Esta é a ÚNICA função que deve ser usada para mostrar erros
 */
export function notifyError(error: unknown, context?: string) {
  const translated = translateError(error)

  // Log interno (para debugging/Sentry)
  logError(translated, context)

  // Exibir toast
  showErrorToast(translated)

  // Se crítico, exibir modal/banner persistente
  if (translated.shouldPersist && globalPersistentHandler) {
    globalPersistentHandler(translated)
  }

  return translated
}

/**
 * Notificação de sucesso (para manter API consistente)
 */
export function notifySuccess(
  title: string,
  description?: string,
  duration = 5000
) {
  if (!globalToastFn) {
    console.warn('Toast function not configured')
    return
  }

  globalToastFn({
    title,
    description,
    type: 'success',
    duration
  })
}

/**
 * Notificação de aviso
 */
export function notifyWarning(
  title: string,
  description?: string,
  duration = 6000
) {
  if (!globalToastFn) {
    console.warn('Toast function not configured')
    return
  }

  globalToastFn({
    title,
    description,
    type: 'warning',
    duration
  })
}

/**
 * Notificação de info
 */
export function notifyInfo(
  title: string,
  description?: string,
  duration = 5000
) {
  if (!globalToastFn) {
    console.warn('Toast function not configured')
    return
  }

  globalToastFn({
    title,
    description,
    type: 'info',
    duration
  })
}

// ============================================================================
// INTERNALS
// ============================================================================

function showErrorToast(error: TranslatedError) {
  if (!globalToastFn) {
    console.error('Toast function not configured. Error:', error.userMessage)
    return
  }

  const action = error.cta
    ? {
        label: error.cta.label,
        onClick: () => {
          if (error.cta!.action.startsWith('/')) {
            window.location.href = error.cta!.action
          } else {
            // Callback customizado
            console.log('CTA action:', error.cta!.action)
          }
        }
      }
    : undefined

  globalToastFn({
    title: getTitleFromSeverity(error.severity),
    description: error.userMessage,
    type: 'error',
    duration: error.toastDurationMs,
    action
  })
}

function getTitleFromSeverity(severity: TranslatedError['severity']): string {
  switch (severity) {
    case 'low':
      return 'Atenção'
    case 'high':
      return 'Erro'
    case 'critical':
      return 'Erro Crítico'
    default:
      return 'Erro'
  }
}

function logError(error: TranslatedError, context?: string) {
  const logData = {
    context: context || 'Unknown',
    severity: error.severity,
    userMessage: error.userMessage,
    debugMeta: error.debugMeta,
    timestamp: new Date().toISOString()
  }

  // Log baseado em severidade
  if (error.severity === 'critical') {
    console.error('🔴 [CRITICAL ERROR]', logData)
  } else if (error.severity === 'high') {
    console.error('🟠 [ERROR]', logData)
  } else {
    console.warn('🟡 [WARNING]', logData)
  }

  // TODO: Enviar para Sentry/monitoring service
  // Sentry.captureException(new Error(error.userMessage), {
  //   contexts: { errorTranslation: logData }
  // })
}
