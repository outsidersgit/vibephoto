'use client'

import { signOut } from 'next-auth/react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

/**
 * Hook para logout completo que limpa:
 * - localStorage
 * - sessionStorage
 * - Cookies personalizados
 * - React Query cache
 * - Sessão NextAuth
 */
export function useLogout() {
  const queryClient = useQueryClient()
  const router = useRouter()

  const logout = useCallback(async (callbackUrl: string = '/') => {
    try {
      console.log('🧹 Iniciando limpeza completa de cache e sessão...')

      // 1. Limpar localStorage COMPLETAMENTE (exceto apenas consentimentos não sensíveis)
      const preserveKeys = ['ensaio_fotos_consent', 'consent_preferences'] // Mantém apenas consentimentos legais
      const localStorageKeys = Object.keys(localStorage)
      let removedCount = 0
      
      localStorageKeys.forEach(key => {
        if (!preserveKeys.includes(key)) {
          localStorage.removeItem(key)
          removedCount++
          console.log(`  🗑️ localStorage removido: ${key}`)
        }
      })
      console.log(`  ✅ localStorage: ${removedCount} chaves removidas, ${preserveKeys.length} preservadas`)

      // 2. Limpar IndexedDB COMPLETAMENTE (drafts + persisted data)
      try {
        const { finalizeDraft } = await import('@/lib/utils/indexed-db-persistence')
        await Promise.all([
          finalizeDraft('editor'),
          finalizeDraft('video'),
          finalizeDraft('generation'),
          finalizeDraft('model')
        ])
        console.log(`  ✅ IndexedDB: Todos os drafts limpos (editor, video, generation, model)`)
      } catch (idbError) {
        console.error('  ⚠️ Erro ao limpar IndexedDB:', idbError)
        // Continue logout mesmo se IndexedDB falhar
      }

      // 3. Limpar sessionStorage COMPLETAMENTE
      const sessionKeysCount = Object.keys(sessionStorage).length
      sessionStorage.clear()
      console.log(`  ✅ sessionStorage: ${sessionKeysCount} chaves removidas (limpo completamente)`)

      // 4. Limpar TODOS os cookies (incluindo NextAuth, Vercel e personalizados)
      // MOBILE COMPATIBLE: document.cookie funciona em todos os mobile browsers
      // PERFORMANCE: Verificação otimizada para mobile e desktop
      // Lista completa de padrões de cookies que devem ser removidos
      const cookiePatterns = [
        // NextAuth cookies
        'next-auth',
        '__Secure-next-auth',
        '__Host-next-auth',
        // Vercel cookies
        '_vercel',
        'vercel-',
        // Cookies personalizados da aplicação
        'theme_preference',
        'language_pref',
        'gallery_view',
        'notification_settings',
        '_analytics_id',
        'page_views',
        'feature_usage',
        'performance_metrics',
        'user_session_id',
        'user_preferences',
        'gallery_view_preference',
      ]

      // Primeiro, pegar todos os cookies atuais
      const allCookies = document.cookie.split(';')
      let cookiesRemovedCount = 0

      allCookies.forEach(cookie => {
        const cookieName = cookie.split('=')[0].trim()
        if (cookieName) {
          // Verificar se o cookie deve ser removido
          const shouldRemove = cookiePatterns.some(pattern => 
            cookieName.toLowerCase().includes(pattern.toLowerCase())
          )

          if (shouldRemove) {
            // Tentar remover com todos os paths e domains possíveis
            const domains = [
              '', // Sem domain (mesmo domínio)
              window.location.hostname,
              `.${window.location.hostname}`,
              window.location.hostname.replace(/^www\./, ''), // Sem www
              `.${window.location.hostname.replace(/^www\./, '')}`, // Com ponto, sem www
            ]

            const paths = ['/', '/auth', '/api', '/gallery', '/models', '/generate']

            domains.forEach(domain => {
              paths.forEach(path => {
                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; ${domain ? `domain=${domain};` : ''}`
              })
            })

            cookiesRemovedCount++
            console.log(`  🗑️ Cookie removido: ${cookieName}`)
          }
        }
      })

      console.log(`  ✅ Cookies: ${cookiesRemovedCount} cookies removidos`)

      // 5. Limpar React Query cache completamente
      queryClient.clear()
      const queryCacheSize = queryClient.getQueryCache().getAll().length
      console.log(`  ✅ React Query cache limpo (${queryCacheSize} queries removidas)`)

      // 6. Limpar history state para evitar botão voltar mostrar conteúdo protegido
      // Substituir o estado atual da página no history para evitar navegação de volta
      if (typeof window !== 'undefined' && window.history.replaceState) {
        window.history.replaceState(null, '', callbackUrl)
        console.log('  ✅ History state limpo')
      }

      // 7. Fazer logout do NextAuth SEM redirect automático para garantir que os logs sejam visíveis
      console.log('  🔐 Fazendo logout do NextAuth...')
      await signOut({
        redirect: false // Não redirecionar automaticamente - vamos fazer manualmente
      })

      console.log('✅ NextAuth signOut concluído')

      // 8. Forçar limpeza adicional de cache do navegador para rotas protegidas
      // Adicionar timestamp para evitar cache
      const redirectUrl = `${callbackUrl}${callbackUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`
      
      console.log(`  ➡️ Redirecionando para ${redirectUrl}...`)
      
      // IMPORTANTE: Aguardar tempo suficiente para garantir que TODOS os logs sejam visíveis
      // e persistem no console mesmo após redirecionamento
      await new Promise(resolve => setTimeout(resolve, 500))

      // Forçar flush dos logs antes de redirecionar
      console.log('✅ Logout completo realizado com sucesso - redirecionando...')
      console.log('%c════════════════════════════════════════', 'color: #10b981; font-weight: bold;')
      console.log('%c✓ TODOS OS CACHES FORAM LIMPOS', 'color: #10b981; font-weight: bold; font-size: 14px')
      console.log('%c✓ localStorage limpo', 'color: #10b981')
      console.log('%c✓ IndexedDB limpo (drafts removidos)', 'color: #10b981')
      console.log('%c✓ sessionStorage limpo', 'color: #10b981')
      console.log('%c✓ Cookies removidos', 'color: #10b981')
      console.log('%c✓ React Query cache limpo', 'color: #10b981')
      console.log('%c✓ History state limpo', 'color: #10b981')
      console.log('%c════════════════════════════════════════', 'color: #10b981; font-weight: bold;')

      // Aguardar mais um pouco para garantir que logs foram renderizados
      await new Promise(resolve => setTimeout(resolve, 200))

      // CRITICAL: Usar replace para não adicionar ao histórico do navegador
      // Isso previne que o usuário use botão voltar para voltar à página protegida
      window.location.replace(redirectUrl)
    } catch (error) {
      console.error('❌ Erro durante logout:', error)
      
      // Mesmo se houver erro, tentar fazer o logout do NextAuth e redirecionar
      try {
        await signOut({
          redirect: false
        })
        
        // CRITICAL: Usar replace para prevenir BFCache
        window.location.replace(callbackUrl)
      } catch (signOutError) {
        console.error('❌ Erro ao fazer signOut:', signOutError)
        // Última tentativa: redirecionar mesmo sem signOut usando replace
        window.location.replace(callbackUrl)
      }
    }
  }, [queryClient])

  return { logout }
}

