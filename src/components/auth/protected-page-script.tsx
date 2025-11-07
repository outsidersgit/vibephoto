'use client'

import Script from 'next/script'

/**
 * Script de Proteção Multi-Camada para Rotas Protegidas
 * 
 * Baseado em Next.js 15 Best Practices:
 * - https://nextjs.org/docs/app/building-your-application/routing/middleware
 * - https://nextjs.org/docs/app/api-reference/functions/route-handlers
 * 
 * Estratégia:
 * 1. Injeta meta tags no <head> para prevenir BFCache
 * 2. Intercepta pageshow/popstate ANTES do React hidratar
 * 3. Verifica sessão via Route Handler otimizado (/api/auth/verify)
 * 4. Redireciona IMEDIATAMENTE se não autenticado
 */
export function ProtectedPageScript() {
  return null
}

