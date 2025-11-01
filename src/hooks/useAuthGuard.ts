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
  const redirectingRef = useRef(false)
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  // Lista de rotas protegidas que requerem autenticação
  const protectedPaths = ['/dashboard', '/models', '/generate', '/billing', '/gallery', '/editor', '/profile', '/settings', '/credits', '/packages']
  
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))

  // Função de redirecionamento seguro (usando useCallback para evitar recriação)
  const redirectToLogin = (callbackUrl?: string) => {
    if (redirectingRef.current) {
      return // Já redirecionando, evitar múltiplos redirects
    }
    
    redirectingRef.current = true
    console.log('🚫 [useAuthGuard] Redirecionando para login...')
    
    const url = callbackUrl || pathname
    const signInUrl = `/auth/signin?callbackUrl=${encodeURIComponent(url)}`
    
    // Usar replace para não adicionar ao history (evita botão voltar)
    // Forçar redirecionamento mesmo se houver erros
    try {
      window.location.replace(signInUrl)
    } catch (error) {
      console.error('❌ [useAuthGuard] Erro ao redirecionar:', error)
      // Fallback: usar href se replace falhar
      window.location.href = signInUrl
    }
  }

  // Verificação SÍNCRONA imediata para bloquear renderização
  useEffect(() => {
    if (!isProtectedPath) {
      setIsAuthorized(true)
      return
    }

    // CRITICAL: Se não está autenticado, redirecionar IMEDIATAMENTE antes de qualquer renderização
    if (status === 'unauthenticated') {
      console.log('🚫 [useAuthGuard] Sessão não autenticada - redirecionando imediatamente')
      setIsAuthorized(false)
      redirectToLogin.current(pathname)
      return
    }

    // Se está carregando, aguardar mas não autorizar ainda
    if (status === 'loading') {
      setIsAuthorized(null) // null = loading
      return
    }

    // Se tem sessão, autorizar
    if (session) {
      setIsAuthorized(true)
    } else {
      // Sem sessão após loading - redirecionar
      setIsAuthorized(false)
      redirectToLogin.current(pathname)
    }
  }, [session, status, pathname, isProtectedPath])

  // CRITICAL: Verificar ANTES da primeira renderização (execução imediata)
  useEffect(() => {
    if (!isProtectedPath || hasCheckedRef.current) {
      return
    }

    // Executar verificação imediata ao montar o componente
    if (typeof window !== 'undefined') {
      hasCheckedRef.current = true
      
      // Verificar se já está no bfcache (página restaurada)
      // Se não há sessão na memória, pode ser bfcache
      if (!session && status !== 'loading') {
        console.log('🔄 [useAuthGuard] Verificação inicial - possível bfcache detectado')
        redirectToLogin.current(pathname)
      }
    }
  }, [])

  // Verificar quando a página é restaurada do bfcache (evento pageshow)
  useEffect(() => {
    if (!isProtectedPath) {
      return
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      // event.persisted = true significa que a página foi restaurada do bfcache
      if (event.persisted) {
        console.log('🔄 [useAuthGuard] Página restaurada do bfcache - verificando autenticação imediatamente...')
        hasCheckedRef.current = false
        redirectingRef.current = false // Reset flag para permitir novo redirect
        
        // CRITICAL: Redirecionar IMEDIATAMENTE se não autenticado (sem aguardar status)
        // Isso evita que a página tente renderizar antes do redirect
        const checkAuth = async () => {
          // Pequeno delay para garantir que NextAuth tenha tempo de verificar sessão
          await new Promise(resolve => setTimeout(resolve, 50))
          
          if (status === 'unauthenticated' || (!session && status !== 'loading')) {
            console.log('🚫 [useAuthGuard] Não autenticado após bfcache - redirecionando imediatamente')
            setIsAuthorized(false)
            redirectToLogin.current(pathname)
          } else if (session) {
            console.log('✅ [useAuthGuard] Sessão válida após bfcache')
            setIsAuthorized(true)
          }
        }
        
        checkAuth()
      }
    }

    window.addEventListener('pageshow', handlePageShow)

    return () => {
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [session, status, pathname, isProtectedPath])

  // Retornar autorização para componentes usarem
  // CRITICAL: Retornar false imediatamente se redirecionando
  if (redirectingRef.current) {
    return false
  }
  
  return isAuthorized !== false // true ou null (loading) permite renderização, false bloqueia
}

