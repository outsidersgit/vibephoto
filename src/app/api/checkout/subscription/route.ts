import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'
import { createSubscriptionCheckout } from '@/lib/services/asaas-checkout-service'

/**
 * API para criar checkout de assinatura
 * POST /api/checkout/subscription
 *
 * Body: {
 *   planId: 'STARTER' | 'PREMIUM' | 'GOLD'
 *   cycle: 'MONTHLY' | 'YEARLY'
 * }
 *
 * Returns: {
 *   success: true,
 *   checkoutId: string,
 *   checkoutUrl: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuthAPI()
    const userId = session.user.id

    const body = await req.json()
    const { planId, cycle } = body
    const referralCode =
      typeof body.referralCode === 'string'
        ? body.referralCode.trim().toUpperCase()
        : undefined
    const couponCode =
      typeof body.couponCode === 'string'
        ? body.couponCode.trim().toUpperCase()
        : undefined

    // Validação
    if (!planId || !cycle) {
      return NextResponse.json(
        { success: false, error: 'Plan ID e cycle são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar plan ID
    const validPlans = ['STARTER', 'PREMIUM', 'GOLD']
    if (!validPlans.includes(planId)) {
      return NextResponse.json(
        { success: false, error: 'Plan ID inválido' },
        { status: 400 }
      )
    }

    // Validar cycle
    const validCycles = ['MONTHLY', 'YEARLY']
    if (!validCycles.includes(cycle)) {
      return NextResponse.json(
        { success: false, error: 'Cycle inválido' },
        { status: 400 }
      )
    }

    // Criar checkout
    const checkout = await createSubscriptionCheckout(
      planId,
      cycle,
      userId,
      referralCode,
      couponCode
    )

    return NextResponse.json({
      success: true,
      ...checkout
    })

  } catch (error: any) {
    console.error('Checkout subscription error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao criar checkout'
      },
      { status: 500 }
    )
  }
}
