import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'
import { getCheckoutStatus } from '@/lib/services/asaas-checkout-service'

/**
 * API para consultar status de um checkout
 * GET /api/checkout/status/[id]
 *
 * Returns: {
 *   success: true,
 *   checkout: { ... }
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuthAPI()

    const checkoutId = params.id

    if (!checkoutId) {
      return NextResponse.json(
        { success: false, error: 'Checkout ID é obrigatório' },
        { status: 400 }
      )
    }

    // Consultar status
    const result = await getCheckoutStatus(checkoutId)

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Checkout status error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao consultar status'
      },
      { status: 500 }
    )
  }
}
