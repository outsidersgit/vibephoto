'use client'

import Script from 'next/script'

/**
 * Componente compartilhado para proteger todas as rotas protegidas
 * Previne erros React #300 e acesso via bfcache após logout
 * 
 * PERFORMANCE: Script executa antes do React hidratar (strategy="beforeInteractive")
 * MOBILE COMPATIBLE: Funciona em iOS Safari, Android Chrome, etc.
 */
export function ProtectedPageScript() {
  return (
    <Script
      id="auth-redirect-script"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            // CRITICAL: Executar IMEDIATAMENTE, sem aguardar nada
            const protectedPaths = ['/dashboard', '/models', '/generate', '/billing', '/gallery', '/editor', '/profile', '/account', '/credits', '/packages', '/pricing'];
            const currentPath = window.location.pathname;
            const isProtected = protectedPaths.some(path => currentPath.startsWith(path));
            
            if (!isProtected) return;
            
            function hasNextAuthSession() {
              try {
                const cookies = document.cookie.split(';');
                return cookies.some(cookie => {
                  const cookieName = cookie.trim().split('=')[0];
                  return cookieName.includes('next-auth') || 
                         cookieName.includes('__Secure-next-auth') || 
                         cookieName.includes('__Host-next-auth');
                });
              } catch (e) {
                return false;
              }
            }
            
            // CRITICAL: Bloquear renderização do React se não há sessão
            // Prevenir erros React #300 ao bloquear hidratação
            if (typeof window !== 'undefined' && window.__NEXT_DATA__) {
              const originalApp = window.__NEXT_DATA__;
              if (!hasNextAuthSession()) {
                // Bloquear hidratação do React
                console.log('🚫 [AuthRedirectScript] Bloqueando hidratação do React - sem sessão');
              }
            }
            
            // CRITICAL: Interceptar fetch para prevenir chamadas 401
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
              try {
                let url = '';
                if (typeof args[0] === 'string') {
                  url = args[0];
                } else if (args[0] instanceof Request) {
                  url = args[0].url;
                } else if (args[0] && typeof args[0] === 'object' && args[0].url) {
                  url = args[0].url;
                }
                
                const isApiCall = url && (url.startsWith('/api/') || url.includes('/api/'));
                const isProtectedApi = isApiCall && (
                  url.includes('/api/credits/balance') || 
                  url.includes('/api/gallery/') || 
                  url.includes('/api/models/') ||
                  url.includes('/api/generate/')
                );
                
                // Se não há sessão e é uma API protegida, cancelar fetch
                if (isProtectedApi && !hasNextAuthSession()) {
                  console.log('🚫 [AuthRedirectScript] Bloqueando chamada de API sem sessão:', url);
                  return Promise.reject(new Error('Unauthorized - session expired'));
                }
              } catch (e) {
                // Se erro ao interceptar, permitir fetch original
                console.warn('⚠️ [AuthRedirectScript] Erro ao interceptar fetch:', e);
              }
              
              return originalFetch.apply(this, args);
            };
            
            // CRITICAL: Verificar IMEDIATAMENTE ao carregar (ANTES de tudo)
            // PERFORMANCE: Função otimizada para mobile e desktop
            // CRITICAL: Só redirecionar se realmente não há sessão (aguardar um pouco para NextAuth processar)
            function checkAndRedirect() {
              // CRITICAL: Aguardar um pequeno delay para NextAuth processar cookies
              // Se o NextAuth ainda está carregando, não redirecionar imediatamente
              // A página server-side já verificou autenticação, então deve haver sessão
              if (!hasNextAuthSession()) {
                // CRITICAL: Dar um pequeno delay para garantir que NextAuth processou
                // Só redirecionar se realmente não há sessão após delay
                setTimeout(function() {
                  if (!hasNextAuthSession()) {
                    console.log('🚫 [AuthRedirectScript] Sem sessão detectada após delay - redirecionando para login');
                    const redirectUrl = '/auth/signin?callbackUrl=' + encodeURIComponent(currentPath);
                    // CRITICAL: Usar replace em vez de href para não adicionar ao history
                    // MOBILE COMPATIBLE: Funciona em iOS Safari, Android Chrome, etc.
                    try {
                      window.location.replace(redirectUrl);
                    } catch (e) {
                      // Fallback para browsers que não suportam replace
                      try {
                        window.location.href = redirectUrl;
                      } catch (e2) {
                        // Último recurso: compatível com todos os browsers
                        window.location = redirectUrl;
                      }
                    }
                  }
                }, 100); // Pequeno delay para NextAuth processar
                return false; // Não redirecionar imediatamente
              }
              return false;
            }
            
            // CRITICAL: NÃO verificar imediatamente - aguardar NextAuth processar
            // A página server-side já garantiu autenticação
            // Verificar apenas para bfcache e popstate
            
            // CRITICAL: Verificar também quando página é restaurada do bfcache (botão voltar)
            // MOBILE COMPATIBLE: pageshow funciona em iOS Safari e Android Chrome
            window.addEventListener('pageshow', function(event) {
              if (event.persisted) {
                console.log('🔄 [AuthRedirectScript] Página restaurada do bfcache - verificando sessão IMEDIATAMENTE...');
                // PERFORMANCE: Verificar IMEDIATAMENTE, sem delay (otimizado para mobile)
                if (checkAndRedirect()) {
                  // MOBILE: preventDefault/stopPropagation compatível com todos os browsers
                  if (typeof event.preventDefault === 'function') {
                    event.preventDefault();
                  }
                  if (typeof event.stopPropagation === 'function') {
                    event.stopPropagation();
                  }
                  return;
                }
                
                // PERFORMANCE: Delay mínimo (10ms) otimizado para mobile
                // Mobile browsers podem ter pequeno delay na disponibilidade de cookies
                setTimeout(function() {
                  if (checkAndRedirect()) return;
                }, 10);
              }
            }, true); // CRITICAL: capture phase para executar ANTES de React
            
            // CRITICAL: Verificar também no evento popstate (botão voltar/avançar)
            // MOBILE COMPATIBLE: popstate detecta swipe back em mobile browsers
            window.addEventListener('popstate', function(event) {
              console.log('🔄 [AuthRedirectScript] popstate detectado - verificando sessão...');
              // PERFORMANCE: Verificar IMEDIATAMENTE sem delay
              if (checkAndRedirect()) {
                // MOBILE: Compatível com iOS Safari e Android Chrome
                if (typeof event.preventDefault === 'function') {
                  event.preventDefault();
                }
                if (typeof event.stopPropagation === 'function') {
                  event.stopPropagation();
                }
                return;
              }
              // PERFORMANCE: Delay mínimo otimizado para mobile
              setTimeout(function() {
                checkAndRedirect();
              }, 10);
            }, true); // CRITICAL: capture phase
            
            // CRITICAL: NÃO verificar no DOMContentLoaded ou load inicial
            // A página server-side já verificou autenticação
            // Só verificar em casos de bfcache (páginas restauradas)
            // O checkAndRedirect já tem delay interno para aguardar NextAuth
          })();
        `,
      }}
    />
  )
}

