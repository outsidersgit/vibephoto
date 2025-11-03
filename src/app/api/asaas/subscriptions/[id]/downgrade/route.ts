import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { asaas, getPlanPrice } from '@/lib/payments/asaas'
import { prisma } from '@/lib/prisma'
import { updateSubscriptionStatus } from '@/lib/db/subscriptions'

/**
 * Downgrade user subscription to a lower plan
 * POST /api/asaas/subscriptions/[id]/downgrade
 *
 * Note: Downgrade applies at the end of the current billing cycle
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { newPlan, cycle, immediate } = await request.json()

    if (!newPlan || !cycle) {
      return NextResponse.json({
        error: 'Plano e ciclo são obrigatórios',
        message: 'Envie: { "newPlan": "FREE" | "STARTER" | "PREMIUM", "cycle": "MONTHLY" | "YEARLY", "immediate": false }'
      }, { status: 400 })
    }

    const subscriptionId = params.id

    // Validate plan downgrade
    const planHierarchy = ['FREE', 'STARTER', 'PREMIUM', 'GOLD']

    // Get current subscription from Asaas
    const currentSubscription = await asaas.getSubscription(subscriptionId)

    // Get user to verify ownership
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, asaasCustomerId: true, plan: true }
    })

    if (!user || user.asaasCustomerId !== currentSubscription.customer) {
      return NextResponse.json({
        error: 'Assinatura não pertence a este usuário'
      }, { status: 403 })
    }

    const currentPlanIndex = planHierarchy.indexOf(user.plan || 'FREE')
    const newPlanIndex = planHierarchy.indexOf(newPlan)

    if (newPlanIndex >= currentPlanIndex) {
      return NextResponse.json({
        error: 'Downgrade inválido',
        message: 'Para upgrade, use o endpoint /upgrade'
      }, { status: 400 })
    }

    // Calculate new price
    const newPrice = getPlanPrice(newPlan, cycle)

    const cycleMapping: Record<string, 'MONTHLY' | 'YEARLY'> = {
      'MONTHLY': 'MONTHLY',
      'YEARLY': 'YEARLY'
    }

    // Downgrade logic:
    // - If immediate=true, apply now (lose access immediately)
    // - If immediate=false (default), apply at end of billing cycle
    if (immediate) {
      // Apply immediately
      const updatedSubscription = await asaas.updateSubscription(subscriptionId, {
        value: newPrice,
        cycle: cycleMapping[cycle],
        updatePendingPayments: true
      })

      // IMPORTANTE: Apenas atualiza o plan, NÃO atualiza creditsLimit
      // Os créditos do plano antigo serão mantidos até o próximo pagamento
      // Quando o próximo pagamento for confirmado via webhook, aí sim o creditsLimit será atualizado
      await prisma.user.update({
        where: { id: user.id },
        data: {
          plan: newPlan,
          subscriptionCycle: cycle
          // creditsLimit e creditsUsed permanecem inalterados
          // Isso garante que o usuário continue usando os créditos do plano antigo até o próximo pagamento
        }
      })

      // Atualizar status da assinatura SEM passar plan
      // Isso mantém creditsLimit e creditsUsed inalterados
      await updateSubscriptionStatus(user.id, 'ACTIVE')

      // CRÍTICO: Broadcast atualização para frontend
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          creditsUsed: true,
          creditsLimit: true,
          creditsBalance: true,
          subscriptionStatus: true,
          plan: true
        }
      })

      if (updatedUser) {
        const { broadcastCreditsUpdate, broadcastUserUpdate } = await import('@/lib/services/realtime-service')
        await broadcastCreditsUpdate(
          user.id,
          updatedUser.creditsUsed,
          updatedUser.creditsLimit,
          'SUBSCRIPTION_DOWNGRADED',
          updatedUser.creditsBalance
        ).catch(console.error)
        
        await broadcastUserUpdate(
          user.id,
          {
            plan: updatedUser.plan,
            subscriptionStatus: updatedUser.subscriptionStatus,
            creditsLimit: updatedUser.creditsLimit,
            creditsUsed: updatedUser.creditsUsed,
            creditsBalance: updatedUser.creditsBalance
          },
          'SUBSCRIPTION_DOWNGRADED'
        ).catch(console.error)
      }

      await prisma.usageLog.create({
        data: {
          userId: user.id,
          action: 'SUBSCRIPTION_DOWNGRADED_IMMEDIATE',
          creditsUsed: 0,
          details: {
            subscriptionId,
            oldPlan: user.plan,
            newPlan,
            newPrice,
            cycle
          }
        }
      })

      console.log(`⬇️  Subscription downgraded immediately: ${user.plan} → ${newPlan}`)

      return NextResponse.json({
        success: true,
        message: 'Assinatura reduzida com sucesso! Mudanças aplicadas imediatamente.',
        subscription: {
          id: updatedSubscription.id,
          plan: newPlan,
          cycle,
          value: newPrice,
          nextDueDate: updatedSubscription.nextDueDate
        },
        appliedImmediately: true
      })
    } else {
      // Schedule downgrade for end of billing cycle
      // Store the pending downgrade in database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          pendingPlanChange: newPlan,
          pendingCycleChange: cycle
        }
      })

      await prisma.usageLog.create({
        data: {
          userId: user.id,
          action: 'SUBSCRIPTION_DOWNGRADE_SCHEDULED',
          creditsUsed: 0,
          details: {
            subscriptionId,
            currentPlan: user.plan,
            newPlan,
            scheduledFor: currentSubscription.nextDueDate,
            newPrice,
            cycle
          }
        }
      })

      console.log(`📅 Subscription downgrade scheduled: ${user.plan} → ${newPlan} on ${currentSubscription.nextDueDate}`)

      return NextResponse.json({
        success: true,
        message: 'Downgrade agendado para o fim do ciclo atual',
        subscription: {
          id: currentSubscription.id,
          currentPlan: user.plan,
          newPlan,
          cycle,
          newValue: newPrice,
          effectiveDate: currentSubscription.nextDueDate
        },
        appliedImmediately: false,
        scheduledFor: currentSubscription.nextDueDate
      })
    }

  } catch (error: any) {
    console.error('❌ Erro ao fazer downgrade:', error)
    return NextResponse.json({
      error: 'Falha ao fazer downgrade da assinatura',
      message: error.message
    }, { status: 500 })
  }
}