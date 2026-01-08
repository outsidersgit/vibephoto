/**
 * Client-side error logging utility
 *
 * Envia erros do client para o servidor para análise
 * Especialmente útil para erros que acontecem apenas em navegadores específicos
 */

interface ClientErrorData {
  errorMessage: string
  errorStack?: string
  errorType?: string
  url?: string
  componentStack?: string
  additionalData?: Record<string, any>
  timestamp?: string
}

/**
 * Envia erro do client para o servidor
 */
export async function logClientError(error: Error | string, additionalData?: Record<string, any>) {
  try {
    const errorMessage = typeof error === 'string' ? error : error.message
    const errorStack = typeof error === 'object' && error.stack ? error.stack : undefined
    const errorType = typeof error === 'object' ? error.constructor.name : 'Error'

    const errorData: ClientErrorData = {
      errorMessage,
      errorStack,
      errorType,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      additionalData: {
        ...additionalData,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        viewport: typeof window !== 'undefined'
          ? { width: window.innerWidth, height: window.innerHeight }
          : undefined,
        platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
        language: typeof navigator !== 'undefined' ? navigator.language : undefined,
      },
      timestamp: new Date().toISOString()
    }

    // Log no console do browser também
    console.error('[CLIENT_LOGGER] Logging error to server:', {
      message: errorMessage,
      type: errorType,
      additionalData
    })

    // Enviar para servidor (não aguardar resposta para não bloquear)
    fetch('/api/logs/client-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorData),
      // keepalive garante que request seja enviada mesmo se página fechar
      keepalive: true
    }).catch((fetchError) => {
      // Se falhar ao enviar, só logar no console
      console.error('[CLIENT_LOGGER] Failed to send error to server:', fetchError)
    })

  } catch (loggingError) {
    // Não deixar o logging causar mais erros
    console.error('[CLIENT_LOGGER] Error in logging utility:', loggingError)
  }
}

/**
 * Captura erros não tratados globalmente
 */
export function setupGlobalErrorHandler() {
  if (typeof window === 'undefined') return

  // Capturar erros JavaScript não tratados
  window.addEventListener('error', (event) => {
    logClientError(event.error || event.message, {
      source: 'window.onerror',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    })
  })

  // Capturar promises rejeitadas não tratadas
  window.addEventListener('unhandledrejection', (event) => {
    logClientError(
      event.reason instanceof Error ? event.reason : String(event.reason),
      {
        source: 'unhandledrejection',
        promiseRejection: true
      }
    )
  })
}

/**
 * Hook React para capturar erros em componentes
 */
export function logReactError(error: Error, errorInfo?: { componentStack?: string }) {
  logClientError(error, {
    source: 'react-error-boundary',
    componentStack: errorInfo?.componentStack
  })
}

/**
 * Validação defensiva de dados antes de enviar para API
 * Retorna dados sanitizados ou erro detalhado
 */
export function validateAndSanitize(data: any, context: string): {
  valid: boolean
  data?: any
  error?: string
  sanitized?: boolean
} {
  try {
    // Verificar se é objeto válido
    if (!data || typeof data !== 'object') {
      return {
        valid: false,
        error: `Invalid data type in ${context}: expected object, got ${typeof data}`
      }
    }

    let sanitized = false
    const cleanData = { ...data }

    // Sanitizar strings com caracteres problemáticos
    Object.keys(cleanData).forEach(key => {
      if (typeof cleanData[key] === 'string') {
        const original = cleanData[key]

        // Remover caracteres de controle que podem causar problemas
        // mas manter emojis e caracteres unicode normais
        cleanData[key] = original.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

        if (original !== cleanData[key]) {
          sanitized = true
          console.warn(`[SANITIZE] Removed control characters from ${key} in ${context}`)
        }

        // Verificar comprimento máximo
        if (cleanData[key].length > 10000) {
          cleanData[key] = cleanData[key].substring(0, 10000)
          sanitized = true
          console.warn(`[SANITIZE] Truncated ${key} in ${context} (was ${original.length} chars)`)
        }
      }
    })

    return {
      valid: true,
      data: cleanData,
      sanitized
    }

  } catch (error) {
    return {
      valid: false,
      error: `Validation error in ${context}: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Detecta navegador e versão
 */
export function detectBrowser(): {
  name: string
  version: string
  isSafari: boolean
  isIOS: boolean
  isChrome: boolean
  isFirefox: boolean
} {
  if (typeof navigator === 'undefined') {
    return {
      name: 'unknown',
      version: 'unknown',
      isSafari: false,
      isIOS: false,
      isChrome: false,
      isFirefox: false
    }
  }

  const ua = navigator.userAgent
  const iOS = /iPhone|iPad|iPod/.test(ua)
  const safari = /Safari/.test(ua) && !/Chrome/.test(ua)
  const chrome = /Chrome/.test(ua) && !/Edge/.test(ua)
  const firefox = /Firefox/.test(ua)

  let version = 'unknown'

  if (safari) {
    const match = ua.match(/Version\/(\d+\.\d+)/)
    version = match ? match[1] : 'unknown'
  } else if (chrome) {
    const match = ua.match(/Chrome\/(\d+\.\d+)/)
    version = match ? match[1] : 'unknown'
  } else if (firefox) {
    const match = ua.match(/Firefox\/(\d+\.\d+)/)
    version = match ? match[1] : 'unknown'
  }

  return {
    name: safari ? 'Safari' : chrome ? 'Chrome' : firefox ? 'Firefox' : 'other',
    version,
    isSafari: safari,
    isIOS: iOS,
    isChrome: chrome,
    isFirefox: firefox
  }
}

/**
 * Testa compatibilidade de features
 */
export function testBrowserCompatibility(): {
  formData: boolean
  fetch: boolean
  fileReader: boolean
  asyncAwait: boolean
  issues: string[]
} {
  const issues: string[] = []

  const tests = {
    formData: typeof FormData !== 'undefined',
    fetch: typeof fetch !== 'undefined',
    fileReader: typeof FileReader !== 'undefined',
    asyncAwait: true // Se o código está rodando, já suporta
  }

  if (!tests.formData) issues.push('FormData not supported')
  if (!tests.fetch) issues.push('Fetch API not supported')
  if (!tests.fileReader) issues.push('FileReader not supported')

  return { ...tests, issues }
}
