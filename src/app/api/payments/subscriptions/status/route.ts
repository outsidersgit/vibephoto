import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { subscriptionService } from '@/lib/services/subscription-service'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Verify user authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Get user subscription info from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        subscriptionId: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
        plan: true,
        asaasCustomerId: true,
        creditsBalance: true,
        creditsUsed: true,
        creditsLimit: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // If no subscription, return basic info
    if (!user.subscriptionId) {
      return NextResponse.json({
        hasSubscription: false,
        plan: user.plan || 'STARTER',
        status: 'INACTIVE',
        credits: {
          balance: user.creditsBalance || 0,
          used: user.creditsUsed || 0,
          limit: user.creditsLimit || 10
        }
      })
    }

    // Get detailed subscription info from Asaas
    const subscriptionResult = await subscriptionService.getSubscription(user.subscriptionId)
    
    if (!subscriptionResult.success) {
      return NextResponse.json({
        hasSubscription: true,
        subscriptionId: user.subscriptionId,
        status: 'ERROR',
        plan: user.plan,
        error: 'Não foi possível obter informações da assinatura',
        credits: {
          balance: user.creditsBalance || 0,
          used: user.creditsUsed || 0,
          limit: user.creditsLimit || 10
        }
      })
    }

    const subscription = subscriptionResult.subscription
    const subscriptionDisplay = subscriptionService.formatSubscriptionDisplay(subscription)

    // Get recent payments for this subscription
    const paymentsResult = await subscriptionService.getSubscriptionPayments(user.subscriptionId)
    const recentPayments = paymentsResult.success ? 
      (paymentsResult.payments || []).slice(0, 3).map((payment: any) => ({
        id: payment.id,
        value: payment.value,
        status: payment.status,
        billingType: payment.billingType,
        dueDate: new Date(payment.dueDate).toLocaleDateString('pt-BR'),
        confirmedDate: payment.confirmedDate ? 
          new Date(payment.confirmedDate).toLocaleDateString('pt-BR') : null
      })) : []

    // Calculate subscription metrics
    const nextDueDate = new Date(subscription.nextDueDate)
    const now = new Date()
    const daysUntilDue = Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    // Get plan benefits
    const planBenefits = subscriptionService.getPlanBenefits(user.plan as 'STARTER' | 'PREMIUM' | 'GOLD')

    // Check if subscription needs attention
    const needsAttention = ['OVERDUE', 'EXPIRED'].includes(subscription.status)
    const isActive = subscription.status === 'ACTIVE'

    return NextResponse.json({
      hasSubscription: true,
      subscriptionId: user.subscriptionId,
      customerId: user.asaasCustomerId,
      
      // Subscription details
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan: subscriptionDisplay.plan,
        cycle: subscription.cycle,
        value: subscription.value,
        billingType: subscription.billingType,
        nextDueDate: subscriptionDisplay.nextDueDate,
        daysUntilDue,
        isActive,
        canCancel: subscriptionDisplay.canCancel,
        needsAttention
      },

      // Plan information
      plan: {
        current: user.plan,
        benefits: planBenefits,
        canUpgrade: user.plan !== 'GOLD',
        canDowngrade: user.plan !== 'STARTER'
      },

      // Credits information
      credits: {
        balance: user.creditsBalance || 0,
        used: user.creditsUsed || 0,
        limit: user.creditsLimit || 10,
        usagePercentage: user.creditsLimit ? 
          Math.round(((user.creditsUsed || 0) / user.creditsLimit) * 100) : 0
      },

      // Recent payments
      recentPayments,

      // Action items or warnings
      alerts: needsAttention ? [{
        type: 'warning',
        title: subscription.status === 'OVERDUE' ? 'Pagamento em Atraso' : 'Assinatura Expirada',
        message: subscription.status === 'OVERDUE' ? 
          'Seu pagamento está em atraso. Regularize para manter o acesso.' :
          'Sua assinatura expirou. Renove para continuar usando o serviço.',
        action: subscription.status === 'OVERDUE' ? 'Pagar Agora' : 'Renovar'
      }] : daysUntilDue <= 3 && isActive ? [{
        type: 'info',
        title: 'Renovação Próxima',
        message: `Sua assinatura será renovada em ${daysUntilDue} dia${daysUntilDue !== 1 ? 's' : ''}`,
        action: null
      }] : []
    })

  } catch (error: any) {
    console.error('Subscription status error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}