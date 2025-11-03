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
    
    console.log(`✅ [API_SUBSCRIPTION_PLANS] Found ${plans.length} plans in database`)
    
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
        features: Array.isArray(plan.features) ? plan.features : [],
        popular: plan.popular,
        credits: plan.credits,
        models: plan.models,
        color: plan.color
      }))

    console.log(`✅ [API_SUBSCRIPTION_PLANS] Returning ${activePlans.length} active plans`)
    
    if (activePlans.length === 0) {
      console.warn('⚠️ [API_SUBSCRIPTION_PLANS] No active plans found! Total plans:', plans.length)
    }

    return NextResponse.json({ plans: activePlans })
  } catch (error: any) {
    console.error('❌ [API_SUBSCRIPTION_PLANS] Error fetching plans:', error)
    console.error('❌ [API_SUBSCRIPTION_PLANS] Error stack:', error.stack)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

