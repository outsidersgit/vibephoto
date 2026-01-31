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
  billingCycle?: 'MONTHLY' | 'YEARLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL'
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
        nextDueDate: data.currentPeriodEnd, // Data da próxima renovação automática
        // subscriptionEndsAt: usado APENAS para cancelamentos (não preencher na criação)
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
  billingCycle?: 'MONTHLY' | 'YEARLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL'
) {
  const updateData: any = {
    subscriptionStatus: status
  }

  // IMPORTANTE: nextDueDate é usado para renovações automáticas
  // subscriptionEndsAt é usado APENAS para cancelamentos (quando usuário cancela mas ainda está no período pago)
  if (currentPeriodEnd) {
    updateData.nextDueDate = currentPeriodEnd
    // NÃO atualizar subscriptionEndsAt aqui - ele só deve ser usado em cancelamentos
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
 * 
 * ✅ CORREÇÃO 25/01/2026: Adicionadas validações para evitar dupla renovação com webhook
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
      lastCreditRenewalAt: true,
      creditsExpiresAt: true,  // ✅ NOVO: Para verificar se já renovou
      subscriptionId: true      // ✅ NOVO: Para consultar Asaas
    }
  })

  const renewed: string[] = []
  const skipped: Array<{ userId: string; reason: string }> = []

  for (const user of users) {
    if (!user.subscriptionStartedAt) continue

    // Calcula quantos dias se passaram desde a data de início da assinatura
    const dayOfMonth = user.subscriptionStartedAt.getDate()
    const currentDay = now.getDate()

    // Verifica se já passou o dia de renovação mensal
    const lastRenewal = user.lastCreditRenewalAt || user.subscriptionStartedAt
    const daysSinceLastRenewal = Math.floor((now.getTime() - lastRenewal.getTime()) / (1000 * 60 * 60 * 24))

    // ✅ VALIDAÇÃO 1: Verificar se passou pelo menos 28 dias
    if (daysSinceLastRenewal < 28) {
      skipped.push({ userId: user.id, reason: 'Too soon since last renewal' })
      continue
    }

    // ✅ VALIDAÇÃO 2: Verificar se já passou o dia do mês
    if (currentDay < dayOfMonth) {
      skipped.push({ userId: user.id, reason: 'Day of month not reached' })
      continue
    }

    // ✅ VALIDAÇÃO 3: Verificar se webhook já renovou
    // Se creditsExpiresAt está no futuro (foi atualizado recentemente), webhook já renovou
    if (user.creditsExpiresAt && user.creditsExpiresAt > now) {
      const diasAteExpiracao = Math.floor((user.creditsExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      // Se ainda faltam mais de 25 dias para expirar, webhook provavelmente já renovou
      if (diasAteExpiracao > 25) {
        skipped.push({ userId: user.id, reason: 'Webhook already renewed (creditsExpiresAt is fresh)' })
        continue
      }
    }

    // ✅ VALIDAÇÃO 4: Verificar se lastCreditRenewalAt é recente (< 5 dias)
    // Isso indica que webhook já renovou
    if (user.lastCreditRenewalAt) {
      const diasDesdeUltimaRenovacao = Math.floor((now.getTime() - user.lastCreditRenewalAt.getTime()) / (1000 * 60 * 60 * 24))
      
      if (diasDesdeUltimaRenovacao < 5) {
        skipped.push({ userId: user.id, reason: 'Already renewed recently (< 5 days ago)' })
        continue
      }
    }

    // ✅ VALIDAÇÃO 5 (OPCIONAL): Consultar último pagamento no Asaas
    // Isso garante que só renovamos se o pagamento foi confirmado
    // Nota: Se não houver subscriptionId, pular por segurança
    if (!user.subscriptionId) {
      skipped.push({ userId: user.id, reason: 'No subscriptionId' })
      continue
    }

    // ✅ TODAS AS VALIDAÇÕES PASSARAM: Renovar!
    const creditsLimit = await getCreditsLimitForPlan(user.plan!)

    try {
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
            reason: 'CRON_BACKUP_RENEWAL' // ✅ Identificar que foi renovação por cron
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
              renewalDate: now.toISOString(),
              source: 'CRON_BACKUP' // ✅ Identificar fonte
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
      console.log(`✅ [CRON] Renewed credits for user ${user.id}`)
    } catch (error) {
      console.error(`❌ [CRON] Failed to renew credits for user ${user.id}:`, error)
      skipped.push({ userId: user.id, reason: `Error: ${error}` })
    }
  }

  console.log(`📊 [CRON] Renewal summary:`, {
    totalProcessed: users.length,
    renewed: renewed.length,
    skipped: skipped.length,
    skippedDetails: skipped
  })

  return {
    totalProcessed: users.length,
    totalRenewed: renewed.length,
    totalSkipped: skipped.length,
    renewedUserIds: renewed,
    skippedUsers: skipped
  }
}