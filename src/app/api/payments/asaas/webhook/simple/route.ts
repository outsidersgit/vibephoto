import { NextRequest, NextResponse } from 'next/server'

interface AsaasWebhookPayload {
  event: string
  payment?: {
    id: string
    customer: string
    value: number
    dueDate: string
    status: string
    billingType: string
    subscription?: string
    externalReference?: string
  }
  subscription?: {
    id: string
    customer: string
    status: string
  }
  dateCreated: string
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Basic security validation
    const asaasWebhookToken = process.env.ASAAS_WEBHOOK_TOKEN

    if (asaasWebhookToken) {
      const asaasAccessToken = request.headers.get('asaas-access-token')

      if (!asaasAccessToken || asaasAccessToken !== asaasWebhookToken) {
        return NextResponse.json({ error: 'Invalid access token' }, { status: 401 })
      }
    }

    // Parse and validate body
    const body: AsaasWebhookPayload = await request.json()

    if (!body.event) {
      return NextResponse.json({ error: 'Missing event type' }, { status: 400 })
    }

    // Log the webhook event (for sandbox testing)
    console.log('🔔 Webhook recebido:', {
      event: body.event,
      paymentId: body.payment?.id,
      subscriptionId: body.subscription?.id,
      value: body.payment?.value,
      status: body.payment?.status,
      billingType: body.payment?.billingType,
      timestamp: new Date().toISOString()
    })

    // Basic event processing
    switch (body.event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        console.log('✅ Pagamento confirmado:', {
          id: body.payment?.id,
          value: body.payment?.value,
          billingType: body.payment?.billingType
        })
        break

      case 'PAYMENT_OVERDUE':
        console.log('⚠️ Pagamento em atraso:', body.payment?.id)
        break

      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
        console.log('❌ Pagamento cancelado/estornado:', body.payment?.id)
        break

      default:
        console.log('ℹ️ Evento não processado:', body.event)
    }

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      status: 'processed',
      event: body.event,
      processingTime,
      message: 'Webhook processado com sucesso (modo sandbox)'
    })

  } catch (error: any) {
    console.error('❌ Erro no webhook:', error.message)

    return NextResponse.json(
      { error: 'Internal webhook processing error' },
      { status: 500 }
    )
  }
}