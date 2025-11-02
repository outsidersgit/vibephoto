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
 */
export async function getAllSubscriptionPlans(): Promise<SubscriptionPlanData[]> {
  const plans = await prisma.subscriptionPlan.findMany({
    where: {
      deletedAt: null
    },
    orderBy: [
      { popular: 'desc' },
      { monthlyPrice: 'asc' }
    ]
  })

  return plans.map(plan => ({
    ...plan,
    features: (plan.features as any[]).map((f: any) => typeof f === 'string' ? f : f.toString())
  })) as SubscriptionPlanData[]
}

/**
 * Buscar plano por planId (STARTER, PREMIUM, GOLD)
 */
export async function getSubscriptionPlanById(planId: Plan): Promise<SubscriptionPlanData | null> {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: {
      planId,
      deletedAt: null
    }
  })

  if (!plan) return null

  return {
    ...plan,
    features: (plan.features as any[]).map((f: any) => typeof f === 'string' ? f : f.toString())
  } as SubscriptionPlanData
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

