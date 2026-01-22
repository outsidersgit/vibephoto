import { prisma } from '@/lib/db'
import { Plan } from '@prisma/client'
import { getCreditsLimitForPlan } from '@/lib/constants/plans'
import { recordSubscriptionRenewal } from '@/lib/services/credit-transaction-service'
import { broadcastCreditsUpdate } from '@/lib/services/realtime-service'

export async function createSubscription(data: {
  userId: string
  asaasCustomerId: string
  asaasSubscriptionId: string
  plan: Plan
  status: string
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd?: boolean
  billingCycle?: 'MONTHLY' | 'YEARLY'
  influencerId?: string
  referralCodeUsed?: string
}) {
  const creditsLimit = await getCreditsLimitForPlan(data.plan)
  const now = new Date()

  // IMPORTANTE: Créditos só são disponibilizados se status = ACTIVE (pagamento confirmado)
  const totalCredits = data.status === 'ACTIVE'
    ? (data.billingCycle === 'YEARLY' ? creditsLimit * 12 : creditsLimit)
    : 0 // Se pagamento não confirmado, créditos = 0

  // CRÉDITOS DO PLANO EXPIRAM:
  // - Planos MONTHLY: 1 mês após início (não acumulam para próximo ciclo)
  // - Planos YEARLY: 1 ano após início (não acumulam)
  const creditsExpiresAt = data.billingCycle === 'YEARLY'
    ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // + 1 ano
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // + 1 mês (30 dias)

  let renewalError: Error | null = null

  const result = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: data.userId },
      data: {
        asaasCustomerId: data.asaasCustomerId,
        plan: data.plan,
        billingCycle: data.billingCycle,
        subscriptionId: data.asaasSubscriptionId,
        subscriptionStatus: data.status,
        subscriptionEndsAt: data.currentPeriodEnd,
        subscriptionStartedAt: now,
        lastCreditRenewalAt: now,
        creditsExpiresAt,
        creditsLimit: totalCredits,
        creditsUsed: 0,
        ...(data.influencerId
          ? {
              referredByInfluencerId: data.influencerId,
              referralCodeUsed: data.referralCodeUsed
            }
          : data.referralCodeUsed
            ? { referralCodeUsed: data.referralCodeUsed }
            : {})
      }
    })

    if (data.status === 'ACTIVE' && totalCredits > 0) {
      try {
        await recordSubscriptionRenewal(
          data.userId,
          totalCredits,
          {
            plan: data.plan,
            billingCycle: data.billingCycle,
            reason: 'ACTIVATION'
          },
          tx
        )
      } catch (error) {
        renewalError = error as Error
        console.error('❌ [createSubscription] Failed to record subscription renewal transaction:', error)
      }
    }

    return {
      updatedUser,
      snapshot: {
        creditsUsed: updatedUser.creditsUsed,
        creditsLimit: updatedUser.creditsLimit,
        creditsBalance: updatedUser.creditsBalance ?? 0
      }
    }
  })

  if (renewalError) {
    await prisma.usageLog.create({
      data: {
        userId: data.userId,
        action: 'SUBSCRIPTION_CREDIT_ERROR',
        creditsUsed: 0,
        details: {
          stage: 'createSubscription',
          message: renewalError.message,
          hint: 'Verify CreditTransactionSource enum contains SUBSCRIPTION'
        }
      }
    }).catch((logError) => {
      console.error('❌ [createSubscription] Failed to log credit transaction error:', logError)
    })
  }

  if (data.status === 'ACTIVE' && result?.snapshot) {
    await broadcastCreditsUpdate(
      data.userId,
      result.snapshot.creditsUsed,
      result.snapshot.creditsLimit,
      'SUBSCRIPTION_RENEWAL',
      result.snapshot.creditsBalance
    )
  }

  return result.updatedUser
}

export async function updateSubscriptionStatus(
  userId: string,
  status: string,
  currentPeriodEnd?: Date,
  plan?: Plan,
  billingCycle?: 'MONTHLY' | 'YEARLY'
) {
  const updateData: any = {
    subscriptionStatus: status
  }

  if (currentPeriodEnd) {
    updateData.subscriptionEndsAt = currentPeriodEnd
    updateData.nextDueDate = currentPeriodEnd // Sempre atualiza nextDueDate junto com subscriptionEndsAt
  }

  // If subscription is activated, set credits limit and reset usage
  // CRÍTICO: Se não tiver plan como parâmetro, tentar usar do usuário atual
  if (status === 'ACTIVE') {
    // Busca dados atuais do usuário (precisa buscar plan também)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        subscriptionStartedAt: true,
        billingCycle: true
      }
    })

    // Se não passou plan como parâmetro, usar do usuário (fallback)
    const finalPlan = plan || user?.plan
    
    if (!finalPlan) {
      console.error('❌ [updateSubscriptionStatus] CRÍTICO: Não há plan disponível (nem parâmetro nem do usuário)')
      console.error('❌ [updateSubscriptionStatus] userId:', userId, 'status:', status)
      // Mesmo sem plan, atualizar status (mas creditsLimit permanecerá 0)
      return prisma.user.update({
        where: { id: userId },
        data: updateData
      })
    }

    const creditsLimit = await getCreditsLimitForPlan(finalPlan)
    const now = new Date()

    const currentBillingCycle = billingCycle || user?.billingCycle

    // Planos ANUAIS recebem créditos multiplicados por 12 (todos de uma vez)
    const totalCredits = currentBillingCycle === 'YEARLY' ? creditsLimit * 12 : creditsLimit

    // CRÉDITOS DO PLANO EXPIRAM:
    // - Planos MONTHLY: 1 mês após início/renovação (não acumulam para próximo ciclo)
    // - Planos YEARLY: 1 ano após início/renovação (não acumulam)
    const creditsExpiresAt = currentBillingCycle === 'YEARLY'
      ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // + 1 ano
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // + 1 mês (30 dias)

    updateData.plan = finalPlan // Usar plan encontrado (parâmetro ou do usuário)
    updateData.creditsLimit = totalCredits
    updateData.creditsUsed = 0 // Reset credits - créditos anteriores NÃO acumulam
    updateData.lastCreditRenewalAt = now // Atualiza data de renovação
    updateData.creditsExpiresAt = creditsExpiresAt // Seta expiração

    // Save billing cycle if provided
    if (billingCycle) {
      updateData.billingCycle = billingCycle
    }

    // Se é primeira ativação, salva data de início
    if (!user?.subscriptionStartedAt) {
      updateData.subscriptionStartedAt = now
    }

    console.log('✅ [updateSubscriptionStatus] Atualizando creditsLimit:', {
      userId,
      plan: finalPlan,
      creditsLimit: totalCredits,
      billingCycle: currentBillingCycle,
      source: plan ? 'parameter' : 'user_record'
    })

    let renewalError: Error | null = null

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: updateData
      })

      try {
        await recordSubscriptionRenewal(
          userId,
          totalCredits,
          {
            plan: finalPlan,
            billingCycle: currentBillingCycle,
            reason: 'STATUS_ACTIVE'
          },
          tx
        )
      } catch (error) {
        renewalError = error as Error
        console.error('❌ [updateSubscriptionStatus] Failed to record subscription renewal transaction:', error)
      }

      return {
        updatedUser,
        snapshot: {
          creditsUsed: updatedUser.creditsUsed,
          creditsLimit: updatedUser.creditsLimit,
          creditsBalance: updatedUser.creditsBalance ?? 0
        }
      }
    })

    if (renewalError) {
      await prisma.usageLog.create({
        data: {
          userId,
          action: 'SUBSCRIPTION_CREDIT_ERROR',
          creditsUsed: 0,
          details: {
            stage: 'updateSubscriptionStatus',
            message: renewalError.message,
            hint: 'Verify CreditTransactionSource enum contains SUBSCRIPTION'
          }
        }
      }).catch((logError) => {
        console.error('❌ [updateSubscriptionStatus] Failed to log credit transaction error:', logError)
      })
    }

    if (result?.snapshot) {
      await broadcastCreditsUpdate(
        userId,
        result.snapshot.creditsUsed,
        result.snapshot.creditsLimit,
        'SUBSCRIPTION_RENEWAL',
        result.snapshot.creditsBalance
      )
    }

    return result.updatedUser
  }

  // CRITICAL: Do NOT downgrade plan on OVERDUE/CANCELLED/EXPIRED
  // User keeps their plan, but subscriptionStatus controls access
  // Middleware will block access based on subscriptionStatus

  // Se não foi ACTIVE com plan, fazer update normal (sem increment de créditos)
  return prisma.user.update({
    where: { id: userId },
    data: updateData
  })
}

export async function cancelSubscription(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: 'CANCELLED'
      // Do NOT change plan - user keeps their plan type
      // Middleware will block access based on CANCELLED status
    }
  })
}

export async function getSubscriptionByUserId(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
      subscriptionId: true,
      subscriptionStatus: true,
      subscriptionEndsAt: true,
      creditsUsed: true,
      creditsLimit: true
    }
  })
}

export async function getUserByAsaasCustomerId(asaasCustomerId: string) {
  return prisma.user.findUnique({
    where: {
      asaasCustomerId: asaasCustomerId
    }
  })
}

export async function updateUserAsaasCustomerId(userId: string, asaasCustomerId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      asaasCustomerId: asaasCustomerId
    }
  })
}

// Re-export for backwards compatibility
export { getCreditsLimitForPlan }

// Usage logging for billing
export async function logUsage(data: {
  userId: string
  action: string
  creditsUsed: number
  details?: any
}) {
  return prisma.usageLog.create({
    data: {
      userId: data.userId,
      action: data.action,
      creditsUsed: data.creditsUsed,
      details: data.details || {}
    }
  })
}

export async function getUsageStats(userId: string, startDate: Date, endDate: Date) {
  const logs = await prisma.usageLog.findMany({
    where: {
      userId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  const totalCredits = logs.reduce((sum, log) => sum + log.creditsUsed, 0)
  const actionCounts = logs.reduce((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    totalCredits,
    actionCounts,
    logs: logs.slice(0, 100) // Last 100 activities
  }
}

/**
 * Renova créditos para planos MONTHLY que já passaram 1 mês desde a última renovação
 * Esta função deve ser chamada por um CRON job diário
 */
export async function renewMonthlyCredits() {
  const now = new Date()

  // Busca usuários com planos MONTHLY ativos
  const users = await prisma.user.findMany({
    where: {
      billingCycle: 'MONTHLY',
      subscriptionStatus: 'ACTIVE',
      plan: { in: ['STARTER', 'PREMIUM', 'GOLD'] },
      subscriptionStartedAt: { not: null }
    },
    select: {
      id: true,
      plan: true,
      subscriptionStartedAt: true,
      lastCreditRenewalAt: true
    }
  })

  const renewed: string[] = []

  for (const user of users) {
    if (!user.subscriptionStartedAt) continue

    // Calcula quantos meses se passaram desde a data de início da assinatura
    const dayOfMonth = user.subscriptionStartedAt.getDate()
    const currentDay = now.getDate()

    // Verifica se já passou o dia de renovação mensal
    const lastRenewal = user.lastCreditRenewalAt || user.subscriptionStartedAt
    const daysSinceLastRenewal = Math.floor((now.getTime() - lastRenewal.getTime()) / (1000 * 60 * 60 * 24))

    // Renova se passaram pelo menos 28 dias E já passou o dia do mês
    if (daysSinceLastRenewal >= 28 && currentDay >= dayOfMonth) {
      const creditsLimit = await getCreditsLimitForPlan(user.plan!)

      const result = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            creditsUsed: 0,
            creditsLimit: creditsLimit,
            lastCreditRenewalAt: now,
            creditsExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          }
        })

        await recordSubscriptionRenewal(
          user.id,
          creditsLimit,
          {
            plan: user.plan || undefined,
            billingCycle: 'MONTHLY',
            reason: 'MONTHLY_RENEWAL'
          },
          tx
        )

        await tx.usageLog.create({
          data: {
            userId: user.id,
            action: 'MONTHLY_CREDIT_RENEWAL',
            creditsUsed: 0,
            details: {
              plan: user.plan,
              creditsRenewed: creditsLimit,
              renewalDate: now.toISOString()
            }
          }
        })

        return {
          creditsUsed: updatedUser.creditsUsed,
          creditsLimit: updatedUser.creditsLimit,
          creditsBalance: updatedUser.creditsBalance ?? 0
        }
      })

      if (result) {
        await broadcastCreditsUpdate(
          user.id,
          result.creditsUsed,
          result.creditsLimit,
          'SUBSCRIPTION_RENEWAL',
          result.creditsBalance
        )
      }

      renewed.push(user.id)
    }
  }

  return {
    totalProcessed: users.length,
    totalRenewed: renewed.length,
    renewedUserIds: renewed
  }
}