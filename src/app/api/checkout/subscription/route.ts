import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'
import { createSubscriptionCheckout } from '@/lib/services/asaas-checkout-service'
import { getAllSubscriptionPlans } from '@/lib/db/subscription-plans'
import { getActivePlanFormat } from '@/lib/services/system-config-service'

/**
 * API para criar checkout de assinatura
 * POST /api/checkout/subscription
 *
 * Body: {
 *   planId: string (ID do plano - ex: 'STARTER', 'MEMBERSHIP_QUARTERLY', etc)
 *   cycle?: 'MONTHLY' | 'YEARLY' (apenas para Format A - Traditional)
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

    // Validação básica
    if (!planId) {
      return NextResponse.json(
        { success: false, error: 'Plan ID é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar formato ativo e planos do banco
    const activePlanFormat = await getActivePlanFormat()
    const dbPlans = await getAllSubscriptionPlans()

    // Validar se o plano existe no banco
    const planExists = dbPlans.some(p => p.planId === planId)
    if (!planExists) {
      return NextResponse.json(
        { success: false, error: 'Plan ID inválido ou inativo' },
        { status: 400 }
      )
    }

    // Para Format A (Traditional), validar cycle
    if (activePlanFormat === 'TRADITIONAL') {
      if (!cycle) {
        return NextResponse.json(
          { success: false, error: 'Cycle é obrigatório para planos Traditional' },
          { status: 400 }
        )
      }

      const validCycles = ['MONTHLY', 'YEARLY']
      if (!validCycles.includes(cycle)) {
        return NextResponse.json(
          { success: false, error: 'Cycle inválido. Use MONTHLY ou YEARLY' },
          { status: 400 }
        )
      }
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
