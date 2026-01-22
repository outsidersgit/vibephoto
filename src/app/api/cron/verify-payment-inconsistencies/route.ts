import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/monitoring/logger'
import { prisma } from '@/lib/db'
import { updateSubscriptionStatus } from '@/lib/db/subscriptions'

/**
 * CRON: Verificar inconsistências entre pagamentos e status de assinatura
 * Roda diariamente para detectar e corrigir:
 * - Usuários ACTIVE com último pagamento OVERDUE
 * - Pagamentos PENDING que deveriam estar OVERDUE (passaram da data de vencimento)
 * - Usuários ACTIVE sem cobranças registradas no banco
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await logger.info('🔍 Starting payment inconsistency verification job')

    const results = {
      active_users_with_overdue: 0,
      pending_payments_now_overdue: 0,
      active_users_without_payments: 0,
      errors: 0
    }

    const now = new Date()

    // Check 1: Usuários ACTIVE mas com último pagamento OVERDUE
    const usersWithOverduePayments = await prisma.user.findMany({
      where: {
        subscriptionStatus: 'ACTIVE',
        subscriptionId: { not: null }
      },
      select: {
        id: true,
        email: true,
        plan: true,
        subscriptionId: true,
        payments: {
          where: {
            type: 'SUBSCRIPTION'
          },
          orderBy: {
            dueDate: 'desc'
          },
          take: 1
        }
      }
    })

    for (const user of usersWithOverduePayments) {
      try {
        const lastPayment = user.payments[0]

        // Se o último pagamento está OVERDUE, o usuário não deveria estar ACTIVE
        if (lastPayment && lastPayment.status === 'OVERDUE') {
          await logger.warn(`User ${user.email} is ACTIVE but last payment is OVERDUE`, {
            userId: user.id,
            paymentId: lastPayment.id,
            dueDate: lastPayment.dueDate
          })

          // Bloquear acesso do usuário
          await updateSubscriptionStatus(user.id, 'OVERDUE')
          results.active_users_with_overdue++
        }
      } catch (error) {
        results.errors++
        await logger.error(`Error checking payments for user ${user.email}`, error as Error)
      }
    }

    // Check 2: Pagamentos PENDING que já passaram da data de vencimento
    const overduePayments = await prisma.payment.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          lt: now
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            subscriptionStatus: true
          }
        }
      }
    })

    for (const payment of overduePayments) {
      try {
        await logger.warn(`Payment ${payment.id} is PENDING but past due date`, {
          paymentId: payment.id,
          userId: payment.userId,
          userEmail: payment.user.email,
          dueDate: payment.dueDate,
          daysPastDue: Math.floor((now.getTime() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        })

        // Marcar pagamento como OVERDUE
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'OVERDUE' }
        })

        // Se for pagamento de assinatura, bloquear usuário
        if (payment.type === 'SUBSCRIPTION' && payment.user.subscriptionStatus === 'ACTIVE') {
          await updateSubscriptionStatus(payment.userId, 'OVERDUE')
        }

        results.pending_payments_now_overdue++
      } catch (error) {
        results.errors++
        await logger.error(`Error marking payment ${payment.id} as overdue`, error as Error)
      }
    }

    // Check 3: Usuários ACTIVE sem cobranças registradas no banco
    const activeUsersWithoutPayments = await prisma.user.findMany({
      where: {
        subscriptionStatus: 'ACTIVE',
        subscriptionId: { not: null },
        payments: {
          none: {
            type: 'SUBSCRIPTION'
          }
        }
      },
      select: {
        id: true,
        email: true,
        plan: true,
        subscriptionId: true,
        subscriptionStartedAt: true
      }
    })

    for (const user of activeUsersWithoutPayments) {
      await logger.warn(`User ${user.email} is ACTIVE with subscriptionId but has no payments in database`, {
        userId: user.id,
        subscriptionId: user.subscriptionId,
        subscriptionStartedAt: user.subscriptionStartedAt
      })

      results.active_users_without_payments++
    }

    await logger.info('✅ Payment inconsistency verification job completed', results)

    return NextResponse.json({
      success: true,
      message: 'Payment inconsistency verification completed',
      results
    })

  } catch (error) {
    await logger.error('❌ Payment inconsistency verification job failed', error as Error)

    return NextResponse.json(
      { error: 'Payment inconsistency verification failed', message: (error as Error).message },
      { status: 500 }
    )
  }
}
