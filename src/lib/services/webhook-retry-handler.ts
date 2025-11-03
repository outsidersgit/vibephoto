import { asaas } from '@/lib/payments/asaas'
import { updateSubscriptionStatus, getUserByAsaasCustomerId, logUsage } from '@/lib/db/subscriptions'
import { prisma } from '@/lib/prisma'

/**
 * Handle webhook event processing (used by retry mechanism)
 */
export async function handleWebhookEvent(webhookEvent: any) {
  const { event, payload } = webhookEvent
  const { payment, subscription } = payload || {}

  console.log(`🔄 Retrying webhook event: ${event}`)

  // Route to appropriate handler based on event type
  switch (event) {
    // Payment success events
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      await handlePaymentSuccess(payment)
      break

    case 'PAYMENT_OVERDUE':
      await handlePaymentOverdue(payment)
      break

    case 'PAYMENT_DELETED':
    case 'PAYMENT_REFUNDED':
      await handlePaymentCancelled(payment)
      break

    // Subscription events
    case 'SUBSCRIPTION_EXPIRED':
      await handleSubscriptionExpired(subscription)
      break

    case 'SUBSCRIPTION_CANCELLED':
      await handleSubscriptionCancelled(subscription)
      break

    case 'SUBSCRIPTION_REACTIVATED':
      await handleSubscriptionReactivated(subscription)
      break

    // Add other events as needed
    default:
      console.log(`⚠️  Unhandled event type in retry: ${event}`)
  }
}

// Handler functions (simplified versions from webhook route)
async function handlePaymentSuccess(payment: any) {
  const user = await getUserByAsaasCustomerId(payment.customer)
  if (!user) throw new Error('User not found')

  await updateSubscriptionStatus(user.id, 'ACTIVE')
  
  // CRÍTICO: Broadcast atualização para frontend
  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      creditsUsed: true,
      creditsLimit: true,
      creditsBalance: true,
      subscriptionStatus: true,
      plan: true
    }
  })

  if (updatedUser) {
    const { broadcastCreditsUpdate, broadcastUserUpdate } = await import('@/lib/services/realtime-service')
    await broadcastCreditsUpdate(
      user.id,
      updatedUser.creditsUsed,
      updatedUser.creditsLimit,
      'PAYMENT_RECEIVED_RETRY',
      updatedUser.creditsBalance
    ).catch(console.error)
    
    await broadcastUserUpdate(
      user.id,
      {
        plan: updatedUser.plan,
        subscriptionStatus: updatedUser.subscriptionStatus,
        creditsLimit: updatedUser.creditsLimit,
        creditsUsed: updatedUser.creditsUsed,
        creditsBalance: updatedUser.creditsBalance
      },
      'PAYMENT_RECEIVED_RETRY'
    ).catch(console.error)
  }

  await logUsage({
    userId: user.id,
    action: 'PAYMENT_RECEIVED',
    creditsUsed: 0,
    details: { paymentId: payment.id, value: payment.value }
  })
}

async function handlePaymentOverdue(payment: any) {
  const user = await getUserByAsaasCustomerId(payment.customer)
  if (!user) throw new Error('User not found')

  await updateSubscriptionStatus(user.id, 'OVERDUE')
}

async function handlePaymentCancelled(payment: any) {
  const user = await getUserByAsaasCustomerId(payment.customer)
  if (!user) throw new Error('User not found')

  await updateSubscriptionStatus(user.id, 'CANCELLED')
}

async function handleSubscriptionExpired(subscription: any) {
  const asaasSubscription = await asaas.getSubscription(subscription.id)
  const user = await getUserByAsaasCustomerId(asaasSubscription.customer)
  if (!user) throw new Error('User not found')

  await updateSubscriptionStatus(user.id, 'EXPIRED')
}

async function handleSubscriptionCancelled(subscription: any) {
  const asaasSubscription = await asaas.getSubscription(subscription.id)
  const user = await getUserByAsaasCustomerId(asaasSubscription.customer)
  if (!user) throw new Error('User not found')

  await updateSubscriptionStatus(user.id, 'CANCELLED')
}

async function handleSubscriptionReactivated(subscription: any) {
  const asaasSubscription = await asaas.getSubscription(subscription.id)
  const user = await getUserByAsaasCustomerId(asaasSubscription.customer)
  if (!user) throw new Error('User not found')

  await updateSubscriptionStatus(user.id, 'ACTIVE')
}