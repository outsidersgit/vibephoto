'use client'

import Script from 'next/script'

/**
 * Componente compartilhado para proteger todas as rotas protegidas
 * Previne erros React #300/#310 e acesso via bfcache após logout
 * 
 * PERFORMANCE: Script executa antes do React hidratar (strategy="beforeInteractive")
 * MOBILE COMPATIBLE: Funciona em iOS Safari, Android Chrome, etc.
 * 
 * CRITICAL: Verifica autenticação via API quando página é restaurada do BFCache
 * Isso garante que mesmo que cookies existam, a sessão seja validada no servidor
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
            const protectedPaths = ['/dashboard', '/models', '/generate', '/billing', '/gallery', '/editor', '/profile', '/account', '/credits', '/packages', '/pricing', '/support'];
            const currentPath = window.location.pathname;
            const isProtected = protectedPaths.some(path => currentPath.startsWith(path));
            
            // CRITICAL: Só atuar em rotas protegidas
            if (!isProtected) return;
            
            let isRedirecting = false;
            
            function redirectToLogin() {
              if (isRedirecting) return;
              isRedirecting = true;
              console.log('🚫 [AuthRedirectScript] Redirecionando para login...');
              const redirectUrl = '/auth/signin?callbackUrl=' + encodeURIComponent(currentPath);
              // CRITICAL: Usar replace para não adicionar ao histórico
              window.location.replace(redirectUrl);
            }
            
            // CRITICAL: Verificação ROBUSTA via API do NextAuth
            async function verifySession() {
              try {
                // Fazer requisição HEAD para /api/auth/session (mais leve que GET)
                // Se não autenticado, retorna 401 ou redireciona
                const response = await fetch('/api/auth/session', {
                  method: 'GET',
                  credentials: 'include',
                  cache: 'no-store',
                  headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                  }
                });
                
                if (!response.ok || response.status === 401 || response.status === 403) {
                  console.log('🚫 [AuthRedirectScript] Sessão inválida detectada via API');
                  redirectToLogin();
                  return false;
                }
                
                const data = await response.json().catch(() => ({}));
                if (!data || !data.user || !data.user.id) {
                  console.log('🚫 [AuthRedirectScript] Sessão sem usuário válido');
                  redirectToLogin();
                  return false;
                }
                
                console.log('✅ [AuthRedirectScript] Sessão válida confirmada');
                return true;
              } catch (error) {
                console.error('❌ [AuthRedirectScript] Erro ao verificar sessão:', error);
                // Em caso de erro, redirecionar por segurança
                redirectToLogin();
                return false;
              }
            }
            
            // CRITICAL: Verificar quando página é restaurada do bfcache (botão voltar)
            function handlePageShow(event) {
              if (event.persisted) {
                console.log('🔄 [AuthRedirectScript] Página restaurada do bfcache - verificando sessão via API...');
                // CRITICAL: Verificar imediatamente via API (não confiar apenas em cookies)
                verifySession();
              }
            }
            
            // CRITICAL: Verificar também no popstate (navegação back/forward)
            function handlePopState(event) {
              console.log('🔄 [AuthRedirectScript] popstate detectado - verificando sessão...');
              verifySession();
            }
            
            // CRITICAL: Registrar listeners na capture phase (antes de React)
            window.addEventListener('pageshow', handlePageShow, true);
            window.addEventListener('popstate', handlePopState, true);
            
            // CRITICAL: Também verificar no focus da janela (usuário voltou de outra aba)
            window.addEventListener('focus', function() {
              if (document.visibilityState === 'visible') {
                console.log('🔄 [AuthRedirectScript] Janela recebeu foco - verificando sessão...');
                verifySession();
              }
            }, true);
          })();
        `,
      }}
    />
  )
}

