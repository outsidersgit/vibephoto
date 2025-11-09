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
import type { Adapter, AdapterUser } from 'next-auth/adapters'

// Custom adapter to map 'image' to 'avatar' field
const customAdapter: Adapter = {
  ...PrismaAdapter(prisma),
  async createUser(user: Omit<AdapterUser, 'id'>) {
    // Convert 'image' to 'avatar' for Prisma schema
    const { image, ...restUser } = user
    const userData: any = {
      ...restUser,
      ...(image && { avatar: image }),
      // Novos usuários OAuth também não têm plano, então creditsLimit = 0
      creditsLimit: 0,
      creditsUsed: 0,
      creditsBalance: 0
    }
    
    const createdUser = await prisma.user.create({
      data: userData
    })
    
    return {
      id: createdUser.id,
      email: createdUser.email,
      emailVerified: createdUser.emailVerified,
      name: createdUser.name,
      image: createdUser.avatar || null
    } as AdapterUser
  },
  async updateUser(user: Partial<AdapterUser> & { id: string }) {
    // Convert 'image' to 'avatar' for Prisma schema
    const { image, id, ...restUser } = user
    const updateData: any = {
      ...restUser,
      ...(image !== undefined && { avatar: image })
    }
    
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData
    })
    
    return {
      id: updatedUser.id,
      email: updatedUser.email,
      emailVerified: updatedUser.emailVerified,
      name: updatedUser.name,
      image: updatedUser.avatar || null
    } as AdapterUser
  }
}

export const authOptions: NextAuthOptions = {
  adapter: customAdapter,
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
        token.plan = user.plan // Pode ser null - não usar fallback
        token.creditsUsed = user.creditsUsed || 0
        token.creditsLimit = user.creditsLimit ?? 0 // Usar 0 se null/undefined, mas manter 0 se for 0
        // Load Asaas billing fields from user
        // @ts-ignore dynamic fields on token
        token.asaasCustomerId = (user as any).asaasCustomerId || null
        // @ts-ignore
        token.subscriptionId = (user as any).subscriptionId || null
        // @ts-ignore
        token.subscriptionStatus = (user as any).subscriptionStatus || (account?.provider !== 'credentials' ? null : undefined)
        // @ts-ignore - Load subscriptionEndsAt for CANCELLED subscriptions
        token.subscriptionEndsAt = (user as any).subscriptionEndsAt ? (user as any).subscriptionEndsAt.toISOString() : null
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
                subscriptionStatus: true,
                subscriptionEndsAt: true
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
              // @ts-ignore
              token.subscriptionEndsAt = updatedUser.subscriptionEndsAt ? updatedUser.subscriptionEndsAt.toISOString() : null
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
        // @ts-ignore
        session.user.subscriptionEndsAt = (token as any).subscriptionEndsAt || null
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
      if (account?.type === 'oauth' && account.provider && (profile as any)) {
        const profileData = profile as Record<string, any>
        const email = profileData.email || user.email
        if (!email) {
          console.warn(`⚠️ OAuth signin sem e-mail para provider ${account.provider}`)
          return false
        }

        const existingUser = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            emailVerified: true
          }
        })

        if (existingUser) {
          const emailVerified =
            profileData.email_verified === true ||
            profileData.emailVerified === true ||
            profileData.verified === true ||
            user.emailVerified instanceof Date ||
            !!existingUser.emailVerified ||
            account.provider === 'github' // GitHub only returns verified emails

          if (!emailVerified) {
            console.warn(`⚠️ OAuth email não verificado para ${email}, bloqueando vínculo automático.`)
            return '/auth/error?error=EmailNotVerified'
          }

          const providerAccountId = account.providerAccountId || account.providerAccountId?.toString() || ''

          await prisma.account.upsert({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId
              }
            },
            update: {
              type: account.type,
              refresh_token: account.refresh_token,
              access_token: account.access_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
              session_state: account.session_state,
              userId: existingUser.id
            },
            create: {
              userId: existingUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId,
              refresh_token: account.refresh_token,
              access_token: account.access_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
              session_state: account.session_state
            }
          })

          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              name: user.name ?? existingUser.name,
              avatar: profileData.picture || profileData.image || existingUser.avatar || null,
              emailVerified: existingUser.emailVerified ?? new Date()
            }
          })

          if (user.id && user.id !== existingUser.id) {
            await prisma.user.delete({ where: { id: user.id } }).catch(() => null)
          }

          user.id = existingUser.id
          user.email = existingUser.email
          user.name = user.name ?? existingUser.name ?? undefined

          return true
        }
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

export async function requireAdmin() {
  const session = await requireAuth()
  
  const role = String(((session.user as any)?.role) || '').toUpperCase()
  
  if (role !== 'ADMIN') {
    redirect('/dashboard')
  }
  
  return session
}