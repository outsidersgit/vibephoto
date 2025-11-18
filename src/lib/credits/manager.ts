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
  purchasedCredits: number
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

    const [user, daySpentResult, monthSpentResult] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { creditsUsed: true, creditsLimit: true, creditsBalance: true }
      }),
      prisma.$queryRaw<{ total: bigint | number | null }[]>`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM credit_transactions
        WHERE "userId" = ${userId}
          AND type = 'SPENT'
          AND "createdAt" >= ${startOfDay}
      `,
      prisma.$queryRaw<{ total: bigint | number | null }[]>`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM credit_transactions
        WHERE "userId" = ${userId}
          AND type = 'SPENT'
          AND "createdAt" >= ${startOfMonth}
      `
    ])

    const dailySpentRaw = daySpentResult?.[0]?.total ?? 0
    const monthlySpentRaw = monthSpentResult?.[0]?.total ?? 0

    const dailySpent = Math.abs(Number(dailySpentRaw))
    const monthlySpent = Math.abs(Number(monthlySpentRaw))
    const remainingPlanCredits = Math.max(0, (user?.creditsLimit || 0) - (user?.creditsUsed || 0))
    const purchasedCredits = Math.max(0, user?.creditsBalance || 0)

    return {
      today: dailySpent,
      thisMonth: monthlySpent,
      totalTraining: 0, // TODO: track specific training usage
      totalGeneration: monthlySpent,
      remaining: remainingPlanCredits,
      purchasedCredits
    }
  }

  static async canUserAfford(
    userId: string,
    amount: number,
    _userPlan: Plan
  ): Promise<{ canAfford: boolean; reason?: string }> {
    const currentCredits = await this.getUserCredits(userId)

    if (currentCredits < amount) {
      return {
        canAfford: false,
        reason: `Créditos insuficientes. Necessário: ${amount}, disponível: ${currentCredits}`
      }
    }

    return { canAfford: true }
  }

  static async deductCredits(
    userId: string,
    amount: number,
    description: string,
    metadata?: DeductCreditsMetadata,
    tx?: Prisma.TransactionClient,
    transactionOptions?: Prisma.TransactionOptions
  ): Promise<{
    success: boolean
    user?: { creditsUsed: number; creditsLimit: number; creditsBalance: number }
    error?: string
  }> {
    try {
      let updatedUserRecord: { creditsUsed: number; creditsLimit: number; creditsBalance: number } | null = null

      // OPTIMIZATION: Fetch user data and credit packages BEFORE the transaction
      // This reduces the work inside the transaction and prevents timeout
      const user = await prisma.user.findUnique({
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
        return { success: false, error: 'User not found' }
      }

      // VALIDAÇÃO: Créditos do plano (mensais ou anuais) expirados não podem ser usados
      const now = new Date()
      let planCreditsAvailable = 0

      if (user.creditsExpiresAt && user.creditsExpiresAt < now) {
        planCreditsAvailable = 0
      } else {
        planCreditsAvailable = Math.max(0, user.creditsLimit - user.creditsUsed)
      }

      // Pre-fetch credit packages if needed (outside transaction)
      let validPackages: Array<{ id: string; creditAmount: number; usedCredits: number }> = []
      let creditsNeededFromPackages = 0

      if (planCreditsAvailable < amount) {
        creditsNeededFromPackages = amount - planCreditsAvailable

        // Fetch packages BEFORE transaction to reduce transaction time
        const potentialPackages = await prisma.creditPurchase.findMany({
          where: {
            userId,
            status: 'CONFIRMED',
            isExpired: false,
            validUntil: { gte: now },
          },
          orderBy: { validUntil: 'asc' },
          select: {
            id: true,
            creditAmount: true,
            usedCredits: true
          }
        })

        validPackages = potentialPackages.filter((pkg) => pkg.usedCredits < pkg.creditAmount)

        const totalPackageCredits = validPackages.reduce(
          (sum, pkg) => sum + (pkg.creditAmount - pkg.usedCredits),
          0
        )

        if (totalPackageCredits < creditsNeededFromPackages) {
          return { success: false, error: 'Insufficient credits' }
        }
      }

      // OPTIMIZED: Transaction only does the critical updates
      const execute = async (client: Prisma.TransactionClient) => {
        if (planCreditsAvailable >= amount) {
          // Simple case: only plan credits needed
          updatedUserRecord = await client.user.update({
            where: { id: userId },
            data: {
              creditsUsed: { increment: amount }
            },
            select: { creditsUsed: true, creditsLimit: true, creditsBalance: true }
          })
        } else {
          // Complex case: need to use package credits
          // Update credit packages (already validated outside transaction)
          // OPTIMIZED: Calculate all updates first, then execute in parallel
          const packageUpdates: Array<{ id: string; amount: number }> = []
          let remaining = creditsNeededFromPackages
          
          for (const pkg of validPackages) {
            if (remaining <= 0) break

            const available = pkg.creditAmount - pkg.usedCredits
            const toUse = Math.min(available, remaining)

            packageUpdates.push({ id: pkg.id, amount: toUse })
            remaining -= toUse
          }

          // OPTIMIZED: Execute all package updates in parallel
          await Promise.all(
            packageUpdates.map(update =>
              client.creditPurchase.update({
                where: { id: update.id },
                data: { usedCredits: { increment: update.amount } }
              })
            )
          )

          // Update user
          updatedUserRecord = await client.user.update({
            where: { id: userId },
            data: {
              creditsUsed: user.creditsLimit, // Use all plan credits
              creditsBalance: { decrement: creditsNeededFromPackages }
            },
            select: { creditsUsed: true, creditsLimit: true, creditsBalance: true }
          })
        }

        return updatedUserRecord
      }

      // Execute transaction (now much faster since we pre-fetched data)
      if (tx) {
        await execute(tx)
      } else {
        await prisma.$transaction(
          async (transaction) => {
            await execute(transaction)
          },
          transactionOptions || { timeout: 10000 } // Reduced timeout since transaction is now faster
        )
      }

      // Record credit transaction OUTSIDE the main transaction (can be async)
      // This prevents the transaction from timing out
      if (updatedUserRecord) {
        // Fire and forget - don't wait for this to complete
        Promise.all([
          // Record transaction (async, non-blocking)
          (async () => {
            try {
              if (metadata?.type === 'IMAGE_GENERATION' && metadata.generationId) {
                await recordImageGenerationCost(userId, metadata.generationId, amount, {
                  prompt: metadata.prompt,
                  variations: metadata.variations,
                  resolution: metadata.resolution
                })
              } else if (metadata?.type === 'TRAINING' && metadata.modelId) {
                await recordModelTrainingCost(userId, metadata.modelId, amount)
              } else if (metadata?.type === 'IMAGE_EDIT' && metadata.editId) {
                await recordImageEditCost(userId, metadata.editId, amount, {
                  prompt: metadata.prompt
                })
              } else if (metadata?.type === 'VIDEO_GENERATION' && metadata.videoId) {
                await recordVideoGenerationCost(userId, metadata.videoId, amount, {
                  duration: metadata.duration,
                  resolution: metadata.resolution
                })
              } else if (metadata?.type === 'UPSCALE' && metadata.upscaleId) {
                await recordUpscaleCost(userId, metadata.upscaleId, amount)
              } else if (metadata?.type === 'PHOTO_PACKAGE' && metadata.userPackageId) {
                await recordPhotoPackagePurchase(userId, metadata.userPackageId, amount, {
                  packageName: metadata.packageName
                })
              }
            } catch (error) {
              console.error('⚠️ Failed to record credit transaction (non-critical):', error)
            }
          })(),
          // Broadcast update (async, non-blocking)
          broadcastCreditsUpdate(
            userId,
            updatedUserRecord.creditsUsed,
            updatedUserRecord.creditsLimit,
            metadata?.type || 'GENERATION',
            updatedUserRecord.creditsBalance
          ).catch(err => console.error('⚠️ Failed to broadcast credits update:', err))
        ]).catch(() => {
          // Ignore errors in async operations
        })

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