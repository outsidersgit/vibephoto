/**
 * Configuração centralizada de preços e pacotes
 * FONTE OFICIAL DE VERDADE para todos os valores no sistema
 */

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
 * PLANOS DE ASSINATURA - Valores Oficiais
 * Última atualização: 2025-10-01
 */
export const PLANS: Plan[] = [
  {
    id: 'STARTER',
    name: 'Starter',
    monthlyPrice: 89,
    annualPrice: 708,
    monthlyEquivalent: 59,
    description: 'Perfeito para começar sua jornada com IA',
    features: [
      '1 modelo de IA',
      '500 créditos por mês',
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
      '1200 créditos por mês',
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
      '2500 créditos por mês',
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
 * PACOTES DE CRÉDITOS AVULSOS - Valores Oficiais
 * Validade: 1 ano
 */
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'essencial',
    name: 'Essencial',
    credits: 350,
    price: 89,
    photos: 35,
    description: 'Perfeito para projetos pequenos'
  },
  {
    id: 'avancado',
    name: 'Avançado',
    credits: 1000,
    price: 179,
    photos: 100,
    popular: true,
    description: 'Ideal para uso frequente'
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 2200,
    price: 359,
    photos: 220,
    description: 'Para profissionais e agências'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    credits: 5000,
    price: 899,
    photos: 500,
    description: 'Volume máximo para grandes projetos'
  }
]

/**
 * Helper: Encontrar plano por ID
 */
export function getPlanById(planId: 'STARTER' | 'PREMIUM' | 'GOLD'): Plan | undefined {
  return PLANS.find(p => p.id === planId)
}

/**
 * Helper: Encontrar pacote de créditos por ID
 */
export function getCreditPackageById(packageId: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find(p => p.id === packageId)
}

/**
 * Helper: Calcular economia anual
 */
export function calculateAnnualSavings(plan: Plan): { savings: number; monthsEquivalent: number } {
  const savings = (plan.monthlyPrice * 12) - plan.annualPrice
  const monthsEquivalent = Math.round(savings / plan.monthlyPrice)
  return { savings, monthsEquivalent }
}
