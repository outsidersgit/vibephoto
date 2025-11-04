import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { asaas, handleAsaasError } from '@/lib/payments/asaas'
import { updateSubscriptionStatus } from '@/lib/db/subscriptions'
import { broadcastCreditsUpdate, broadcastUserUpdate } from '@/lib/services/realtime-service'
import crypto from 'crypto'

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
  checkout?: {
    id: string
    customer: string
    status: string
    subscription?: {
      cycle: string
      nextDueDate: string
    }
    items?: Array<{ name: string; value: number; description?: string }>
  }
  dateCreated: string
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let webhookEvent: any = null

  try {
    // 1. Security validation
    const securityResult = await validateWebhookSecurity(request)
    if (!securityResult.isValid) {
      return NextResponse.json({ error: securityResult.error }, { status: securityResult.status })
    }

    const body: AsaasWebhookPayload = securityResult.body

    // 2. Create idempotency key
    const idempotencyKey = generateIdempotencyKey(body)

    // 3. Check for duplicate processing
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { idempotencyKey }
    })

    if (existingEvent?.processed) {
      console.log('Webhook already processed:', idempotencyKey)
      return NextResponse.json({ status: 'already_processed', eventId: existingEvent.id })
    }

    // 4. Create/update webhook event record
    webhookEvent = await prisma.webhookEvent.upsert({
      where: { idempotencyKey },
      create: {
        event: body.event,
        asaasPaymentId: body.payment?.id,
        asaasSubscriptionId: body.subscription?.id,
        asaasCustomerId: body.payment?.customer || body.subscription?.customer,
        idempotencyKey,
        rawPayload: body,
        processed: false,
        receivedAt: new Date()
      },
      update: {
        retryCount: { increment: 1 },
        lastRetryAt: new Date(),
        rawPayload: body
      }
    })

    // 5. Process the webhook
    const processingResult = await processWebhookEvent(body)

    // 6. Update webhook event status
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        processed: processingResult.success,
        processedAt: processingResult.success ? new Date() : null,
        processingError: processingResult.error
      }
    })

    const processingTime = Date.now() - startTime
    console.log(`Webhook processed in ${processingTime}ms:`, {
      event: body.event,
      success: processingResult.success,
      paymentId: body.payment?.id,
      subscriptionId: body.subscription?.id
    })

    if (processingResult.success) {
      return NextResponse.json({ 
        status: 'processed', 
        eventId: webhookEvent.id,
        processingTime 
      })
    } else {
      return NextResponse.json(
        { 
          error: processingResult.error, 
          eventId: webhookEvent.id,
          retryable: processingResult.retryable 
        }, 
        { status: processingResult.retryable ? 422 : 400 }
      )
    }

  } catch (error: any) {
    console.error('Webhook processing failed:', error)

    // Log error to webhook event if it exists
    if (webhookEvent) {
      try {
        await prisma.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            processed: false,
            processingError: error.message,
            retryCount: { increment: 1 },
            lastRetryAt: new Date()
          }
        })
      } catch (logError) {
        console.error('Failed to log webhook error:', logError)
      }
    }

    return NextResponse.json(
      { error: 'Internal webhook processing error' },
      { status: 500 }
    )
  }
}

async function validateWebhookSecurity(request: NextRequest): Promise<{
  isValid: boolean
  body?: AsaasWebhookPayload
  error?: string
  status?: number
}> {
  try {
    // Check for Asaas access token
    const asaasWebhookToken = process.env.ASAAS_WEBHOOK_TOKEN
    
    if (asaasWebhookToken) {
      const asaasAccessToken = request.headers.get('asaas-access-token')
      
      if (!asaasAccessToken || asaasAccessToken !== asaasWebhookToken) {
        return { isValid: false, error: 'Invalid access token', status: 401 }
      }
    } else {
      console.warn('ASAAS_WEBHOOK_TOKEN not configured - webhook not secured')
    }

    // Parse and validate body
    const body = await request.json()
    
    if (!body.event) {
      return { isValid: false, error: 'Missing event type', status: 400 }
    }

    // Additional validation for required fields
    if (!body.payment && !body.subscription) {
      return { isValid: false, error: 'Missing payment or subscription data', status: 400 }
    }

    return { isValid: true, body }

  } catch (error) {
    return { isValid: false, error: 'Invalid JSON payload', status: 400 }
  }
}

function generateIdempotencyKey(payload: AsaasWebhookPayload): string {
  // Create a unique key based on event type, payment/subscription ID, and timestamp
  const keyData = {
    event: payload.event,
    paymentId: payload.payment?.id,
    subscriptionId: payload.subscription?.id,
    dateCreated: payload.dateCreated
  }
  
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(keyData))
    .digest('hex')
}

async function processWebhookEvent(payload: AsaasWebhookPayload): Promise<{
  success: boolean
  error?: string
  retryable?: boolean
}> {
  try {
    switch (payload.event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        return await handlePaymentSuccess(payload.payment!)
        
      case 'CHECKOUT_PAID':
        return await handleCheckoutPaid(payload.checkout!)
        
      case 'PAYMENT_OVERDUE':
        return await handlePaymentOverdue(payload.payment!)
        
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
        return await handlePaymentCancelled(payload.payment!)
        
      case 'SUBSCRIPTION_EXPIRED':
        return await handleSubscriptionExpired(payload.subscription!)
        
      case 'SUBSCRIPTION_CANCELLED':
        return await handleSubscriptionCancelled(payload.subscription!)
        
      case 'SUBSCRIPTION_REACTIVATED':
        return await handleSubscriptionReactivated(payload.subscription!)

      default:
        console.log('Unhandled webhook event:', payload.event)
        return { success: true } // Don't retry unknown events
    }
    
  } catch (error: any) {
    console.error(`Error processing ${payload.event}:`, error)
    
    // Determine if error is retryable
    const isRetryable = !error.message?.includes('not found') && 
                       !error.message?.includes('invalid') &&
                       !error.message?.includes('duplicate')
    
    return { 
      success: false, 
      error: error.message, 
      retryable: isRetryable 
    }
  }
}

async function handleCheckoutPaid(checkout: AsaasWebhookPayload['checkout']): Promise<{
  success: boolean
  error?: string
  retryable?: boolean
}> {
  if (!checkout) {
    return { success: false, error: 'Missing checkout data', retryable: false }
  }

  console.log('='.repeat(80))
  console.log('🔔 [WEBHOOK] PROCESSANDO CHECKOUT_PAID')
  console.log('📦 Dados do checkout recebido:', {
    id: checkout.id,
    customer: checkout.customer,
    status: checkout.status,
    subscription: checkout.subscription,
    items: checkout.items
  })
  console.log('='.repeat(80))

  try {
    // Find user by Asaas customer ID
    const user = await prisma.user.findUnique({
      where: { asaasCustomerId: checkout.customer },
      select: { 
        id: true, 
        plan: true,
        billingCycle: true,
        subscriptionId: true,
        creditsBalance: true,
        email: true,
        name: true
      }
    })

    if (!user) {
      console.error('❌ [WEBHOOK] User not found for checkout:', checkout.id, 'customer:', checkout.customer)
      return { success: false, error: 'User not found', retryable: false }
    }

    console.log('✅ [WEBHOOK] Usuário encontrado:', {
      userId: user.id,
      email: user.email,
      name: user.name,
      currentPlan: user.plan,
      currentBillingCycle: user.billingCycle,
      subscriptionId: user.subscriptionId
    })

    // Se é um checkout de assinatura (tem subscription)
    if (checkout.subscription) {
      console.log('📋 [WEBHOOK] É um checkout de assinatura (subscription):', checkout.subscription)

      // PRIORIDADE 1: Buscar plan e billingCycle da tabela users (já salvos no checkout)
      let plan: 'STARTER' | 'PREMIUM' | 'GOLD' | undefined = undefined
      let billingCycle: 'MONTHLY' | 'YEARLY' | undefined = undefined
      let currentPeriodEnd: Date | undefined = undefined

      if (user.plan) {
        plan = user.plan as any
        console.log('✅ [WEBHOOK] Plan encontrado na tabela users:', plan)
      }
      if (user.billingCycle === 'MONTHLY' || user.billingCycle === 'YEARLY') {
        billingCycle = user.billingCycle as any
        console.log('✅ [WEBHOOK] billingCycle encontrado na tabela users:', billingCycle)
      }

      // PRIORIDADE 2: Se não encontrou, extrair do checkout.subscription.cycle
      if (!billingCycle && checkout.subscription.cycle) {
        const cycle = checkout.subscription.cycle.toUpperCase()
        if (cycle === 'MONTHLY' || cycle === 'YEARLY') {
          billingCycle = cycle as any
          console.log('✅ [WEBHOOK] billingCycle extraído do checkout.subscription.cycle:', billingCycle)
        }
      }

      // Calcular currentPeriodEnd se nextDueDate estiver disponível
      if (checkout.subscription.nextDueDate) {
        try {
          currentPeriodEnd = new Date(checkout.subscription.nextDueDate)
          console.log('✅ [WEBHOOK] currentPeriodEnd calculado:', currentPeriodEnd.toISOString())
        } catch (error) {
          console.warn('⚠️ [WEBHOOK] Erro ao parsear nextDueDate:', error)
        }
      }

      // PRIORIDADE 3: Se ainda não tem plan, tentar extrair dos items do checkout
      if (!plan && checkout.items && checkout.items.length > 0) {
        // Tentar extrair plan do nome ou descrição do item
        const itemName = checkout.items[0].name?.toLowerCase() || ''
        const itemDescription = checkout.items[0].description?.toLowerCase() || ''
        const combined = `${itemName} ${itemDescription}`
        
        if (combined.includes('starter')) {
          plan = 'STARTER'
        } else if (combined.includes('premium')) {
          plan = 'PREMIUM'
        } else if (combined.includes('gold')) {
          plan = 'GOLD'
        }
        
        if (plan) {
          console.log('✅ [WEBHOOK] Plan extraído dos items do checkout:', plan)
        }
      }

      // CRÍTICO: Verificar se temos plan antes de chamar updateSubscriptionStatus
      if (!plan) {
        console.error('❌ [WEBHOOK] CRÍTICO: Não foi possível determinar o plan do checkout!')
        console.error('❌ [WEBHOOK] Dados disponíveis:', {
          userPlan: user.plan,
          checkoutSubscription: checkout.subscription,
          checkoutItems: checkout.items
        })
        
        // Se não tem plan, ainda assim ativar a assinatura (mas sem creditsLimit)
        await updateSubscriptionStatus(
          user.id,
          'ACTIVE',
          currentPeriodEnd,
          undefined, // sem plan
          billingCycle
        )
        
        // Criar log de erro crítico
        await prisma.usageLog.create({
          data: {
            userId: user.id,
            action: 'WEBHOOK_ERROR_NO_PLAN_CHECKOUT',
            creditsUsed: 0,
            details: {
              error: 'Plan não encontrado no webhook CHECKOUT_PAID - creditsLimit não foi atualizado',
              checkoutId: checkout.id,
              subscription: checkout.subscription,
              requiresManualFix: true
            }
          }
        })
        
        return {
          success: false,
          error: 'Plan não encontrado - subscriptionStatus atualizado mas creditsLimit não foi definido. Requer correção manual.',
          retryable: false
        }
      }

      console.log('✅ [WEBHOOK] Dados finais antes de updateSubscriptionStatus (CHECKOUT_PAID):', {
        userId: user.id,
        status: 'ACTIVE',
        plan,
        billingCycle,
        currentPeriodEnd: currentPeriodEnd?.toISOString()
      })

      // Usar updateSubscriptionStatus que já possui toda a lógica correta
      const updatedUser = await updateSubscriptionStatus(
        user.id,
        'ACTIVE',
        currentPeriodEnd,
        plan,
        billingCycle
      )

      console.log('✅ [WEBHOOK] updateSubscriptionStatus executado com sucesso (CHECKOUT_PAID)')

      // Buscar dados atualizados do usuário para broadcast
      const userAfterUpdate = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          creditsUsed: true,
          creditsLimit: true,
          creditsBalance: true,
          subscriptionStatus: true,
          plan: true
        }
      })

      // Broadcast atualização em tempo real para frontend
      if (userAfterUpdate) {
        await broadcastCreditsUpdate(
          user.id,
          userAfterUpdate.creditsUsed,
          userAfterUpdate.creditsLimit,
          'SUBSCRIPTION_ACTIVATED',
          userAfterUpdate.creditsBalance
        ).catch((error) => {
          console.error('❌ [WEBHOOK] Erro ao broadcast créditos:', error)
        })

        await broadcastUserUpdate(
          user.id,
          {
            plan: userAfterUpdate.plan,
            subscriptionStatus: userAfterUpdate.subscriptionStatus,
            creditsLimit: userAfterUpdate.creditsLimit,
            creditsUsed: userAfterUpdate.creditsUsed,
            creditsBalance: userAfterUpdate.creditsBalance
          },
          'SUBSCRIPTION_ACTIVATED'
        ).catch((error) => {
          console.error('❌ [WEBHOOK] Erro ao broadcast user update:', error)
        })

        console.log('✅ [WEBHOOK] Broadcast SSE enviado para frontend (CHECKOUT_PAID):', {
          userId: user.id,
          creditsLimit: userAfterUpdate.creditsLimit,
          creditsUsed: userAfterUpdate.creditsUsed,
          creditsBalance: userAfterUpdate.creditsBalance,
          subscriptionStatus: userAfterUpdate.subscriptionStatus
        })
      }

      // Verificar se Payment foi criado/atualizado
      const payment = await prisma.payment.findFirst({
        where: {
          userId: user.id,
          asaasCheckoutId: checkout.id,
          type: 'SUBSCRIPTION'
        }
      })

      if (payment) {
        // Atualizar Payment para CONFIRMED
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'CONFIRMED',
            confirmedDate: new Date(),
            ...(plan && { planType: plan }),
            ...(billingCycle && { billingCycle: billingCycle })
          }
        })
        console.log('✅ [WEBHOOK] Payment atualizado para CONFIRMED (CHECKOUT_PAID):', payment.id)
      } else {
        // Criar novo Payment se não existir
        // Buscar valor dos items
        const totalValue = checkout.items?.reduce((sum, item) => sum + (item.value || 0), 0) || 0
        
        await prisma.payment.create({
          data: {
            userId: user.id,
            asaasCheckoutId: checkout.id,
            type: 'SUBSCRIPTION',
            status: 'CONFIRMED',
            billingType: 'CREDIT_CARD',
            value: totalValue,
            description: `Assinatura confirmada via checkout - ${checkout.items?.[0]?.name || 'N/A'}`,
            dueDate: currentPeriodEnd || new Date(),
            confirmedDate: new Date(),
            planType: plan || undefined,
            billingCycle: billingCycle || undefined
          }
        })
        console.log('✅ [WEBHOOK] Novo Payment criado (CHECKOUT_PAID)')
      }

      console.log('✅ [WEBHOOK] CHECKOUT_PAID processado com sucesso:', {
        userId: user.id,
        plan,
        billingCycle,
        checkoutId: checkout.id
      })

      return { success: true }
    } else {
      // Não é checkout de assinatura, apenas logar
      console.log('ℹ️ [WEBHOOK] CHECKOUT_PAID não é de assinatura, ignorando')
      return { success: true }
    }
  } catch (error: any) {
    console.error('❌ [WEBHOOK] Erro ao processar CHECKOUT_PAID:', error)
    return { 
      success: false, 
      error: error.message, 
      retryable: true 
    }
  }
}

async function handlePaymentSuccess(payment: AsaasWebhookPayload['payment']): Promise<{
  success: boolean
  error?: string
  retryable?: boolean
}> {
  if (!payment) {
    return { success: false, error: 'Missing payment data', retryable: false }
  }

  console.log('='.repeat(80))
  console.log('🔔 [WEBHOOK] PROCESSANDO PAYMENT_CONFIRMED')
  console.log('📦 Dados do payment recebido:', {
    id: payment.id,
    customer: payment.customer,
    value: payment.value,
    status: payment.status,
    subscription: payment.subscription,
    externalReference: payment.externalReference,
    billingType: payment.billingType,
    dueDate: payment.dueDate
  })
  console.log('='.repeat(80))

  try {
    // Find user by Asaas customer ID
    const user = await prisma.user.findUnique({
      where: { asaasCustomerId: payment.customer },
      select: { 
        id: true, 
        plan: true,
        billingCycle: true, // Buscar billingCycle também
        subscriptionId: true,
        creditsBalance: true,
        email: true,
        name: true
      }
    })

    if (!user) {
      console.error('❌ [WEBHOOK] User not found for payment:', payment.id, 'customer:', payment.customer)
      return { success: false, error: 'User not found', retryable: false }
    }

    console.log('✅ [WEBHOOK] Usuário encontrado:', {
      userId: user.id,
      email: user.email,
      name: user.name,
      currentPlan: user.plan,
      subscriptionId: user.subscriptionId
    })

    // Update user subscription status if it's a subscription payment
    if (payment.subscription) {
      console.log('📋 [WEBHOOK] É um pagamento de assinatura (subscription):', payment.subscription)
      console.log('🔍 [WEBHOOK] Iniciando busca do Payment original...')
      console.log('🔍 [WEBHOOK] Critérios de busca:', {
        userId: user.id,
        externalReference: payment.externalReference,
        subscriptionId: payment.subscription,
        asaasPaymentId: payment.id
      })
      
      // CRÍTICO: Buscar plan e billingCycle - PRIORIDADE 1: Tabela users (já salvos no checkout)
      // PRIORIDADE 2: Tabela payments (fallback para compatibilidade)
      // PRIORIDADE 3: Subscription do Asaas (fallback final)
      let originalPayment = null
      let plan: 'STARTER' | 'PREMIUM' | 'GOLD' | undefined = undefined
      let billingCycle: 'MONTHLY' | 'YEARLY' | undefined = undefined
      let currentPeriodEnd: Date | undefined = undefined

      // PRIORIDADE 1: Buscar plan e billingCycle diretamente da tabela users (já salvos no checkout)
      if (user.plan) {
        plan = user.plan as any
        console.log('✅ [WEBHOOK] Plan encontrado na tabela users:', plan)
      }
      if (user.billingCycle === 'MONTHLY' || user.billingCycle === 'YEARLY') {
        billingCycle = user.billingCycle as any
        console.log('✅ [WEBHOOK] billingCycle encontrado na tabela users:', billingCycle)
      }

      try {
        // CRÍTICO: Payment criado no checkout tem asaasCheckoutId
        // O webhook pode vir com externalReference = checkoutId ou subscriptionId
        // Estratégia 1: Buscar pelo externalReference do webhook = asaasCheckoutId
        if (payment.externalReference) {
          console.log('🔍 [WEBHOOK] Estratégia 1: Buscando pelo externalReference (checkoutId):', payment.externalReference)
          originalPayment = await prisma.payment.findFirst({
            where: {
              userId: user.id,
              type: 'SUBSCRIPTION',
              asaasCheckoutId: payment.externalReference
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              billingCycle: true,
              planType: true,
              asaasCheckoutId: true,
              subscriptionId: true,
              status: true
            }
          })
          
          if (originalPayment) {
            console.log('✅ [WEBHOOK] Payment encontrado pelo externalReference (checkoutId):', {
              paymentId: originalPayment.id,
              checkoutId: payment.externalReference,
              currentStatus: originalPayment.status,
              planType: originalPayment.planType,
              billingCycle: originalPayment.billingCycle
            })
          } else {
            console.warn('⚠️ [WEBHOOK] Payment não encontrado pelo externalReference:', payment.externalReference)
          }
        }

        // Estratégia 2: Se não encontrou, buscar por userId + type + status PENDING + asaasCheckoutId
        if (!originalPayment) {
          console.log('🔍 [WEBHOOK] Estratégia 2: Buscando por PENDING + asaasCheckoutId não null + asaasPaymentId null')
          originalPayment = await prisma.payment.findFirst({
            where: {
              userId: user.id,
              type: 'SUBSCRIPTION',
              status: 'PENDING', // Payment criado no checkout está como PENDING
              asaasCheckoutId: { not: null }, // Payment do checkout tem asaasCheckoutId
              asaasPaymentId: null // Mas ainda não tem asaasPaymentId (será preenchido pelo webhook)
            },
            orderBy: { createdAt: 'desc' }, // Pegar o mais recente
            select: {
              id: true,
              billingCycle: true,
              planType: true,
              asaasCheckoutId: true,
              subscriptionId: true,
              status: true
            }
          })
          
          if (originalPayment) {
            console.log('✅ [WEBHOOK] Payment encontrado por critérios gerais:', {
              paymentId: originalPayment.id,
              checkoutId: originalPayment.asaasCheckoutId,
              currentStatus: originalPayment.status,
              planType: originalPayment.planType,
              billingCycle: originalPayment.billingCycle
            })
          } else {
            console.warn('⚠️ [WEBHOOK] Payment não encontrado pela Estratégia 2')
            // Listar todos os Payments do usuário para debug
            const allPayments = await prisma.payment.findMany({
              where: { userId: user.id, type: 'SUBSCRIPTION' },
              orderBy: { createdAt: 'desc' },
              take: 5,
              select: {
                id: true,
                status: true,
                asaasCheckoutId: true,
                asaasPaymentId: true,
                planType: true,
                billingCycle: true,
                createdAt: true
              }
            })
            console.log('📋 [WEBHOOK] Últimos 5 Payments do usuário (para debug):', allPayments)
          }
        }

        // Estratégia 3: Buscar pelo subscriptionId (se o Payment já foi atualizado antes)
        if (!originalPayment && payment.subscription) {
          console.log('🔍 [WEBHOOK] Estratégia 3: Buscando pelo subscriptionId:', payment.subscription)
          originalPayment = await prisma.payment.findFirst({
            where: {
              userId: user.id,
              type: 'SUBSCRIPTION',
              subscriptionId: payment.subscription
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              billingCycle: true,
              planType: true,
              asaasCheckoutId: true,
              subscriptionId: true,
              status: true
            }
          })
          
          if (originalPayment) {
            console.log('✅ [WEBHOOK] Payment encontrado pelo subscriptionId:', {
              paymentId: originalPayment.id,
              subscriptionId: payment.subscription,
              currentStatus: originalPayment.status,
              planType: originalPayment.planType,
              billingCycle: originalPayment.billingCycle
            })
          } else {
            console.warn('⚠️ [WEBHOOK] Payment não encontrado pelo subscriptionId:', payment.subscription)
          }
        }

        if (originalPayment) {
          console.log('✅ [WEBHOOK] Payment original encontrado:', {
            paymentId: originalPayment.id,
            planType: originalPayment.planType,
            billingCycle: originalPayment.billingCycle,
            checkoutId: originalPayment.asaasCheckoutId
          })

          // PRIORIDADE 2: Usar plan/billingCycle do Payment apenas se não encontrou na tabela users
          if (!billingCycle && (originalPayment.billingCycle === 'MONTHLY' || originalPayment.billingCycle === 'YEARLY')) {
            billingCycle = originalPayment.billingCycle
            console.log('✅ [WEBHOOK] billingCycle obtido do Payment (fallback):', billingCycle)
          }
          if (!plan && originalPayment.planType) {
            plan = originalPayment.planType as any
            console.log('✅ [WEBHOOK] Plan obtido do Payment (fallback):', plan)
          }
        } else {
          console.warn('⚠️ [WEBHOOK] Payment original não encontrado pelo subscriptionId, tentando buscar pelo asaasPaymentId')
          
          // Fallback: tentar buscar pelo asaasPaymentId (pode ser que já tenha sido atualizado)
          const existingPayment = await prisma.payment.findUnique({
            where: { asaasPaymentId: payment.id },
            select: {
              billingCycle: true,
              planType: true
            }
          })

          if (existingPayment) {
            // PRIORIDADE 2: Usar plan/billingCycle do Payment apenas se não encontrou na tabela users
            if (!billingCycle && (existingPayment.billingCycle === 'MONTHLY' || existingPayment.billingCycle === 'YEARLY')) {
              billingCycle = existingPayment.billingCycle
              console.log('✅ [WEBHOOK] billingCycle obtido do Payment existente (fallback):', billingCycle)
            }
            if (!plan && existingPayment.planType) {
              plan = existingPayment.planType as any
              console.log('✅ [WEBHOOK] Plan obtido do Payment existente (fallback):', plan)
            }
          }
        }
      } catch (error: any) {
        console.error('❌ [WEBHOOK] Error fetching payment info from DB:', error)
      }

      // PRIORIDADE 3: Se ainda não encontrou plan, tentar buscar de Payments recentes do usuário
      if (!plan) {
        try {
          // Buscar Payment mais recente com planType (pode ser o checkout que ainda não foi confirmado)
          const recentPayment = await prisma.payment.findFirst({
            where: {
              userId: user.id,
              type: 'SUBSCRIPTION',
              planType: { not: null }
            },
            orderBy: { createdAt: 'desc' },
            select: {
              planType: true,
              billingCycle: true
            }
          })

          if (recentPayment?.planType) {
            plan = recentPayment.planType as any
            if (!billingCycle && recentPayment.billingCycle) {
              billingCycle = recentPayment.billingCycle as any
            }
            console.log('✅ [WEBHOOK] Plan encontrado em Payment recente:', plan)
          } else {
            // Último fallback: usar do usuário
            // IMPORTANTE: Se o usuário trocou de plano anteriormente (upgrade/downgrade),
            // o plan do usuário já foi atualizado, então será usado para atualizar creditsLimit
            // Isso garante que os créditos do novo plano sejam aplicados no próximo pagamento
            plan = user.plan as any
            console.warn('⚠️ [WEBHOOK] Usando plan do usuário como fallback:', plan)
            if (!plan) {
              console.error('❌ [WEBHOOK] CRÍTICO: plan não encontrado em nenhum lugar!')
            }
          }
        } catch (error: any) {
          console.error('❌ [WEBHOOK] Erro ao buscar plan em Payments recentes:', error)
          // Fallback final: usar do usuário
          plan = user.plan as any
        }
      }

      // Buscar informações do subscription no Asaas
      let subscriptionInfo: any = null
      try {
        subscriptionInfo = await asaas.getSubscription(payment.subscription)
        
        if (subscriptionInfo) {
          // Extrair billingCycle do subscription se não tiver do Payment
          if (!billingCycle) {
            const cycle = subscriptionInfo.cycle
            if (cycle === 'MONTHLY' || cycle === 'YEARLY') {
              billingCycle = cycle
            }
          }

          // Extrair data de fim do período atual se disponível
          if (subscriptionInfo.endDate) {
            currentPeriodEnd = new Date(subscriptionInfo.endDate)
          }
        }
      } catch (error: any) {
        console.error('❌ [WEBHOOK] Error fetching subscription info from Asaas:', error)
      }

      // Log crítico antes de atualizar
      console.log('🔑 [WEBHOOK] Dados para updateSubscriptionStatus:', {
        userId: user.id,
        status: 'ACTIVE',
        plan,
        billingCycle,
        hasPlan: !!plan,
        hasBillingCycle: !!billingCycle,
        userPlan: user.plan
      })

      // CRÍTICO: Se ainda não tiver plan após todas as tentativas, tentar extrair do subscription do Asaas
      if (!plan) {
        console.warn('⚠️ [WEBHOOK] plan não encontrado na tabela users nem nos Payments, tentando extrair do subscription do Asaas...')
        
        // Fallback final: Tentar extrair do subscription do Asaas (se subscriptionInfo foi buscado)
        if (subscriptionInfo && subscriptionInfo.description) {
          // Tentar extrair plan do description (ex: "Plano Premium Mensal")
          const desc = subscriptionInfo.description.toLowerCase()
          if (desc.includes('starter')) plan = 'STARTER' as any
          else if (desc.includes('premium')) plan = 'PREMIUM' as any
          else if (desc.includes('gold')) plan = 'GOLD' as any
          
          if (plan) {
            console.log('✅ [WEBHOOK] Plan extraído do description do subscription:', plan)
          }
        }
        
        // Se ainda não tem plan, é um erro crítico
        if (!plan) {
            console.error('❌ [WEBHOOK] CRÍTICO: Não foi possível determinar o plan!')
            console.error('❌ [WEBHOOK] Payment data:', {
              paymentId: payment.id,
              subscriptionId: payment.subscription,
              customer: payment.customer,
              originalPaymentFound: !!originalPayment,
              userPlan: user.plan,
              subscriptionInfo: subscriptionInfo ? {
                cycle: subscriptionInfo.cycle,
                description: subscriptionInfo.description
              } : null
            })
            
            // Mesmo sem plan, atualizar status para ACTIVE
            // Mas creditsLimit permanecerá 0 (problema conhecido que precisa ser corrigido manualmente)
            await updateSubscriptionStatus(
              user.id,
              'ACTIVE',
              currentPeriodEnd,
              undefined, // sem plan
              billingCycle
            )
            
            // Criar log de erro para rastreamento
            await prisma.usageLog.create({
              data: {
                userId: user.id,
                action: 'WEBHOOK_ERROR',
                creditsUsed: 0,
                details: {
                  error: 'Plan não encontrado no webhook',
                  paymentId: payment.id,
                  subscriptionId: payment.subscription,
                  requiresManualFix: true
                }
              }
            })
            
            return { 
              success: false, 
              error: 'Plan não encontrado - creditsLimit não foi atualizado. Requer correção manual.',
              retryable: false 
            }
          }
        }
      }

      // CRÍTICO: Verificar se temos plan antes de chamar updateSubscriptionStatus
      if (!plan) {
        console.error('❌ [WEBHOOK] CRÍTICO: Não foi possível determinar o plan!')
        console.error('❌ [WEBHOOK] Dados disponíveis:', {
          originalPaymentFound: !!originalPayment,
          userPlan: user.plan,
          subscriptionInfo: subscriptionInfo ? {
            cycle: subscriptionInfo.cycle,
            description: subscriptionInfo.description
          } : null,
          paymentExternalReference: payment.externalReference
        })
        
        // Se não tem plan, ainda assim ativar a assinatura (mas sem creditsLimit)
        // O admin pode corrigir manualmente depois
        await updateSubscriptionStatus(
          user.id,
          'ACTIVE',
          currentPeriodEnd,
          undefined, // sem plan
          billingCycle
        )
        
        // Criar log de erro crítico
        await prisma.usageLog.create({
          data: {
            userId: user.id,
            action: 'WEBHOOK_ERROR_NO_PLAN',
            creditsUsed: 0,
            details: {
              error: 'Plan não encontrado no webhook - creditsLimit não foi atualizado',
              paymentId: payment.id,
              subscriptionId: payment.subscription,
              externalReference: payment.externalReference,
              requiresManualFix: true
            }
          }
        })
        
        return {
          success: false,
          error: 'Plan não encontrado - subscriptionStatus atualizado mas creditsLimit não foi definido. Requer correção manual.',
          retryable: false
        }
      }

      console.log('✅ [WEBHOOK] Dados finais antes de updateSubscriptionStatus:', {
        userId: user.id,
        status: 'ACTIVE',
        plan,
        billingCycle,
        currentPeriodEnd: currentPeriodEnd?.toISOString()
      })

      // Usar updateSubscriptionStatus que já possui toda a lógica correta
      // (YEARLY * 12 créditos, reset de créditos, data de expiração, etc.)
      // CRÍTICO: Agora garantimos que plan sempre existe quando chegamos aqui
      const updatedUser = await updateSubscriptionStatus(
        user.id,
        'ACTIVE',
        currentPeriodEnd,
        plan, // Agora garantimos que plan existe
        billingCycle
      )

      console.log('✅ [WEBHOOK] updateSubscriptionStatus executado com sucesso')

      // CRÍTICO: Buscar dados atualizados do usuário para broadcast
      const userAfterUpdate = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          creditsUsed: true,
          creditsLimit: true,
          creditsBalance: true,
          subscriptionStatus: true,
          plan: true
        }
      })

      // CRÍTICO: Broadcast atualização em tempo real para frontend
      if (userAfterUpdate) {
        await broadcastCreditsUpdate(
          user.id,
          userAfterUpdate.creditsUsed,
          userAfterUpdate.creditsLimit,
          'SUBSCRIPTION_ACTIVATED',
          userAfterUpdate.creditsBalance
        ).catch((error) => {
          console.error('❌ [WEBHOOK] Erro ao broadcast créditos:', error)
          // Não falhar webhook se broadcast falhar
        })

        await broadcastUserUpdate(
          user.id,
          {
            plan: userAfterUpdate.plan,
            subscriptionStatus: userAfterUpdate.subscriptionStatus,
            creditsLimit: userAfterUpdate.creditsLimit,
            creditsUsed: userAfterUpdate.creditsUsed,
            creditsBalance: userAfterUpdate.creditsBalance
          },
          'SUBSCRIPTION_ACTIVATED'
        ).catch((error) => {
          console.error('❌ [WEBHOOK] Erro ao broadcast user update:', error)
          // Não falhar webhook se broadcast falhar
        })

        console.log('✅ [WEBHOOK] Broadcast SSE enviado para frontend:', {
          userId: user.id,
          creditsLimit: userAfterUpdate.creditsLimit,
          creditsUsed: userAfterUpdate.creditsUsed,
          creditsBalance: userAfterUpdate.creditsBalance,
          subscriptionStatus: userAfterUpdate.subscriptionStatus
        })
      }

      // Atualizar Payment original ou criar novo se não existir
      if (originalPayment && originalPayment.id) {
        // Atualizar Payment original com asaasPaymentId e subscriptionId
        try {
          await prisma.payment.update({
            where: { id: originalPayment.id },
            data: {
              asaasPaymentId: payment.id,
              subscriptionId: payment.subscription,
              status: 'CONFIRMED',
              confirmedDate: new Date(),
              ...(plan && { planType: plan }),
              ...(billingCycle && { billingCycle: billingCycle })
            }
          })
          console.log('✅ [WEBHOOK] Payment original atualizado:', {
            paymentId: originalPayment.id,
            newStatus: 'CONFIRMED',
            previousStatus: originalPayment.status,
            asaasPaymentId: payment.id,
            subscriptionId: payment.subscription,
            strategy: 'original_found'
          })
        } catch (error: any) {
          console.error('❌ [WEBHOOK] Erro ao atualizar Payment original:', error)
          // Se der erro, tentar criar novo como fallback
          try {
            await prisma.payment.create({
              data: {
                asaasPaymentId: payment.id,
                userId: user.id,
                type: 'SUBSCRIPTION',
                status: 'CONFIRMED',
                billingType: payment.billingType as any,
                value: payment.value,
                description: `Payment confirmed - ${payment.billingType}`,
                dueDate: new Date(payment.dueDate),
                confirmedDate: new Date(),
                subscriptionId: payment.subscription,
                externalReference: payment.externalReference,
                planType: plan || undefined,
                billingCycle: billingCycle || undefined
              }
            })
            console.log('✅ [WEBHOOK] Novo Payment criado como fallback')
          } catch (createError: any) {
            console.error('❌ [WEBHOOK] Erro ao criar Payment fallback:', createError)
          }
        }
      } else {
        // Não encontrou Payment original, tentar atualizar existente ou criar novo
        try {
          // Primeiro, tentar atualizar um payment existente com esse asaasPaymentId
          const existingPayment = await prisma.payment.findUnique({
            where: { asaasPaymentId: payment.id }
          })

          if (existingPayment) {
            // Payment já existe, apenas atualizar status
            await prisma.payment.update({
              where: { id: existingPayment.id },
              data: {
                status: 'CONFIRMED',
                confirmedDate: new Date(),
                ...(plan && { planType: plan }),
                ...(billingCycle && { billingCycle: billingCycle }),
                ...(payment.subscription && { subscriptionId: payment.subscription })
              }
            })
            console.log('✅ [WEBHOOK] Payment existente atualizado para CONFIRMED')
          } else {
            // ÚLTIMA TENTATIVA: Buscar qualquer Payment PENDING do usuário para esta subscription
            const pendingPayment = await prisma.payment.findFirst({
              where: {
                userId: user.id,
                type: 'SUBSCRIPTION',
                status: 'PENDING',
                ...(payment.externalReference && { asaasCheckoutId: payment.externalReference })
              },
              orderBy: { createdAt: 'desc' }
            })

            if (pendingPayment) {
              // Atualizar este Payment PENDING encontrado
              await prisma.payment.update({
                where: { id: pendingPayment.id },
                data: {
                  asaasPaymentId: payment.id,
                  subscriptionId: payment.subscription,
                  status: 'CONFIRMED',
                  confirmedDate: new Date(),
                  ...(plan && { planType: plan }),
                  ...(billingCycle && { billingCycle: billingCycle })
                }
              })
              console.log('✅ [WEBHOOK] Payment PENDING encontrado e atualizado:', {
                paymentId: pendingPayment.id,
                checkoutId: pendingPayment.asaasCheckoutId
              })
            } else {
              // Criar novo Payment apenas se realmente não existir nenhum
              console.log('📝 [WEBHOOK] Criando novo Payment (original não encontrado):', {
                asaasPaymentId: payment.id,
                userId: user.id,
                subscriptionId: payment.subscription,
                plan: plan || 'NÃO DEFINIDO',
                billingCycle: billingCycle || 'NÃO DEFINIDO',
                externalReference: payment.externalReference
              })
              
              const newPayment = await prisma.payment.create({
                data: {
                  asaasPaymentId: payment.id,
                  userId: user.id,
                  type: 'SUBSCRIPTION',
                  status: 'CONFIRMED',
                  billingType: payment.billingType as any,
                  value: payment.value,
                  description: `Payment confirmed - ${payment.billingType}`,
                  dueDate: new Date(payment.dueDate),
                  confirmedDate: new Date(),
                  subscriptionId: payment.subscription,
                  externalReference: payment.externalReference,
                  asaasCheckoutId: payment.externalReference || undefined,
                  planType: plan || undefined,
                  billingCycle: billingCycle || undefined
                }
              })
              console.log('✅ [WEBHOOK] Novo Payment criado (original não encontrado):', {
                paymentId: newPayment.id,
                planType: newPayment.planType,
                billingCycle: newPayment.billingCycle,
                status: newPayment.status
              })
            }
          }
        } catch (error: any) {
          // Pode dar erro de unique constraint se já existe, não é crítico
          console.error('❌ [WEBHOOK] Erro ao criar/atualizar Payment:', error)
          console.error('❌ [WEBHOOK] Stack trace:', error.stack)
          // Criar log de erro
          await prisma.usageLog.create({
            data: {
              userId: user.id,
              action: 'WEBHOOK_PAYMENT_CREATE_ERROR',
              creditsUsed: 0,
              details: {
                error: error.message,
                paymentId: payment.id,
                subscriptionId: payment.subscription,
                errorStack: error.stack
              }
            }
          }).catch(() => {}) // Não falhar se log der erro
        }
      }

      console.log('✅ [WEBHOOK] Subscription activated via updateSubscriptionStatus:', {
        userId: user.id,
        plan,
        billingCycle,
        currentPeriodEnd: currentPeriodEnd?.toISOString(),
        creditsWillBeSet: !!plan
      })
      
      // Verificar se Payment foi criado/atualizado
      const finalPayment = await prisma.payment.findFirst({
        where: {
          asaasPaymentId: payment.id,
          userId: user.id
        }
      })
      
      if (finalPayment) {
        console.log('✅ [WEBHOOK] Payment final confirmado no banco:', {
          paymentId: finalPayment.id,
          status: finalPayment.status,
          planType: finalPayment.planType,
          billingCycle: finalPayment.billingCycle
        })
      } else {
        console.error('❌ [WEBHOOK] CRÍTICO: Payment não foi criado/atualizado no banco!')
        console.error('❌ [WEBHOOK] asaasPaymentId:', payment.id, 'userId:', user.id)
      }
      
      // Verificar se usuário foi atualizado
      const finalUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          plan: true,
          creditsLimit: true,
          subscriptionStatus: true
        }
      })
      
      if (finalUser) {
        console.log('✅ [WEBHOOK] Usuário final após processamento:', {
          userId: finalUser ? user.id : 'NÃO ENCONTRADO',
          plan: finalUser.plan,
          creditsLimit: finalUser.creditsLimit,
          subscriptionStatus: finalUser.subscriptionStatus
        })
        
        if (!finalUser.plan || !finalUser.creditsLimit) {
          console.error('❌ [WEBHOOK] CRÍTICO: Usuário não foi atualizado corretamente!')
          console.error('❌ [WEBHOOK] plan:', finalUser.plan, 'creditsLimit:', finalUser.creditsLimit)
        }
      }
    } else {
      // Handle credit purchase
      // Primeiro, tentar encontrar CreditPurchase existente pelo asaasCheckoutId
      const creditPurchase = await prisma.creditPurchase.findFirst({
        where: {
          userId: user.id,
          asaasCheckoutId: payment.externalReference || undefined,
          status: 'PENDING'
        }
      })

      if (creditPurchase) {
        // Verificar se já foi confirmado antes para evitar adicionar créditos duplicados
        const needsCreditUpdate = creditPurchase.status === 'PENDING'
        
        // Atualizar CreditPurchase existente
        await prisma.creditPurchase.update({
          where: { id: creditPurchase.id },
          data: {
            asaasPaymentId: payment.id,
            status: 'CONFIRMED',
            confirmedAt: new Date()
          }
        })

        // Adicionar créditos se ainda não foram adicionados (status era PENDING antes do update)
        if (needsCreditUpdate) {
          // Buscar balance atual antes de adicionar
          const userBeforeUpdate = await prisma.user.findUnique({
            where: { id: user.id },
            select: { creditsBalance: true }
          })

          // Adicionar créditos
          await prisma.user.update({
            where: { id: user.id },
            data: {
              creditsBalance: { increment: creditPurchase.creditAmount }
            }
          })

          // Buscar balance após atualização para transaction record
          const userForTransaction = await prisma.user.findUnique({
            where: { id: user.id },
            select: { creditsBalance: true }
          })

          await prisma.creditTransaction.create({
            data: {
              userId: user.id,
              type: 'EARNED',
              source: 'PURCHASE',
              amount: creditPurchase.creditAmount,
              description: `Compra de ${creditPurchase.packageName} - ${creditPurchase.creditAmount} créditos`,
              referenceId: payment.id,
              creditPurchaseId: creditPurchase.id,
              balanceAfter: (userForTransaction?.creditsBalance || 0),
              metadata: {
                packageName: creditPurchase.packageName,
                packageId: creditPurchase.packageId,
                value: creditPurchase.value,
                asaasPaymentId: payment.id,
                billingType: payment.billingType
              }
            }
          })

          console.log(`✅ [WEBHOOK] Adicionados ${creditPurchase.creditAmount} créditos para usuário ${user.id}`)

          // CRÍTICO: Broadcast atualização em tempo real para frontend
          const userAfterUpdate = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              creditsUsed: true,
              creditsLimit: true,
              creditsBalance: true,
              subscriptionStatus: true,
              plan: true
            }
          })

          if (userAfterUpdate) {
            await broadcastCreditsUpdate(
              user.id,
              userAfterUpdate.creditsUsed,
              userAfterUpdate.creditsLimit,
              'CREDIT_PURCHASE_CONFIRMED',
              userAfterUpdate.creditsBalance
            ).catch((error) => {
              console.error('❌ [WEBHOOK] Erro ao broadcast créditos:', error)
            })

            await broadcastUserUpdate(
              user.id,
              {
                creditsBalance: userAfterUpdate.creditsBalance,
                creditsLimit: userAfterUpdate.creditsLimit,
                creditsUsed: userAfterUpdate.creditsUsed
              },
              'CREDIT_PURCHASE_CONFIRMED'
            ).catch((error) => {
              console.error('❌ [WEBHOOK] Erro ao broadcast user update:', error)
            })

            console.log('✅ [WEBHOOK] Broadcast SSE enviado para compra de créditos:', {
              userId: user.id,
              creditsAdded: creditPurchase.creditAmount,
              creditsBalance: userAfterUpdate.creditsBalance
            })
          }
        } else {
          console.log(`⚠️ [WEBHOOK] CreditPurchase já estava confirmado, pulando adição de créditos`)
        }
      } else {
        // Tentar extrair creditAmount do externalReference ou description
        const creditAmount = extractCreditAmount(payment.externalReference || payment.description || '')
        if (creditAmount > 0) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              creditsBalance: { increment: creditAmount }
            }
          })

          // Create credit purchase record
          const newCreditPurchase = await prisma.creditPurchase.create({
            data: {
              userId: user.id,
              asaasPaymentId: payment.id,
              asaasCheckoutId: payment.externalReference || undefined,
              packageName: `Pacote de ${creditAmount} créditos`,
              creditAmount,
              value: payment.value,
              status: 'CONFIRMED',
              validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
              confirmedAt: new Date()
            }
          })

          // Criar transaction record
          const currentUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { creditsBalance: true }
          })

          await prisma.creditTransaction.create({
            data: {
              userId: user.id,
              type: 'EARNED',
              source: 'PURCHASE',
              amount: creditAmount,
              description: `Compra de Pacote de ${creditAmount} créditos`,
              referenceId: payment.id,
              creditPurchaseId: newCreditPurchase.id,
              balanceAfter: (currentUser?.creditsBalance || 0),
              metadata: {
                packageName: newCreditPurchase.packageName,
                value: payment.value,
                asaasPaymentId: payment.id,
                billingType: payment.billingType
              }
            }
          })

          console.log(`✅ [WEBHOOK] Criado CreditPurchase e adicionados ${creditAmount} créditos para usuário ${user.id}`)

          // CRÍTICO: Broadcast atualização em tempo real para frontend
          const userAfterCreditUpdate = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              creditsUsed: true,
              creditsLimit: true,
              creditsBalance: true,
              subscriptionStatus: true,
              plan: true
            }
          })

          if (userAfterCreditUpdate) {
            await broadcastCreditsUpdate(
              user.id,
              userAfterCreditUpdate.creditsUsed,
              userAfterCreditUpdate.creditsLimit,
              'CREDIT_PURCHASE_CONFIRMED',
              userAfterCreditUpdate.creditsBalance
            ).catch((error) => {
              console.error('❌ [WEBHOOK] Erro ao broadcast créditos:', error)
            })

            await broadcastUserUpdate(
              user.id,
              {
                creditsBalance: userAfterCreditUpdate.creditsBalance,
                creditsLimit: userAfterCreditUpdate.creditsLimit,
                creditsUsed: userAfterCreditUpdate.creditsUsed
              },
              'CREDIT_PURCHASE_CONFIRMED'
            ).catch((error) => {
              console.error('❌ [WEBHOOK] Erro ao broadcast user update:', error)
            })

            console.log('✅ [WEBHOOK] Broadcast SSE enviado para compra de créditos (fallback):', {
              userId: user.id,
              creditsAdded: creditAmount,
              creditsBalance: userAfterCreditUpdate.creditsBalance
            })
          }
        }
      }

      // Atualizar ou criar Payment para CREDIT_PURCHASE
      try {
        const existingPayment = await prisma.payment.findFirst({
          where: {
            userId: user.id,
            type: 'CREDIT_PURCHASE',
            asaasCheckoutId: payment.externalReference || undefined,
            status: 'PENDING'
          },
          orderBy: { createdAt: 'desc' }
        })

        if (existingPayment) {
          // Atualizar Payment existente
          await prisma.payment.update({
            where: { id: existingPayment.id },
            data: {
              asaasPaymentId: payment.id,
              status: 'CONFIRMED',
              confirmedDate: new Date()
            }
          })
          console.log('✅ [WEBHOOK] Payment CREDIT_PURCHASE atualizado para CONFIRMED')
        } else {
          // Verificar se já existe payment com esse asaasPaymentId
          const paymentWithAsaasId = await prisma.payment.findUnique({
            where: { asaasPaymentId: payment.id }
          })

          if (!paymentWithAsaasId) {
            // Criar novo Payment
            await prisma.payment.create({
              data: {
                asaasPaymentId: payment.id,
                userId: user.id,
                type: 'CREDIT_PURCHASE',
                status: 'CONFIRMED',
                billingType: payment.billingType as any,
                value: payment.value,
                description: `Credit purchase confirmed - ${payment.billingType}`,
                dueDate: new Date(payment.dueDate),
                confirmedDate: new Date(),
                externalReference: payment.externalReference
              }
            })
            console.log('✅ [WEBHOOK] Novo Payment CREDIT_PURCHASE criado')
          }
        }
      } catch (error: any) {
        console.warn('⚠️ [WEBHOOK] Erro ao criar/atualizar Payment para CREDIT_PURCHASE:', error.message)
      }
    }

    // Log the payment confirmation
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        action: 'PAYMENT_CONFIRMED',
        creditsUsed: 0,
        details: {
          paymentId: payment.id,
          value: payment.value,
          billingType: payment.billingType,
          subscription: payment.subscription
        }
      }
    })

    console.log('Payment confirmed successfully:', payment.id)
    return { success: true }

  } catch (error: any) {
    console.error('Error handling payment success:', error)
    return { 
      success: false, 
      error: error.message, 
      retryable: !error.message?.includes('Unique constraint') 
    }
  }
}

async function handlePaymentOverdue(payment: AsaasWebhookPayload['payment']): Promise<{
  success: boolean
  error?: string
  retryable?: boolean
}> {
  if (!payment) {
    return { success: false, error: 'Missing payment data', retryable: false }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { asaasCustomerId: payment.customer },
      select: { id: true }
    })

    if (!user) {
      return { success: false, error: 'User not found', retryable: false }
    }

    // Update payment record
    await prisma.payment.upsert({
      where: { asaasPaymentId: payment.id },
      create: {
        asaasPaymentId: payment.id,
        userId: user.id,
        type: payment.subscription ? 'SUBSCRIPTION' : 'CREDIT_PURCHASE',
        status: 'OVERDUE',
        billingType: payment.billingType as any,
        value: payment.value,
        description: `Payment overdue - ${payment.billingType}`,
        dueDate: new Date(payment.dueDate),
        overdueDate: new Date(),
        subscriptionId: payment.subscription,
        externalReference: payment.externalReference
      },
      update: {
        status: 'OVERDUE',
        overdueDate: new Date()
      }
    })

    // Update user subscription status if it's a subscription payment
    if (payment.subscription) {
      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: 'OVERDUE' }
      })
    }

    console.log('Payment marked as overdue:', payment.id)
    return { success: true }

  } catch (error: any) {
    console.error('Error handling payment overdue:', error)
    return { success: false, error: error.message, retryable: true }
  }
}

async function handlePaymentCancelled(payment: AsaasWebhookPayload['payment']): Promise<{
  success: boolean
  error?: string
  retryable?: boolean
}> {
  if (!payment) {
    return { success: false, error: 'Missing payment data', retryable: false }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { asaasCustomerId: payment.customer },
      select: { id: true }
    })

    if (!user) {
      return { success: false, error: 'User not found', retryable: false }
    }

    // Update payment status
    await prisma.payment.upsert({
      where: { asaasPaymentId: payment.id },
      create: {
        asaasPaymentId: payment.id,
        userId: user.id,
        type: payment.subscription ? 'SUBSCRIPTION' : 'CREDIT_PURCHASE',
        status: payment.status === 'REFUNDED' ? 'REFUNDED' : 'CANCELLED',
        billingType: payment.billingType as any,
        value: payment.value,
        description: `Payment ${payment.status.toLowerCase()} - ${payment.billingType}`,
        dueDate: new Date(payment.dueDate),
        subscriptionId: payment.subscription,
        externalReference: payment.externalReference
      },
      update: {
        status: payment.status === 'REFUNDED' ? 'REFUNDED' : 'CANCELLED'
      }
    })

    // Handle subscription cancellation
    if (payment.subscription) {
      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: 'CANCELLED' }
      })
    }

    console.log('Payment cancelled/refunded:', payment.id)
    return { success: true }

  } catch (error: any) {
    console.error('Error handling payment cancellation:', error)
    return { success: false, error: error.message, retryable: true }
  }
}

async function handleSubscriptionExpired(subscription: AsaasWebhookPayload['subscription']): Promise<{
  success: boolean
  error?: string
  retryable?: boolean
}> {
  if (!subscription) {
    return { success: false, error: 'Missing subscription data', retryable: false }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { asaasCustomerId: subscription.customer },
      select: { id: true }
    })

    if (!user) {
      return { success: false, error: 'User not found', retryable: false }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: 'EXPIRED',
        subscriptionEndsAt: new Date()
        // Do NOT downgrade plan - user keeps their plan, access controlled by status
      }
    })

    console.log('Subscription expired:', subscription.id)
    return { success: true }

  } catch (error: any) {
    console.error('Error handling subscription expiration:', error)
    return { success: false, error: error.message, retryable: true }
  }
}

async function handleSubscriptionCancelled(subscription: AsaasWebhookPayload['subscription']): Promise<{
  success: boolean
  error?: string
  retryable?: boolean
}> {
  if (!subscription) {
    return { success: false, error: 'Missing subscription data', retryable: false }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { asaasCustomerId: subscription.customer },
      select: { id: true }
    })

    if (!user) {
      return { success: false, error: 'User not found', retryable: false }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { subscriptionStatus: 'CANCELLED' }
    })

    console.log('Subscription cancelled:', subscription.id)
    return { success: true }

  } catch (error: any) {
    console.error('Error handling subscription cancellation:', error)
    return { success: false, error: error.message, retryable: true }
  }
}

async function handleSubscriptionReactivated(subscription: AsaasWebhookPayload['subscription']): Promise<{
  success: boolean
  error?: string
  retryable?: boolean
}> {
  if (!subscription) {
    return { success: false, error: 'Missing subscription data', retryable: false }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { asaasCustomerId: subscription.customer },
      select: { id: true, plan: true }
    })

    if (!user) {
      return { success: false, error: 'User not found', retryable: false }
    }

    // Update subscription status and restore credits limit
    const creditsLimit = getPlanCreditsLimit(user.plan as any)
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt: null,
        creditsLimit
      }
    })

    console.log('Subscription reactivated:', subscription.id)
    return { success: true }

  } catch (error: any) {
    console.error('Error handling subscription reactivation:', error)
    return { success: false, error: error.message, retryable: true }
  }
}

// Helper functions
function getPlanCreditsLimit(plan: 'STARTER' | 'PREMIUM' | 'GOLD'): number {
  switch (plan) {
    case 'STARTER': return 500
    case 'PREMIUM': return 1200
    case 'GOLD': return 2500
    default: return 10
  }
}

function extractCreditAmount(externalReference?: string): number {
  if (!externalReference) return 0
  
  // Extract credit amount from external reference like "credits-100" or "package-300"
  const match = externalReference.match(/(?:credits?|package)-(\d+)/i)
  return match ? parseInt(match[1]) : 0
}