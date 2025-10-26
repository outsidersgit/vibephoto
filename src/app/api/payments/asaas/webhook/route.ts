import { NextRequest, NextResponse } from 'next/server'
import { asaas } from '@/lib/payments/asaas'
import { updateSubscriptionStatus, getUserByAsaasCustomerId, logUsage } from '@/lib/db/subscriptions'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    // Webhook security validation for Asaas
    let body: any
    const asaasWebhookToken = process.env.ASAAS_WEBHOOK_TOKEN

    if (asaasWebhookToken) {
      const asaasAccessToken = request.headers.get('asaas-access-token')

      if (!asaasAccessToken || asaasAccessToken !== asaasWebhookToken) {
        console.log('Asaas webhook: Invalid access token')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      body = await request.json()
    } else {
      console.warn('Asaas webhook: No ASAAS_WEBHOOK_TOKEN configured - webhook not secured')
      body = await request.json()
    }

    const { event, payment, subscription } = body

    console.log('Asaas Webhook received:', {
      event,
      payment: payment?.id,
      subscription: subscription?.id,
      timestamp: new Date().toISOString()
    })

    // Check if this webhook was already processed (deduplication)
    const existingEvent = await prisma.webhookEvent.findFirst({
      where: {
        event,
        asaasPaymentId: payment?.id || null,
        asaasSubscriptionId: subscription?.id || null,
        status: 'PROCESSED'
      }
    })

    if (existingEvent) {
      console.log('⚠️  Webhook already processed:', existingEvent.id)
      return NextResponse.json({
        received: true,
        message: 'Event already processed',
        eventId: existingEvent.id
      })
    }

    // Create webhook event record
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        event,
        asaasPaymentId: payment?.id,
        asaasSubscriptionId: subscription?.id,
        status: 'PENDING',
        rawData: body,
        userAgent: request.headers.get('user-agent') || undefined,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] ||
                   request.headers.get('x-real-ip') ||
                   undefined
      }
    })

    console.log('📝 Webhook event recorded:', webhookEvent.id)

    // Handle all Asaas webhook events
    switch (event) {
      // Payment events - Success flow
      case 'PAYMENT_CREATED':
        await handlePaymentCreated(payment)
        break

      case 'PAYMENT_AWAITING_RISK_ANALYSIS':
        await handlePaymentAwaitingRiskAnalysis(payment)
        break

      case 'PAYMENT_APPROVED_BY_RISK_ANALYSIS':
        await handlePaymentApprovedByRiskAnalysis(payment)
        break

      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        await handlePaymentSuccess(payment)
        break

      case 'PAYMENT_CREDITED':
        await handlePaymentCredited(payment)
        break

      // Payment events - Pending/Waiting
      case 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL':
        await handlePaymentAwaitingChargebackReversal(payment)
        break

      case 'PAYMENT_CHECKOUT_VIEWED':
        await handlePaymentCheckoutViewed(payment)
        break

      case 'PAYMENT_ANTICIPATED':
        await handlePaymentAnticipated(payment)
        break

      // Payment events - Problems
      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(payment)
        break

      case 'PAYMENT_REPROVED_BY_RISK_ANALYSIS':
        await handlePaymentReprovedByRiskAnalysis(payment)
        break

      case 'PAYMENT_UNAUTHORIZED':
        await handlePaymentUnauthorized(payment)
        break

      case 'PAYMENT_CHARGEBACK_REQUESTED':
        await handlePaymentChargebackRequested(payment)
        break

      case 'PAYMENT_CHARGEBACK_DISPUTE':
        await handlePaymentChargebackDispute(payment)
        break

      case 'PAYMENT_REFUND_IN_PROGRESS':
        await handlePaymentRefundInProgress(payment)
        break

      // Payment events - Cancellation/Refund
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
        await handlePaymentCancelled(payment)
        break

      case 'PAYMENT_DUNNING_RECEIVED':
        await handlePaymentDunningReceived(payment)
        break

      case 'PAYMENT_DUNNING_REQUESTED':
        await handlePaymentDunningRequested(payment)
        break

      // Payment events - Updates
      case 'PAYMENT_UPDATED':
        await handlePaymentUpdated(payment)
        break

      case 'PAYMENT_RESTORED':
        await handlePaymentRestored(payment)
        break

      // Subscription events
      case 'SUBSCRIPTION_CREATED':
        await handleSubscriptionCreated(subscription)
        break

      case 'SUBSCRIPTION_UPDATED':
        await handleSubscriptionUpdated(subscription)
        break

      case 'SUBSCRIPTION_EXPIRED':
        await handleSubscriptionExpired(subscription)
        break

      case 'SUBSCRIPTION_CANCELLED':
        await handleSubscriptionCancelled(subscription)
        break

      case 'SUBSCRIPTION_REACTIVATED':
        await handleSubscriptionReactivated(subscription)
        break

      default:
        console.log('⚠️  Unhandled webhook event:', event)
        // Log unhandled events for monitoring
        await logUsage({
          userId: 'system',
          action: 'WEBHOOK_UNHANDLED',
          creditsUsed: 0,
          details: { event, paymentId: payment?.id, subscriptionId: subscription?.id }
        })
    }

    // Mark webhook as processed
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        status: 'PROCESSED',
        processedAt: new Date()
      }
    })

    console.log('✅ Webhook processed successfully:', webhookEvent.id)

    return NextResponse.json({
      received: true,
      webhookEventId: webhookEvent.id,
      event
    })

  } catch (error: any) {
    console.error('❌ Webhook error:', error)

    // Try to log the error if we have a webhookEvent
    try {
      if (error.webhookEventId) {
        await prisma.webhookEvent.update({
          where: { id: error.webhookEventId },
          data: {
            status: 'FAILED',
            errorMessage: error.message,
            retryCount: { increment: 1 }
          }
        })
      }
    } catch (logError) {
      console.error('Failed to log webhook error:', logError)
    }

    return NextResponse.json(
      { error: 'Webhook processing failed', message: error.message },
      { status: 500 }
    )
  }
}

async function handlePaymentSuccess(payment: any) {
  try {
    // Find user by external reference or customer
    const user = await getUserByAsaasCustomerId(payment.customer)

    if (!user) {
      console.error('User not found for payment:', payment.id)
      return
    }

    // Save asaasCustomerId if this is the first payment
    if (!user.asaasCustomerId && payment.customer) {
      await prisma.user.update({
        where: { id: user.id },
        data: { asaasCustomerId: payment.customer }
      })
      console.log(`✅ Saved asaasCustomerId ${payment.customer} for user ${user.id}`)
    }

    // Check if this is a credit purchase (has asaasCheckoutId) or subscription payment
    const creditPurchase = await prisma.creditPurchase.findFirst({
      where: {
        OR: [
          { asaasPaymentId: payment.id },
          { asaasCheckoutId: payment.externalReference },
          { asaasCheckoutId: payment.checkoutSession } // Asaas usa checkoutSession, não externalReference
        ]
      }
    })

    if (creditPurchase) {
      // This is a credit package purchase via checkout
      console.log('💳 Processing credit package purchase:', creditPurchase.id)

      // Update credit purchase status
      await prisma.creditPurchase.update({
        where: { id: creditPurchase.id },
        data: {
          status: 'COMPLETED',
          asaasPaymentId: payment.id,
          confirmedAt: new Date()
        }
      })

      // Add credits to user account (using correct field: creditsBalance)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          creditsBalance: { increment: creditPurchase.creditAmount }
        }
      })

      console.log(`✅ Added ${creditPurchase.creditAmount} credits to user ${user.id}`)
    } else {
      // This is a subscription payment
      console.log('🔄 Processing subscription payment for user:', user.id)

      // Find the payment record to get the plan and billing cycle
      const paymentRecord = await prisma.payment.findFirst({
        where: {
          OR: [
            { asaasPaymentId: payment.id },
            { asaasCheckoutId: payment.externalReference }
          ]
        },
        select: { planType: true, billingCycle: true }
      })

      // Update subscription status to active with plan and cycle
      if (paymentRecord?.planType) {
        await updateSubscriptionStatus(
          user.id,
          'ACTIVE',
          undefined,
          paymentRecord.planType,
          paymentRecord.billingCycle as 'MONTHLY' | 'YEARLY' | undefined
        )
        console.log(`✅ Activated ${paymentRecord.planType} ${paymentRecord.billingCycle || ''} subscription for user ${user.id}`)
      } else {
        // Fallback: activate without changing plan
        await updateSubscriptionStatus(user.id, 'ACTIVE')
        console.log(`⚠️ Activated subscription for user ${user.id} (plan not found in payment record)`)
      }
    }

    // Log the payment
    await logUsage({
      userId: user.id,
      action: 'PAYMENT_RECEIVED',
      creditsUsed: 0,
      details: {
        paymentId: payment.id,
        value: payment.value,
        dueDate: payment.dueDate,
        type: creditPurchase ? 'CREDIT_PURCHASE' : 'SUBSCRIPTION'
      }
    })

    console.log('Payment confirmed for user:', user.id)
  } catch (error) {
    console.error('Error handling payment success:', error)
  }
}

async function handlePaymentOverdue(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    
    if (!user) {
      console.error('User not found for overdue payment:', payment.id)
      return
    }

    // Update subscription status to overdue
    await updateSubscriptionStatus(user.id, 'OVERDUE')

    console.log('Payment overdue for user:', user.id)
  } catch (error) {
    console.error('Error handling payment overdue:', error)
  }
}

async function handlePaymentCancelled(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    
    if (!user) {
      console.error('User not found for cancelled payment:', payment.id)
      return
    }

    // Update subscription status to cancelled
    await updateSubscriptionStatus(user.id, 'CANCELLED')

    console.log('Payment cancelled for user:', user.id)
  } catch (error) {
    console.error('Error handling payment cancellation:', error)
  }
}

async function handleSubscriptionExpired(subscription: any) {
  try {
    // Get subscription details from Asaas
    const asaasSubscription = await asaas.getSubscription(subscription.id)
    const user = await getUserByAsaasCustomerId(asaasSubscription.customer)
    
    if (!user) {
      console.error('User not found for expired subscription:', subscription.id)
      return
    }

    await updateSubscriptionStatus(user.id, 'EXPIRED')

    console.log('Subscription expired for user:', user.id)
  } catch (error) {
    console.error('Error handling subscription expiration:', error)
  }
}

async function handleSubscriptionCancelled(subscription: any) {
  try {
    const asaasSubscription = await asaas.getSubscription(subscription.id)
    const user = await getUserByAsaasCustomerId(asaasSubscription.customer)
    
    if (!user) {
      console.error('User not found for cancelled subscription:', subscription.id)
      return
    }

    await updateSubscriptionStatus(user.id, 'CANCELLED')

    console.log('Subscription cancelled for user:', user.id)
  } catch (error) {
    console.error('Error handling subscription cancellation:', error)
  }
}

async function handleSubscriptionReactivated(subscription: any) {
  try {
    const asaasSubscription = await asaas.getSubscription(subscription.id)
    const user = await getUserByAsaasCustomerId(asaasSubscription.customer)

    if (!user) {
      console.error('User not found for reactivated subscription:', subscription.id)
      return
    }

    await updateSubscriptionStatus(user.id, 'ACTIVE')

    console.log('Subscription reactivated for user:', user.id)
  } catch (error) {
    console.error('Error handling subscription reactivation:', error)
  }
}

// Additional payment event handlers
async function handlePaymentCreated(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    if (!user) return

    await logUsage({
      userId: user.id,
      action: 'PAYMENT_CREATED',
      creditsUsed: 0,
      details: { paymentId: payment.id, value: payment.value, billingType: payment.billingType }
    })
  } catch (error) {
    console.error('Error handling payment created:', error)
  }
}

async function handlePaymentAwaitingRiskAnalysis(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    if (!user) return

    await logUsage({
      userId: user.id,
      action: 'PAYMENT_AWAITING_RISK_ANALYSIS',
      creditsUsed: 0,
      details: { paymentId: payment.id }
    })
  } catch (error) {
    console.error('Error handling payment awaiting risk analysis:', error)
  }
}

async function handlePaymentApprovedByRiskAnalysis(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    if (!user) return

    await logUsage({
      userId: user.id,
      action: 'PAYMENT_APPROVED_BY_RISK_ANALYSIS',
      creditsUsed: 0,
      details: { paymentId: payment.id }
    })
  } catch (error) {
    console.error('Error handling payment approved by risk analysis:', error)
  }
}

async function handlePaymentReprovedByRiskAnalysis(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    if (!user) return

    await logUsage({
      userId: user.id,
      action: 'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
      creditsUsed: 0,
      details: { paymentId: payment.id, reason: payment.reasonCode }
    })
  } catch (error) {
    console.error('Error handling payment reproved by risk analysis:', error)
  }
}

async function handlePaymentCredited(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    if (!user) return

    await logUsage({
      userId: user.id,
      action: 'PAYMENT_CREDITED',
      creditsUsed: 0,
      details: { paymentId: payment.id, value: payment.value }
    })
  } catch (error) {
    console.error('Error handling payment credited:', error)
  }
}

async function handlePaymentUnauthorized(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    if (!user) return

    await updateSubscriptionStatus(user.id, 'PAYMENT_FAILED')
    await logUsage({
      userId: user.id,
      action: 'PAYMENT_UNAUTHORIZED',
      creditsUsed: 0,
      details: { paymentId: payment.id, reason: payment.reasonCode }
    })
  } catch (error) {
    console.error('Error handling payment unauthorized:', error)
  }
}

async function handlePaymentChargebackRequested(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    if (!user) return

    await updateSubscriptionStatus(user.id, 'CHARGEBACK')
    await logUsage({
      userId: user.id,
      action: 'PAYMENT_CHARGEBACK_REQUESTED',
      creditsUsed: 0,
      details: { paymentId: payment.id, value: payment.value }
    })
  } catch (error) {
    console.error('Error handling payment chargeback requested:', error)
  }
}

async function handlePaymentChargebackDispute(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    if (!user) return

    await logUsage({
      userId: user.id,
      action: 'PAYMENT_CHARGEBACK_DISPUTE',
      creditsUsed: 0,
      details: { paymentId: payment.id }
    })
  } catch (error) {
    console.error('Error handling payment chargeback dispute:', error)
  }
}

async function handlePaymentAwaitingChargebackReversal(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    if (!user) return

    await logUsage({
      userId: user.id,
      action: 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
      creditsUsed: 0,
      details: { paymentId: payment.id }
    })
  } catch (error) {
    console.error('Error handling payment awaiting chargeback reversal:', error)
  }
}

async function handlePaymentRefundInProgress(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    if (!user) return

    await logUsage({
      userId: user.id,
      action: 'PAYMENT_REFUND_IN_PROGRESS',
      creditsUsed: 0,
      details: { paymentId: payment.id, value: payment.value }
    })
  } catch (error) {
    console.error('Error handling payment refund in progress:', error)
  }
}

async function handlePaymentDunningReceived(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    if (!user) return

    await logUsage({
      userId: user.id,
      action: 'PAYMENT_DUNNING_RECEIVED',
      creditsUsed: 0,
      details: { paymentId: payment.id }
    })
  } catch (error) {
    console.error('Error handling payment dunning received:', error)
  }
}

async function handlePaymentDunningRequested(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    if (!user) return

    await logUsage({
      userId: user.id,
      action: 'PAYMENT_DUNNING_REQUESTED',
      creditsUsed: 0,
      details: { paymentId: payment.id }
    })
  } catch (error) {
    console.error('Error handling payment dunning requested:', error)
  }
}

async function handlePaymentCheckoutViewed(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    if (!user) return

    await logUsage({
      userId: user.id,
      action: 'PAYMENT_CHECKOUT_VIEWED',
      creditsUsed: 0,
      details: { paymentId: payment.id }
    })
  } catch (error) {
    console.error('Error handling payment checkout viewed:', error)
  }
}

async function handlePaymentAnticipated(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    if (!user) return

    await logUsage({
      userId: user.id,
      action: 'PAYMENT_ANTICIPATED',
      creditsUsed: 0,
      details: { paymentId: payment.id, value: payment.value }
    })
  } catch (error) {
    console.error('Error handling payment anticipated:', error)
  }
}

async function handlePaymentUpdated(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    if (!user) return

    await logUsage({
      userId: user.id,
      action: 'PAYMENT_UPDATED',
      creditsUsed: 0,
      details: { paymentId: payment.id, status: payment.status }
    })
  } catch (error) {
    console.error('Error handling payment updated:', error)
  }
}

async function handlePaymentRestored(payment: any) {
  try {
    const user = await getUserByAsaasCustomerId(payment.customer)
    if (!user) return

    await logUsage({
      userId: user.id,
      action: 'PAYMENT_RESTORED',
      creditsUsed: 0,
      details: { paymentId: payment.id }
    })
  } catch (error) {
    console.error('Error handling payment restored:', error)
  }
}

async function handleSubscriptionCreated(subscription: any) {
  try {
    const asaasSubscription = await asaas.getSubscription(subscription.id)
    const user = await getUserByAsaasCustomerId(asaasSubscription.customer)
    if (!user) return

    // Save asaasCustomerId if not already saved
    if (!user.asaasCustomerId && asaasSubscription.customer) {
      await prisma.user.update({
        where: { id: user.id },
        data: { asaasCustomerId: asaasSubscription.customer }
      })
      console.log(`✅ Saved asaasCustomerId ${asaasSubscription.customer} for user ${user.id}`)
    }

    await logUsage({
      userId: user.id,
      action: 'SUBSCRIPTION_CREATED',
      creditsUsed: 0,
      details: { subscriptionId: subscription.id, plan: asaasSubscription.value }
    })
  } catch (error) {
    console.error('Error handling subscription created:', error)
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  try {
    const asaasSubscription = await asaas.getSubscription(subscription.id)
    const user = await getUserByAsaasCustomerId(asaasSubscription.customer)
    if (!user) return

    await logUsage({
      userId: user.id,
      action: 'SUBSCRIPTION_UPDATED',
      creditsUsed: 0,
      details: { subscriptionId: subscription.id }
    })
  } catch (error) {
    console.error('Error handling subscription updated:', error)
  }
}