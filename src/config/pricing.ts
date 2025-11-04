/**
 * Configuração centralizada de preços e pacotes
 * DEPRECATED: Agora os planos vêm do banco de dados
 * Mantido para compatibilidade - usar getAllSubscriptionPlans() do banco
 */

import { getAllSubscriptionPlans, getSubscriptionPlanById } from '@/lib/db/subscription-plans'
import { Plan } from '@prisma/client'

export interface Plan {
  id: 'STARTER' | 'PREMIUM' | 'GOLD'
  name: string
  monthlyPrice: number
  annualPrice: number
  monthlyEquivalent: number
  description: string
  features: string[]
  popular: boolean
  credits: number
  models: number
  color?: 'blue' | 'purple' | 'yellow'
}

export interface CreditPackage {
  id: string
  name: string
  credits: number
  price: number
  popular?: boolean
  description: string
  photos: number
}

/**
 * PLANOS DE ASSINATURA - Agora vêm do banco de dados
 * Esta constante é mantida apenas como fallback temporário
 * DEPRECATED: Use getAllSubscriptionPlans() do banco
 */
export const PLANS_FALLBACK: Plan[] = [
  {
    id: 'STARTER',
    name: 'Starter',
    monthlyPrice: 5,
    annualPrice: 10,
    monthlyEquivalent: 59,
    description: 'Perfeito para começar sua jornada com IA',
    features: [
      '1 modelo de IA',
      '500 créditos/mês',
      '50 fotos por mês',
      'Máxima resolução'
    ],
    popular: false,
    credits: 500,
    models: 1,
    color: 'blue'
  },
  {
    id: 'PREMIUM',
    name: 'Premium',
    monthlyPrice: 179,
    annualPrice: 1428,
    monthlyEquivalent: 119,
    description: 'Ideal para criadores de conteúdo',
    features: [
      '1 modelo de IA',
      '1.200 créditos/mês',
      '120 fotos por mês',
      'Máxima resolução'
    ],
    popular: true,
    credits: 1200,
    models: 1,
    color: 'purple'
  },
  {
    id: 'GOLD',
    name: 'Gold',
    monthlyPrice: 359,
    annualPrice: 2868,
    monthlyEquivalent: 239,
    description: 'Para profissionais e agências',
    features: [
      '1 modelo de IA',
      '2.500 créditos/mês',
      '250 fotos por mês',
      'Máxima resolução'
    ],
    popular: false,
    credits: 2500,
    models: 1,
    color: 'yellow'
  }
]

/**
 * Buscar planos do banco de dados ou usar fallback
 */
export async function getPlans(): Promise<Plan[]> {
  try {
    const dbPlans = await getAllSubscriptionPlans()
    if (dbPlans && dbPlans.length > 0) {
      return dbPlans.map(plan => ({
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
        color: plan.color as 'blue' | 'purple' | 'yellow' | undefined
      }))
    }
  } catch (error) {
    console.warn('⚠️ [PRICING] Erro ao buscar planos do banco, usando fallback:', error)
  }
  return PLANS_FALLBACK
}

/**
 * DEPRECATED: Use getPlans() ao invés desta constante
 * Mantida para compatibilidade com código existente
 */
export const PLANS: Plan[] = PLANS_FALLBACK

/**
 * PACOTES DE CRÉDITOS AVULSOS - Valores Oficiais
 * Validade: 1 ano
 */
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'essencial',
    name: 'Pacote 350',
    credits: 350,
    price: 5, // Valor de teste temporário (era 89)
    photos: 35,
    description: 'Perfeito para projetos pequenos'
  },
  {
    id: 'avancado',
    name: 'Pacote 1000',
    credits: 1000,
    price: 179,
    photos: 100,
    popular: true,
    description: 'Ideal para uso frequente'
  },
  {
    id: 'pro',
    name: 'Pacote 2200',
    credits: 2200,
    price: 359,
    photos: 220,
    description: 'Para profissionais e agências'
  },
  {
    id: 'enterprise',
    name: 'Pacote 5000',
    credits: 5000,
    price: 899,
    photos: 500,
    description: 'Volume máximo para grandes projetos'
  }
]

/**
 * Helper: Encontrar plano por ID (busca do banco primeiro)
 */
export async function getPlanById(planId: 'STARTER' | 'PREMIUM' | 'GOLD'): Promise<Plan | undefined> {
  console.log('🔍 [PRICING] getPlanById chamado para:', planId)
  
  try {
    console.log('📊 [PRICING] Tentando buscar do banco de dados...')
    const dbPlan = await getSubscriptionPlanById(planId)
    
    if (dbPlan) {
      console.log('✅ [PRICING] Plano encontrado no BANCO DE DADOS:', {
        planId: dbPlan.planId,
        name: dbPlan.name,
        monthlyPrice: dbPlan.monthlyPrice,
        annualPrice: dbPlan.annualPrice
      })
      return {
        id: dbPlan.planId,
        name: dbPlan.name,
        monthlyPrice: dbPlan.monthlyPrice,
        annualPrice: dbPlan.annualPrice,
        monthlyEquivalent: dbPlan.monthlyEquivalent,
        description: dbPlan.description,
        features: dbPlan.features,
        popular: dbPlan.popular,
        credits: dbPlan.credits,
        models: dbPlan.models,
        color: dbPlan.color as 'blue' | 'purple' | 'yellow' | undefined
      }
    } else {
      console.warn('⚠️ [PRICING] Plano não encontrado no banco de dados, usando fallback')
    }
  } catch (error) {
    console.error('❌ [PRICING] Erro ao buscar plano do banco:', error)
    console.warn('⚠️ [PRICING] Usando fallback devido ao erro')
  }
  
  const fallbackPlan = PLANS_FALLBACK.find(p => p.id === planId)
  if (fallbackPlan) {
    console.log('🔄 [PRICING] Usando plano FALLBACK (código hardcoded):', {
      id: fallbackPlan.id,
      name: fallbackPlan.name,
      monthlyPrice: fallbackPlan.monthlyPrice,
      annualPrice: fallbackPlan.annualPrice
    })
  } else {
    console.error('❌ [PRICING] Plano não encontrado nem no banco nem no fallback:', planId)
  }
  
  return fallbackPlan
}

/**
 * Helper: Encontrar pacote de créditos por ID
 */
/**
 * DEPRECATED: Use CreditPackageService.getPackageById() instead
 * Mantido para compatibilidade, mas agora busca do banco
 */
export async function getCreditPackageById(packageId: string): Promise<CreditPackage | undefined> {
  // Importar dinamicamente para evitar dependência circular
  const { CreditPackageService } = await import('@/lib/services/credit-package-service')
  const pkg = await CreditPackageService.getPackageById(packageId)
  
  if (!pkg) return undefined
  
  // Converter formato do CreditPackageService para CreditPackage do pricing
  return {
    id: pkg.id.toLowerCase(),
    name: pkg.name,
    credits: pkg.creditAmount + pkg.bonusCredits,
    price: pkg.price,
    photos: Math.floor((pkg.creditAmount + pkg.bonusCredits) / 10), // Estimativa
    description: pkg.description || '',
    popular: pkg.sortOrder === 2 // Assumir que o segundo pacote é popular
  }
}

/**
 * Helper: Calcular economia anual
 */
export function calculateAnnualSavings(plan: Plan): { savings: number; monthsEquivalent: number } {
  const savings = (plan.monthlyPrice * 12) - plan.annualPrice
  const monthsEquivalent = Math.round(savings / plan.monthlyPrice)
  return { savings, monthsEquivalent }
}
