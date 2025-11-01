import { requireAuth } from '@/lib/auth'
import { getGenerationsByUserId, searchGenerations } from '@/lib/db/generations'
import { getModelsByUserId } from '@/lib/db/models'
import { getVideoGenerationsByUserId, getVideoGenerationStats } from '@/lib/db/videos'
import { AutoSyncGalleryInterface } from '@/components/gallery/auto-sync-gallery-interface'
import { prisma } from '@/lib/db'
import Script from 'next/script'

interface GalleryPageProps {
  searchParams: Promise<{
    model?: string
    generation?: string
    search?: string
    page?: string
    limit?: string
    sort?: string
    view?: string
    tab?: string
    status?: string
    quality?: string
  }>
}

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const session = await requireAuth()
  const userId = session.user.id

  const params = await searchParams
  const page = parseInt(params.page || '1')
  const limit = parseInt(params.limit || '20')
  const modelFilter = params.model
  const searchQuery = params.search
  const sortBy = params.sort || 'newest'
  const viewMode = params.view || 'grid'
  const activeTab = params.tab || 'generated'
  const videoStatus = params.status
  const videoQuality = params.quality

  // Otimização: Buscar modelos e gerações em paralelo para reduzir latência (Fase 2 - Performance)
  let models = []
  let generationsData = { generations: [], totalCount: 0 }
  
  try {
    // Executar todas as queries em paralelo com Promise.all
    const skip = (page - 1) * limit
    
    if (activeTab === 'packages') {
      const where = {
        userId,
        status: 'COMPLETED' as any,
        packageId: { not: null },
        ...(modelFilter && { modelId: modelFilter }),
        ...(searchQuery && {
          OR: [
            { prompt: { contains: searchQuery, mode: 'insensitive' as any } },
            { model: { name: { contains: searchQuery, mode: 'insensitive' as any } } }
          ]
        })
      }

      // Query paralela: models + generations + count
      const [modelsResult, generations, total] = await Promise.all([
        getModelsByUserId(userId),
        prisma.generation.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            model: {
              select: { id: true, name: true, class: true }
            },
            userPackage: {
              include: {
                package: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        }),
        prisma.generation.count({ where })
      ])

      models = modelsResult
      generationsData = { generations, totalCount: total }
      
    } else if (searchQuery) {
      // Query paralela: models + search
      const [modelsResult, searchResult] = await Promise.all([
        getModelsByUserId(userId),
        searchGenerations(userId, searchQuery, page, limit)
      ])
      
      models = modelsResult
      generationsData = searchResult
      
    } else {
      const where = {
        userId,
        status: 'COMPLETED' as any,
        packageId: null,
        ...(modelFilter && { modelId: modelFilter })
      }

      // Query paralela: models + generations + count
      const [modelsResult, generations, total] = await Promise.all([
        getModelsByUserId(userId),
        prisma.generation.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { 
            model: {
              select: { id: true, name: true, class: true }
            }
          }
        }),
        prisma.generation.count({ where })
      ])

      models = modelsResult
      generationsData = { generations, totalCount: total }
    }
  } catch (error) {
    console.error('Database error:', error)
    models = []
    generationsData = { generations: [], totalCount: 0 }
  }

  // Get video data if on videos tab
  let videosData = { videos: [], totalCount: 0 }
  let videoStats = null
  
  if (activeTab === 'videos') {
    try {
      if (searchQuery) {
        // Search videos by prompt
        const { searchVideoGenerations } = await import('@/lib/db/videos')
        videosData = await searchVideoGenerations(userId, searchQuery, page, limit)
      } else {
        // Get videos with status and quality filters
        videosData = await getVideoGenerationsByUserId(
          userId, 
          page, 
          limit, 
          videoStatus as any,
          videoQuality as any
        )
      }
      
      // Get video stats
      videoStats = await getVideoGenerationStats(userId)
    } catch (error) {
      console.error('Database error fetching videos:', error)
      videosData = { videos: [], totalCount: 0 }
      videoStats = {
        totalVideos: 0,
        completedVideos: 0,
        processingVideos: 0,
        failedVideos: 0,
        totalCreditsUsed: 0,
      }
    }
  }

  // Otimização: Usar query agregada única ao invés de múltiplas counts (Fase 2 - Performance)
  let totalCount = 0
  let completedCount = 0

  try {
    // Uma única query agregada com groupBy por status
    const packageCondition = activeTab === 'packages' 
      ? { packageId: { not: null } } 
      : { packageId: null }
    
    const statsAgg = await prisma.generation.groupBy({
      by: ['status'],
      where: { userId, ...packageCondition },
      _count: { status: true }
    })
    
    totalCount = statsAgg.reduce((sum, stat) => sum + stat._count.status, 0)
    completedCount = statsAgg.find(s => s.status === 'COMPLETED')?._count.status || 0
  } catch (error) {
    console.error('Database error in gallery stats:', error)
    // Use fallback stats from generationsData
    totalCount = generationsData?.generations?.length || 0
    completedCount = generationsData?.generations?.filter(g => g.status === 'COMPLETED').length || 0
  }
  
  const stats = {
    totalGenerations: totalCount,
    completedGenerations: completedCount,
    totalImages: completedCount, // Simplified - assume 1 image per generation
    favoriteImages: 0, // This would come from a favorites table
    collections: 0 // This would come from collections
  }

  return (
    <>
      {/* CRITICAL: Script inline que verifica autenticação ANTES do React hidratar */}
      {/* Isso previne erros quando a página é restaurada do bfcache */}
      <Script
        id="auth-redirect-script"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              const protectedPaths = ['/dashboard', '/models', '/generate', '/billing', '/gallery', '/editor', '/profile', '/settings', '/credits', '/packages'];
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
              
              // CRITICAL: Verificar IMEDIATAMENTE ao carregar
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
              
              // Verificar imediatamente
              if (checkAndRedirect()) return;
              
              // CRITICAL: Verificar também quando página é restaurada do bfcache (botão voltar)
              window.addEventListener('pageshow', function(event) {
                if (event.persisted) {
                  console.log('🔄 [AuthRedirectScript] Página restaurada do bfcache - verificando sessão IMEDIATAMENTE...');
                  // Verificar imediatamente, sem delay
                  if (checkAndRedirect()) return;
                  
                  // Verificar novamente após pequeno delay (caso cookies não estejam prontos ainda)
                  setTimeout(function() {
                    if (checkAndRedirect()) return;
                  }, 50);
                }
              }, true); // Use capture phase para executar antes de outros listeners
              
              // CRITICAL: Verificar também no evento popstate (botão voltar/avançar)
              window.addEventListener('popstate', function(event) {
                console.log('🔄 [AuthRedirectScript] popstate detectado - verificando sessão...');
                setTimeout(function() {
                  checkAndRedirect();
                }, 50);
              }, true);
              
              // CRITICAL: Verificar antes de React hidratar (se possível)
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                  checkAndRedirect();
                });
              } else {
                // DOM já carregou, verificar agora
                checkAndRedirect();
              }
            })();
          `,
        }}
      />
      
      <div className="min-h-screen bg-gray-50" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
        {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-8">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 tracking-tight" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                Galeria
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              <a
                href="/generate"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] border-[#667EEA] shadow-lg shadow-[#667EEA]/25 transition-all duration-200"
                style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
              >
                Gerar Nova Foto
              </a>
              <a
                href="/generate?tab=video"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-[#764BA2] to-[#667EEA] hover:from-[#6a4190] hover:to-[#5a6bd8] border-[#764BA2] shadow-lg shadow-[#764BA2]/25 transition-all duration-200"
                style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
              >
                Gerar Novo Vídeo
              </a>
              <a
                href="/editor"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] border-[#667EEA] shadow-lg shadow-[#667EEA]/25 transition-all duration-200"
                style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
              >
                Editor IA
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <AutoSyncGalleryInterface
          initialGenerations={generationsData.generations}
          initialVideos={videosData.videos}
          pagination={{
            page,
            limit,
            total: generationsData.totalCount,
            pages: Math.ceil(generationsData.totalCount / limit)
          }}
          videoPagination={{
            page,
            limit,
            total: videosData.totalCount,
            pages: Math.ceil(videosData.totalCount / limit)
          }}
          models={models}
          stats={stats}
          videoStats={videoStats}
          filters={{
            model: modelFilter,
            search: searchQuery,
            sort: sortBy,
            view: viewMode,
            page,
            tab: activeTab
          }}
          user={session.user}
        />
      </div>
    </div>
    </>
  )
}