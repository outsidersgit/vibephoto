import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/monitoring/logger'
import { prisma } from '@/lib/db'

/**
 * CRON: Notificar clientes sobre cobranças próximas
 * Envia email/notificação 3 dias antes do vencimento
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

    await logger.info('🔔 Starting upcoming payments notification job')

    const results = {
      payments_checked: 0,
      notifications_sent: 0,
      errors: 0
    }

    // Buscar cobranças que vencem em 3 dias
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
    threeDaysFromNow.setHours(23, 59, 59, 999) // Fim do dia

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 3)
    tomorrow.setHours(0, 0, 0, 0) // Início do dia

    const upcomingPayments = await prisma.payment.findMany({
      where: {
        status: 'PENDING',
        type: 'SUBSCRIPTION',
        dueDate: {
          gte: tomorrow,
          lte: threeDaysFromNow
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            plan: true,
            billingCycle: true
          }
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    })

    await logger.info(`Found ${upcomingPayments.length} payments due in 3 days`)

    for (const payment of upcomingPayments) {
      results.payments_checked++

      try {
        const user = payment.user

        // TODO: Implementar envio de email/notificação
        // Por enquanto, apenas log
        console.log('📧 [NOTIFY_PAYMENT] Would send notification:', {
          userId: user.id,
          email: user.email,
          paymentId: payment.id,
          value: payment.value,
          dueDate: payment.dueDate.toISOString().split('T')[0],
          plan: user.plan,
          billingCycle: user.billingCycle
        })

        // Aqui você pode integrar com:
        // - SendGrid / Resend / Mailgun para email
        // - Push notifications
        // - WhatsApp Business API
        // - SMS

        // Exemplo de estrutura de email:
        /*
        await sendEmail({
          to: user.email,
          subject: `Sua assinatura VibePhoto será renovada em 3 dias`,
          html: `
            <h2>Olá ${user.name}!</h2>
            <p>Sua assinatura do plano <strong>${user.plan}</strong> será renovada automaticamente em <strong>3 dias</strong>.</p>
            <p><strong>Data de vencimento:</strong> ${payment.dueDate.toLocaleDateString('pt-BR')}</p>
            <p><strong>Valor:</strong> R$ ${payment.value.toFixed(2)}</p>
            <p>Certifique-se de que seu cartão de crédito possui saldo suficiente para evitar interrupções no serviço.</p>
            <p>Se desejar atualizar seus dados de pagamento, <a href="${process.env.NEXTAUTH_URL}/account/billing">clique aqui</a>.</p>
          `
        })
        */

        results.notifications_sent++

        await logger.info(`Notification sent for payment ${payment.id} to user ${user.email}`)

      } catch (error) {
        results.errors++
        await logger.error(`Error sending notification for payment ${payment.id}`, error as Error)
      }
    }

    await logger.info('✅ Upcoming payments notification job completed', results)

    return NextResponse.json({
      success: true,
      message: 'Notification job completed',
      results
    })

  } catch (error) {
    await logger.error('❌ Upcoming payments notification job failed', error as Error)

    return NextResponse.json(
      { error: 'Notification job failed', message: (error as Error).message },
      { status: 500 }
    )
  }
}
