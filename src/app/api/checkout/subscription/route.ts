import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'
import { createSubscriptionCheckout } from '@/lib/services/asaas-checkout-service'

/**
 * API para criar checkout de assinatura
 * POST /api/checkout/subscription
 *
 * Suporta dois formatos:
 * - TRADITIONAL: planId = STARTER/PREMIUM/GOLD, cycle = MONTHLY/YEARLY
 * - MEMBERSHIP: planId = MEMBERSHIP_QUARTERLY/MEMBERSHIP_SEMI_ANNUAL/MEMBERSHIP_ANNUAL
 *
 * Body: {
 *   planId: string
 *   cycle: string
 *   referralCode?: string
 *   couponCode?: string
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

    // Validar plan ID (aceitar ambos formatos)
    const validTraditionalPlans = ['STARTER', 'PREMIUM', 'GOLD']
    const validMembershipPlans = ['MEMBERSHIP_QUARTERLY', 'MEMBERSHIP_SEMI_ANNUAL', 'MEMBERSHIP_ANNUAL']
    const allValidPlans = [...validTraditionalPlans, ...validMembershipPlans]

    if (!allValidPlans.includes(planId)) {
      return NextResponse.json(
        { success: false, error: 'Plan ID inválido' },
        { status: 400 }
      )
    }

    // Validar cycle (aceitar ambos formatos)
    const validCycles = ['MONTHLY', 'YEARLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL']
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
