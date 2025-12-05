import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'
import { validateCoupon } from '@/lib/services/coupon-service'

/**
 * API para validar cupom de desconto
 * POST /api/coupons/validate
 *
 * Body: {
 *   code: string,
 *   planId: 'STARTER' | 'PREMIUM' | 'GOLD',
 *   cycle: 'MONTHLY' | 'YEARLY'
 * }
 *
 * Returns: {
 *   valid: boolean,
 *   coupon?: {
 *     code: string,
 *     type: 'DISCOUNT' | 'HYBRID',
 *     discountType: 'FIXED' | 'PERCENTAGE',
 *     discountValue: number,
 *     discountAmount: number, // Calculated discount in BRL
 *     finalPrice: number, // Price after discount
 *     influencer?: { id: string, ... }
 *   },
 *   error?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuthAPI()
    const userId = session.user.id

    const body = await req.json()
    const { code, planId, cycle } = body

    // Validação básica
    if (!code || !planId || !cycle) {
      return NextResponse.json(
        { valid: false, error: 'Código, plano e ciclo são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar plan ID
    const validPlans = ['STARTER', 'PREMIUM', 'GOLD']
    if (!validPlans.includes(planId)) {
      return NextResponse.json(
        { valid: false, error: 'Plan ID inválido' },
        { status: 400 }
      )
    }

    // Validar cycle
    const validCycles = ['MONTHLY', 'YEARLY']
    if (!validCycles.includes(cycle)) {
      return NextResponse.json(
        { valid: false, error: 'Cycle inválido' },
        { status: 400 }
      )
    }

    // Validar cupom
    const result = await validateCoupon(code, planId, cycle, userId)

    if (!result.valid) {
      return NextResponse.json({
        valid: false,
        error: result.error || 'Cupom inválido'
      })
    }

    return NextResponse.json({
      valid: true,
      coupon: result.coupon
    })

  } catch (error: any) {
    console.error('Validate coupon error:', error)

    return NextResponse.json(
      {
        valid: false,
        error: error.message || 'Erro ao validar cupom'
      },
      { status: 500 }
    )
  }
}
