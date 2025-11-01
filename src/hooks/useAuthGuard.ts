'use client'

import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/**
 * Hook para proteger páginas contra acesso via bfcache (botão voltar) após logout
 * Verifica sessão quando a página é restaurada do cache do navegador
 * @returns {boolean} - Retorna false se a página deve ser bloqueada (não autenticado)
 */
export function useAuthGuard() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const hasCheckedRef = useRef(false)
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  // Lista de rotas protegidas que requerem autenticação
  const protectedPaths = ['/dashboard', '/models', '/generate', '/billing', '/gallery', '/editor', '/profile', '/settings', '/credits', '/packages']
  
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))

  // Verificação SÍNCRONA imediata para bloquear renderização
  useEffect(() => {
    if (!isProtectedPath) {
      setIsAuthorized(true)
      return
    }

    // Verificação IMEDIATA sem delay - se não está autenticado, bloquear
    if (status === 'unauthenticated') {
      console.log('🚫 [useAuthGuard] Sessão não autenticada - bloqueando renderização')
      setIsAuthorized(false)
      // Redirecionar imediatamente
      const callbackUrl = encodeURIComponent(pathname)
      window.location.replace(`/auth/signin?callbackUrl=${callbackUrl}`)
      return
    }

    // Se está carregando, aguardar
    if (status === 'loading') {
      setIsAuthorized(null) // null = loading
      return
    }

    // Se tem sessão, autorizar
    if (session) {
      setIsAuthorized(true)
    } else {
      setIsAuthorized(false)
      const callbackUrl = encodeURIComponent(pathname)
      window.location.replace(`/auth/signin?callbackUrl=${callbackUrl}`)
    }
  }, [session, status, pathname, isProtectedPath])

  // Verificar quando a página é restaurada do bfcache (evento pageshow)
  useEffect(() => {
    if (!isProtectedPath) {
      return
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      // event.persisted = true significa que a página foi restaurada do bfcache
      if (event.persisted) {
        console.log('🔄 [useAuthGuard] Página restaurada do bfcache - verificando autenticação...')
        hasCheckedRef.current = false
        
        // Verificar imediatamente e bloquear se não autenticado
        if (status === 'unauthenticated' || !session) {
          console.log('🚫 [useAuthGuard] Não autenticado após bfcache - bloqueando e redirecionando')
          setIsAuthorized(false)
          const callbackUrl = encodeURIComponent(pathname)
          window.location.replace(`/auth/signin?callbackUrl=${callbackUrl}`)
        }
      }
    }

    window.addEventListener('pageshow', handlePageShow)

    return () => {
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [session, status, pathname, isProtectedPath])

  // Retornar autorização para componentes usarem
  return isAuthorized !== false // true ou null (loading) permite renderização, false bloqueia
}

