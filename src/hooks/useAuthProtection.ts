'use client'

import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useAuthGuard } from './useAuthGuard'

/**
 * Hook compartilhado para proteção de páginas client-side
 * Replica a lógica da /gallery que funciona corretamente
 * 
 * CRITICAL: Verifica cookies ANTES de qualquer renderização
 * Isso previne que conteúdo protegido seja exibido via bfcache
 */
export function useAuthProtection() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const isAuthorized = useAuthGuard()
  const hasRedirectedRef = useRef(false)
  
  // CRITICAL: Verificação IMEDIATA antes de qualquer hook ou estado
  // Prevenir erro React #300 ao bloquear renderização completamente
  // PERFORMANCE: Verificação otimizada para mobile e desktop
  // MOBILE COMPATIBLE: document.cookie funciona em todos os mobile browsers
  if (typeof window !== 'undefined') {
    // PERFORMANCE: Função leve (<0.1ms) que verifica cookies diretamente
    // Evita depender de NextAuth que pode estar em estado inconsistente
    const hasSessionCookie = () => {
      try {
        // MOBILE: document.cookie funciona em iOS Safari, Android Chrome, etc.
        const cookies = document.cookie.split(';')
        return cookies.some(cookie => {
          const cookieName = cookie.trim().split('=')[0]
          return cookieName.includes('next-auth') || 
                 cookieName.includes('__Secure-next-auth') || 
                 cookieName.includes('__Host-next-auth')
        })
      } catch (e) {
        // MOBILE: Fallback seguro se cookie API falhar
        return false
      }
    }
    
    // CRITICAL: Se não há cookie de sessão, redirecionar IMEDIATAMENTE
    // MOBILE COMPATIBLE: location.replace funciona em todos os mobile browsers
    if (!hasRedirectedRef.current && !hasSessionCookie() && (status === 'unauthenticated' || isAuthorized === false)) {
      hasRedirectedRef.current = true
      // Bloquear qualquer renderização adicional
      const redirectUrl = '/auth/signin?callbackUrl=' + encodeURIComponent(pathname)
      try {
        // MOBILE: replace funciona em iOS Safari, Android Chrome, etc.
        window.location.replace(redirectUrl)
      } catch (error) {
        // MOBILE: Fallback para browsers que não suportam replace
        window.location.href = redirectUrl
      }
    }
  }
  
  // CRITICAL: Redirecionar se não autorizado (usando useEffect para não violar regras dos hooks)
  useEffect(() => {
    if (!hasRedirectedRef.current && (isAuthorized === false || status === 'unauthenticated')) {
      hasRedirectedRef.current = true
      console.log('🚫 [useAuthProtection] Acesso não autorizado - redirecionando para login')
      const redirectUrl = '/auth/signin?callbackUrl=' + encodeURIComponent(pathname)
      try {
        window.location.replace(redirectUrl)
      } catch (error) {
        console.error('❌ [useAuthProtection] Erro ao redirecionar:', error)
        window.location.href = redirectUrl
      }
    }
  }, [isAuthorized, status, pathname])
  
  // CRITICAL: Se não autorizado, bloquear renderização
  if (isAuthorized === false || status === 'unauthenticated') {
    return {
      isAuthorized: false,
      shouldBlock: true
    }
  }
  
  return {
    isAuthorized: isAuthorized === true,
    shouldBlock: false,
    isLoading: isAuthorized === null || status === 'loading'
  }
}

