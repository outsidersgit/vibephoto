/**
 * Model Credit Service
 *
 * Handles credit verification and charging for extra AI model creation.
 * Business rules:
 * - First model is free for users with active subscription
 * - Additional models cost 500 credits each
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/monitoring/logger'
import { CreditPackageService } from './credit-package-service'

export const MODEL_CREATION_COST = 500
export const FREE_MODELS_PER_USER = 1

export interface ModelCreditCheckResult {
  canCreate: boolean
  needsPayment: boolean
  currentModels: number
  creditsRequired: number
  creditsAvailable: number
  message?: string
}

export interface ChargeModelCreditsResult {
  success: boolean
  transactionId?: string
  newBalance?: number
  message?: string
}

/**
 * Checks if user can create a new model and if they need to pay credits
 */
export async function checkModelCreationEligibility(
  userId: string
): Promise<ModelCreditCheckResult> {
  try {
    // Get user with subscription and model count
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: { models: true }
        }
      }
    })

    if (!user) {
      logger.error('User not found for model creation check', { userId })
      return {
        canCreate: false,
        needsPayment: false,
        currentModels: 0,
        creditsRequired: 0,
        creditsAvailable: 0,
        message: 'Usuário não encontrado'
      }
    }

    const currentModels = user._count.models

    // Get total credits (subscription + purchased)
    const creditBalance = await CreditPackageService.getUserCreditBalance(userId)
    const creditsAvailable = creditBalance.totalCredits

    logger.info('Checking model creation eligibility', {
      userId,
      currentModels,
      subscriptionCredits: creditBalance.subscriptionCredits,
      purchasedCredits: creditBalance.purchasedCredits,
      totalCredits: creditsAvailable,
      freeModelsUsed: currentModels >= FREE_MODELS_PER_USER
    })

    // First model is always free (if user has active subscription)
    if (currentModels < FREE_MODELS_PER_USER) {
      logger.info('User eligible for free model', { userId, currentModels })
      return {
        canCreate: true,
        needsPayment: false,
        currentModels,
        creditsRequired: 0,
        creditsAvailable
      }
    }

    // Additional models require credits
    const creditsRequired = MODEL_CREATION_COST

    if (creditsAvailable < creditsRequired) {
      logger.warn('Insufficient credits for model creation', {
        userId,
        creditsAvailable,
        creditsRequired,
        currentModels,
        subscriptionCredits: creditBalance.subscriptionCredits,
        purchasedCredits: creditBalance.purchasedCredits
      })
      return {
        canCreate: false,
        needsPayment: true,
        currentModels,
        creditsRequired,
        creditsAvailable,
        message: `Você já utilizou o modelo gratuito incluso na sua assinatura. Modelos adicionais custam ${MODEL_CREATION_COST} créditos cada. Você possui ${creditsAvailable} créditos (${creditBalance.subscriptionCredits} da assinatura + ${creditBalance.purchasedCredits} comprados) e precisa de ${creditsRequired}. Adquira mais créditos para continuar.`
      }
    }

    logger.info('User has sufficient credits for model creation', {
      userId,
      creditsAvailable,
      creditsRequired
    })

    return {
      canCreate: true,
      needsPayment: true,
      currentModels,
      creditsRequired,
      creditsAvailable
    }

  } catch (error) {
    logger.error('Error checking model creation eligibility', { userId, error })
    return {
      canCreate: false,
      needsPayment: false,
      currentModels: 0,
      creditsRequired: 0,
      creditsAvailable: 0,
      message: 'Erro ao verificar elegibilidade para criação de modelo'
    }
  }
}

/**
 * Charges credits for creating an additional model
 */
export async function chargeModelCreationCredits(
  userId: string,
  modelId: string,
  modelName?: string
): Promise<ChargeModelCreditsResult> {
  try {
    // Check eligibility first
    const eligibility = await checkModelCreationEligibility(userId)

    if (!eligibility.canCreate) {
      return {
        success: false,
        message: eligibility.message || 'Você não pode criar mais modelos no momento'
      }
    }

    // If it's the first free model, no charge needed
    if (!eligibility.needsPayment) {
      logger.info('Free model created (first model)', {
        userId,
        modelId,
        modelName,
        currentModels: eligibility.currentModels
      })

      return {
        success: true,
        newBalance: eligibility.creditsAvailable,
        message: 'Modelo gratuito criado com sucesso'
      }
    }

    // Charge credits for additional model (debit subscription first, then purchased)
    const result = await prisma.$transaction(async (tx) => {
      // Read current balances
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          creditsUsed: true,
          creditsLimit: true,
          creditsBalance: true
        }
      })

      if (!user) {
        throw new Error('Usuário não encontrado para débito de créditos')
      }

      const subscriptionAvailable = Math.max(0, user.creditsLimit - user.creditsUsed)
      const purchasedAvailable = user.creditsBalance || 0
      const totalAvailable = subscriptionAvailable + purchasedAvailable
      if (totalAvailable < MODEL_CREATION_COST) {
        throw new Error('Saldo insuficiente no momento da cobrança')
      }

      const balanceBefore = totalAvailable

      // Split debit
      const debitFromSubscription = Math.min(subscriptionAvailable, MODEL_CREATION_COST)
      const remaining = MODEL_CREATION_COST - debitFromSubscription
      const debitFromPurchased = remaining > 0 ? remaining : 0

      // Apply updates
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          creditsUsed: debitFromSubscription > 0 ? { increment: debitFromSubscription } : undefined,
          creditsBalance: debitFromPurchased > 0 ? { decrement: debitFromPurchased } : undefined
        },
        select: {
          creditsUsed: true,
          creditsLimit: true,
          creditsBalance: true
        }
      })

      const subscriptionAfter = Math.max(0, updated.creditsLimit - updated.creditsUsed)
      const purchasedAfter = updated.creditsBalance || 0
      const balanceAfter = subscriptionAfter + purchasedAfter

      // Create transaction record (single record consolidating débito)
      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount: -MODEL_CREATION_COST,
          type: 'SPENT',
          source: 'MODEL_CREATION',
          description: `Criação de modelo adicional: ${modelName || modelId}`,
          balanceBefore,
          balanceAfter,
          metadata: {
            modelId,
            modelName,
            costPerModel: MODEL_CREATION_COST,
            currentModelsCount: eligibility.currentModels + 1,
            debitFromSubscription,
            debitFromPurchased
          }
        }
      })

      return {
        transactionId: transaction.id,
        newBalance: balanceAfter
      }
    })

    logger.info('Model creation credits charged', {
      userId,
      modelId,
      modelName,
      creditsCharged: MODEL_CREATION_COST,
      newBalance: result.newBalance,
      transactionId: result.transactionId
    })

    return {
      success: true,
      transactionId: result.transactionId,
      newBalance: result.newBalance,
      message: `${MODEL_CREATION_COST} créditos deduzidos. Novo saldo: ${result.newBalance}`
    }

  } catch (error) {
    logger.error('Error charging model creation credits', {
      userId,
      modelId,
      modelName,
      error
    })

    return {
      success: false,
      message: 'Erro ao cobrar créditos pela criação do modelo'
    }
  }
}

/**
 * Gets model creation cost info for display to user
 */
export async function getModelCreationCostInfo(userId: string) {
  const eligibility = await checkModelCreationEligibility(userId)

  return {
    currentModels: eligibility.currentModels,
    freeModelsAvailable: Math.max(0, FREE_MODELS_PER_USER - eligibility.currentModels),
    nextModelCost: eligibility.currentModels >= FREE_MODELS_PER_USER ? MODEL_CREATION_COST : 0,
    canAffordNextModel: eligibility.canCreate,
    creditsAvailable: eligibility.creditsAvailable,
    needsCredits: !eligibility.canCreate && eligibility.needsPayment,
    message: eligibility.message
  }
}
