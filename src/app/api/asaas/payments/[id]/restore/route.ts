import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { asaas } from '@/lib/payments/asaas'
import { prisma } from '@/lib/prisma'

/**
 * Restore a deleted/cancelled payment
 * POST /api/asaas/payments/[id]/restore
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

    // Only allow restore on deleted payments
    if (currentPayment.status !== 'DELETED') {
      return NextResponse.json({
        error: 'Apenas pagamentos deletados podem ser restaurados',
        currentStatus: currentPayment.status
      }, { status: 400 })
    }

    // Restore payment
    const restoredPayment = await asaas.restorePayment(paymentId)

    // Log the restoration
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        action: 'PAYMENT_RESTORED',
        creditsUsed: 0,
        details: {
          paymentId,
          value: currentPayment.value,
          dueDate: restoredPayment.dueDate
        }
      }
    })

    console.log(`🔄 Payment restored: ${paymentId}`)

    return NextResponse.json({
      success: true,
      message: 'Pagamento restaurado com sucesso',
      payment: {
        id: restoredPayment.id,
        status: restoredPayment.status,
        value: restoredPayment.value,
        dueDate: restoredPayment.dueDate
      }
    })

  } catch (error: any) {
    console.error('❌ Erro ao restaurar pagamento:', error)
    return NextResponse.json({
      error: 'Falha ao restaurar pagamento',
      message: error.message
    }, { status: 500 })
  }
}