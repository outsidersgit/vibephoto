import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Simple middleware for basic auth checks
// Rate limiting moved to API routes to avoid Edge Runtime issues with Prisma
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for static files, API auth routes, and public pages
  // CRITICAL: Permitir /api/auth/verify para verificação rápida de sessão
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico' ||
    pathname === '/' ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/legal')
  ) {
    return NextResponse.next()
  }

  try {
    // Get user session for protected routes
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })

    // Check if this is an API route
    const isApiRoute = pathname.startsWith('/api/')
    
    // Protect dashboard and other authenticated routes
    const protectedPaths = ['/dashboard', '/models', '/generate', '/billing', '/gallery', '/account', '/profile', '/pricing', '/admin']
    const protectedApiPaths = ['/api/generations', '/api/models', '/api/gallery', '/api/media', '/api/upscale', '/api/video', '/api/admin']
    
    const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))
    const isProtectedApiPath = protectedApiPaths.some(path => pathname.startsWith(path))

    if ((isProtectedPath || isProtectedApiPath) && !token) {
      if (isApiRoute) {
        // Return JSON error for API routes
        return NextResponse.json(
          { error: 'Authentication required', code: 'UNAUTHORIZED' },
          { status: 401 }
        )
      } else {
        // Redirect to signup for web routes (best practice: capture leads)
        // If accessing pricing specifically, redirect to signup to create account
        // Otherwise, redirect to signin
        if (pathname.startsWith('/pricing')) {
          const signUpUrl = new URL('/auth/signup', request.url)
          signUpUrl.searchParams.set('redirectTo', '/pricing')
          return NextResponse.redirect(signUpUrl)
        } else {
          const signInUrl = new URL('/auth/signin', request.url)
          signInUrl.searchParams.set('callbackUrl', request.url)
          return NextResponse.redirect(signInUrl)
        }
      }
    }

    // Check admin role for /admin routes
    if (token && pathname.startsWith('/admin')) {
      const role = String((token as any).role || '').toUpperCase()
      
      if (role !== 'ADMIN') {
        if (isApiRoute) {
          return NextResponse.json(
            { error: 'Admin access required', code: 'FORBIDDEN' },
            { status: 403 }
          )
        } else {
          const dashboardUrl = new URL('/dashboard', request.url)
          return NextResponse.redirect(dashboardUrl)
        }
      }
      
      // Admin routes don't need subscription check
      const response = NextResponse.next()
      response.headers.set('X-Frame-Options', 'DENY')
      response.headers.set('X-Content-Type-Options', 'nosniff')
      response.headers.set('Referrer-Policy', 'origin-when-cross-origin')
      
      // Prevent caching of admin pages
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, private')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
      response.headers.set('Surrogate-Control', 'no-store')
      response.headers.set('X-Accel-Buffering', 'no')
      response.headers.set('Vary', 'Accept-Encoding, Cookie, Authorization')
      response.headers.set('CDN-Cache-Control', 'no-store')
      
      return response
    }

    // Check subscription status - ALL plans are PAID, access controlled by subscriptionStatus only
    if (token && (isProtectedPath || isProtectedApiPath)) {
      const subscriptionStatus = (token as any).subscriptionStatus as string | null
      const subscriptionEndsAt = (token as any).subscriptionEndsAt as string | Date | null

      // Allow access to billing and pricing pages for plan management
      if (pathname.startsWith('/billing') || pathname.startsWith('/pricing')) {
        return NextResponse.next()
      }

      // CRITICAL: Verificar acesso baseado em subscriptionStatus e subscriptionEndsAt
      // Se status é CANCELLED mas subscriptionEndsAt está no futuro, permitir acesso
      let hasAccess = false
      
      if (subscriptionStatus === 'ACTIVE') {
        hasAccess = true
      } else if (subscriptionStatus === 'CANCELLED' && subscriptionEndsAt) {
        // Verificar se subscriptionEndsAt está no futuro
        const endsAtDate = subscriptionEndsAt instanceof Date 
          ? subscriptionEndsAt 
          : new Date(subscriptionEndsAt)
        const now = new Date()
        
        if (endsAtDate > now) {
          // Usuário cancelou mas ainda tem acesso até subscriptionEndsAt
          hasAccess = true
          console.log('✅ [MIDDLEWARE] User with CANCELLED subscription has access until:', endsAtDate.toISOString())
        } else {
          // Data de término já passou
          hasAccess = false
          console.log('❌ [MIDDLEWARE] User with CANCELLED subscription - access expired:', endsAtDate.toISOString())
        }
      } else {
        // OVERDUE, EXPIRED, null, etc. - sem acesso
        hasAccess = false
      }

      // Se não tem acesso, bloquear
      if (!hasAccess) {
        // Determinar mensagem de erro baseado no status e data
        let errorMessage = ''
        if (subscriptionStatus === 'OVERDUE') {
          errorMessage = 'Your subscription payment is overdue. Please update your payment method.'
        } else if (subscriptionStatus === 'CANCELLED') {
          // Se chegou aqui, subscriptionEndsAt já passou ou não existe
          if (subscriptionEndsAt) {
            const endsAtDate = subscriptionEndsAt instanceof Date 
              ? subscriptionEndsAt 
              : new Date(subscriptionEndsAt)
            errorMessage = `Your subscription was cancelled and access expired on ${endsAtDate.toLocaleDateString('pt-BR')}. Please subscribe to a plan to continue.`
          } else {
            errorMessage = 'Your subscription has been cancelled. Please subscribe to a plan to continue.'
          }
        } else if (subscriptionStatus === 'EXPIRED') {
          errorMessage = 'Your subscription has expired. Please renew your plan to continue.'
        } else {
          errorMessage = 'You need an active subscription to access this feature. Please subscribe to a plan.'
        }

        const errorCode = subscriptionStatus === 'OVERDUE' ? 'PAYMENT_OVERDUE' : 'SUBSCRIPTION_REQUIRED'
        const statusCode = subscriptionStatus === 'OVERDUE' ? 402 : 403

        if (isApiRoute || isProtectedApiPath) {
          return NextResponse.json(
            {
              error: errorMessage,
              code: errorCode,
              subscriptionStatus: subscriptionStatus || 'NONE',
              billingUrl: '/billing',
              pricingUrl: '/pricing'
            },
            { status: statusCode }
          )
        } else {
          // CRITICAL: Redirect logic fixed
          // For new users (subscriptionStatus === null) -> /pricing
          // For users with inactive subscriptions (OVERDUE, EXPIRED, CANCELLED) -> /billing
          const redirectUrl = subscriptionStatus === null ? '/pricing' : '/billing'
          const url = new URL(redirectUrl, request.url)

          if (subscriptionStatus === 'OVERDUE') {
            url.searchParams.set('overdue', 'true')
          } else if (subscriptionStatus === 'EXPIRED') {
            url.searchParams.set('expired', 'true')
          } else if (subscriptionStatus === 'CANCELLED') {
            url.searchParams.set('cancelled', 'true')
          } else if (subscriptionStatus === null) {
            url.searchParams.set('required', 'true')
          }

          return NextResponse.redirect(url)
        }
      }
    }

    // Add basic security headers and cache control
    const response = NextResponse.next()
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'origin-when-cross-origin')
    
    // CRITICAL: Prevent caching of protected pages to avoid bfcache issues after logout
    // Next.js 15 Best Practice: https://nextjs.org/docs/app/building-your-application/routing/middleware
    // Headers HTTP são a primeira linha de defesa contra BFCache
    if (isProtectedPath && !isApiRoute) {
      // CRITICAL: Headers completos para prevenir BFCache e cache do navegador
      // Baseado em: https://web.dev/articles/bfcache
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, private')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
      response.headers.set('Surrogate-Control', 'no-store')
      
      // Headers específicos para prevenir BFCache
      response.headers.set('X-Accel-Buffering', 'no')
      
      // Adicionar header para prevenir restauração de cache (Chrome/Safari)
      // Este header força o navegador a sempre fazer nova requisição
      response.headers.set('Vary', 'Accept-Encoding, Cookie, Authorization')
      
      // Prevenir cache em CDNs/proxies
      response.headers.set('CDN-Cache-Control', 'no-store')
    }
    
    return response
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

// Configure middleware matcher
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}