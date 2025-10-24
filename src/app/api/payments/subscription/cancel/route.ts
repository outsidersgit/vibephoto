import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { asaas } from '@/lib/payments/asaas'

export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { subscriptionId, reason, cancelImmediately = false } = body

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'ID da assinatura é obrigatório' },
        { status: 400 }
      )
    }

    // Verify subscription belongs to user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        subscriptionId: true,
        subscriptionStatus: true,
        plan: true,
        asaasCustomerId: true
      }
    })

    if (!user || user.subscriptionId !== subscriptionId) {
      return NextResponse.json(
        { error: 'Assinatura não encontrada ou não pertence ao usuário' },
        { status: 404 }
      )
    }

    if (user.subscriptionStatus === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Assinatura já está cancelada' },
        { status: 400 }
      )
    }

    try {
      // Cancel subscription in Asaas
      const asaasResponse = await asaas.cancelSubscription(subscriptionId)
      
      // Update user in database
      const cancelDate = new Date()
      const subscriptionEndsAt = cancelImmediately 
        ? cancelDate 
        : new Date(asaasResponse.nextDueDate) // Let it run until next billing cycle

      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: 'CANCELLED',
          subscriptionEndsAt,
          subscriptionCancelledAt: cancelDate,
          // Reset to STARTER plan if cancelling immediately
          ...(cancelImmediately && {
            plan: 'STARTER',
            creditsLimit: 500 // STARTER plan monthly limit
          })
        }
      })

      // Log the cancellation
      await prisma.usageLog.create({
        data: {
          userId: user.id,
          action: 'SUBSCRIPTION_CANCELLED',
          creditsUsed: 0,
          details: {
            subscriptionId,
            reason: reason || 'Cancelado pelo usuário',
            cancelImmediately,
            previousPlan: user.plan,
            cancelledAt: cancelDate.toISOString(),
            endsAt: subscriptionEndsAt.toISOString()
          }
        }
      })

      // Create system log for tracking
      await prisma.systemLog.create({
        data: {
          level: 'INFO',
          category: 'subscription',
          message: 'Subscription cancelled',
          userId: user.id,
          metadata: {
            subscriptionId,
            asaasResponse: {
              id: asaasResponse.id,
              status: asaasResponse.status,
              nextDueDate: asaasResponse.nextDueDate
            },
            cancellationReason: reason,
            cancelImmediately
          }
        }
      })

      // Send cancellation confirmation email (if email service is configured)
      try {
        // This would be implemented when email service is added
        // await sendCancellationEmail(user.email, subscriptionDetails)
      } catch (emailError) {
        console.error('Failed to send cancellation email:', emailError)
        // Don't fail the cancellation if email fails
      }

      return NextResponse.json({
        success: true,
        message: cancelImmediately 
          ? 'Assinatura cancelada imediatamente' 
          : 'Assinatura será cancelada no final do período de cobrança',
        subscription: {
          id: subscriptionId,
          status: 'CANCELLED',
          cancelledAt: cancelDate.toISOString(),
          endsAt: subscriptionEndsAt.toISOString(),
          remainingDays: cancelImmediately 
            ? 0 
            : Math.ceil((subscriptionEndsAt.getTime() - cancelDate.getTime()) / (1000 * 60 * 60 * 24))
        },
        nextSteps: [
          cancelImmediately 
            ? 'Sua conta foi alterada para o plano gratuito' 
            : `Sua assinatura permanecerá ativa até ${subscriptionEndsAt.toLocaleDateString('pt-BR')}`,
          'Você pode reativar sua assinatura a qualquer momento',
          'Seus dados e modelos treinados serão mantidos'
        ]
      })

    } catch (asaasError: any) {
      console.error('Error cancelling subscription in Asaas:', asaasError)
      
      // If Asaas cancellation fails but subscription should be cancelled locally
      // (e.g., payment failures), we can still cancel locally
      if (asaasError.message?.includes('not found') || asaasError.status === 404) {
        // Subscription doesn't exist in Asaas, cancel locally
        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscriptionStatus: 'CANCELLED',
            subscriptionEndsAt: new Date(),
            subscriptionCancelledAt: new Date(),
            subscriptionId: null
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Assinatura cancelada (sincronizada localmente)',
          warning: 'A assinatura não foi encontrada no provedor de pagamento'
        })
      }

      return NextResponse.json(
        { error: `Erro ao cancelar assinatura: ${asaasError.message}` },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Subscription cancellation error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET method to get cancellation information
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        subscriptionId: true,
        subscriptionStatus: true,
        plan: true,
        subscriptionEndsAt: true,
        subscriptionCancelledAt: true
      }
    })

    if (!user?.subscriptionId) {
      return NextResponse.json(
        { error: 'Nenhuma assinatura ativa encontrada' },
        { status: 404 }
      )
    }

    // Get subscription details from Asaas
    let subscriptionDetails = null
    try {
      subscriptionDetails = await asaas.getSubscription(user.subscriptionId)
    } catch (error) {
      console.error('Error fetching subscription for cancellation info:', error)
    }

    // Calculate what happens after cancellation
    const today = new Date()
    const nextBillingDate = subscriptionDetails?.nextDueDate 
      ? new Date(subscriptionDetails.nextDueDate)
      : null

    const cancellationInfo = {
      canCancel: user.subscriptionStatus === 'ACTIVE',
      currentPlan: user.plan,
      
      // Immediate cancellation
      immediateEffect: {
        planChangeTo: 'STARTER',
        creditsLimitChangeTo: 500,
        featuresLost: getFeatureDifferences(user.plan, 'STARTER')
      },

      // End-of-period cancellation
      endOfPeriodEffect: {
        accessUntil: nextBillingDate?.toLocaleDateString('pt-BR') || 'N/A',
        daysRemaining: nextBillingDate 
          ? Math.ceil((nextBillingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : 0,
        planChangeTo: 'STARTER',
        creditsLimitChangeTo: 500
      },

      // What's kept after cancellation
      dataRetention: {
        modelsKept: true,
        generationsKept: true,
        accountKept: true,
        reactivationPossible: true
      },

      // Financial info
      financial: {
        currentValue: subscriptionDetails?.value || 0,
        nextChargeDate: nextBillingDate?.toLocaleDateString('pt-BR') || 'N/A',
        refundPolicy: 'Não há reembolso de pagamentos já realizados',
        futureCharges: 'Cobranças futuras serão interrompidas'
      }
    }

    return NextResponse.json(cancellationInfo)

  } catch (error: any) {
    console.error('Get cancellation info error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

function getFeatureDifferences(fromPlan: string, toPlan: string): string[] {
  const planFeatures: Record<string, string[]> = {
    STARTER: ['500 créditos/mês', '1 modelo IA', 'Qualidade básica'],
    PREMIUM: ['1200 créditos/mês', '3 modelos IA', 'Qualidade alta', 'Suporte prioritário'],
    GOLD: ['2500 créditos/mês', '20 modelos IA', 'Qualidade máxima', 'Suporte VIP', 'Recursos exclusivos']
  }

  const fromFeatures = planFeatures[fromPlan] || []
  const toFeatures = planFeatures[toPlan] || []

  return fromFeatures.filter(feature => !toFeatures.includes(feature))
}