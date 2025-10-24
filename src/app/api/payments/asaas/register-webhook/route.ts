import { NextRequest, NextResponse } from 'next/server'
import { AsaasClient } from '@/lib/payments/asaas'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ASAAS_API_KEY
    const env = process.env.ASAAS_ENVIRONMENT === 'production' ? 'production' : 'sandbox'
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN

    if (!apiKey) {
      return NextResponse.json({ error: 'ASAAS_API_KEY not configured' }, { status: 400 })
    }

    const asaas = new AsaasClient({ apiKey, environment: env })

    const url = `${baseUrl}/api/payments/asaas/webhook`
    const events = [
      'PAYMENT_CREATED',
      'PAYMENT_UPDATED',
      'PAYMENT_CONFIRMED',
      'PAYMENT_RECEIVED',
      'PAYMENT_OVERDUE',
      'PAYMENT_DELETED',
      'PAYMENT_REFUNDED',
      'SUBSCRIPTION_CREATED',
      'SUBSCRIPTION_UPDATED',
      'SUBSCRIPTION_DELETED',
      'SUBSCRIPTION_EXPIRED',
      'SUBSCRIPTION_CANCELLED'
    ]

    const webhook = await asaas.createWebhook({
      name: 'Ensaio Fotos Webhook',
      url,
      events,
      enabled: true,
      interrupted: false,
      authToken: webhookToken || undefined
    })

    return NextResponse.json({ success: true, webhook })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to register webhook' }, { status: 500 })
  }
}



