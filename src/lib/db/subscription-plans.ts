import { prisma } from '@/lib/prisma'
import { Plan } from '@prisma/client'
import { unstable_cache } from 'next/cache'

export interface SubscriptionPlanData {
  id: string
  planId: Plan
  name: string
  description: string
  isActive: boolean
  popular: boolean
  color?: string | null
  monthlyPrice: number
  annualPrice: number
  monthlyEquivalent: number
  credits: number
  models: number
  resolution: string
  features: string[]
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date | null
}

/**
 * Buscar todos os planos de assinatura ativos (não deletados)
 * CRÍTICO: Usar $queryRaw para evitar problema do Prisma com Json[] vs Json
 */
export async function getAllSubscriptionPlans(): Promise<SubscriptionPlanData[]> {
  // CRÍTICO: Usar $queryRaw para contornar problema do Prisma com Json[] vs Json
  // O mesmo problema que resolvemos no admin panel e getSubscriptionPlanById
  const plans = await prisma.$queryRaw<Array<{
    id: string
    planId: string
    name: string
    description: string
    isActive: boolean
    popular: boolean
    color: string | null
    monthlyPrice: number
    annualPrice: number
    monthlyEquivalent: number
    credits: number
    models: number
    resolution: string
    features: any
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
  }>>`
    SELECT 
      id, 
      "planId",
      name, 
      description, 
      "isActive", 
      popular, 
      color, 
      "monthlyPrice", 
      "annualPrice", 
      "monthlyEquivalent", 
      credits, 
      models, 
      resolution, 
      features,
      "createdAt", 
      "updatedAt", 
      "deletedAt"
    FROM subscription_plans
    WHERE "deletedAt" IS NULL
    ORDER BY 
      CASE "planId"
        WHEN 'STARTER' THEN 1
        WHEN 'PREMIUM' THEN 2
        WHEN 'GOLD' THEN 3
        ELSE 4
      END ASC
  `

  return plans.map(planRaw => {
    // Converter features para array se necessário
    let features = planRaw.features
    if (!Array.isArray(features)) {
      try {
        if (typeof features === 'string') {
          features = JSON.parse(features)
        }
        if (!Array.isArray(features)) {
          features = []
        }
      } catch {
        features = []
      }
    }

    return {
      ...planRaw,
      features: Array.isArray(features) 
        ? (features as any[]).map((f: any) => typeof f === 'string' ? f : f.toString())
        : []
    } as SubscriptionPlanData
  })
}

/**
 * Buscar plano por planId (STARTER, PREMIUM, GOLD)
 * CRÍTICO: Usar $queryRaw para evitar problema do Prisma com Json[] vs Json
 */
export async function getSubscriptionPlanById(planId: Plan): Promise<SubscriptionPlanData | null> {
  console.log('🔍 [DB] getSubscriptionPlanById chamado para:', planId)
  
  try {
    // CRÍTICO: Usar $queryRaw para contornar problema do Prisma com Json[] vs Json
    // O mesmo problema que resolvemos no admin panel
    const plans = await prisma.$queryRaw<Array<{
      id: string
      planId: string
      name: string
      description: string
      isActive: boolean
      popular: boolean
      color: string | null
      monthlyPrice: number
      annualPrice: number
      monthlyEquivalent: number
      credits: number
      models: number
      resolution: string
      features: any
      createdAt: Date
      updatedAt: Date
      deletedAt: Date | null
    }>>`
      SELECT 
        id, 
        "planId",
        name, 
        description, 
        "isActive", 
        popular, 
        color, 
        "monthlyPrice", 
        "annualPrice", 
        "monthlyEquivalent", 
        credits, 
        models, 
        resolution, 
        features,
        "createdAt", 
        "updatedAt", 
        "deletedAt"
      FROM subscription_plans
      WHERE "planId" = ${planId}::"Plan"
        AND "deletedAt" IS NULL
      LIMIT 1
    `

    if (!plans || plans.length === 0) {
      console.warn('⚠️ [DB] Plano não encontrado no banco:', planId)
      return null
    }

    const planRaw = plans[0]

    // Verificar se está deletado (soft delete) - já filtrado no SQL, mas verificação adicional
    if (planRaw.deletedAt) {
      console.warn('⚠️ [DB] Plano encontrado mas está deletado (soft delete):', planId)
      return null
    }

    console.log('✅ [DB] Plano encontrado no banco:', {
      planId: planRaw.planId,
      name: planRaw.name,
      monthlyPrice: planRaw.monthlyPrice,
      annualPrice: planRaw.annualPrice,
      deletedAt: planRaw.deletedAt
    })

    // Converter features para array se necessário
    let features = planRaw.features
    if (!Array.isArray(features)) {
      try {
        if (typeof features === 'string') {
          features = JSON.parse(features)
        }
        if (!Array.isArray(features)) {
          features = []
        }
      } catch {
        features = []
      }
    }

    return {
      ...planRaw,
      features: Array.isArray(features) 
        ? (features as any[]).map((f: any) => typeof f === 'string' ? f : f.toString())
        : []
    } as SubscriptionPlanData
  } catch (error) {
    console.error('❌ [DB] Erro ao buscar plano do banco:', error)
    throw error
  }
}

/**
 * Buscar plano ativo (alias para getSubscriptionPlanById)
 */
export async function getSubscriptionPlan(planId: Plan): Promise<SubscriptionPlanData | null> {
  return getSubscriptionPlanById(planId)
}

/**
 * Buscar créditos de um plano (helper)
 */
export async function getCreditsLimitForPlan(planId: Plan): Promise<number> {
  const plan = await getSubscriptionPlanById(planId)
  return plan?.credits || 0
}

/**
 * Buscar preço de um plano baseado no ciclo de cobrança
 */
export async function getPlanPrice(planId: Plan, cycle: 'MONTHLY' | 'YEARLY'): Promise<number> {
  const plan = await getSubscriptionPlanById(planId)
  if (!plan) return 0
  
  return cycle === 'YEARLY' ? plan.annualPrice : plan.monthlyPrice
}

/**
 * Buscar todos os planos ativos (com cache)
 * Cache invalida quando admin atualiza planos
 */
export const getCachedSubscriptionPlans = unstable_cache(
  async () => {
    return getAllSubscriptionPlans()
  },
  ['subscription-plans'],
  {
    tags: ['subscription-plans'],
    revalidate: 3600 // 1 hora
  }
)

/**
 * Buscar plano por ID (com cache)
 */
export const getCachedSubscriptionPlan = unstable_cache(
  async (planId: Plan) => {
    return getSubscriptionPlanById(planId)
  },
  ['subscription-plan'],
  {
    tags: ['subscription-plans'],
    revalidate: 3600 // 1 hora
  }
)

