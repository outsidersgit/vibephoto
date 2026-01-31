import { NextResponse } from 'next/server'
import { getAllSubscriptionPlans } from '@/lib/db/subscription-plans'
import { getActivePlanFormat } from '@/lib/services/system-config-service'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1 hora

/**
 * API pública para buscar planos de assinatura ativos
 * Usado pela página /pricing
 */
export async function GET() {
  try {
    // Verificar se DATABASE_URL está definido
    if (!process.env.DATABASE_URL) {
      console.error('❌ [API_SUBSCRIPTION_PLANS] DATABASE_URL is not defined')
      return NextResponse.json(
        {
          error: 'Database configuration error',
          message: 'DATABASE_URL environment variable is not set'
        },
        { status: 500 }
      )
    }

    // Get active plan format
    const activePlanFormat = await getActivePlanFormat()
    console.log(`📋 [API_SUBSCRIPTION_PLANS] Active plan format: ${activePlanFormat}`)

    const allPlans = await getAllSubscriptionPlans()

    // Filter plans by active format
    const plans = allPlans.filter(plan => {
      const planFormat = plan.planFormat || 'TRADITIONAL'
      return planFormat === activePlanFormat
    })
    
    console.log(`✅ [API_SUBSCRIPTION_PLANS] Found ${plans.length} plans in database`)
    
    // Filtrar apenas planos ativos para exibição pública
    const activePlans = plans
      .filter(plan => plan.isActive)
      .map(plan => {
        const planFormat = plan.planFormat || 'TRADITIONAL'

        // Para Format B (Membership), usar campos específicos
        if (planFormat === 'MEMBERSHIP') {
          return {
            id: plan.planId,
            name: plan.name,
            price: plan.monthlyPrice, // Preço do ciclo completo
            monthlyEquivalent: plan.monthlyEquivalent,
            description: plan.description,
            features: Array.isArray(plan.features) ? plan.features : [],
            popular: plan.popular,
            credits: plan.cycleCredits || plan.credits, // Usar cycleCredits
            models: plan.models,
            color: plan.color,
            // Campos específicos do Format B
            planFormat: 'MEMBERSHIP' as const,
            billingCycle: plan.billingCycle,
            cycleCredits: plan.cycleCredits,
            cycleDurationMonths: plan.cycleDurationMonths
          }
        }

        // Para Format A (Traditional), manter estrutura original
        return {
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
          color: plan.color,
          planFormat: 'TRADITIONAL' as const
        }
      })

    console.log(`✅ [API_SUBSCRIPTION_PLANS] Returning ${activePlans.length} active plans for format ${activePlanFormat}`)

    if (activePlans.length === 0) {
      console.warn('⚠️ [API_SUBSCRIPTION_PLANS] No active plans found! Total plans:', plans.length, 'Format:', activePlanFormat)
    }

    return NextResponse.json({
      plans: activePlans,
      format: activePlanFormat
    })
  } catch (error: any) {
    console.error('❌ [API_SUBSCRIPTION_PLANS] Error fetching plans:', error)
    console.error('❌ [API_SUBSCRIPTION_PLANS] Error message:', error.message)
    console.error('❌ [API_SUBSCRIPTION_PLANS] Error stack:', error.stack)
    
    // Se for erro de Prisma por falta de DATABASE_URL, retornar erro específico
    if (error.message?.includes('DATABASE_URL') || error.message?.includes('environment variable')) {
      return NextResponse.json(
        { 
          error: 'Database configuration error',
          message: 'DATABASE_URL environment variable is not set. Please check your environment configuration.',
          code: 'DATABASE_CONFIG_ERROR'
        },
        { status: 500 }
      )
    }
    
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

