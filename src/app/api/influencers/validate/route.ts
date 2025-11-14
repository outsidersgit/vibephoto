import { NextRequest, NextResponse } from 'next/server'
import { findInfluencerByCouponCode } from '@/lib/db/influencers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawCode = typeof body.code === 'string' ? body.code : ''
    const sanitizedCode = rawCode.trim().toUpperCase()

    if (!sanitizedCode) {
      return NextResponse.json(
        { valid: false, error: 'Informe um código de indicação.' },
        { status: 400 }
      )
    }

    const influencer = await findInfluencerByCouponCode(sanitizedCode, { includeUser: true })

    if (!influencer) {
      return NextResponse.json(
        { valid: false, error: 'Código não encontrado.' },
        { status: 404 }
      )
    }

    if (!influencer.asaasWalletId) {
      return NextResponse.json(
        { valid: false, error: 'Influenciador sem wallet configurada. Entre em contato com o suporte.' },
        { status: 422 }
      )
    }

    const commissionPercentage =
      influencer.commissionPercentage != null
        ? Number(influencer.commissionPercentage)
        : null
    const commissionFixedValue =
      influencer.commissionFixedValue != null
        ? Number(influencer.commissionFixedValue)
        : null

    return NextResponse.json({
      valid: true,
      influencer: {
        id: influencer.id,
        couponCode: influencer.couponCode,
        name: influencer.user?.name || influencer.user?.email || null,
        commissionPercentage,
        commissionFixedValue
      }
    })
  } catch (error) {
    console.error('[API] validate influencer code error:', error)
    return NextResponse.json(
      { valid: false, error: 'Não foi possível validar o código neste momento.' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { findInfluencerByCouponCode } from '@/lib/db/influencers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawCode = (body?.code as string | undefined)?.trim()

    if (!rawCode) {
      return NextResponse.json(
        { success: false, error: 'Código não informado.' },
        { status: 400 }
      )
    }

    const code = rawCode.toUpperCase()
    const influencer = await findInfluencerByCouponCode(code, { includeUser: true })

    if (!influencer) {
      return NextResponse.json(
        { success: false, error: 'Código não encontrado.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      influencer: {
        id: influencer.id,
        couponCode: influencer.couponCode,
        commissionPercentage: influencer.commissionPercentage.toNumber(),
        commissionFixedValue: influencer.commissionFixedValue
          ? influencer.commissionFixedValue.toNumber()
          : null,
        totalReferrals: influencer.totalReferrals,
        totalCommissions: influencer.totalCommissions.toNumber(),
        name: influencer.user?.name || null,
        email: influencer.user?.email || null
      }
    })
  } catch (error) {
    console.error('❌ [Validate Influencer Code] Erro inesperado:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno ao validar o código.' },
      { status: 500 }
    )
  }
}

