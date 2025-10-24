import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'

/**
 * API para verificar status de pagamento
 * GET /api/payments/credits/status/[id]
 *
 * Usado principalmente para polling de pagamentos PIX
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuthAPI()

    const paymentId = params.id

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: 'ID do pagamento é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar status no Asaas
    const response = await fetch(`https://api.asaas.com/v3/payments/${paymentId}`, {
      headers: {
        'access_token': process.env.ASAAS_API_KEY!,
        'User-Agent': 'VibePhoto/1.0'
      }
    })

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'Pagamento não encontrado' },
        { status: 404 }
      )
    }

    const payment = await response.json()

    // Mapear status do Asaas para mensagens amigáveis
    const statusMessages: Record<string, string> = {
      'PENDING': '⏳ Aguardando pagamento...',
      'RECEIVED': '✅ Pagamento recebido! Processando créditos...',
      'CONFIRMED': '✅ Pagamento confirmado! Seus créditos foram adicionados.',
      'OVERDUE': '⚠️ Pagamento vencido',
      'REFUNDED': '💰 Pagamento estornado',
      'RECEIVED_IN_CASH': '✅ Pagamento recebido!',
      'REFUND_REQUESTED': '⏳ Estorno solicitado...',
      'CHARGEBACK_REQUESTED': '⚠️ Contestação iniciada',
      'CHARGEBACK_DISPUTE': '⚠️ Em disputa',
      'AWAITING_CHARGEBACK_REVERSAL': '⏳ Aguardando reversão...',
      'DUNNING_REQUESTED': '⏳ Cobrança em andamento...',
      'DUNNING_RECEIVED': '✅ Cobrança recebida!',
      'AWAITING_RISK_ANALYSIS': '🔍 Em análise de risco...'
    }

    const message = statusMessages[payment.status] || 'Status desconhecido'
    const isPaid = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DUNNING_RECEIVED'].includes(payment.status)
    const isPending = ['PENDING', 'AWAITING_RISK_ANALYSIS', 'DUNNING_REQUESTED'].includes(payment.status)

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        value: payment.value,
        netValue: payment.netValue,
        billingType: payment.billingType,
        dueDate: payment.dueDate,
        paymentDate: payment.paymentDate,
        confirmedDate: payment.confirmedDate,
        description: payment.description
      },
      message,
      isPaid,
      isPending
    })

  } catch (error: any) {
    console.error('Payment status check error:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Erro ao verificar status do pagamento' },
      { status: 500 }
    )
  }
}
