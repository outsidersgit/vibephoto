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

