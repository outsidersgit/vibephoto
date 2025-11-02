'use client'

import Script from 'next/script'

/**
 * Componente compartilhado para proteger todas as rotas protegidas
 * Previne erros React #300/#310 e acesso via bfcache após logout
 * 
 * PERFORMANCE: Script executa antes do React hidratar (strategy="beforeInteractive")
 * MOBILE COMPATIBLE: Funciona em iOS Safari, Android Chrome, etc.
 * 
 * CRITICAL: Só atua em casos de bfcache (página restaurada após logout)
 * Não interfere com navegação normal ou hidratação do React
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
            
            // CRITICAL: Só atuar em rotas protegidas
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
            
            // CRITICAL: REDUZIDO - Só verificar e redirecionar em casos de bfcache (página restaurada)
            // NÃO verificar no carregamento normal da página
            // A página server-side já verificou autenticação via middleware
            
            function checkAndRedirect() {
              if (!hasNextAuthSession()) {
                console.log('🚫 [AuthRedirectScript] Sem sessão detectada - redirecionando para login');
                const redirectUrl = '/auth/signin?callbackUrl=' + encodeURIComponent(currentPath);
                try {
                  window.location.replace(redirectUrl);
                } catch (e) {
                  window.location.href = redirectUrl;
                }
                return true;
              }
              return false;
            }
            
            // CRITICAL: SÓ verificar quando página é restaurada do bfcache (botão voltar)
            // MOBILE COMPATIBLE: pageshow funciona em iOS Safari e Android Chrome
            window.addEventListener('pageshow', function(event) {
              if (event.persisted) {
                console.log('🔄 [AuthRedirectScript] Página restaurada do bfcache - verificando sessão...');
                // Verificar imediatamente para bfcache
                checkAndRedirect();
              }
            }, true); // CRITICAL: capture phase para executar ANTES de React
            
            // CRITICAL: NÃO verificar no DOMContentLoaded ou load
            // NÃO verificar popstate para navegação normal
            // A página server-side já verificou autenticação
          })();
        `,
      }}
    />
  )
}

