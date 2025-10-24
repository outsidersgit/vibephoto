import { Plan } from '@prisma/client'
import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string
      image?: string
      plan: Plan
      creditsUsed: number
      creditsLimit: number
      // Billing (Asaas)
      asaasCustomerId?: string | null
      subscriptionId?: string | null
      subscriptionStatus?: string | null
      // Enhanced subscription fields
      hasActiveSubscription: boolean
      isInDevelopmentMode: boolean
    }
  }

  interface User {
    id: string
    email: string
    name?: string
    image?: string
    plan: Plan
    creditsUsed: number
    creditsLimit: number
    // Persisted billing fields in DB
    asaasCustomerId?: string | null
    subscriptionId?: string | null
    subscriptionStatus?: string | null
    // Enhanced subscription fields
    hasActiveSubscription?: boolean
    isInDevelopmentMode?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    plan: Plan
    creditsUsed: number
    creditsLimit: number
    asaasCustomerId?: string | null
    subscriptionId?: string | null
    subscriptionStatus?: string | null
    // Enhanced subscription fields
    hasActiveSubscription?: boolean
    isInDevelopmentMode?: boolean
  }
}