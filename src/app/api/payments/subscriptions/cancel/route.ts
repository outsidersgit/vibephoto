import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { subscriptionService } from '@/lib/services/subscription-service'
import { prisma } from '@/lib/db'

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
    const { subscriptionId, reason } = body

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'ID da assinatura é obrigatório' },
        { status: 400 }
      )
    }

    // Get user from database to verify subscription ownership
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { subscriptionId: true, asaasCustomerId: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Verify subscription belongs to user
    if (user.subscriptionId !== subscriptionId) {
      return NextResponse.json(
        { error: 'Esta assinatura não pertence ao usuário logado' },
        { status: 403 }
      )
    }

    // Cancel subscription in Asaas
    const cancelResult = await subscriptionService.cancelSubscription(subscriptionId)

    if (!cancelResult.success) {
      return NextResponse.json(
        { error: cancelResult.error },
        { status: 400 }
      )
    }

    // Update user subscription status in database
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        subscriptionStatus: 'CANCELLED',
        subscriptionEndsAt: new Date() // Set end date to now for immediate cancellation
      }
    })

    // Log the cancellation
    await prisma.usageLog.create({
      data: {
        userId: session.user.id,
        action: 'SUBSCRIPTION_CANCELLED',
        creditsUsed: 0,
        details: {
          subscriptionId,
          reason: reason || 'No reason provided',
          cancelledAt: new Date().toISOString()
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Assinatura cancelada com sucesso',
      subscriptionId,
      cancelledAt: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Subscription cancellation error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET method to check cancellation eligibility
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const subscriptionId = searchParams.get('subscriptionId')

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'ID da assinatura é obrigatório' },
        { status: 400 }
      )
    }

    // Get subscription details
    const subscriptionResult = await subscriptionService.getSubscription(subscriptionId)

    if (!subscriptionResult.success) {
      return NextResponse.json(
        { error: subscriptionResult.error },
        { status: 400 }
      )
    }

    const subscription = subscriptionResult.subscription

    // Check if cancellation is allowed
    const canCancel = ['ACTIVE', 'OVERDUE'].includes(subscription.status)
    const nextBillingDate = new Date(subscription.nextDueDate)
    const now = new Date()
    const daysUntilBilling = Math.ceil((nextBillingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return NextResponse.json({
      canCancel,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        nextBillingDate: nextBillingDate.toLocaleDateString('pt-BR'),
        daysUntilBilling: Math.max(0, daysUntilBilling),
        value: subscription.value,
        cycle: subscription.cycle
      },
      cancellationInfo: {
        immediate: subscription.status !== 'ACTIVE',
        billingCycleEnd: subscription.status === 'ACTIVE',
        refundEligible: daysUntilBilling > 7 && subscription.cycle === 'YEARLY'
      }
    })

  } catch (error: any) {
    console.error('Cancellation check error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}