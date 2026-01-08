'use client'

import { useEffect } from 'react'
import { setupGlobalErrorHandler } from '@/lib/client-logger'

/**
 * Provider para configurar logging global de erros
 * Captura erros não tratados e envia para o servidor
 */
export function ErrorLoggerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Configurar handlers globais de erro apenas uma vez
    setupGlobalErrorHandler()

    console.log('[ERROR_LOGGER] Global error handlers configured')
  }, [])

  return <>{children}</>
}
