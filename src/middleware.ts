import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Simple middleware for basic auth checks
// Rate limiting moved to API routes to avoid Edge Runtime issues with Prisma
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for static files, API auth routes, and public pages
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
    const protectedPaths = ['/dashboard', '/models', '/generate', '/billing', '/gallery', '/account', '/profile', '/pricing']
    const protectedApiPaths = ['/api/generations', '/api/models', '/api/gallery', '/api/media', '/api/upscale', '/api/video']
    
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

    // Check subscription status - ALL plans are PAID, access controlled by subscriptionStatus only
    if (token && (isProtectedPath || isProtectedApiPath)) {
      const subscriptionStatus = (token as any).subscriptionStatus as string | null

      // Allow access to billing and pricing pages for plan management
      if (pathname.startsWith('/billing') || pathname.startsWith('/pricing')) {
        return NextResponse.next()
      }

      // CRITICAL: Block ALL users without ACTIVE subscription status
      // This includes: null (no subscription), OVERDUE, CANCELLED, EXPIRED, etc.
      if (subscriptionStatus !== 'ACTIVE') {
        const errorMessage = subscriptionStatus === 'OVERDUE'
          ? 'Your subscription payment is overdue. Please update your payment method.'
          : subscriptionStatus === 'CANCELLED'
          ? 'Your subscription has been cancelled. Please subscribe to a plan to continue.'
          : subscriptionStatus === 'EXPIRED'
          ? 'Your subscription has expired. Please renew your plan to continue.'
          : 'You need an active subscription to access this feature. Please subscribe to a plan.'

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
    // This ensures the browser doesn't serve cached content when user presses "back" button
    if (isProtectedPath && !isApiRoute) {
      // CRITICAL: Headers para prevenir BFCache e cache do navegador
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, private')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
      response.headers.set('Surrogate-Control', 'no-store')
      // Prevent page from being stored in bfcache (Next.js 15 recommendation)
      response.headers.set('X-Accel-Buffering', 'no')
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