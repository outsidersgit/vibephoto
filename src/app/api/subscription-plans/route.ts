import { NextResponse } from 'next/server'
import { getAllSubscriptionPlans } from '@/lib/db/subscription-plans'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1 hora

/**
 * API pública para buscar planos de assinatura ativos
 * Usado pela página /pricing
 */
export async function GET() {
  try {
    const plans = await getAllSubscriptionPlans()
    
    // Filtrar apenas planos ativos para exibição pública
    const activePlans = plans
      .filter(plan => plan.isActive)
      .map(plan => ({
        id: plan.planId,
        name: plan.name,
        monthlyPrice: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
        monthlyEquivalent: plan.monthlyEquivalent,
        description: plan.description,
        features: plan.features,
        popular: plan.popular,
        credits: plan.credits,
        models: plan.models,
        color: plan.color
      }))

    return NextResponse.json({ plans: activePlans })
  } catch (error: any) {
    console.error('❌ [API_SUBSCRIPTION_PLANS] Error fetching plans:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

