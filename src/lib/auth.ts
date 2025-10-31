import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/db/users'
import { Plan } from '@prisma/client'
import { getSubscriptionInfo, isSubscriptionActive } from '@/lib/subscription'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            select: {
              id: true,
              email: true,
              name: true,
              password: true,
              role: true,
              plan: true,
              creditsUsed: true,
              creditsLimit: true,
              creditsBalance: true,
              subscriptionStatus: true,
              subscriptionId: true,
              asaasCustomerId: true
            }
          })

          if (!user || !user.password) {
            return null
          }

          const isValid = await verifyPassword(credentials.password, user.password)
          if (!isValid) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name || undefined,
            role: (user as any).role || 'user',
            plan: user.plan,
            creditsUsed: user.creditsUsed,
            creditsLimit: user.creditsLimit,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionId: user.subscriptionId,
            asaasCustomerId: user.asaasCustomerId
          }
        } catch (error) {
          console.error('Database connection error during authentication:', error)
          return null
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    })
  ],
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        // @ts-ignore
        token.role = ((user as any).role || 'user').toUpperCase()
        token.plan = user.plan || 'STARTER'
        token.creditsUsed = user.creditsUsed || 0
        token.creditsLimit = user.creditsLimit || 100
        // Load Asaas billing fields from user
        // @ts-ignore dynamic fields on token
        token.asaasCustomerId = (user as any).asaasCustomerId || null
        // @ts-ignore
        token.subscriptionId = (user as any).subscriptionId || null
        // @ts-ignore
        token.subscriptionStatus = (user as any).subscriptionStatus || (account?.provider !== 'credentials' ? null : undefined)
        // @ts-ignore - Load subscription state from user
        token.hasActiveSubscription = (user as any).hasActiveSubscription || false
        // @ts-ignore - Load development mode from user
        token.isInDevelopmentMode = (user as any).isInDevelopmentMode || false

        // Debug log
        console.log('🔐 JWT Callback - User Login:', {
          plan: token.plan,
          subscriptionStatus: token.subscriptionStatus,
          subscriptionId: token.subscriptionId,
          provider: account?.provider
        })
      }

      // Handle session updates - refetch user data from database
      if (trigger === 'update') {
        try {
          const userId = token.sub
          if (userId) {
            const updatedUser = await prisma.user.findUnique({
              where: { id: userId },
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                plan: true,
                creditsUsed: true,
                creditsLimit: true,
                creditsBalance: true,
                asaasCustomerId: true,
                subscriptionId: true,
                subscriptionStatus: true
              }
            })

            if (updatedUser) {
              token.name = updatedUser.name
              // @ts-ignore
              token.role = (updatedUser.role || 'user').toUpperCase()
              token.plan = updatedUser.plan
              token.creditsUsed = updatedUser.creditsUsed
              token.creditsLimit = updatedUser.creditsLimit
              // @ts-ignore
              token.asaasCustomerId = updatedUser.asaasCustomerId || null
              // @ts-ignore
              token.subscriptionId = updatedUser.subscriptionId || null
              // @ts-ignore
              token.subscriptionStatus = updatedUser.subscriptionStatus || null
            }
          }
        } catch (error) {
          console.error('Error updating session from database:', error)
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string
        // @ts-ignore
        session.user.role = ((token as any).role || 'USER') as any
        session.user.plan = token.plan as Plan
        session.user.creditsUsed = token.creditsUsed as number
        session.user.creditsLimit = token.creditsLimit as number
        // @ts-ignore surfaced billing fields from Asaas
        session.user.asaasCustomerId = (token as any).asaasCustomerId || null
        // @ts-ignore
        session.user.subscriptionId = (token as any).subscriptionId || null
        // @ts-ignore
        session.user.subscriptionStatus = (token as any).subscriptionStatus || null
        // @ts-ignore enhanced subscription fields
        session.user.hasActiveSubscription = (token as any).hasActiveSubscription || false
        // @ts-ignore
        session.user.isInDevelopmentMode = (token as any).isInDevelopmentMode || false

        // Debug log
        console.log('📋 Session Callback:', {
          role: (session.user as any).role,
          plan: session.user.plan,
          subscriptionStatus: session.user.subscriptionStatus,
          hasActiveSubscription: session.user.hasActiveSubscription
        })
      }
      return session
    },
    async signIn({ user, account, profile }) {
      // Ensure OAuth accounts link to existing users by email (no duplicates)
      try {
        if (account && account.provider !== 'credentials') {
          const email = user.email || (profile as any)?.email
          if (!email) return true

          const existing = await prisma.user.findUnique({ 
            where: { email },
            select: { id: true, subscriptionStatus: true }
          })
          if (existing) {
            // Force token to use existing user id
            ;(user as any).id = existing.id
            // Store subscriptionStatus for redirect logic
            ;(user as any).subscriptionStatus = existing.subscriptionStatus

            // Ensure Account row exists/links to same user
            const hasAccount = await prisma.account.findFirst({
              where: { provider: account.provider, providerAccountId: account.providerAccountId }
            })
            if (!hasAccount) {
              await prisma.account.create({
                data: {
                  userId: existing.id,
                  provider: account.provider,
                  type: account.type,
                  providerAccountId: account.providerAccountId,
                  access_token: (account as any).access_token || null,
                  token_type: (account as any).token_type || null,
                  expires_at: (account as any).expires_at || null,
                  id_token: (account as any).id_token || null,
                  refresh_token: (account as any).refresh_token || null,
                  scope: (account as any).scope || null,
                }
              })
            }
          } else {
            // New user created via OAuth - subscriptionStatus will be null
            ;(user as any).subscriptionStatus = null
          }
        }
      } catch (e) {
        console.error('signIn linking error:', e)
      }
      return true
    },
    async redirect({ url, baseUrl }) {
      // Custom redirect logic for OAuth only
      // Credentials provider uses redirect: false and handles redirect client-side
      // OAuth providers go through this callback after authentication
      
      // If already going to callback, allow it
      if (url.includes('/auth/callback')) {
        if (url.startsWith('/')) return `${baseUrl}${url}`
        return url
      }
      
      // For OAuth, redirect to callback which checks subscriptionStatus
      // Extract callbackUrl from url if present
      try {
        const urlObj = new URL(url, baseUrl)
        const callbackUrl = urlObj.searchParams.get('callbackUrl') || urlObj.pathname || '/'
        return `${baseUrl}/auth/callback?callbackUrl=${encodeURIComponent(callbackUrl)}`
      } catch {
        // Fallback: if url parsing fails, redirect to callback with home
        return `${baseUrl}/auth/callback?callbackUrl=${encodeURIComponent('/')}`
      }
    }
  },
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/auth/signin'
  }
}

export async function getSession() {
  return await getServerSession(authOptions)
}

export async function getCurrentUser() {
  const session = await getSession()
  return session?.user
}

export async function requireAuth() {
  const session = await getSession()
  
  if (!session || !session.user?.id) {
    redirect('/auth/signin')
  }
  
  return session
}

// Separate function for API routes that returns JSON error instead of redirect
export async function requireAuthAPI() {
  const session = await getSession()
  
  if (!session || !session.user?.id) {
    throw new Error('Unauthorized')
  }
  
  return session
}

export async function requirePlan(requiredPlan: 'PREMIUM' | 'GOLD') {
  const session = await requireAuth()
  
  const planHierarchy = {
    'STARTER': 0,
    'PREMIUM': 1,
    'GOLD': 2
  }
  
  const userPlanLevel = planHierarchy[session.user.plan]
  const requiredPlanLevel = planHierarchy[requiredPlan]
  
  if (userPlanLevel < requiredPlanLevel) {
    redirect('/billing/upgrade')
  }
  
  return session
}