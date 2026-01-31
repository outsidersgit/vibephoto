import { NextResponse } from 'next/server'
import { getAllSubscriptionPlans } from '@/lib/db/subscription-plans'
import { getActivePlanFormat } from '@/lib/services/system-config-service'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1 hora

/**
 * API pública para buscar planos de assinatura ativos
 * Usado pela página /pricing
 *
 * Suporta dois formatos:
 * - TRADITIONAL (Formato A): 3 planos × 2 ciclos
 * - MEMBERSHIP (Formato B): 1 plano × 3 ciclos
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

    // Buscar formato ativo
    const activeFormat = await getActivePlanFormat()
    console.log(`✅ [API_SUBSCRIPTION_PLANS] Formato ativo: ${activeFormat}`)

    // Buscar todos os planos do banco
    const allPlans = await getAllSubscriptionPlans()
    console.log(`✅ [API_SUBSCRIPTION_PLANS] Found ${allPlans.length} plans in database`)

    // Filtrar planos pelo formato ativo
    const plans = allPlans.filter(plan => {
      // Filtrar por formato e ativo
      const matchesFormat = plan.planFormat === activeFormat
      const isActive = plan.isActive

      if (!matchesFormat) {
        console.log(`⚠️ [API_SUBSCRIPTION_PLANS] Skipping plan ${plan.planId} (format: ${plan.planFormat}, expected: ${activeFormat})`)
      }

      return matchesFormat && isActive
    })

    console.log(`✅ [API_SUBSCRIPTION_PLANS] Filtered to ${plans.length} plans for format ${activeFormat}`)

    // Formatar resposta baseado no formato
    if (activeFormat === 'TRADITIONAL') {
      // Formato A: Estrutura atual (3 planos com ciclos mensal/anual)
      const activePlans = plans.map(plan => ({
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

      console.log(`✅ [API_SUBSCRIPTION_PLANS] Returning ${activePlans.length} traditional plans`)

      if (activePlans.length === 0) {
        console.warn('⚠️ [API_SUBSCRIPTION_PLANS] No active traditional plans found!')
      }

      return NextResponse.json({
        plans: activePlans,
        format: 'TRADITIONAL'
      })

    } else {
      // Formato B: Estrutura nova (1 plano com 3 variações de ciclo)
      const membershipPlans = plans.map(plan => ({
        id: plan.planId,
        name: plan.name,
        description: plan.description,
        features: Array.isArray(plan.features) ? plan.features : [],
        popular: plan.popular,
        models: plan.models,
        color: plan.color,

        // Cycle-specific details
        billingCycle: plan.billingCycle, // 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'
        price: plan.monthlyPrice, // Preço TOTAL do ciclo (não é mensal)
        cycleCredits: plan.cycleCredits, // Créditos fixos por ciclo
        cycleDurationMonths: plan.cycleDurationMonths, // 3, 6, ou 12
        monthlyEquivalent: plan.monthlyEquivalent // Preço equivalente mensal
      }))

      console.log(`✅ [API_SUBSCRIPTION_PLANS] Returning ${membershipPlans.length} membership plans`)

      if (membershipPlans.length === 0) {
        console.warn('⚠️ [API_SUBSCRIPTION_PLANS] No active membership plans found!')
      }

      return NextResponse.json({
        plans: membershipPlans,
        format: 'MEMBERSHIP'
      })
    }
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

