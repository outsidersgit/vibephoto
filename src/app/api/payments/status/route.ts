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

    const { searchParams } = new URL(request.url)
    const paymentId = searchParams.get('paymentId')
    const subscriptionId = searchParams.get('subscriptionId')

    if (!paymentId && !subscriptionId) {
      return NextResponse.json(
        { error: 'Payment ID ou Subscription ID é obrigatório' },
        { status: 400 }
      )
    }

    let paymentInfo = null
    let subscriptionInfo = null

    // Get payment status
    if (paymentId) {
      try {
        // Check our database first
        const dbPayment = await prisma.payment.findUnique({
          where: { asaasPaymentId: paymentId },
          select: {
            status: true,
            confirmedDate: true,
            overdueDate: true,
            value: true,
            billingType: true,
            user: {
              select: { id: true }
            }
          }
        })

        // Verify payment belongs to current user
        if (dbPayment && dbPayment.user.id !== session.user.id) {
          return NextResponse.json(
            { error: 'Pagamento não pertence ao usuário logado' },
            { status: 403 }
          )
        }

        // Get latest status from Asaas
        const asaasPayment = await asaas.getPayment(paymentId)
        
        paymentInfo = {
          id: paymentId,
          status: asaasPayment.status,
          value: asaasPayment.value,
          dueDate: asaasPayment.dueDate,
          billingType: asaasPayment.billingType,
          confirmedDate: asaasPayment.confirmedDate,
          overdueDate: asaasPayment.overdueDate,
          // Local database info
          localStatus: dbPayment?.status,
          localConfirmedDate: dbPayment?.confirmedDate
        }

        // If payment is confirmed in Asaas but not in our DB, trigger webhook processing
        if (asaasPayment.status === 'CONFIRMED' && dbPayment?.status !== 'CONFIRMED') {
          // Trigger internal webhook processing
          setTimeout(async () => {
            try {
              await fetch(`${process.env.NEXTAUTH_URL}/api/payments/asaas/webhook/enhanced`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN || ''
                },
                body: JSON.stringify({
                  event: 'PAYMENT_CONFIRMED',
                  payment: asaasPayment,
                  dateCreated: new Date().toISOString()
                })
              })
            } catch (error) {
              console.error('Failed to trigger webhook processing:', error)
            }
          }, 100)
        }

      } catch (error) {
        console.error('Error fetching payment:', error)
        paymentInfo = { error: 'Erro ao buscar informações do pagamento' }
      }
    }

    // Get subscription status
    if (subscriptionId) {
      try {
        // Check our database first
        const user = await prisma.user.findUnique({
          where: { 
            id: session.user.id,
            subscriptionId: subscriptionId
          },
          select: {
            subscriptionStatus: true,
            plan: true,
            subscriptionEndsAt: true
          }
        })

        if (!user) {
          return NextResponse.json(
            { error: 'Assinatura não encontrada ou não pertence ao usuário' },
            { status: 404 }
          )
        }

        // Get latest status from Asaas
        const asaasSubscription = await asaas.getSubscription(subscriptionId)
        
        subscriptionInfo = {
          id: subscriptionId,
          status: asaasSubscription.status,
          nextDueDate: asaasSubscription.nextDueDate,
          cycle: asaasSubscription.cycle,
          value: asaasSubscription.value,
          // Local database info
          localStatus: user.subscriptionStatus,
          localPlan: user.plan,
          localEndsAt: user.subscriptionEndsAt
        }

      } catch (error) {
        console.error('Error fetching subscription:', error)
        subscriptionInfo = { error: 'Erro ao buscar informações da assinatura' }
      }
    }

    return NextResponse.json({
      payment: paymentInfo,
      subscription: subscriptionInfo,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Payment status check error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST method to manually sync payment status
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { paymentId, subscriptionId, action } = body

    if (!paymentId && !subscriptionId) {
      return NextResponse.json(
        { error: 'Payment ID ou Subscription ID é obrigatório' },
        { status: 400 }
      )
    }

    if (action === 'sync') {
      // Force sync with Asaas
      try {
        if (paymentId) {
          const asaasPayment = await asaas.getPayment(paymentId)
          
          // Trigger webhook processing to sync
          const webhookResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/payments/asaas/webhook/enhanced`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN || ''
            },
            body: JSON.stringify({
              event: asaasPayment.status === 'CONFIRMED' ? 'PAYMENT_CONFIRMED' : 
                     asaasPayment.status === 'OVERDUE' ? 'PAYMENT_OVERDUE' : 'PAYMENT_UPDATED',
              payment: asaasPayment,
              dateCreated: new Date().toISOString()
            })
          })

          if (webhookResponse.ok) {
            return NextResponse.json({ 
              success: true, 
              message: 'Sincronização iniciada',
              status: asaasPayment.status
            })
          }
        }

        if (subscriptionId) {
          const asaasSubscription = await asaas.getSubscription(subscriptionId)
          
          // Update local subscription info
          await prisma.user.update({
            where: { 
              id: session.user.id,
              subscriptionId: subscriptionId
            },
            data: {
              subscriptionStatus: asaasSubscription.status
            }
          })

          return NextResponse.json({ 
            success: true, 
            message: 'Assinatura sincronizada',
            status: asaasSubscription.status
          })
        }

      } catch (error) {
        console.error('Sync error:', error)
        return NextResponse.json(
          { error: 'Erro durante sincronização' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Ação não suportada' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('Payment sync error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}