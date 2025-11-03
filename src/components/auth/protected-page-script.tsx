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
  return (
    <>
      {/* Meta tags inline para prevenir BFCache */}
      <Script
        id="auth-meta-tags"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              const protectedPaths = ['/dashboard', '/models', '/generate', '/billing', '/gallery', '/editor', '/profile', '/account', '/credits', '/packages', '/pricing', '/support'];
              const currentPath = window.location.pathname;
              const isProtected = protectedPaths.some(path => currentPath.startsWith(path));
              
              if (isProtected && typeof document !== 'undefined') {
                // Adicionar meta tags para prevenir BFCache
                const meta1 = document.createElement('meta');
                meta1.httpEquiv = 'Cache-Control';
                meta1.content = 'no-store, no-cache, must-revalidate';
                document.head.appendChild(meta1);
                
                const meta2 = document.createElement('meta');
                meta2.httpEquiv = 'Pragma';
                meta2.content = 'no-cache';
                document.head.appendChild(meta2);
                
                const meta3 = document.createElement('meta');
                meta3.httpEquiv = 'Expires';
                meta3.content = '0';
                document.head.appendChild(meta3);
              }
            })();
          `,
        }}
      />
      
      {/* Script principal de verificação e interceptação */}
      <Script
        id="auth-redirect-script"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              // CRITICAL: Executar IMEDIATAMENTE, sem aguardar nada
              const protectedPaths = ['/dashboard', '/models', '/generate', '/billing', '/gallery', '/editor', '/profile', '/account', '/credits', '/packages', '/pricing', '/support'];
              const currentPath = window.location.pathname;
              const isProtected = protectedPaths.some(path => currentPath.startsWith(path));
              
              // CRITICAL: Só atuar em rotas protegidas
              if (!isProtected) return;
              
              let isRedirecting = false;
              let hasVerifiedOnLoad = false;
              
              function redirectToLogin() {
                if (isRedirecting) return;
                isRedirecting = true;
                console.log('🚫 [AuthGuard] Redirecionando para login...');
                const redirectUrl = '/auth/signin?callbackUrl=' + encodeURIComponent(currentPath);
                // CRITICAL: Usar replace para não adicionar ao histórico
                try {
                  window.location.replace(redirectUrl);
                } catch (e) {
                  window.location.href = redirectUrl;
                }
              }
              
              // CRITICAL: Verificação ULTRA-RÁPIDA via Route Handler dedicado
              // Usa /api/auth/verify que verifica apenas token JWT (sem consulta ao DB)
              async function verifySession() {
                try {
                  const startTime = performance.now();
                  
                  // Fazer requisição para endpoint otimizado
                  const response = await fetch('/api/auth/verify?' + Date.now(), {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store',
                    headers: {
                      'Cache-Control': 'no-cache, no-store, must-revalidate',
                      'Pragma': 'no-cache'
                    }
                  });
                  
                  const elapsed = performance.now() - startTime;
                  
                  if (!response.ok || response.status === 401 || response.status === 403) {
                    console.log('🚫 [AuthGuard] Sessão inválida (' + elapsed.toFixed(2) + 'ms)');
                    redirectToLogin();
                    return false;
                  }
                  
                  const data = await response.json().catch(() => ({}));
                  if (!data || !data.authenticated || !data.userId) {
                    console.log('🚫 [AuthGuard] Não autenticado (' + elapsed.toFixed(2) + 'ms)');
                    redirectToLogin();
                    return false;
                  }
                  
                  console.log('✅ [AuthGuard] Sessão válida (' + elapsed.toFixed(2) + 'ms)');
                  return true;
                } catch (error) {
                  console.error('❌ [AuthGuard] Erro:', error);
                  // Em caso de erro, redirecionar por segurança
                  redirectToLogin();
                  return false;
                }
              }
              
              // CRITICAL: Verificar IMEDIATAMENTE no carregamento (inclui BFCache)
              // Isso intercepta ANTES do React hidratar
              function checkOnLoad() {
                if (hasVerifiedOnLoad) return;
                hasVerifiedOnLoad = true;
                
                // Verificar se foi restaurado do BFCache
                if (window.performance && window.performance.navigation) {
                  const navType = window.performance.navigation.type;
                  if (navType === 2) { // TYPE_BACK_FORWARD
                    console.log('🔄 [AuthGuard] Navegação back/forward detectada');
                    verifySession();
                    return;
                  }
                }
                
                // Também verificar após um pequeno delay para garantir que não é BFCache
                setTimeout(() => {
                  verifySession();
                }, 100);
              }
              
              // CRITICAL: Verificar quando página é restaurada do bfcache
              function handlePageShow(event) {
                if (event.persisted) {
                  console.log('🔄 [AuthGuard] BFCache detectado (event.persisted=true)');
                  hasVerifiedOnLoad = false; // Reset para permitir nova verificação
                  // Verificar IMEDIATAMENTE
                  verifySession();
                }
              }
              
              // CRITICAL: Verificar no popstate (botão voltar/avançar)
              function handlePopState(event) {
                console.log('🔄 [AuthGuard] popstate detectado');
                hasVerifiedOnLoad = false;
                verifySession();
              }
              
              // CRITICAL: Registrar listeners na CAPTURE PHASE (antes de qualquer outro listener)
              // Isso garante que executamos ANTES do React
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', checkOnLoad, true);
              } else {
                // Já carregou, verificar imediatamente
                checkOnLoad();
              }
              
              window.addEventListener('pageshow', handlePageShow, true);
              window.addEventListener('popstate', handlePopState, true);
              
              // Verificar quando janela recebe foco (usuário voltou de outra aba)
              window.addEventListener('focus', function() {
                if (document.visibilityState === 'visible') {
                  console.log('🔄 [AuthGuard] Janela recebeu foco');
                  verifySession();
                }
              }, true);
            })();
          `,
        }}
      />
    </>
  )
}

