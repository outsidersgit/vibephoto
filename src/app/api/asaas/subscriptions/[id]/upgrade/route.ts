import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { asaas, getPlanPrice } from '@/lib/payments/asaas'
import { prisma } from '@/lib/prisma'
import { updateSubscriptionStatus } from '@/lib/db/subscriptions'

/**
 * Upgrade user subscription to a higher plan
 * POST /api/asaas/subscriptions/[id]/upgrade
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

    const { newPlan, cycle } = await request.json()

    if (!newPlan || !cycle) {
      return NextResponse.json({
        error: 'Plano e ciclo são obrigatórios',
        message: 'Envie: { "newPlan": "PREMIUM" | "GOLD", "cycle": "MONTHLY" | "YEARLY" }'
      }, { status: 400 })
    }

    const subscriptionId = params.id

    // Validate plan upgrade (can only upgrade, not downgrade)
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

    if (newPlanIndex <= currentPlanIndex) {
      return NextResponse.json({
        error: 'Upgrade inválido',
        message: 'Para downgrade, use o endpoint /downgrade'
      }, { status: 400 })
    }

    // Calculate new price
    const newPrice = getPlanPrice(newPlan, cycle)

    // Update subscription in Asaas
    const cycleMapping: Record<string, 'MONTHLY' | 'YEARLY'> = {
      'MONTHLY': 'MONTHLY',
      'YEARLY': 'YEARLY'
    }

    const updatedSubscription = await asaas.updateSubscription(subscriptionId, {
      value: newPrice,
      cycle: cycleMapping[cycle],
      updatePendingPayments: true // Apply immediately to pending payments
    })

    // Update user plan in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: newPlan,
        subscriptionCycle: cycle
      }
    })

    await updateSubscriptionStatus(user.id, 'ACTIVE')

    // Log the upgrade
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        action: 'SUBSCRIPTION_UPGRADED',
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

    console.log(`✅ Subscription upgraded: ${user.plan} → ${newPlan}`)

    return NextResponse.json({
      success: true,
      message: 'Assinatura atualizada com sucesso!',
      subscription: {
        id: updatedSubscription.id,
        plan: newPlan,
        cycle,
        value: newPrice,
        nextDueDate: updatedSubscription.nextDueDate
      }
    })

  } catch (error: any) {
    console.error('❌ Erro ao fazer upgrade:', error)
    return NextResponse.json({
      error: 'Falha ao fazer upgrade da assinatura',
      message: error.message
    }, { status: 500 })
  }
}