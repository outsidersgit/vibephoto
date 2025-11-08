import { prisma } from '@/lib/db'
import { revalidateTag } from 'next/cache'
import { Plan, Prisma } from '@prisma/client'
import {
  createCreditTransaction,
  recordImageGenerationCost,
  recordModelTrainingCost,
  recordUpscaleCost,
  recordImageEditCost,
  recordVideoGenerationCost,
  recordPhotoPackagePurchase
} from '@/lib/services/credit-transaction-service'
import { broadcastCreditsUpdate } from '@/lib/services/realtime-service'

type CreditChargeType =
  | 'IMAGE_GENERATION'
  | 'IMAGE_EDIT'
  | 'VIDEO_GENERATION'
  | 'UPSCALE'
  | 'TRAINING'
  | 'PHOTO_PACKAGE'

interface DeductCreditsMetadata {
  modelId?: string
  generationId?: string
  editId?: string
  videoId?: string
  upscaleId?: string
  userPackageId?: string
  packageName?: string
  type?: CreditChargeType
  prompt?: string
  variations?: number
  duration?: number
  resolution?: string
}

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
      select: { creditsUsed: true, creditsLimit: true, creditsBalance: true }
    })
    
    return (user?.creditsLimit || 0) - (user?.creditsUsed || 0) + (user?.creditsBalance || 0)
  }

  static async getUserUsage(userId: string): Promise<CreditUsage> {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [user, daySpent, monthSpent] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { creditsUsed: true, creditsLimit: true }
      }),
      prisma.creditTransaction.aggregate({
        where: {
          userId,
          type: 'SPENT',
          createdAt: { gte: startOfDay }
        },
        _sum: { amount: true }
      }),
      prisma.creditTransaction.aggregate({
        where: {
          userId,
          type: 'SPENT',
          createdAt: { gte: startOfMonth }
        },
        _sum: { amount: true }
      })
    ])

    const dailySpent = Math.abs(daySpent._sum.amount || 0)
    const monthlySpent = Math.abs(monthSpent._sum.amount || 0)
    const remainingPlanCredits = Math.max(0, (user?.creditsLimit || 0) - (user?.creditsUsed || 0))

    return {
      today: dailySpent,
      thisMonth: monthlySpent,
      totalTraining: 0, // TODO: track specific training usage
      totalGeneration: monthlySpent,
      remaining: remainingPlanCredits
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
    metadata?: DeductCreditsMetadata,
    tx?: Prisma.TransactionClient
  ): Promise<{
    success: boolean
    user?: { creditsUsed: number; creditsLimit: number; creditsBalance: number }
    error?: string
  }> {
    try {
      let updatedUserRecord: { creditsUsed: number; creditsLimit: number; creditsBalance: number } | null = null

      const execute = async (client: Prisma.TransactionClient) => {
        // Busca informações do usuário
        const user = await client.user.findUnique({
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
          updatedUserRecord = await client.user.update({
            where: { id: userId },
            data: {
              creditsUsed: { increment: amount }
            },
            select: { creditsUsed: true, creditsLimit: true, creditsBalance: true }
          })
        } else {
          // Precisa usar créditos de pacotes avulsos também
          const creditsNeededFromPackages = amount - planCreditsAvailable

          // Busca pacotes de créditos válidos (não expirados)
        const potentialPackages = await client.creditPurchase.findMany({
            where: {
              userId,
              status: 'CONFIRMED',
              isExpired: false,
              validUntil: { gte: new Date() },
            },
            orderBy: { validUntil: 'asc' } // Usa os que expiram primeiro
          })

        const validPackages = potentialPackages.filter((pkg) => pkg.usedCredits < pkg.creditAmount)

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

            await client.creditPurchase.update({
              where: { id: pkg.id },
              data: { usedCredits: { increment: toUse } }
            })

            remaining -= toUse
          }

          // Usa todos os créditos do plano
          updatedUserRecord = await client.user.update({
            where: { id: userId },
            data: {
              creditsUsed: user.creditsLimit, // Usa todo o limite
              creditsBalance: { decrement: creditsNeededFromPackages }
            },
            select: { creditsUsed: true, creditsLimit: true, creditsBalance: true }
          })
        }

        // Registrar transação de crédito após a dedução bem-sucedida
        if (metadata?.type === 'IMAGE_GENERATION' && metadata.generationId) {
          await recordImageGenerationCost(userId, metadata.generationId, amount, {
            prompt: metadata.prompt,
            variations: metadata.variations,
            resolution: metadata.resolution
          }, client)
        } else if (metadata?.type === 'TRAINING' && metadata.modelId) {
          await recordModelTrainingCost(userId, metadata.modelId, amount, undefined, client)
        } else if (metadata?.type === 'IMAGE_EDIT' && metadata.editId) {
          await recordImageEditCost(userId, metadata.editId, amount, {
            prompt: metadata.prompt
          }, client)
        } else if (metadata?.type === 'VIDEO_GENERATION' && metadata.videoId) {
          await recordVideoGenerationCost(userId, metadata.videoId, amount, {
            duration: metadata.duration,
            resolution: metadata.resolution
          }, client)
        } else if (metadata?.type === 'UPSCALE' && metadata.upscaleId) {
          await recordUpscaleCost(userId, metadata.upscaleId, amount, undefined, client)
        } else if (metadata?.type === 'PHOTO_PACKAGE' && metadata.userPackageId) {
          await recordPhotoPackagePurchase(userId, metadata.userPackageId, amount, {
            packageName: metadata.packageName
          }, client)
        }

        return updatedUserRecord
      }

      if (tx) {
        await execute(tx)
      } else {
        await prisma.$transaction(async (transaction) => {
          await execute(transaction)
        })
      }

      if (updatedUserRecord) {
        await broadcastCreditsUpdate(
          userId,
          updatedUserRecord.creditsUsed,
          updatedUserRecord.creditsLimit,
          metadata?.type || 'GENERATION',
          updatedUserRecord.creditsBalance
        )

        try {
          revalidateTag(`user-${userId}-credits`)
        } catch (revalidateError) {
          console.warn('⚠️ Failed to revalidate credit balance tag:', revalidateError)
        }
      }

      return { success: true, user: updatedUserRecord || undefined }
    } catch (error) {
      console.error('Failed to deduct credits:', error)
      return { success: false, error: error instanceof Error ? error.message : undefined }
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
      refundSource?: string
      referenceId?: string
    }
  ): Promise<{ success: boolean; user?: { creditsUsed: number; creditsLimit: number; creditsBalance: number }; error?: string }> {
    try {
      let updatedUser: { creditsUsed: number; creditsLimit: number; creditsBalance: number } | null = null

      const execute = async (client: Prisma.TransactionClient) => {
        updatedUser = await client.user.update({
          where: { id: userId },
          data: {
            creditsUsed: {
              decrement: amount
            }
          },
          select: { creditsUsed: true, creditsLimit: true, creditsBalance: true }
        })

        await createCreditTransaction({
          userId,
          type: 'REFUNDED',
          source: metadata?.refundSource || 'REFUND',
          amount: Math.abs(amount),
          description,
          referenceId: metadata?.referenceId || metadata?.generationId || metadata?.modelId || metadata?.subscriptionId,
          metadata
        }, client)
      }

      await prisma.$transaction(async (tx) => {
        await execute(tx)
      })

      if (updatedUser) {
        await broadcastCreditsUpdate(
          userId,
          updatedUser.creditsUsed,
          updatedUser.creditsLimit,
          'CREDIT_REFUND',
          updatedUser.creditsBalance
        )

        try {
          revalidateTag(`user-${userId}-credits`)
        } catch (revalidateError) {
          console.warn('⚠️ Failed to revalidate credit balance tag:', revalidateError)
        }
      }

      return { success: true, user: updatedUser || undefined }
    } catch (error) {
      console.error('Failed to add credits:', error)
      return { success: false, error: error instanceof Error ? error.message : undefined }
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