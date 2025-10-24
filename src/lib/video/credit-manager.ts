import { prisma } from '../prisma'
import { CreditTransactionType, CreditTransactionSource } from '@prisma/client'

/**
 * Debit credits for video generation
 */
export async function debitCreditsForVideo(
  userId: string,
  videoGenerationId: string,
  creditsUsed: number,
  videoConfig: {
    duration: number
    quality: string
    aspectRatio: string
    prompt: string
  }
) {
  try {
    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get current user credits
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          creditsUsed: true,
          creditsLimit: true,
          creditsBalance: true
        }
      })

      if (!user) {
        throw new Error('User not found')
      }

      // Check if user has enough credits
      const availableCredits = user.creditsLimit + user.creditsBalance - user.creditsUsed
      
      if (availableCredits < creditsUsed) {
        throw new Error(`Insufficient credits. Available: ${availableCredits}, Required: ${creditsUsed}`)
      }

      // Update user credits
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          creditsUsed: {
            increment: creditsUsed
          }
        },
        select: {
          creditsUsed: true,
          creditsLimit: true,
          creditsBalance: true
        }
      })

      // Create credit transaction record
      await tx.creditTransaction.create({
        data: {
          userId,
          type: CreditTransactionType.SPENT,
          source: CreditTransactionSource.GENERATION, // We can use GENERATION for video too
          amount: -creditsUsed,
          description: `Video generation: ${videoConfig.duration}s ${videoConfig.quality} (${videoConfig.aspectRatio})`,
          referenceId: videoGenerationId,
          balanceAfter: updatedUser.creditsLimit + updatedUser.creditsBalance - updatedUser.creditsUsed,
          metadata: {
            type: 'video_generation',
            videoConfig: videoConfig,
            prompt: videoConfig.prompt.substring(0, 200) // Store first 200 chars of prompt
          }
        }
      })

      return {
        success: true,
        creditsDebited: creditsUsed,
        remainingCredits: updatedUser.creditsLimit + updatedUser.creditsBalance - updatedUser.creditsUsed,
        newBalance: {
          creditsUsed: updatedUser.creditsUsed,
          creditsLimit: updatedUser.creditsLimit,
          creditsBalance: updatedUser.creditsBalance
        }
      }
    })

    console.log(`✅ Credits debited for video ${videoGenerationId}: ${creditsUsed} credits`)
    return result

  } catch (error) {
    console.error('❌ Error debiting credits for video:', error)
    throw error
  }
}

/**
 * Refund credits for failed/cancelled video generation
 */
export async function refundCreditsForVideo(
  userId: string,
  videoGenerationId: string,
  creditsToRefund: number,
  reason: string = 'Video generation failed'
) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get current user credits
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          creditsUsed: true,
          creditsLimit: true,
          creditsBalance: true
        }
      })

      if (!user) {
        throw new Error('User not found')
      }

      // Ensure we don't refund more than what was used
      const refundAmount = Math.min(creditsToRefund, user.creditsUsed)

      // Update user credits (reduce creditsUsed)
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          creditsUsed: {
            decrement: refundAmount
          }
        },
        select: {
          creditsUsed: true,
          creditsLimit: true,
          creditsBalance: true
        }
      })

      // Create refund transaction record
      await tx.creditTransaction.create({
        data: {
          userId,
          type: CreditTransactionType.REFUNDED,
          source: CreditTransactionSource.REFUND,
          amount: refundAmount,
          description: `Video generation refund: ${reason}`,
          referenceId: videoGenerationId,
          balanceAfter: updatedUser.creditsLimit + updatedUser.creditsBalance - updatedUser.creditsUsed,
          metadata: {
            type: 'video_generation_refund',
            reason: reason,
            originalAmount: creditsToRefund,
            refundedAmount: refundAmount
          }
        }
      })

      return {
        success: true,
        creditsRefunded: refundAmount,
        remainingCredits: updatedUser.creditsLimit + updatedUser.creditsBalance - updatedUser.creditsUsed,
        newBalance: {
          creditsUsed: updatedUser.creditsUsed,
          creditsLimit: updatedUser.creditsLimit,
          creditsBalance: updatedUser.creditsBalance
        }
      }
    })

    console.log(`✅ Credits refunded for video ${videoGenerationId}: ${creditsToRefund} credits`)
    return result

  } catch (error) {
    console.error('❌ Error refunding credits for video:', error)
    throw error
  }
}

/**
 * Get credit history for videos
 */
export async function getVideoCreditsHistory(userId: string, limit: number = 50) {
  try {
    const transactions = await prisma.creditTransaction.findMany({
      where: {
        userId,
        OR: [
          {
            metadata: {
              path: ['type'],
              equals: 'video_generation'
            }
          },
          {
            metadata: {
              path: ['type'],
              equals: 'video_generation_refund'
            }
          }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    return transactions.map(transaction => ({
      id: transaction.id,
      type: transaction.type,
      source: transaction.source,
      amount: transaction.amount,
      description: transaction.description,
      referenceId: transaction.referenceId,
      balanceAfter: transaction.balanceAfter,
      createdAt: transaction.createdAt,
      metadata: transaction.metadata
    }))

  } catch (error) {
    console.error('❌ Error getting video credits history:', error)
    throw error
  }
}

/**
 * Get video credits statistics
 */
export async function getVideoCreditsStats(userId: string) {
  try {
    // Get total credits spent on videos
    const videoTransactions = await prisma.creditTransaction.findMany({
      where: {
        userId,
        metadata: {
          path: ['type'],
          equals: 'video_generation'
        }
      }
    })

    // Get total credits refunded for videos
    const videoRefunds = await prisma.creditTransaction.findMany({
      where: {
        userId,
        metadata: {
          path: ['type'],
          equals: 'video_generation_refund'
        }
      }
    })

    const totalSpent = videoTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
    const totalRefunded = videoRefunds.reduce((sum, tx) => sum + tx.amount, 0)
    const netSpent = totalSpent - totalRefunded

    // Get video generation counts by status
    const videoStats = await prisma.videoGeneration.groupBy({
      by: ['status'],
      where: { userId },
      _count: {
        status: true
      },
      _sum: {
        creditsUsed: true
      }
    })

    return {
      totalSpent,
      totalRefunded,
      netSpent,
      transactionCount: videoTransactions.length + videoRefunds.length,
      videoStats: videoStats.map(stat => ({
        status: stat.status,
        count: stat._count.status,
        creditsUsed: stat._sum.creditsUsed || 0
      }))
    }

  } catch (error) {
    console.error('❌ Error getting video credits stats:', error)
    throw error
  }
}