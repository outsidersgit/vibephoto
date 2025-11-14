import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { asaas, handleAsaasError } from '@/lib/payments/asaas'
import { updateSubscriptionStatus } from '@/lib/db/subscriptions'
import { broadcastCreditsUpdate, broadcastUserUpdate } from '@/lib/services/realtime-service'
import { incrementInfluencerStats } from '@/lib/db/influencers'
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
    creditCardToken?: string
  }
  subscription?: {
    id: string
    customer: string
    status: string
    nextDueDate?: string
    creditCardToken?: string
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

    const body: AsaasWebhookPayload = securityResult.body!

    // 2. Check for duplicate processing (idempotency)
    const existingEvent = await prisma.webhookEvent.findFirst({
      where: {
        event: body.event,
        asaasPaymentId: body.payment?.id || null,
        asaasSubscriptionId: body.subscription?.id || null,
        status: 'PROCESSED'
      },
      orderBy: { createdAt: 'desc' }
    })

    if (existingEvent) {
      console.log('Webhook already processed:', existingEvent.id)
      return NextResponse.json({ status: 'already_processed', eventId: existingEvent.id })
    }

    // 3. Create webhook event record
    webhookEvent = await prisma.webhookEvent.create({
      data: {
        event: body.event,
        asaasPaymentId: body.payment?.id,
        asaasSubscriptionId: body.subscription?.id,
        status: 'PENDING',
        rawData: body as any,
        userAgent: request.headers.get('user-agent') || undefined,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] ||
                   request.headers.get('x-real-ip') ||
                   undefined
      }
    })

    // 4. Process the webhook
    const processingResult = await processWebhookEvent(body)

    // 5. Update webhook event status
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        status: processingResult.success ? 'PROCESSED' : 'FAILED',
        processedAt: processingResult.success ? new Date() : null,
        errorMessage: processingResult.error
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
            status: 'FAILED',
            errorMessage: error.message,
            retryCount: { increment: 1 }
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
        
      case 'SUBSCRIPTION_CREATED':
        return await handleSubscriptionCreated(payload.subscription!)
        
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

/**
 * Helper function para salvar creditCardToken em User e PaymentMethod
 */
async function saveCreditCardToken(
  userId: string,
  token: string,
  isDefault: boolean = true
): Promise<void> {
  try {
    // 1. Salvar no User (fallback)
    await prisma.user.update({
      where: { id: userId },
      data: { asaasCreditCardToken: token }
    })
    console.log('✅ [WEBHOOK] Token salvo em User.asaasCreditCardToken:', userId)

    // 2. Criar ou atualizar PaymentMethod
    const existingPaymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        userId,
        asaasTokenId: token
      }
    })

    if (existingPaymentMethod) {
      // Atualizar existente
      await prisma.paymentMethod.update({
        where: { id: existingPaymentMethod.id },
        data: {
          isActive: true,
          isDefault: isDefault
        }
      })
      console.log('✅ [WEBHOOK] PaymentMethod atualizado com token:', existingPaymentMethod.id)
    } else {
      // Criar novo
      // Se isDefault é true, desativar outros métodos default
      if (isDefault) {
        await prisma.paymentMethod.updateMany({
          where: {
            userId,
            isDefault: true
          },
          data: {
            isDefault: false
          }
        })
      }

      await prisma.paymentMethod.create({
        data: {
          userId,
          asaasTokenId: token,
          isActive: true,
          isDefault: isDefault
        }
      })
      console.log('✅ [WEBHOOK] Novo PaymentMethod criado com token para usuário:', userId)
    }
  } catch (error: any) {
    console.error('❌ [WEBHOOK] Erro ao salvar creditCardToken:', error)
    // Não lançar erro, apenas logar (não crítico)
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
            plan: userAfterUpdate.plan || undefined,
            subscriptionStatus: userAfterUpdate.subscriptionStatus || undefined,
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

      // CRÍTICO: Atualizar Payment para CONFIRMED
      // Estratégia 1: Buscar por asaasCheckoutId (forma mais direta)
      let payment = await prisma.payment.findFirst({
        where: {
          userId: user.id,
          asaasCheckoutId: checkout.id,
          type: 'SUBSCRIPTION'
        },
        orderBy: { createdAt: 'desc' }
      })

      // Estratégia 2: Se não encontrou, buscar qualquer Payment PENDING do usuário para assinatura
      if (!payment) {
        console.log('⚠️ [WEBHOOK] Payment não encontrado por asaasCheckoutId, buscando Payment PENDING...')
        payment = await prisma.payment.findFirst({
          where: {
            userId: user.id,
            type: 'SUBSCRIPTION',
            status: 'PENDING',
            asaasCheckoutId: { not: null } // Payment do checkout tem asaasCheckoutId
          },
          orderBy: { createdAt: 'desc' }
        })
        
        if (payment) {
          console.log('✅ [WEBHOOK] Payment PENDING encontrado, atualizando asaasCheckoutId:', payment.id)
          // Atualizar o asaasCheckoutId se não estava salvo corretamente
          await prisma.payment.update({
            where: { id: payment.id },
            data: { asaasCheckoutId: checkout.id }
          })
        }
      }

      // Estratégia 3: Se ainda não encontrou, buscar pelo subscriptionId (se houver)
      if (!payment && checkout.subscription && user.subscriptionId) {
        console.log('⚠️ [WEBHOOK] Payment não encontrado, tentando buscar por subscriptionId...')
        payment = await prisma.payment.findFirst({
          where: {
            userId: user.id,
            type: 'SUBSCRIPTION',
            subscriptionId: checkout.subscription
          },
          orderBy: { createdAt: 'desc' }
        })
      }

      if (payment) {
        // Atualizar Payment para CONFIRMED
        console.log('🔄 [WEBHOOK] Atualizando Payment para CONFIRMED:', {
          paymentId: payment.id,
          currentStatus: payment.status,
          checkoutId: checkout.id
        })
        
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'CONFIRMED',
            confirmedDate: new Date(),
            asaasCheckoutId: checkout.id, // Garantir que está salvo corretamente
            ...(plan && { planType: plan }),
            ...(billingCycle && { billingCycle: billingCycle })
          }
        })
        console.log('✅ [WEBHOOK] Payment atualizado para CONFIRMED (CHECKOUT_PAID):', payment.id)
      } else {
        // Criar novo Payment se não existir (fallback de segurança)
        console.log('⚠️ [WEBHOOK] Payment não encontrado, criando novo registro...')
        // Buscar valor dos items
        const totalValue = checkout.items?.reduce((sum, item) => sum + (item.value || 0), 0) || 0
        
        const newPayment = await prisma.payment.create({
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
            billingCycle: billingCycle || undefined,
            ...(checkout.subscription && { subscriptionId: checkout.subscription })
          }
        })
        console.log('✅ [WEBHOOK] Novo Payment criado (CHECKOUT_PAID):', newPayment.id)
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
        name: true,
        referralCodeUsed: true,
        referredByInfluencerId: true
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

    let influencerCandidateId: string | null = user.referredByInfluencerId || null
    let commissionReferralCode: string | null = user.referralCodeUsed || null
    let wasAlreadyConfirmed = false

    // Salvar creditCardToken se presente
    if (payment.creditCardToken) {
      await saveCreditCardToken(user.id, payment.creditCardToken, true)
    }

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
              status: true,
              influencerId: true,
              referralCodeUsed: true
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
          if (originalPayment.influencerId) {
            influencerCandidateId = originalPayment.influencerId
          }
          if (originalPayment.referralCodeUsed) {
            commissionReferralCode = originalPayment.referralCodeUsed
          }
          if (originalPayment.status === 'CONFIRMED') {
            wasAlreadyConfirmed = true
          }
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
              status: true,
              influencerId: true,
              referralCodeUsed: true
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
            if (originalPayment.influencerId) {
              influencerCandidateId = originalPayment.influencerId
            }
            if (originalPayment.referralCodeUsed) {
              commissionReferralCode = originalPayment.referralCodeUsed
            }
            if (originalPayment.status === 'CONFIRMED') {
              wasAlreadyConfirmed = true
            }
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
            if (originalPayment.influencerId) {
              influencerCandidateId = originalPayment.influencerId
            }
            if (originalPayment.referralCodeUsed) {
              commissionReferralCode = originalPayment.referralCodeUsed
            }
            if (originalPayment.status === 'CONFIRMED') {
              wasAlreadyConfirmed = true
            }
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
            plan: userAfterUpdate.plan || undefined,
            subscriptionStatus: userAfterUpdate.subscriptionStatus || undefined,
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
                billingCycle: billingCycle || undefined,
                influencerId: influencerCandidateId || undefined,
                referralCodeUsed: commissionReferralCode || undefined
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
            where: { asaasPaymentId: payment.id },
            select: {
              id: true,
              status: true,
              influencerId: true,
              referralCodeUsed: true
            }
          })

          if (existingPayment) {
            // Payment já existe, apenas atualizar status
            if (existingPayment.influencerId) {
              influencerCandidateId = existingPayment.influencerId
            }
            if (existingPayment.referralCodeUsed) {
              commissionReferralCode = existingPayment.referralCodeUsed
            }
            if (existingPayment.status === 'CONFIRMED') {
              wasAlreadyConfirmed = true
            }
            await prisma.payment.update({
              where: { id: existingPayment.id },
              data: {
                status: 'CONFIRMED',
                confirmedDate: new Date(),
                ...(plan && { planType: plan }),
                ...(billingCycle && { billingCycle: billingCycle }),
                ...(payment.subscription && { subscriptionId: payment.subscription }),
                ...(commissionReferralCode ? { referralCodeUsed: commissionReferralCode } : {})
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
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                status: true,
                asaasCheckoutId: true,
                influencerId: true,
                referralCodeUsed: true
              }
            })

            if (pendingPayment) {
              if (pendingPayment.influencerId) {
                influencerCandidateId = pendingPayment.influencerId
              }
              if (pendingPayment.referralCodeUsed) {
                commissionReferralCode = pendingPayment.referralCodeUsed
              }
              if (pendingPayment.status === 'CONFIRMED') {
                wasAlreadyConfirmed = true
              }
              // Atualizar este Payment PENDING encontrado
              await prisma.payment.update({
                where: { id: pendingPayment.id },
                data: {
                  asaasPaymentId: payment.id,
                  subscriptionId: payment.subscription,
                  status: 'CONFIRMED',
                  confirmedDate: new Date(),
                  ...(plan && { planType: plan }),
                  ...(billingCycle && { billingCycle: billingCycle }),
                  ...(commissionReferralCode ? { referralCodeUsed: commissionReferralCode } : {})
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
                  billingCycle: billingCycle || undefined,
                  influencerId: influencerCandidateId || undefined,
                  referralCodeUsed: commissionReferralCode || undefined
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

      if (influencerCandidateId && !wasAlreadyConfirmed) {
        try {
          const influencerRecord = await prisma.influencer.findUnique({
            where: { id: influencerCandidateId },
            select: {
              commissionPercentage: true,
              commissionFixedValue: true
            }
          })

          if (influencerRecord) {
            const paymentValue = Number(payment.value || 0)
            const fixedCommission = influencerRecord.commissionFixedValue
              ? Number(influencerRecord.commissionFixedValue)
              : 0
            const percentCommission = influencerRecord.commissionPercentage
              ? Number(influencerRecord.commissionPercentage)
              : 0

            let commissionValue = 0

            if (fixedCommission > 0) {
              commissionValue = fixedCommission
            } else if (percentCommission > 0 && paymentValue > 0) {
              commissionValue = (paymentValue * percentCommission) / 100
            }

            commissionValue = Math.round(commissionValue * 100) / 100

            if (commissionValue > 0) {
              await incrementInfluencerStats(influencerCandidateId, {
                referrals: 1,
                commissionValue
              })
              console.log('✅ [WEBHOOK] Comissão registrada para influenciador:', {
                influencerId: influencerCandidateId,
                commissionValue,
                paymentId: payment.id
              })
            }
          }
        } catch (influencerError) {
          console.error('⚠️ [WEBHOOK] Erro ao registrar comissão do influenciador:', influencerError)
        }
      }
      
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
        const packageFromDb = creditPurchase.packageId
          ? await prisma.creditPackage.findUnique({
              where: { id: creditPurchase.packageId }
            })
          : null

        const packageName = packageFromDb?.name ?? creditPurchase.packageName
        const creditsFromPackage =
          packageFromDb
            ? packageFromDb.creditAmount + packageFromDb.bonusCredits
            : creditPurchase.creditAmount
        const bonusCreditsFromPackage =
          packageFromDb?.bonusCredits ?? creditPurchase.bonusCredits ?? 0
        const packageValue = packageFromDb?.price ?? creditPurchase.value
        
        // Atualizar CreditPurchase existente
        await prisma.creditPurchase.update({
          where: { id: creditPurchase.id },
          data: {
            asaasPaymentId: payment.id,
            status: 'CONFIRMED',
            confirmedAt: new Date(),
            packageName,
            packageId: packageFromDb?.id ?? creditPurchase.packageId,
            creditAmount: creditsFromPackage,
            bonusCredits: bonusCreditsFromPackage,
            value: packageValue
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
              creditsBalance: { increment: creditsFromPackage }
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
                amount: creditsFromPackage,
                description: `Compra de ${packageName} - ${creditsFromPackage} créditos`,
              referenceId: payment.id,
              creditPurchaseId: creditPurchase.id,
              balanceAfter: (userForTransaction?.creditsBalance || 0),
              metadata: {
                  packageName,
                  packageId: packageFromDb?.id ?? creditPurchase.packageId,
                  value: packageValue,
                  bonusCredits: bonusCreditsFromPackage,
                  creditsUsedFromRecord: creditPurchase.creditAmount,
                asaasPaymentId: payment.id,
                billingType: payment.billingType
              }
            }
          })

          console.log(`✅ [WEBHOOK] Adicionados ${creditsFromPackage} créditos para usuário ${user.id} (pacote: ${packageName})`)

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
              creditsAdded: creditsFromPackage,
              creditsBalance: userAfterUpdate.creditsBalance
            })
          }
        } else {
          console.log(`⚠️ [WEBHOOK] CreditPurchase já estava confirmado, pulando adição de créditos`)
        }
      } else {
        // Tentar extrair creditAmount do externalReference ou description
        const creditAmount = extractCreditAmount(payment.externalReference || '')
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

  console.log('='.repeat(80))
  console.log('🔔 [WEBHOOK] PROCESSANDO SUBSCRIPTION_CANCELLED')
  console.log('📦 Dados da subscription recebida:', {
    id: subscription.id,
    customer: subscription.customer,
    status: subscription.status
  })
  console.log('='.repeat(80))

  try {
    // Buscar dados completos da subscription do Asaas para obter nextDueDate e endDate
    let subscriptionData: any = null
    try {
      subscriptionData = await asaas.getSubscription(subscription.id)
      console.log('✅ [WEBHOOK] Subscription data fetched:', {
        subscriptionId: subscription.id,
        status: subscriptionData.status,
        nextDueDate: subscriptionData.nextDueDate,
        endDate: subscriptionData.endDate
      })
    } catch (fetchError: any) {
      console.warn('⚠️ [WEBHOOK] Could not fetch subscription details from Asaas:', fetchError.message)
      // Continuar mesmo se não conseguir buscar, usar dados do webhook
    }

    const user = await prisma.user.findUnique({
      where: { asaasCustomerId: subscription.customer },
      select: { 
        id: true,
        subscriptionId: true,
        subscriptionStatus: true,
        nextDueDate: true // Buscar nextDueDate salvo
      }
    })

    if (!user) {
      console.error('❌ [WEBHOOK] User not found for subscription:', subscription.id, 'customer:', subscription.customer)
      return { success: false, error: 'User not found', retryable: false }
    }

    // Verificar se a subscription pertence ao usuário
    if (user.subscriptionId !== subscription.id) {
      console.warn('⚠️ [WEBHOOK] Subscription ID mismatch:', {
        userSubscriptionId: user.subscriptionId,
        webhookSubscriptionId: subscription.id
      })
      // Continuar mesmo assim, pode ser uma atualização
    }

    const cancelDate = new Date()

    // CRÍTICO: Determinar subscriptionEndsAt baseado em:
    // PRIORIDADE 1: nextDueDate salvo na tabela users (do webhook SUBSCRIPTION_CREATED)
    // PRIORIDADE 2: endDate da subscription do Asaas (se disponível)
    // PRIORIDADE 3: nextDueDate da subscription do Asaas (se disponível)
    // FALLBACK: usar data atual + 30 dias se não encontrar nada
    let subscriptionEndsAt: Date
    
    if (user.nextDueDate) {
      // Usar nextDueDate salvo do webhook SUBSCRIPTION_CREATED (correto)
      subscriptionEndsAt = user.nextDueDate
      console.log('✅ [WEBHOOK] Usando nextDueDate salvo na tabela users (do SUBSCRIPTION_CREATED):', subscriptionEndsAt.toISOString())
    } else if (subscriptionData?.endDate) {
      subscriptionEndsAt = new Date(subscriptionData.endDate)
      console.log('⚠️ [WEBHOOK] nextDueDate não encontrado na tabela, usando endDate da subscription:', subscriptionEndsAt.toISOString())
    } else if (subscriptionData?.nextDueDate) {
      subscriptionEndsAt = new Date(subscriptionData.nextDueDate)
      console.log('⚠️ [WEBHOOK] nextDueDate não encontrado na tabela, usando nextDueDate da API:', subscriptionEndsAt.toISOString())
    } else {
      // Fallback: usar data atual + 30 dias (último recurso)
      console.warn('⚠️ [WEBHOOK] Nenhum nextDueDate encontrado, usando fallback (now + 30 days)')
      subscriptionEndsAt = new Date(cancelDate.getTime() + 30 * 24 * 60 * 60 * 1000)
    }

    // Atualizar usuário com dados completos
    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: 'CANCELLED',
        subscriptionCancelledAt: cancelDate,
        subscriptionEndsAt: subscriptionEndsAt
      }
    })

    console.log('✅ [WEBHOOK] Subscription cancelled:', {
      subscriptionId: subscription.id,
      userId: user.id,
      cancelledAt: cancelDate.toISOString(),
      endsAt: subscriptionEndsAt.toISOString()
    })

    // Broadcast atualização para frontend
    await broadcastUserUpdate(
      user.id,
      {
        subscriptionStatus: 'CANCELLED',
        subscriptionEndsAt: subscriptionEndsAt.toISOString()
      },
      'SUBSCRIPTION_CANCELLED'
    ).catch((error) => {
      console.error('❌ [WEBHOOK] Erro ao broadcast user update:', error)
      // Não falhar se broadcast falhar
    })

    return { success: true }

  } catch (error: any) {
    console.error('❌ [WEBHOOK] Error handling subscription cancellation:', error)
    return { success: false, error: error.message, retryable: true }
  }
}

async function handleSubscriptionCreated(subscription: AsaasWebhookPayload['subscription']): Promise<{
  success: boolean
  error?: string
  retryable?: boolean
}> {
  if (!subscription) {
    return { success: false, error: 'Missing subscription data', retryable: false }
  }

  console.log('='.repeat(80))
  console.log('🔔 [WEBHOOK] PROCESSANDO SUBSCRIPTION_CREATED')
  console.log('📦 Dados da subscription recebida:', {
    id: subscription.id,
    customer: subscription.customer,
    status: subscription.status,
    nextDueDate: subscription.nextDueDate,
    creditCardToken: subscription.creditCardToken ? '***' : undefined
  })
  console.log('='.repeat(80))

  try {
    // Buscar dados completos da subscription via API do Asaas
    let subscriptionData: any = null
    try {
      subscriptionData = await asaas.getSubscription(subscription.id)
      console.log('✅ [WEBHOOK] Subscription data fetched from Asaas:', {
        subscriptionId: subscription.id,
        status: subscriptionData.status,
        nextDueDate: subscriptionData.nextDueDate,
        cycle: subscriptionData.cycle
      })
    } catch (fetchError: any) {
      console.warn('⚠️ [WEBHOOK] Could not fetch subscription details from Asaas:', fetchError.message)
      // Continuar mesmo se não conseguir buscar
    }

    const user = await prisma.user.findUnique({
      where: { asaasCustomerId: subscription.customer },
      select: { 
        id: true,
        subscriptionId: true,
        email: true,
        name: true
      }
    })

    if (!user) {
      console.error('❌ [WEBHOOK] User not found for subscription:', subscription.id, 'customer:', subscription.customer)
      return { success: false, error: 'User not found', retryable: false }
    }

    // Determinar nextDueDate
    // PRIORIDADE 1: Do webhook (subscription.nextDueDate) - este é o correto (data da próxima renovação)
    // PRIORIDADE 2: Da API do Asaas (subscriptionData.nextDueDate)
    let nextDueDate: Date | null = null
    
    if (subscription.nextDueDate) {
      nextDueDate = new Date(subscription.nextDueDate)
      console.log('✅ [WEBHOOK] nextDueDate do webhook (CORRETO - próxima renovação):', nextDueDate.toISOString())
    } else if (subscriptionData?.nextDueDate) {
      nextDueDate = new Date(subscriptionData.nextDueDate)
      console.log('✅ [WEBHOOK] nextDueDate da API do Asaas:', nextDueDate.toISOString())
    } else {
      console.warn('⚠️ [WEBHOOK] nextDueDate não encontrado no webhook nem na API')
    }

    // Preparar dados de atualização
    const updateData: any = {
      subscriptionId: subscription.id
    }

    if (nextDueDate) {
      updateData.nextDueDate = nextDueDate
    }

    // Atualizar usuário
    await prisma.user.update({
      where: { id: user.id },
      data: updateData
    })

    console.log('✅ [WEBHOOK] Subscription ID e nextDueDate salvos:', {
      userId: user.id,
      subscriptionId: subscription.id,
      nextDueDate: nextDueDate?.toISOString()
    })

    // Salvar creditCardToken se presente
    const tokenToSave = subscription.creditCardToken || subscriptionData?.creditCardToken
    if (tokenToSave) {
      await saveCreditCardToken(user.id, tokenToSave, true)
      console.log('✅ [WEBHOOK] creditCardToken salvo do webhook SUBSCRIPTION_CREATED')
    }

    return { success: true }

  } catch (error: any) {
    console.error('❌ [WEBHOOK] Error handling subscription created:', error)
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