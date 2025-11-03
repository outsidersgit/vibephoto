import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { asaas } from '@/lib/payments/asaas'
import { prisma } from '@/lib/prisma'
import { updateSubscriptionStatus } from '@/lib/db/subscriptions'

/**
 * Reactivate a cancelled subscription
 * POST /api/asaas/subscriptions/[id]/reactivate
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

    const subscriptionId = params.id

    // Get current subscription from Asaas
    const currentSubscription = await asaas.getSubscription(subscriptionId)

    // Get user to verify ownership
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        asaasCustomerId: true,
        plan: true,
        subscriptionStatus: true
      }
    })

    if (!user || user.asaasCustomerId !== currentSubscription.customer) {
      return NextResponse.json({
        error: 'Assinatura não pertence a este usuário'
      }, { status: 403 })
    }

    // Check if subscription is cancelled
    if (currentSubscription.status !== 'INACTIVE' && user.subscriptionStatus !== 'CANCELLED') {
      return NextResponse.json({
        error: 'Assinatura não está cancelada',
        message: 'Apenas assinaturas canceladas podem ser reativadas'
      }, { status: 400 })
    }

    // Reactivate subscription in Asaas
    // Note: Asaas doesn't have a direct reactivate endpoint,
    // so we need to create a new subscription with the same parameters
    const reactivatedSubscription = await asaas.createSubscription({
      customer: user.asaasCustomerId!,
      billingType: currentSubscription.billingType,
      cycle: currentSubscription.cycle,
      value: currentSubscription.value,
      nextDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
      description: `Reativação - ${user.plan} Plan`,
      externalReference: user.id
    })

    // Update user subscription status
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
        'SUBSCRIPTION_REACTIVATED',
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
        'SUBSCRIPTION_REACTIVATED'
      ).catch(console.error)
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        asaasSubscriptionId: reactivatedSubscription.id
      }
    })

    // Log the reactivation
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        action: 'SUBSCRIPTION_REACTIVATED',
        creditsUsed: 0,
        details: {
          oldSubscriptionId: subscriptionId,
          newSubscriptionId: reactivatedSubscription.id,
          plan: user.plan,
          value: reactivatedSubscription.value,
          nextDueDate: reactivatedSubscription.nextDueDate
        }
      }
    })

    console.log(`✅ Subscription reactivated for user ${user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Assinatura reativada com sucesso!',
      subscription: {
        id: reactivatedSubscription.id,
        plan: user.plan,
        cycle: reactivatedSubscription.cycle,
        value: reactivatedSubscription.value,
        nextDueDate: reactivatedSubscription.nextDueDate,
        status: 'ACTIVE'
      }
    })

  } catch (error: any) {
    console.error('❌ Erro ao reativar assinatura:', error)
    return NextResponse.json({
      error: 'Falha ao reativar assinatura',
      message: error.message
    }, { status: 500 })
  }
}