import { prisma } from '@/lib/db'
import { Plan } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { getCreditsLimitForPlan, getModelsLimitForPlan } from '@/lib/constants/plans'
import { broadcastAdminUserCreated } from '@/lib/services/realtime-service'

export async function createUser(data: {
  email: string
  password?: string
  name?: string
  avatar?: string
  plan?: Plan
}) {
  const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : undefined
  
  // Créditos só são disponibilizados quando há plano ativo
  // Novos usuários sem plano recebem 0 créditos
  const creditsLimit = data.plan ? await getCreditsLimitForPlan(data.plan) : 0
  
  const user = await prisma.user.create({
    data: {
      ...data,
      password: hashedPassword,
      creditsLimit // 0 se sem plano, ou valor do plano se houver
    }
  })

  // Broadcast to admins
  try {
    await broadcastAdminUserCreated({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      role: user.role,
      createdAt: user.createdAt
    })
  } catch (error) {
    console.error('❌ Failed to broadcast user created event:', error)
    // Don't fail user creation if broadcast fails
  }

  return user
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: {
      models: {
        orderBy: { createdAt: 'desc' },
        take: 5
      },
      generations: {
        orderBy: { createdAt: 'desc' },
        take: 10
      }
    }
  })
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      models: {
        orderBy: { createdAt: 'desc' }
      },
      generations: {
        orderBy: { createdAt: 'desc' }
      },
      collections: {
        orderBy: { createdAt: 'desc' }
      }
    }
  })
}

export async function updateUserPlan(userId: string, plan: Plan) {
  const creditsLimit = await getCreditsLimitForPlan(plan)
  return prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      creditsLimit,
      creditsUsed: 0 // Reset credits when upgrading
    }
  })
}

export async function updateUserCredits(userId: string, creditsUsed: number) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      creditsUsed: {
        increment: creditsUsed
      }
    }
  })
}

export async function canUserUseCredits(userId: string, creditsNeeded: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsUsed: true, creditsLimit: true, creditsBalance: true }
  })
  
  if (!user) return false
  
  const availablePlanCredits = user.creditsLimit - user.creditsUsed
  const totalAvailable = availablePlanCredits + (user.creditsBalance || 0)
  return totalAvailable >= creditsNeeded
}

export async function verifyPassword(password: string, hashedPassword: string) {
  return bcrypt.compare(password, hashedPassword)
}

// Re-export for backwards compatibility
export { getCreditsLimitForPlan, getModelsLimitForPlan }