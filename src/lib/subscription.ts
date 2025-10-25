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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        subscriptionId: true,
        subscriptionStatus: true
      }
    })

    if (!user) {
      return {
        hasActiveSubscription: false,
        subscriptionStatus: null,
        subscriptionId: null,
        plan: 'STARTER',
        isInDevelopmentMode: isDevelopmentMode()
      }
    }

  // Development mode: simulate active subscription
  if (isDevelopmentMode()) {
    return {
      hasActiveSubscription: true,
      subscriptionStatus: 'active',
      subscriptionId: user.subscriptionId,
      plan: user.plan,
      isInDevelopmentMode: true
    }
  }

    // Production: ONLY check subscriptionStatus field
    // ALL plans (STARTER, PREMIUM, GOLD) are PAID
    // Access is controlled ONLY by subscriptionStatus === 'ACTIVE'
    const hasActiveSubscription = user.subscriptionStatus === 'ACTIVE'

    return {
      hasActiveSubscription,
      subscriptionStatus: user.subscriptionStatus === 'ACTIVE' ? 'active' : 'inactive',
      subscriptionId: user.subscriptionId,
      plan: user.plan || 'STARTER', // Default to STARTER for display purposes if null
      isInDevelopmentMode: false
    }
  } catch (error) {
    console.error('Error fetching subscription info:', error)
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
 */
export async function validateSubscriptionForAPI(userId: string): Promise<boolean> {
  const subscriptionInfo = await getSubscriptionInfo(userId)
  return subscriptionInfo.hasActiveSubscription
}

/**
 * Development helper: Force simulate active subscription
 */
export function simulateActiveSubscription(): boolean {
  return isDevelopmentMode()
}