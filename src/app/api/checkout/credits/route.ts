import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'
import { createCreditPackageCheckout } from '@/lib/services/asaas-checkout-service'

/**
 * API para criar checkout de pacote de créditos
 * POST /api/checkout/credits
 *
 * Body: {
 *   packageId: string
 *   billingType: 'PIX' | 'CREDIT_CARD'
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
    const { packageId, billingType } = body

    // Validação
    if (!packageId || !billingType) {
      return NextResponse.json(
        { success: false, error: 'Package ID e billing type são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar billing type
    const validBillingTypes = ['PIX', 'CREDIT_CARD']
    if (!validBillingTypes.includes(billingType)) {
      return NextResponse.json(
        { success: false, error: 'Billing type inválido' },
        { status: 400 }
      )
    }

    // Criar checkout
    const checkout = await createCreditPackageCheckout(
      packageId,
      billingType,
      userId
    )

    return NextResponse.json({
      success: true,
      ...checkout
    })

  } catch (error: any) {
    console.error('Checkout credits error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao criar checkout'
      },
      { status: 500 }
    )
  }
}
