import { NextRequest, NextResponse } from 'next/server'
import { asaas } from '@/lib/payments/asaas'
import { updateSubscriptionStatus, getUserByAsaasCustomerId, logUsage } from '@/lib/db/subscriptions'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { recordCouponUsage } from '@/lib/services/coupon-service'

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

    const { event, payment, subscription, checkout } = body

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

      // Checkout session events
      case 'CHECKOUT_APPROVED':
      case 'CHECKOUT_CREATED':
        // informational only for now
        break
      case 'CHECKOUT_PAID':
        await handleCheckoutPaid(checkout)
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

      // Get current user balance before update
      const currentUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { creditsBalance: true }
      })

      const balanceAfter = (currentUser?.creditsBalance || 0) + creditPurchase.creditAmount

      // Add credits to user account (using correct field: creditsBalance)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          creditsBalance: { increment: creditPurchase.creditAmount }
        }
      })

      // Create credit transaction record for /account/orders page
      await prisma.creditTransaction.create({
        data: {
          userId: user.id,
          type: 'EARNED',
          source: 'PURCHASE',
          amount: creditPurchase.creditAmount,
          description: `Compra de ${creditPurchase.packageName || 'Pacote de Créditos'} - ${creditPurchase.creditAmount} créditos`,
          referenceId: payment.id,
          creditPurchaseId: creditPurchase.id,
          balanceAfter: balanceAfter,
          metadata: {
            packageName: creditPurchase.packageName,
            packageId: creditPurchase.packageId,
            value: creditPurchase.value,
            asaasPaymentId: payment.id,
            billingType: payment.billingType
          }
        }
      })

      console.log(`✅ Added ${creditPurchase.creditAmount} credits to user ${user.id} and created transaction record`)
    } else {
      // This is a subscription payment
      console.log('🔄 Processing subscription payment for user:', user.id)

      // Get subscription data from Asaas to extract plan info
      let planType: any = null
      let billingCycle: 'MONTHLY' | 'YEARLY' | null = null

      if (payment.subscription) {
        try {
          const asaasSubscription = await asaas.getSubscription(payment.subscription)
          console.log('📋 Asaas subscription data:', JSON.stringify(asaasSubscription, null, 2))

          // Map cycle from Asaas format to our format
          if (asaasSubscription.cycle === 'MONTHLY') billingCycle = 'MONTHLY'
          if (asaasSubscription.cycle === 'YEARLY') billingCycle = 'YEARLY'

          // Try to infer plan from value
          const value = asaasSubscription.value
          if (billingCycle === 'MONTHLY') {
            if (value === 39) planType = 'STARTER'
            else if (value === 69) planType = 'PREMIUM'
            else if (value === 149) planType = 'GOLD'
          } else if (billingCycle === 'YEARLY') {
            if (value === 390) planType = 'STARTER'  // 39 * 10
            else if (value === 690) planType = 'PREMIUM'  // 69 * 10
            else if (value === 1490) planType = 'GOLD'  // 149 * 10
          }

          console.log(`💡 Inferred plan: ${planType}, cycle: ${billingCycle}, value: ${value}`)

          // Save subscription ID if not saved
          if (!user.subscriptionId || user.subscriptionId !== payment.subscription) {
            await prisma.user.update({
              where: { id: user.id },
              data: { subscriptionId: payment.subscription }
            })
          }
        } catch (error) {
          console.error('Error fetching subscription from Asaas:', error)
        }
      }

      // Update subscription status to active with plan and cycle
      if (planType && billingCycle) {
        await updateSubscriptionStatus(
          user.id,
          'ACTIVE',
          undefined,
          planType,
          billingCycle
        )
        console.log(`✅ Activated ${planType} ${billingCycle} subscription for user ${user.id}`)
      } else {
        // Fallback: activate without changing plan (keeps existing plan if any)
        await updateSubscriptionStatus(user.id, 'ACTIVE')
        console.log(`⚠️ Activated subscription for user ${user.id} (plan could not be determined)`)
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

async function handleCheckoutPaid(checkout: any) {
  try {
    if (!checkout?.customer) {
      console.warn('Checkout webhook without customer:', checkout?.id)
      return
    }

    const user = await prisma.user.findFirst({
      where: { asaasCustomerId: checkout.customer },
      select: {
        id: true,
        plan: true,
        billingCycle: true,
        subscriptionId: true
      }
    })

    if (!user) {
      console.error('User not found for checkout:', checkout.id)
      return
    }

    let plan: 'STARTER' | 'PREMIUM' | 'GOLD' | undefined =
      (user.plan as 'STARTER' | 'PREMIUM' | 'GOLD' | undefined) || undefined

    let billingCycle: 'MONTHLY' | 'YEARLY' | undefined =
      (user.billingCycle === 'MONTHLY' || user.billingCycle === 'YEARLY')
        ? (user.billingCycle as 'MONTHLY' | 'YEARLY')
        : undefined

    if (!billingCycle && checkout?.subscription?.cycle) {
      const cycle = checkout.subscription.cycle.toUpperCase()
      if (cycle === 'MONTHLY' || cycle === 'YEARLY') {
        billingCycle = cycle
      }
    }

    if (!plan && checkout?.items?.length) {
      const itemText = `${checkout.items[0]?.name ?? ''} ${checkout.items[0]?.description ?? ''}`.toLowerCase()
      if (itemText.includes('starter')) plan = 'STARTER'
      else if (itemText.includes('premium')) plan = 'PREMIUM'
      else if (itemText.includes('gold')) plan = 'GOLD'
    }

    const periodEnd = checkout?.subscription?.nextDueDate
      ? new Date(checkout.subscription.nextDueDate)
      : undefined

    await updateSubscriptionStatus(
      user.id,
      'ACTIVE',
      periodEnd,
      plan,
      billingCycle
    )

    let paymentRecord = await prisma.payment.findFirst({
      where: {
        userId: user.id,
        asaasCheckoutId: checkout.id || checkout?.code || undefined
      },
      orderBy: { createdAt: 'desc' }
    })

    if (!paymentRecord && checkout.subscription) {
      paymentRecord = await prisma.payment.findFirst({
        where: {
          userId: user.id,
          subscriptionId: checkout.subscription
        },
        orderBy: { createdAt: 'desc' }
      })
    }

    const totalValue =
      checkout?.items?.reduce((sum: number, item: any) => sum + (item?.value ?? 0), 0) ?? 0

    if (paymentRecord) {
      await prisma.payment.update({
        where: { id: paymentRecord.id },
        data: {
          status: 'CONFIRMED',
          confirmedDate: new Date(),
          planType: plan,
          billingCycle,
          value: totalValue || paymentRecord.value,
          asaasCheckoutId: checkout.id || paymentRecord.asaasCheckoutId
        }
      })

      // Record coupon usage if coupon was used
      if (paymentRecord.couponCodeUsed && paymentRecord.discountApplied) {
        await recordCouponUsage(
          paymentRecord.couponCodeUsed,
          paymentRecord.userId,
          paymentRecord.id,
          paymentRecord.discountApplied
        )
        console.log('✅ [WEBHOOK] Coupon usage recorded:', {
          code: paymentRecord.couponCodeUsed,
          discount: paymentRecord.discountApplied,
          paymentId: paymentRecord.id
        })
      }
    } else {
      await prisma.payment.create({
        data: {
          userId: user.id,
          asaasCheckoutId: checkout.id,
          type: 'SUBSCRIPTION',
          status: 'CONFIRMED',
          billingType: 'CREDIT_CARD',
          value: totalValue,
          description: checkout.items?.[0]?.name || 'Assinatura via checkout',
          dueDate: periodEnd || new Date(),
          confirmedDate: new Date(),
          planType: plan,
          billingCycle,
          subscriptionId: checkout.subscription || user.subscriptionId || undefined
        }
      })
    }

    await logUsage({
      userId: user.id,
      action: 'CHECKOUT_PAID',
      creditsUsed: 0,
      details: {
        checkoutId: checkout.id,
        subscriptionId: checkout.subscription,
        plan,
        billingCycle
      }
    })
  } catch (error) {
    console.error('Error handling checkout paid webhook:', error)
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