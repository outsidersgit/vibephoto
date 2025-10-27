import { Plan } from '@prisma/client'

/**
 * Centralized plan configuration
 * This is the SINGLE SOURCE OF TRUTH for plan limits
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

export const PLAN_CONFIGS: Record<Plan, PlanConfig> = {
  STARTER: {
    credits: 500,
    models: 1, // 1 modelo incluído, modelos adicionais custam 500 créditos
    resolution: '512x512',
    features: [
      '500 créditos/mês (6.000/ano)',
      '1 modelo de IA incluído',
      'Modelos adicionais: 500 créditos',
      'Resolução 512x512',
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
    models: 1, // 1 modelo incluído, modelos adicionais custam 500 créditos
    resolution: '1024x1024',
    features: [
      '1.200 créditos/mês (14.400/ano)',
      '1 modelo de IA incluído',
      'Modelos adicionais: 500 créditos',
      'Resolução 1024x1024',
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
    models: 1, // 1 modelo incluído, modelos adicionais custam 500 créditos
    resolution: '2048x2048',
    features: [
      '2.500 créditos/mês (30.000/ano)',
      '1 modelo de IA incluído',
      'Modelos adicionais: 500 créditos',
      'Resolução 2048x2048',
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
 * Get credits limit for a specific plan
 */
export function getCreditsLimitForPlan(plan: Plan): number {
  return PLAN_CONFIGS[plan].credits
}

/**
 * Get models limit for a specific plan
 */
export function getModelsLimitForPlan(plan: Plan): number {
  return PLAN_CONFIGS[plan].models
}

/**
 * Get plan configuration
 */
export function getPlanConfig(plan: Plan): PlanConfig {
  return PLAN_CONFIGS[plan]
}

/**
 * Get plan price for a specific billing cycle
 */
export function getPlanPrice(plan: Plan, cycle: 'MONTHLY' | 'YEARLY'): number {
  return cycle === 'YEARLY'
    ? PLAN_CONFIGS[plan].price.yearly
    : PLAN_CONFIGS[plan].price.monthly
}

/**
 * Calculate annual savings
 */
export function calculateAnnualSavings(plan: Plan) {
  const monthlyPrice = PLAN_CONFIGS[plan].price.monthly
  const annualPrice = PLAN_CONFIGS[plan].price.yearly
  const savings = (monthlyPrice * 12) - annualPrice
  const monthsEquivalent = Math.round(savings / monthlyPrice)

  return {
    savings,
    monthsEquivalent,
    percentage: Math.round((savings / (monthlyPrice * 12)) * 100),
    formattedSavings: `R$ ${savings.toFixed(2)}`
  }
}
