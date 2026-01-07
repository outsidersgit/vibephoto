import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Subscription status validation utilities
 */

export type SubscriptionStatus = 'active' | 'inactive' | 'canceled' | 'pending' | null

export interface SubscriptionInfo {
  hasActiveSubscription: boolean
  subscriptionStatus: SubscriptionStatus
  subscriptionId: string | null
  plan: string
  isInDevelopmentMode: boolean
}

/**
 * Check if development mode is enabled for subscription simulation
 */
export function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV === 'development' && 
         process.env.DEV_SIMULATE_PAID_SUBSCRIPTION === 'true'
}

/**
 * Validate if a subscription status is considered active
 */
export function isSubscriptionActive(status: string | null): boolean {
  if (isDevelopmentMode()) {
    return true // Simulate active subscription in development
  }
  
  return status === 'active'
}

/**
 * Get comprehensive subscription information for a user
 */
export async function getSubscriptionInfo(userId: string): Promise<SubscriptionInfo> {
  try {
    console.log('[Subscription] Fetching subscription info for user:', userId)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        subscriptionId: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true
      }
    })

    if (!user) {
      console.warn('[Subscription] User not found:', userId)
      return {
        hasActiveSubscription: false,
        subscriptionStatus: null,
        subscriptionId: null,
        plan: 'STARTER',
        isInDevelopmentMode: isDevelopmentMode()
      }
    }

    console.log('[Subscription] User data:', {
      userId,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      hasSubscriptionId: !!user.subscriptionId
    })

  // Development mode: simulate active subscription
  if (isDevelopmentMode()) {
    console.log('[Subscription] Development mode: simulating active subscription')
    return {
      hasActiveSubscription: true,
      subscriptionStatus: 'active',
      subscriptionId: user.subscriptionId,
      plan: user.plan,
      isInDevelopmentMode: true
    }
  }

    // Production: Check subscriptionStatus AND subscriptionEndsAt
    // ALL plans (STARTER, PREMIUM, GOLD) are PAID
    // Access is controlled by subscriptionStatus === 'ACTIVE' OR (CANCELLED + subscriptionEndsAt in future)
    // SPECIAL CASE: Influencers/users with credits but no subscription (manual access)
    let hasActiveSubscription = false

    if (user.subscriptionStatus === 'ACTIVE') {
      hasActiveSubscription = true
    } else if (user.subscriptionStatus === 'CANCELLED' && user.subscriptionEndsAt) {
      // Verificar se subscriptionEndsAt está no futuro
      const endsAtDate = user.subscriptionEndsAt instanceof Date
        ? user.subscriptionEndsAt
        : new Date(user.subscriptionEndsAt)
      const now = new Date()

      if (endsAtDate > now) {
        // Usuário cancelou mas ainda tem acesso até subscriptionEndsAt
        hasActiveSubscription = true
        console.log('[Subscription] User with CANCELLED subscription has access until:', endsAtDate.toISOString())
      } else {
        // Data de término já passou
        hasActiveSubscription = false
        console.log('[Subscription] User with CANCELLED subscription - access expired:', endsAtDate.toISOString())
      }
    } else if (user.plan && user.plan !== 'STARTER') {
      // SPECIAL CASE: User has a premium plan assigned (PREMIUM/GOLD) but no subscription
      // This can happen for influencers, manual access, or promotional access
      // Grant access based on plan assignment alone
      hasActiveSubscription = true
      console.log('[Subscription] User with premium plan but no active subscription - granting access:', user.plan)
    } else {
      // OVERDUE, EXPIRED, null, etc. - sem acesso
      hasActiveSubscription = false
    }

    console.log('[Subscription] Subscription check result:', {
      userId,
      hasActiveSubscription,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionEndsAt: user.subscriptionEndsAt
    })

    return {
      hasActiveSubscription,
      subscriptionStatus: hasActiveSubscription ? 'active' : 'inactive',
      subscriptionId: user.subscriptionId,
      plan: user.plan || 'STARTER', // Default to STARTER for display purposes if null
      isInDevelopmentMode: false
    }
  } catch (error) {
    console.error('[Subscription] Error fetching subscription info:', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    // Return safe default on database error
    return {
      hasActiveSubscription: false,
      subscriptionStatus: null,
      subscriptionId: null,
      plan: 'STARTER',
      isInDevelopmentMode: isDevelopmentMode()
    }
  }
}

/**
 * Enhanced session validation that checks both authentication and subscription status
 */
export async function requireActiveSubscription() {
  const session = await getServerSession(authOptions)
  
  if (!session || !session.user?.id) {
    redirect('/auth/signin')
  }

  const subscriptionInfo = await getSubscriptionInfo(session.user.id)

  if (!subscriptionInfo.hasActiveSubscription) {
    // In development mode, log but don't redirect
    if (isDevelopmentMode()) {
      console.log('🔧 Development Mode: Simulating active subscription for user', session.user.id)
      return {
        ...session,
        subscriptionInfo
      }
    }
    
    // Production: redirect to plan selection
    redirect('/pricing?required=true')
  }

  return {
    ...session,
    subscriptionInfo
  }
}

/**
 * Check subscription status without redirecting (for conditional rendering)
 */
export async function checkSubscriptionStatus() {
  const session = await getServerSession(authOptions)
  
  if (!session || !session.user?.id) {
    return {
      isAuthenticated: false,
      hasActiveSubscription: false,
      subscriptionInfo: null
    }
  }

  const subscriptionInfo = await getSubscriptionInfo(session.user.id)

  return {
    isAuthenticated: true,
    hasActiveSubscription: subscriptionInfo.hasActiveSubscription,
    subscriptionInfo
  }
}

/**
 * Validate subscription status for API routes
 * CRITICAL: Considera subscriptionEndsAt para assinaturas canceladas
 */
export async function validateSubscriptionForAPI(userId: string): Promise<boolean> {
  const subscriptionInfo = await getSubscriptionInfo(userId)
  // getSubscriptionInfo já verifica subscriptionEndsAt para CANCELLED
  return subscriptionInfo.hasActiveSubscription
}

/**
 * Development helper: Force simulate active subscription
 */
export function simulateActiveSubscription(): boolean {
  return isDevelopmentMode()
}