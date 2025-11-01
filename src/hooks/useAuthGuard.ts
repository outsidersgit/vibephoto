'use client'

import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * Hook para proteger páginas contra acesso via bfcache (botão voltar) após logout
 * Verifica sessão quando a página é restaurada do cache do navegador
 */
export function useAuthGuard() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const hasCheckedRef = useRef(false)

  // Lista de rotas protegidas que requerem autenticação
  const protectedPaths = ['/dashboard', '/models', '/generate', '/billing', '/gallery', '/editor', '/profile', '/settings', '/credits', '/packages']
  
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))

  useEffect(() => {
    if (!isProtectedPath) {
      return // Não verificar em rotas públicas
    }

    // Verificar sessão quando a página é carregada ou restaurada do bfcache
    const checkAuth = () => {
      // Aguardar um pouco para garantir que a sessão foi carregada
      setTimeout(() => {
        // Se não está autenticado, redirecionar
        if (status === 'unauthenticated' || (!session && status !== 'loading')) {
          console.log('🚫 Acesso não autorizado detectado via bfcache - redirecionando para login')
          // Usar window.location.replace para evitar adicionar ao history (evita botão voltar)
          const callbackUrl = encodeURIComponent(pathname)
          window.location.replace(`/auth/signin?callbackUrl=${callbackUrl}`)
        }
      }, 200)
    }

    // Verificar imediatamente
    if (!hasCheckedRef.current) {
      checkAuth()
      hasCheckedRef.current = true
    }

    // Verificar quando a página é restaurada do bfcache (evento pageshow)
    const handlePageShow = (event: PageTransitionEvent) => {
      // event.persisted = true significa que a página foi restaurada do bfcache
      if (event.persisted) {
        console.log('🔄 Página restaurada do bfcache - verificando autenticação...')
        hasCheckedRef.current = false
        checkAuth()
      }
    }

    window.addEventListener('pageshow', handlePageShow)

    return () => {
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [session, status, pathname, isProtectedPath])

  // Verificar também quando a sessão muda (logout em outra aba, por exemplo)
  useEffect(() => {
    if (!isProtectedPath) {
      return
    }

    // Se status mudou para unauthenticated, redirecionar imediatamente
    if (status === 'unauthenticated') {
      console.log('🚫 Sessão não autenticada detectada - redirecionando para login')
      const callbackUrl = encodeURIComponent(pathname)
      window.location.replace(`/auth/signin?callbackUrl=${callbackUrl}`)
    }
  }, [status, pathname, isProtectedPath])
}

