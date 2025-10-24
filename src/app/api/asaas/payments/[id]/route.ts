import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { asaas } from '@/lib/payments/asaas'
import { prisma } from '@/lib/prisma'

/**
 * Get payment details
 * GET /api/asaas/payments/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const paymentId = params.id

    // Get payment from Asaas
    const payment = await asaas.getPayment(paymentId)

    // Verify ownership
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { asaasCustomerId: true }
    })

    if (!user || user.asaasCustomerId !== payment.customer) {
      return NextResponse.json({
        error: 'Pagamento não pertence a este usuário'
      }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      payment
    })

  } catch (error: any) {
    console.error('❌ Erro ao buscar pagamento:', error)
    return NextResponse.json({
      error: 'Falha ao buscar pagamento',
      message: error.message
    }, { status: 500 })
  }
}

/**
 * Update payment (change due date or value)
 * PUT /api/asaas/payments/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const paymentId = params.id
    const { dueDate, value, description } = await request.json()

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

    // Only allow updates on pending payments
    if (currentPayment.status !== 'PENDING') {
      return NextResponse.json({
        error: 'Apenas pagamentos pendentes podem ser atualizados',
        currentStatus: currentPayment.status
      }, { status: 400 })
    }

    // Update payment
    const updatedPayment = await asaas.updatePayment(paymentId, {
      dueDate,
      value,
      description
    })

    // Log the update
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        action: 'PAYMENT_UPDATED',
        creditsUsed: 0,
        details: {
          paymentId,
          changes: { dueDate, value, description }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Pagamento atualizado com sucesso',
      payment: updatedPayment
    })

  } catch (error: any) {
    console.error('❌ Erro ao atualizar pagamento:', error)
    return NextResponse.json({
      error: 'Falha ao atualizar pagamento',
      message: error.message
    }, { status: 500 })
  }
}

/**
 * Delete/Cancel payment
 * DELETE /api/asaas/payments/[id]
 */
export async function DELETE(
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

    // Cancel payment
    await asaas.cancelPayment(paymentId)

    // Log the cancellation
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        action: 'PAYMENT_CANCELLED',
        creditsUsed: 0,
        details: {
          paymentId,
          value: currentPayment.value,
          status: currentPayment.status
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Pagamento cancelado com sucesso'
    })

  } catch (error: any) {
    console.error('❌ Erro ao cancelar pagamento:', error)
    return NextResponse.json({
      error: 'Falha ao cancelar pagamento',
      message: error.message
    }, { status: 500 })
  }
}