import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { asaas, getNextDueDate } from '@/lib/payments/asaas'
import { createSubscription } from '@/lib/db/subscriptions'
import { getPlanPrice } from '@/lib/db/subscription-plans'
import { Plan } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!session.user.id) {
      return NextResponse.json(
        { error: 'User ID not found in session' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { 
      customerId, 
      plan, 
      cycle = 'MONTHLY',
      billingType = 'CREDIT_CARD',
      creditCard,
      creditCardHolderInfo 
    } = body

    if (!customerId || !plan) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const planPrice = await getPlanPrice(plan as Plan, cycle) // Buscar do banco de dados
    const nextDueDate = getNextDueDate(cycle)

    // Get client IP address
    const remoteIp = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                     request.headers.get('x-real-ip') ||
                     '127.0.0.1'

    // Create subscription in Asaas
    const subscriptionData = {
      customer: customerId,
      billingType,
      value: planPrice,
      nextDueDate,
      cycle,
      description: `Plano ${plan} - Ensaio Fotos AI`,
      externalReference: `user_${session.user.id}_plan_${plan}`,
      ...(creditCard && {
        creditCard,
        creditCardHolderInfo: {
          ...creditCardHolderInfo,
          remoteIp // Adiciona o IP do cliente
        }
      })
    }

    const subscription = await asaas.createSubscription(subscriptionData)

    // Update user subscription in database
    const currentPeriodStart = new Date()
    const currentPeriodEnd = new Date(nextDueDate)

    await createSubscription({
      userId: session.user.id,
      asaasCustomerId: customerId,
      asaasSubscriptionId: subscription.id,
      plan: plan as Plan,
      status: subscription.status,
      currentPeriodStart,
      currentPeriodEnd
    })

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        nextDueDate: subscription.nextDueDate,
        value: subscription.value,
        paymentLink: subscription.paymentLink || null
      }
    })

  } catch (error: any) {
    console.error('Error creating Asaas subscription:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create subscription' },
      { status: 500 }
    )
  }
}