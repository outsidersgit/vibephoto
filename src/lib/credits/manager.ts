import { prisma } from '@/lib/db'
import { Plan } from '@prisma/client'
import {
  recordImageGenerationCost,
  recordModelTrainingCost,
  recordUpscaleCost,
  recordImageEditCost,
  recordVideoGenerationCost
} from '@/lib/services/credit-transaction-service'

export interface CreditLimits {
  daily: number
  monthly: number
  training: number
  generation: number
  storage: number // GB
}

export interface CreditUsage {
  today: number
  thisMonth: number
  totalTraining: number
  totalGeneration: number
  remaining: number
}

export const PLAN_LIMITS: Record<Plan, CreditLimits> = {
  STARTER: {
    daily: 50,
    monthly: 500, // Alinhado com constants/plans.ts
    training: 1, // 1 model training per month
    generation: 50, // 50 generations per month
    storage: 1 // 1GB storage
  },
  PREMIUM: {
    daily: 120,
    monthly: 1200, // Alinhado com constants/plans.ts
    training: 5, // 5 model trainings per month
    generation: 500, // 500 generations per month
    storage: 10 // 10GB storage
  },
  GOLD: {
    daily: 250,
    monthly: 2500, // Alinhado com constants/plans.ts
    training: 20, // 20 model trainings per month
    generation: 2000, // 2000 generations per month
    storage: 50 // 50GB storage
  }
}

export class CreditManager {
  static async getUserCredits(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditsUsed: true, creditsLimit: true }
    })
    
    return (user?.creditsLimit || 0) - (user?.creditsUsed || 0)
  }

  static async getUserUsage(userId: string): Promise<CreditUsage> {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditsUsed: true, creditsLimit: true }
    })

    return {
      today: user?.creditsUsed || 0,
      thisMonth: user?.creditsUsed || 0,
      totalTraining: 0, // Would need separate tracking
      totalGeneration: 0, // Would need separate tracking
      remaining: (user?.creditsLimit || 0) - (user?.creditsUsed || 0)
    }
  }

  static async canUserAfford(
    userId: string, 
    amount: number, 
    userPlan: Plan
  ): Promise<{ canAfford: boolean; reason?: string }> {
    const [currentCredits, usage] = await Promise.all([
      this.getUserCredits(userId),
      this.getUserUsage(userId)
    ])

    // Check if user has enough credits
    if (currentCredits < amount) {
      return {
        canAfford: false,
        reason: `Insufficient credits. Need ${amount}, have ${currentCredits}`
      }
    }

    const limits = PLAN_LIMITS[userPlan]

    // Check daily limit
    if (usage.today + amount > limits.daily) {
      return {
        canAfford: false,
        reason: `Daily limit exceeded. Would use ${usage.today + amount}/${limits.daily} credits`
      }
    }

    // Check monthly limit
    if (usage.thisMonth + amount > limits.monthly) {
      return {
        canAfford: false,
        reason: `Monthly limit exceeded. Would use ${usage.thisMonth + amount}/${limits.monthly} credits`
      }
    }

    return { canAfford: true }
  }

  static async deductCredits(
    userId: string,
    amount: number,
    description: string,
    metadata?: {
      modelId?: string
      generationId?: string
      type?: 'TRAINING' | 'GENERATION' | 'STORAGE' | 'OTHER'
    }
  ): Promise<boolean> {
    try {
      await prisma.$transaction(async (tx) => {
        // Busca informações do usuário
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            creditsUsed: true,
            creditsLimit: true,
            creditsBalance: true,
            creditsExpiresAt: true,
            billingCycle: true
          }
        })

        if (!user) {
          throw new Error('User not found')
        }

        // VALIDAÇÃO: Créditos do plano (mensais ou anuais) expirados não podem ser usados
        const now = new Date()
        let planCreditsAvailable = 0

        if (user.creditsExpiresAt && user.creditsExpiresAt < now) {
          // Créditos do plano expiraram (tanto MONTHLY quanto YEARLY) - zera créditos disponíveis do plano
          planCreditsAvailable = 0
        } else {
          // Calcula créditos disponíveis do PLANO (prioridade 1)
          planCreditsAvailable = Math.max(0, user.creditsLimit - user.creditsUsed)
        }

        // Usa créditos do plano primeiro
        if (planCreditsAvailable >= amount) {
          // Tem créditos suficientes no plano
          await tx.user.update({
            where: { id: userId },
            data: {
              creditsUsed: { increment: amount }
            }
          })
        } else {
          // Precisa usar créditos de pacotes avulsos também
          const creditsNeededFromPackages = amount - planCreditsAvailable

          // Busca pacotes de créditos válidos (não expirados)
          const validPackages = await tx.creditPurchase.findMany({
            where: {
              userId,
              status: 'CONFIRMED',
              isExpired: false,
              validUntil: { gte: new Date() },
              usedCredits: { lt: tx.creditPurchase.fields.creditAmount }
            },
            orderBy: { validUntil: 'asc' } // Usa os que expiram primeiro
          })

          // Calcula total de créditos disponíveis em pacotes
          const totalPackageCredits = validPackages.reduce(
            (sum, pkg) => sum + (pkg.creditAmount - pkg.usedCredits),
            0
          )

          if (totalPackageCredits < creditsNeededFromPackages) {
            throw new Error('Insufficient credits')
          }

          // Deduz créditos dos pacotes
          let remaining = creditsNeededFromPackages
          for (const pkg of validPackages) {
            if (remaining <= 0) break

            const available = pkg.creditAmount - pkg.usedCredits
            const toUse = Math.min(available, remaining)

            await tx.creditPurchase.update({
              where: { id: pkg.id },
              data: { usedCredits: { increment: toUse } }
            })

            remaining -= toUse
          }

          // Usa todos os créditos do plano
          await tx.user.update({
            where: { id: userId },
            data: {
              creditsUsed: user.creditsLimit, // Usa todo o limite
              creditsBalance: { decrement: creditsNeededFromPackages }
            }
          })
        }

      })

      // Registrar transação de crédito após a dedução bem-sucedida
      // Usa os helpers específicos para cada tipo de operação
      if (metadata?.type === 'GENERATION' && metadata.generationId) {
        await recordImageGenerationCost(userId, metadata.generationId, amount)
      } else if (metadata?.type === 'TRAINING' && metadata.modelId) {
        await recordModelTrainingCost(userId, metadata.modelId, amount)
      }

      return true
    } catch (error) {
      console.error('Failed to deduct credits:', error)
      return false
    }
  }

  static async addCredits(
    userId: string,
    amount: number,
    description: string,
    metadata?: {
      modelId?: string
      generationId?: string
      subscriptionId?: string
    }
  ): Promise<boolean> {
    try {
      await prisma.$transaction(async (tx) => {
        // Add credits
        await tx.user.update({
          where: { id: userId },
          data: {
            creditsUsed: {
              decrement: amount
            }
          }
        })

        // TODO: Log transaction when CreditTransaction model is added to schema
      })

      return true
    } catch (error) {
      console.error('Failed to add credits:', error)
      return false
    }
  }

  static async getMonthlyAllowance(userPlan: Plan): Promise<number> {
    return PLAN_LIMITS[userPlan].monthly
  }

  static async resetMonthlyCredits(): Promise<void> {
    // This function should be called monthly (via cron job)
    const users = await prisma.user.findMany({
      where: {
        plan: {
          in: ['PREMIUM', 'GOLD']
        }
      }
    })

    for (const user of users) {
      const monthlyAllowance = PLAN_LIMITS[user.plan].monthly
      
      await this.addCredits(
        user.id,
        monthlyAllowance,
        `Monthly credit allowance: ${user.plan} plan`
      )
    }
  }

  static async getUserStorageUsage(userId: string): Promise<{
    used: number // in bytes
    limit: number // in bytes
    percentage: number
  }> {
    // Get generations for storage calculation
    const generations = await prisma.generation.findMany({
      where: { userId },
      select: { imageUrls: true }
    })

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true }
    })

    const totalSize = 0 // TODO: Calculate from actual training photos when model exists

    // Estimate generated images size (assume 1MB per image)
    const generatedImagesSize = generations.reduce(
      (sum, gen) => sum + (gen.imageUrls.length * 1024 * 1024), 0
    )

    const used = totalSize + generatedImagesSize
    const limitGB = PLAN_LIMITS[user?.plan || 'STARTER'].storage
    const limit = limitGB * 1024 * 1024 * 1024 // Convert GB to bytes
    const percentage = Math.round((used / limit) * 100)

    return {
      used,
      limit,
      percentage: Math.min(percentage, 100)
    }
  }

  static formatCredits(amount: number): string {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}k`
    }
    return amount.toString()
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }
}