import { prisma } from '@/lib/db'
import { Plan } from '@prisma/client'
import { getCreditsLimitForPlan } from '@/lib/constants/plans'

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
}) {
  const creditsLimit = getCreditsLimitForPlan(data.plan)
  const now = new Date()

  // IMPORTANTE: Créditos só são disponibilizados se status = ACTIVE (pagamento confirmado)
  const totalCredits = data.status === 'ACTIVE'
    ? (data.billingCycle === 'YEARLY' ? creditsLimit * 12 : creditsLimit)
    : 0 // Se pagamento não confirmado, créditos = 0

  // Planos ANUAIS: créditos expiram em 1 ano
  const creditsExpiresAt = data.billingCycle === 'YEARLY'
    ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // + 1 ano
    : null // Planos mensais não têm expiração (renovam todo mês)

  return prisma.user.update({
    where: { id: data.userId },
    data: {
      asaasCustomerId: data.asaasCustomerId,
      plan: data.plan,
      billingCycle: data.billingCycle,
      subscriptionId: data.asaasSubscriptionId,
      subscriptionStatus: data.status,
      subscriptionEndsAt: data.currentPeriodEnd,
      subscriptionStartedAt: now, // Salva data de início
      lastCreditRenewalAt: now, // Primeira renovação é agora
      creditsExpiresAt, // Expiração para planos anuais
      creditsLimit: totalCredits, // YEARLY recebe 12x, mas só se ACTIVE
      creditsUsed: 0 // Reset credits on new subscription
    }
  })
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
  }

  // If subscription is activated, set credits limit and reset usage
  if (status === 'ACTIVE' && plan) {
    const creditsLimit = getCreditsLimitForPlan(plan)
    const now = new Date()

    // Busca dados atuais do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStartedAt: true,
        billingCycle: true,
        creditsUsed: true
      }
    })

    const currentBillingCycle = billingCycle || user?.billingCycle

    // Planos ANUAIS recebem créditos multiplicados por 12 (todos de uma vez)
    const totalCredits = currentBillingCycle === 'YEARLY' ? creditsLimit * 12 : creditsLimit

    // Planos ANUAIS: créditos expiram em 1 ano
    // IMPORTANTE: Se for renovação anual, créditos anteriores NÃO acumulam
    const creditsExpiresAt = currentBillingCycle === 'YEARLY'
      ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // + 1 ano
      : null

    updateData.plan = plan
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
  }

  // CRITICAL: Do NOT downgrade plan on OVERDUE/CANCELLED/EXPIRED
  // User keeps their plan, but subscriptionStatus controls access
  // Middleware will block access based on subscriptionStatus

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
      const creditsLimit = getCreditsLimitForPlan(user.plan!)

      await prisma.user.update({
        where: { id: user.id },
        data: {
          creditsUsed: 0, // Reseta créditos usados
          creditsLimit: creditsLimit, // Renova limite
          lastCreditRenewalAt: now // Atualiza data de renovação
        }
      })

      await logUsage({
        userId: user.id,
        action: 'MONTHLY_CREDIT_RENEWAL',
        creditsUsed: 0,
        details: {
          plan: user.plan,
          creditsRenewed: creditsLimit,
          renewalDate: now.toISOString()
        }
      })

      renewed.push(user.id)
    }
  }

  return {
    totalProcessed: users.length,
    totalRenewed: renewed.length,
    renewedUserIds: renewed
  }
}