/**
 * Serviço para gerenciar pacotes de créditos e transações
 * Separação clara entre créditos de assinatura e créditos comprados
 */

import { prisma } from '@/lib/db'
import { Plan } from '@prisma/client'

export interface CreditPackage {
  id: string
  name: string
  description?: string
  creditAmount: number
  price: number
  bonusCredits: number
  validityMonths: number
  isActive: boolean
  sortOrder: number
}

export interface CreditBalance {
  subscriptionCredits: number      // Créditos restantes da assinatura
  purchasedCredits: number         // Créditos comprados disponíveis
  totalCredits: number             // Total disponível
  creditsUsed: number             // Créditos usados da assinatura
  availableCredits: number        // Total que pode ser usado agora
  creditLimit: number             // Limite da assinatura
  nextReset: string | null        // Data da próxima renovação
}

export interface CreditTransaction {
  id: string
  userId: string
  type: 'EARNED' | 'SPENT' | 'EXPIRED' | 'REFUNDED'
  source: 'SUBSCRIPTION' | 'PURCHASE' | 'BONUS' | 'GENERATION' | 'TRAINING' | 'REFUND' | 'EXPIRATION'
  amount: number
  description?: string
  referenceId?: string
  creditPurchaseId?: string
  balanceAfter: number
  createdAt: Date
}

// Pacotes de créditos padrão (usado como fallback e para seed inicial)
const DEFAULT_CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'ESSENTIAL',
    name: 'Pacote Essencial',
    description: 'Ideal para teste e uso esporádico',
    creditAmount: 350,
    price: 89.00,
    bonusCredits: 0,
    validityMonths: 12,
    isActive: true,
    sortOrder: 1
  },
  {
    id: 'ADVANCED',
    name: 'Pacote Avançado', 
    description: 'Para uso regular e projetos pequenos',
    creditAmount: 1000,
    price: 179.00,
    bonusCredits: 0,
    validityMonths: 12,
    isActive: true,
    sortOrder: 2
  },
  {
    id: 'PRO',
    name: 'Pacote Pro',
    description: 'Para criadores de conteúdo e uso intenso',
    creditAmount: 2200,
    price: 359.00,
    bonusCredits: 0,
    validityMonths: 12,
    isActive: true,
    sortOrder: 3
  },
  {
    id: 'ENTERPRISE',
    name: 'Pacote Enterprise',
    description: 'Máximo valor para profissionais',
    creditAmount: 5000,
    price: 899.00,
    bonusCredits: 0,
    validityMonths: 12,
    isActive: true,
    sortOrder: 4
  }
]

export class CreditPackageService {

  /**
   * Retorna métodos de pagamento otimizados para o mercado brasileiro
   */
  static getOptimizedPaymentMethods(plan: 'STARTER' | 'PREMIUM' | 'GOLD') {
    return [
      {
        type: 'PIX' as const,
        name: 'PIX',
        description: '✨ Aprovação instantânea + 5% desconto',
        discount: 5,
        recommended: true,
        icon: '🔥',
        advantages: ['Sem taxas', 'Aprovação imediata', 'Mais seguro']
      },
      {
        type: 'CREDIT_CARD' as const,
        name: 'Cartão de Crédito',
        description: 'Parcelamento em até 12x',
        discount: 0,
        maxInstallments: plan === 'GOLD' ? 12 : plan === 'PREMIUM' ? 6 : 3,
        icon: '💳',
        advantages: ['Parcelamento', 'Aprovação automática']
      },
      {
        type: 'BOLETO' as const,
        name: 'Boleto Bancário',
        description: 'Vencimento em 3 dias úteis',
        discount: 0,
        icon: '🧾',
        advantages: ['Sem cartão necessário', 'Pagamento em bancos']
      }
    ]
  }

  /**
   * Calcula o total de créditos incluindo bônus
   */
  static async calculateTotalCredits(packageId: string): Promise<number> {
    const pkg = await this.getPackageById(packageId)
    return pkg ? pkg.creditAmount + pkg.bonusCredits : 0
  }

  /**
   * Busca pacotes disponíveis do banco de dados
   * Se não houver pacotes no banco, retorna os padrão (fallback)
   */
  static async getAvailablePackages(): Promise<CreditPackage[]> {
    try {
      const dbPackages = await prisma.creditPackage.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      })

      if (dbPackages && dbPackages.length > 0) {
        return dbPackages.map(pkg => ({
          id: pkg.id,
          name: pkg.name,
          description: pkg.description || undefined,
          creditAmount: pkg.creditAmount,
          price: pkg.price,
          bonusCredits: pkg.bonusCredits,
          validityMonths: pkg.validityMonths,
          isActive: pkg.isActive,
          sortOrder: pkg.sortOrder
        }))
      }

      // Fallback para pacotes padrão se banco estiver vazio
      console.warn('⚠️ [CreditPackageService] Nenhum pacote encontrado no banco, usando fallback')
      return DEFAULT_CREDIT_PACKAGES.filter(pkg => pkg.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
    } catch (error) {
      console.error('❌ [CreditPackageService] Erro ao buscar pacotes do banco:', error)
      // Fallback em caso de erro
      return DEFAULT_CREDIT_PACKAGES.filter(pkg => pkg.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
    }
  }
  
  /**
   * Retorna um pacote específico por ID (do banco de dados)
   */
  static async getPackageById(id: string): Promise<CreditPackage | null> {
    const pkg = await prisma.creditPackage.findUnique({
      where: { id }
    })

    if (!pkg) {
      return null
    }

    return {
      id: pkg.id,
      name: pkg.name,
      description: pkg.description || undefined,
      creditAmount: pkg.creditAmount,
      price: pkg.price,
      bonusCredits: pkg.bonusCredits,
      validityMonths: pkg.validityMonths,
      isActive: pkg.isActive,
      sortOrder: pkg.sortOrder
    }
  }

  /**
   * Inicializa pacotes padrão no banco de dados se não existirem
   */
  static async initializeDefaultPackages(): Promise<void> {
    try {
      const existingPackages = await prisma.creditPackage.findMany()
      
      if (existingPackages.length === 0) {
        console.log('📦 [CreditPackageService] Inicializando pacotes padrão no banco...')
        
        await prisma.creditPackage.createMany({
          data: DEFAULT_CREDIT_PACKAGES.map(pkg => ({
            id: pkg.id,
            name: pkg.name,
            description: pkg.description,
            creditAmount: pkg.creditAmount,
            price: pkg.price,
            bonusCredits: pkg.bonusCredits,
            validityMonths: pkg.validityMonths,
            isActive: pkg.isActive,
            sortOrder: pkg.sortOrder
          }))
        })
        
        console.log('✅ [CreditPackageService] Pacotes padrão criados no banco')
      } else {
        console.log(`ℹ️ [CreditPackageService] ${existingPackages.length} pacotes já existem no banco`)
      }
    } catch (error: any) {
      console.error('❌ [CreditPackageService] Erro ao inicializar pacotes:', error)
      // Não lançar erro, apenas logar
    }
  }
  
  /**
   * Calcula o saldo total de créditos de um usuário
   */
  static async getUserCreditBalance(userId: string): Promise<CreditBalance> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        creditsUsed: true,
        creditsLimit: true,
        creditsBalance: true,
        creditsExpiresAt: true, // CRITICAL: Check expiration
        subscriptionEndsAt: true
      }
    })

    if (!user) {
      throw new Error('Usuário não encontrado')
    }

    // CRITICAL: Check if plan credits expired (same logic as CreditManager)
    const now = new Date()
    let subscriptionCredits = 0
    
    if (user.creditsExpiresAt && user.creditsExpiresAt < now) {
      // Plan credits expired - can't use them
      subscriptionCredits = 0
    } else {
      // Plan credits still valid
      subscriptionCredits = Math.max(0, user.creditsLimit - user.creditsUsed)
    }
    
    const purchasedCredits = user.creditsBalance || 0
    const totalCredits = subscriptionCredits + purchasedCredits
    
    console.log(`💰 [getUserCreditBalance] User ${userId}:`, {
      creditsLimit: user.creditsLimit,
      creditsUsed: user.creditsUsed,
      creditsBalance: user.creditsBalance,
      creditsExpiresAt: user.creditsExpiresAt,
      subscriptionCredits,
      purchasedCredits,
      totalCredits,
      isExpired: user.creditsExpiresAt ? user.creditsExpiresAt < now : false
    })

    // Calcular próxima renovação (primeiro do próximo mês ou data de término da assinatura)
    let nextReset: string | null = null
    if (user.subscriptionEndsAt) {
      nextReset = user.subscriptionEndsAt.toISOString()
    } else {
      const now = new Date()
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      nextReset = nextMonth.toISOString()
    }

    return {
      subscriptionCredits,
      purchasedCredits,
      totalCredits,
      creditsUsed: user.creditsUsed,
      availableCredits: totalCredits,
      creditLimit: user.creditsLimit,
      nextReset
    }
  }
  
  /**
   * Debita créditos do usuário (prioriza créditos de assinatura primeiro)
   */
  static async debitCredits(
    userId: string, 
    creditsToDebit: number,
    description: string = 'Credit usage',
    referenceId?: string
  ): Promise<boolean> {
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        creditsUsed: true,
        creditsLimit: true
        // creditsBalance: true // FIELD NOT AVAILABLE IN DB YET
      }
    })
    
    if (!user) {
      throw new Error('Usuário não encontrado')
    }
    
    // Calcular créditos disponíveis
    const subscriptionAvailable = Math.max(0, user.creditsLimit - user.creditsUsed)
    const purchasedAvailable = 0 // TODO: user.creditsBalance || 0
    const totalAvailable = subscriptionAvailable + purchasedAvailable
    
    // Verificar se há créditos suficientes
    if (totalAvailable < creditsToDebit) {
      return false
    }
    
    // Distribuir o débito
    let debitFromSubscription = 0
    let debitFromPurchased = 0
    
    // Debitar primeiro dos créditos de assinatura
    if (subscriptionAvailable > 0) {
      debitFromSubscription = Math.min(subscriptionAvailable, creditsToDebit)
      creditsToDebit -= debitFromSubscription
    }
    
    // Se ainda há créditos para debitar, usar créditos comprados
    if (creditsToDebit > 0) {
      debitFromPurchased = creditsToDebit
    }
    
    // Aplicar as mudanças no banco
    await prisma.user.update({
      where: { id: userId },
      data: {
        creditsUsed: { increment: debitFromSubscription },
        // creditsBalance: { decrement: debitFromPurchased } // FIELD NOT AVAILABLE
      }
    })
    
    // TODO: Registrar transações quando CreditTransaction estiver disponível
    // Por enquanto, usar UsageLog existente
    if (debitFromSubscription > 0) {
      await prisma.usageLog.create({
        data: {
          userId,
          action: 'CREDIT_DEBIT_SUBSCRIPTION',
          creditsUsed: debitFromSubscription,
          details: {
            description,
            referenceId,
            source: 'SUBSCRIPTION'
          }
        }
      })
    }
    
    if (debitFromPurchased > 0) {
      await prisma.usageLog.create({
        data: {
          userId,
          action: 'CREDIT_DEBIT_PURCHASE', 
          creditsUsed: debitFromPurchased,
          details: {
            description,
            referenceId,
            source: 'PURCHASE'
          }
        }
      })
    }
    
    return true
  }
  
  /**
   * Adiciona créditos comprados ao saldo do usuário
   */
  static async addPurchasedCredits(
    userId: string,
    creditAmount: number,
    bonusCredits: number = 0,
    description: string = 'Credit purchase',
    creditPurchaseId?: string
  ): Promise<void> {
    
    const totalCredits = creditAmount + bonusCredits
    
    // Adicionar créditos ao saldo
    await prisma.user.update({
      where: { id: userId },
      data: {
        // creditsBalance: { increment: totalCredits } // FIELD NOT AVAILABLE
      }
    })
    
    // Registrar transações
    if (creditAmount > 0) {
      await prisma.usageLog.create({
        data: {
          userId,
          action: 'CREDIT_PURCHASE',
          creditsUsed: -creditAmount, // Negativo = crédito adicionado
          details: {
            description,
            creditPurchaseId,
            source: 'PURCHASE',
            amount: creditAmount
          }
        }
      })
    }
    
    if (bonusCredits > 0) {
      await prisma.usageLog.create({
        data: {
          userId,
          action: 'CREDIT_BONUS',
          creditsUsed: -bonusCredits, // Negativo = crédito adicionado
          details: {
            description: `Bonus credits: ${description}`,
            creditPurchaseId,
            source: 'BONUS',
            amount: bonusCredits
          }
        }
      })
    }
  }
  
  /**
   * Verifica se o usuário tem créditos suficientes
   */
  static async hasEnoughCredits(userId: string, requiredCredits: number): Promise<boolean> {
    const balance = await this.getUserCreditBalance(userId)
    return balance.availableCredits >= requiredCredits
  }
  
  /**
   * Reseta os créditos da assinatura (renovação mensal)
   */
  static async resetSubscriptionCredits(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        creditsUsed: 0
      }
    })
    
    await prisma.usageLog.create({
      data: {
        userId,
        action: 'SUBSCRIPTION_CREDIT_RESET',
        creditsUsed: 0,
        details: {
          description: 'Monthly subscription credits reset',
          source: 'SUBSCRIPTION'
        }
      }
    })
  }
  
  /**
   * Retorna o histórico de transações de crédito do usuário
   */
  static async getUserCreditHistory(
    userId: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<any[]> {
    
    // Por enquanto usar UsageLog, depois migrar para CreditTransaction
    const logs = await prisma.usageLog.findMany({
      where: {
        userId,
        action: {
          in: [
            'CREDIT_DEBIT_SUBSCRIPTION',
            'CREDIT_DEBIT_PURCHASE', 
            'CREDIT_PURCHASE',
            'CREDIT_BONUS',
            'SUBSCRIPTION_CREDIT_RESET'
          ]
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })
    
    return logs.map(log => ({
      id: log.id,
      type: log.creditsUsed > 0 ? 'SPENT' : 'EARNED',
      source: (log.details as any)?.source || 'UNKNOWN',
      amount: Math.abs(log.creditsUsed),
      description: (log.details as any)?.description || log.action,
      createdAt: log.createdAt
    }))
  }
}