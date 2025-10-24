import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { asaas } from '@/lib/payments/asaas'

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

    // Get user with subscription info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        plan: true,
        subscriptionId: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
        subscriptionStartedAt: true,
        asaasCustomerId: true,
        creditsBalance: true,
        creditsLimit: true,
        creditsUsed: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    let subscriptionDetails = null
    let nextPayments = []
    let paymentHistory = []

    // If user has an active subscription, get details from Asaas
    if (user.subscriptionId && user.subscriptionStatus !== 'CANCELLED') {
      try {
        // Get subscription details from Asaas
        const asaasSubscription = await asaas.getSubscription(user.subscriptionId)
        
        // Get payment history for this subscription
        const payments = await prisma.payment.findMany({
          where: {
            userId: user.id,
            type: 'SUBSCRIPTION'
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            value: true,
            billingType: true,
            dueDate: true,
            confirmedDate: true,
            createdAt: true,
            description: true
          }
        })

        paymentHistory = payments.map(payment => ({
          ...payment,
          formattedDate: (payment.confirmedDate || payment.createdAt).toLocaleDateString('pt-BR'),
          formattedValue: payment.value.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          })
        }))

        // Calculate next payment date
        const nextDueDate = new Date(asaasSubscription.nextDueDate)
        const today = new Date()
        const daysDiff = Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        subscriptionDetails = {
          id: user.subscriptionId,
          plan: user.plan,
          status: asaasSubscription.status,
          localStatus: user.subscriptionStatus,
          cycle: asaasSubscription.cycle,
          value: asaasSubscription.value,
          nextPayment: asaasSubscription.nextDueDate,
          nextPaymentDays: daysDiff,
          startedAt: user.subscriptionStartedAt,
          endsAt: user.subscriptionEndsAt,
          paymentMethod: getPaymentMethodFromHistory(paymentHistory),
          
          // Format dates for display
          formattedNextPayment: nextDueDate.toLocaleDateString('pt-BR'),
          formattedValue: asaasSubscription.value.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }),
          
          // Status indicators
          isActive: asaasSubscription.status === 'ACTIVE',
          isOverdue: daysDiff < 0,
          willExpireSoon: daysDiff <= 3 && daysDiff >= 0,
          
          // Plan limits
          creditLimit: user.creditsLimit,
          currentCredits: user.creditsBalance,
          usedCredits: user.creditsUsed
        }

        // Get upcoming payments (next 3 months)
        const upcomingMonths = [1, 2, 3]
        nextPayments = upcomingMonths.map(monthsAhead => {
          const paymentDate = new Date(nextDueDate)
          if (asaasSubscription.cycle === 'MONTHLY') {
            paymentDate.setMonth(paymentDate.getMonth() + monthsAhead)
          } else {
            paymentDate.setFullYear(paymentDate.getFullYear() + monthsAhead)
          }
          
          return {
            dueDate: paymentDate.toISOString().split('T')[0],
            formattedDate: paymentDate.toLocaleDateString('pt-BR'),
            value: asaasSubscription.value,
            formattedValue: asaasSubscription.value.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }),
            cycle: asaasSubscription.cycle
          }
        })

      } catch (error) {
        console.error('Error fetching Asaas subscription:', error)
        // Fall back to local data
        subscriptionDetails = {
          id: user.subscriptionId,
          plan: user.plan,
          status: user.subscriptionStatus,
          localStatus: user.subscriptionStatus,
          startedAt: user.subscriptionStartedAt,
          endsAt: user.subscriptionEndsAt,
          error: 'Não foi possível sincronizar com o provedor de pagamento'
        }
      }
    }

    // Calculate subscription metrics
    const subscriptionMetrics = await calculateSubscriptionMetrics(user.id)

    // Get available plans for upgrade/downgrade
    const availablePlans = getAvailablePlans(user.plan)

    // Simple active check for account deletion flow
    const isActive = subscriptionDetails?.isActive ||
                     user.subscriptionStatus === 'ACTIVE' ||
                     (user.subscriptionId && user.subscriptionStatus !== 'CANCELLED')

    return NextResponse.json({
      user: {
        id: user.id,
        plan: user.plan,
        creditsBalance: user.creditsBalance,
        creditsLimit: user.creditsLimit,
        creditsUsed: user.creditsUsed
      },

      subscription: subscriptionDetails,
      nextPayments,
      paymentHistory,

      // Simple flag for account deletion checks
      isActive,
      hasActiveSubscription: isActive,

      // Metrics
      metrics: subscriptionMetrics,

      // Available actions
      availablePlans,
      canUpgrade: availablePlans.upgrades.length > 0,
      canDowngrade: availablePlans.downgrades.length > 0,
      canCancel: subscriptionDetails?.isActive || false,

      // Sync info
      syncedAt: new Date().toISOString(),
      lastSyncStatus: 'success'
    })

  } catch (error: any) {
    console.error('Subscription status error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

async function calculateSubscriptionMetrics(userId: string) {
  // Calculate total subscription payments
  const totalPaid = await prisma.payment.aggregate({
    where: {
      userId,
      type: 'SUBSCRIPTION',
      status: 'CONFIRMED'
    },
    _sum: { value: true },
    _count: { id: true }
  })

  // Calculate this year's payments
  const thisYearPaid = await prisma.payment.aggregate({
    where: {
      userId,
      type: 'SUBSCRIPTION',
      status: 'CONFIRMED',
      confirmedDate: {
        gte: new Date(new Date().getFullYear(), 0, 1)
      }
    },
    _sum: { value: true },
    _count: { id: true }
  })

  // Calculate failed payments
  const failedPayments = await prisma.payment.count({
    where: {
      userId,
      type: 'SUBSCRIPTION',
      status: 'FAILED'
    }
  })

  // Get subscription duration
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionStartedAt: true }
  })

  let subscriptionDays = 0
  if (user?.subscriptionStartedAt) {
    const startDate = new Date(user.subscriptionStartedAt)
    const today = new Date()
    subscriptionDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  }

  return {
    totalPaid: totalPaid._sum.value || 0,
    totalPayments: totalPaid._count.id,
    thisYearPaid: thisYearPaid._sum.value || 0,
    thisYearPayments: thisYearPaid._count.id,
    failedPayments,
    subscriptionDays,
    subscriptionMonths: Math.floor(subscriptionDays / 30),
    avgMonthlySpend: subscriptionDays > 30 
      ? (totalPaid._sum.value || 0) / (subscriptionDays / 30) 
      : 0
  }
}

function getPaymentMethodFromHistory(paymentHistory: any[]): string {
  if (paymentHistory.length === 0) return 'N/A'
  
  // Get the most recent confirmed payment method
  const recentPayment = paymentHistory.find(p => p.status === 'CONFIRMED')
  return recentPayment?.billingType || 'N/A'
}

function getAvailablePlans(currentPlan: string) {
  const plans = ['STARTER', 'PREMIUM', 'GOLD']
  const currentIndex = plans.indexOf(currentPlan)
  
  return {
    current: currentPlan,
    upgrades: currentIndex >= 0 ? plans.slice(currentIndex + 1) : [],
    downgrades: currentIndex > 0 ? plans.slice(0, currentIndex) : [],
    all: plans.map(plan => ({
      name: plan,
      isCurrent: plan === currentPlan,
      isUpgrade: currentIndex >= 0 && plans.indexOf(plan) > currentIndex,
      isDowngrade: currentIndex >= 0 && plans.indexOf(plan) < currentIndex
    }))
  }
}