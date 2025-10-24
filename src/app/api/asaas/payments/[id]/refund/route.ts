import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { asaas } from '@/lib/payments/asaas'
import { prisma } from '@/lib/prisma'

/**
 * Refund a confirmed payment
 * POST /api/asaas/payments/[id]/refund
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

    const paymentId = params.id
    const { value, description } = await request.json()

    // Get current payment
    const currentPayment = await asaas.getPayment(paymentId)

    // Verify ownership
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, asaasCustomerId: true }
    })

    if (!user || user.asaasCustomerId !== currentPayment.customer) {
      return NextResponse.json({
        error: 'Pagamento não pertence a este usuário'
      }, { status: 403 })
    }

    // Only allow refund on confirmed/received payments
    if (!['CONFIRMED', 'RECEIVED'].includes(currentPayment.status)) {
      return NextResponse.json({
        error: 'Apenas pagamentos confirmados podem ser estornados',
        currentStatus: currentPayment.status
      }, { status: 400 })
    }

    // Refund payment (partial or full)
    const refund = await asaas.refundPayment(
      paymentId,
      value, // Optional: partial refund amount
      description || 'Estorno solicitado pelo cliente'
    )

    // Log the refund
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        action: 'PAYMENT_REFUNDED',
        creditsUsed: 0,
        details: {
          paymentId,
          refundValue: value || currentPayment.value,
          originalValue: currentPayment.value,
          description,
          refundId: refund.id
        }
      }
    })

    console.log(`💰 Payment refunded: ${paymentId} - R$ ${value || currentPayment.value}`)

    return NextResponse.json({
      success: true,
      message: 'Estorno realizado com sucesso',
      refund: {
        id: refund.id,
        paymentId,
        value: value || currentPayment.value,
        status: refund.status
      }
    })

  } catch (error: any) {
    console.error('❌ Erro ao estornar pagamento:', error)
    return NextResponse.json({
      error: 'Falha ao estornar pagamento',
      message: error.message
    }, { status: 500 })
  }
}