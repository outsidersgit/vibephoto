import { Plan } from '@prisma/client'
import { getSubscriptionPlanById, getPlanPrice as getDbPlanPrice } from '@/lib/db/subscription-plans'

/**
 * Centralized plan configuration
 * DEPRECATED: Agora os dados vêm do banco de dados
 * Mantido para compatibilidade - funções agora buscam do banco
 */

/**
 * Cost to create additional AI models beyond the included one
 */
export const ADDITIONAL_MODEL_COST = 500 // credits

export interface PlanConfig {
  credits: number
  models: number
  resolution: string
  features: string[]
  price: {
    monthly: number
    yearly: number
  }
}

/**
 * DEPRECATED: Agora usa dados do banco
 * Mantido como fallback temporário
 */
const PLAN_CONFIGS_FALLBACK: Record<Plan, PlanConfig> = {
  STARTER: {
    credits: 500,
    models: 1,
    resolution: '512x512',
    features: [
      '500 créditos/mês',
      '1 modelo de IA incluído',
      'Modelos adicionais: 500 créditos',
      'Máxima resolução',
      'Galeria pessoal',
      'Suporte por email'
    ],
    price: {
      monthly: 89.00,
      yearly: 708.00
    }
  },
  PREMIUM: {
    credits: 1200,
    models: 1,
    resolution: '1024x1024',
    features: [
      '1.200 créditos/mês',
      '1 modelo de IA incluído',
      'Modelos adicionais: 500 créditos',
      'Máxima resolução',
      'Pacotes premium inclusos',
      'Galeria ampliada',
      'Suporte prioritário'
    ],
    price: {
      monthly: 269.00,
      yearly: 2148.00
    }
  },
  GOLD: {
    credits: 2500,
    models: 1,
    resolution: '2048x2048',
    features: [
      '2.500 créditos/mês',
      '1 modelo de IA incluído',
      'Modelos adicionais: 500 créditos',
      'Máxima resolução',
      'Todos os pacotes premium',
      'API de integração',
      'Galeria ilimitada',
      'Suporte VIP + consultoria'
    ],
    price: {
      monthly: 489.00,
      yearly: 3912.00
    }
  }
}

/**
 * DEPRECATED: Use getSubscriptionPlanById() do banco
 */
export const PLAN_CONFIGS = PLAN_CONFIGS_FALLBACK

/**
 * Get credits limit for a specific plan (busca do banco)
 */
export async function getCreditsLimitForPlan(plan: Plan): Promise<number> {
  try {
    const dbPlan = await getSubscriptionPlanById(plan)
    if (dbPlan) {
      return dbPlan.credits
    }
  } catch (error) {
    console.warn('⚠️ [PLANS] Erro ao buscar créditos do banco, usando fallback:', error)
  }
  return PLAN_CONFIGS_FALLBACK[plan].credits
}

/**
 * Get models limit for a specific plan (busca do banco)
 */
export async function getModelsLimitForPlan(plan: Plan): Promise<number> {
  try {
    const dbPlan = await getSubscriptionPlanById(plan)
    if (dbPlan) {
      return dbPlan.models
    }
  } catch (error) {
    console.warn('⚠️ [PLANS] Erro ao buscar modelos do banco, usando fallback:', error)
  }
  return PLAN_CONFIGS_FALLBACK[plan].models
}

/**
 * Get plan configuration (busca do banco)
 */
export async function getPlanConfig(plan: Plan): Promise<PlanConfig> {
  try {
    const dbPlan = await getSubscriptionPlanById(plan)
    if (dbPlan) {
      return {
        credits: dbPlan.credits,
        models: dbPlan.models,
        resolution: dbPlan.resolution,
        features: dbPlan.features,
        price: {
          monthly: dbPlan.monthlyPrice,
          yearly: dbPlan.annualPrice
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ [PLANS] Erro ao buscar config do banco, usando fallback:', error)
  }
  return PLAN_CONFIGS_FALLBACK[plan]
}

/**
 * Get plan price for a specific billing cycle (busca do banco)
 */
export async function getPlanPrice(plan: Plan, cycle: 'MONTHLY' | 'YEARLY'): Promise<number> {
  try {
    const price = await getDbPlanPrice(plan, cycle)
    if (price > 0) {
      return price
    }
  } catch (error) {
    console.warn('⚠️ [PLANS] Erro ao buscar preço do banco, usando fallback:', error)
  }
  return cycle === 'YEARLY'
    ? PLAN_CONFIGS_FALLBACK[plan].price.yearly
    : PLAN_CONFIGS_FALLBACK[plan].price.monthly
}

/**
 * Calculate annual savings (busca do banco)
 */
export async function calculateAnnualSavings(plan: Plan) {
  try {
    const dbPlan = await getSubscriptionPlanById(plan)
    if (dbPlan) {
      const monthlyPrice = dbPlan.monthlyPrice
      const annualPrice = dbPlan.annualPrice
      const savings = (monthlyPrice * 12) - annualPrice
      const monthsEquivalent = Math.round(savings / monthlyPrice)

      return {
        savings,
        monthsEquivalent,
        percentage: Math.round((savings / (monthlyPrice * 12)) * 100),
        formattedSavings: `R$ ${savings.toFixed(2)}`
      }
    }
  } catch (error) {
    console.warn('⚠️ [PLANS] Erro ao calcular economia do banco, usando fallback:', error)
  }
  
  const monthlyPrice = PLAN_CONFIGS_FALLBACK[plan].price.monthly
  const annualPrice = PLAN_CONFIGS_FALLBACK[plan].price.yearly
  const savings = (monthlyPrice * 12) - annualPrice
  const monthsEquivalent = Math.round(savings / monthlyPrice)

  return {
    savings,
    monthsEquivalent,
    percentage: Math.round((savings / (monthlyPrice * 12)) * 100),
    formattedSavings: `R$ ${savings.toFixed(2)}`
  }
}
