import {
  asaas,
  AsaasCustomer,
  AsaasSubscription,
  AsaasPayment,
  PLAN_PRICES,
  getPlanPrice,
  getNextDueDate,
  formatCustomerForAsaas,
  validateCustomerData,
  handleAsaasError
} from '@/lib/payments/asaas'
import { validateCPFCNPJ } from '@/lib/utils/brazilian-validators'

export interface SubscriptionPlan {
  plan: 'STARTER' | 'PREMIUM' | 'GOLD'
  cycle: 'MONTHLY' | 'YEARLY'
  paymentMethod: 'PIX' | 'CREDIT_CARD' | 'BOLETO'
}

export interface CustomerData {
  name: string
  email: string
  cpfCnpj?: string
  phone?: string
  mobilePhone?: string
  address?: string
  addressNumber?: string
  complement?: string
  province?: string
  city?: string
  state?: string
  postalCode?: string
}

export interface CreditCardData {
  holderName: string
  number: string
  expiryMonth: string
  expiryYear: string
  ccv: string
  holderInfo: {
    name: string
    email: string
    cpfCnpj: string
    postalCode: string
    addressNumber: string
    phone: string
    addressComplement?: string
    province?: string
    city?: string
    state?: string
  }
}

export class SubscriptionService {
  
  // Create or get existing Asaas customer
  async getOrCreateAsaasCustomer(
    customerData: CustomerData,
    userId?: string
  ): Promise<{ success: boolean; customerId?: string; error?: string; method?: 'EXISTING' | 'CREATED' }> {
    try {
      // Validate customer data first
      const formattedCustomer = formatCustomerForAsaas({
        ...customerData,
        externalReference: userId
      })

      const validation = validateCustomerData(formattedCustomer)
      if (!validation.isValid) {
        return {
          success: false,
          error: `Dados inválidos: ${validation.errors.join(', ')}`
        }
      }

      // 1. First check if customer already exists by email
      try {
        const existingByEmail = await asaas.findCustomerByEmail(customerData.email)
        if (existingByEmail?.data && existingByEmail.data.length > 0) {
          const existing = existingByEmail.data[0]
          console.log('✅ Cliente já existe no Asaas (email):', existing.id)
          return {
            success: true,
            customerId: existing.id,
            method: 'EXISTING'
          }
        }
      } catch (searchError) {
        console.warn('⚠️  Erro ao buscar cliente por email (continuando):', searchError)
      }

      // 2. If has CPF/CNPJ, check by document
      if (customerData.cpfCnpj) {
        try {
          const existingByCpf = await asaas.findCustomerByCpfCnpj(customerData.cpfCnpj)
          if (existingByCpf?.data && existingByCpf.data.length > 0) {
            const existing = existingByCpf.data[0]
            console.log('✅ Cliente já existe no Asaas (CPF/CNPJ):', existing.id)
            return {
              success: true,
              customerId: existing.id,
              method: 'EXISTING'
            }
          }
        } catch (searchError) {
          console.warn('⚠️  Erro ao buscar cliente por CPF/CNPJ (continuando):', searchError)
        }
      }

      // 3. Customer doesn't exist, create new one
      console.log('➕ Criando novo cliente no Asaas...')
      const customer = await asaas.createCustomer(formattedCustomer)
      console.log('✅ Cliente criado com sucesso:', customer.id)

      return {
        success: true,
        customerId: customer.id,
        method: 'CREATED'
      }

    } catch (error: any) {
      const asaasError = handleAsaasError(error)
      console.error('❌ Erro em getOrCreateAsaasCustomer:', asaasError)
      return {
        success: false,
        error: asaasError.message
      }
    }
  }

  // Create subscription with PIX payment
  async createPixSubscription(
    customerId: string,
    plan: SubscriptionPlan
  ): Promise<{ success: boolean; subscription?: any; error?: string }> {
    try {
      if (plan.paymentMethod !== 'PIX') {
        return { success: false, error: 'Método de pagamento inválido para esta função' }
      }

      // Para criar assinatura: enviar valor total baseado no ciclo
      // MONTHLY: valor mensal | YEARLY: valor anual total
      const price = getPlanPrice(plan.plan, plan.cycle)
      const cycleMapping: Record<string, AsaasSubscription['cycle']> = {
        'MONTHLY': 'MONTHLY',
        'YEARLY': 'YEARLY'
      }

      const subscriptionData: AsaasSubscription = {
        customer: customerId,
        billingType: 'PIX',
        value: price,
        nextDueDate: getNextDueDate(plan.cycle),
        cycle: cycleMapping[plan.cycle],
        description: `Assinatura ${plan.plan} - ${plan.cycle === 'YEARLY' ? 'Anual' : 'Mensal'}`,
        externalReference: `subscription-${plan.plan}-${plan.cycle}-${Date.now()}`
      }

      console.log('🔑 Criando assinatura PIX:', {
        plan: plan.plan,
        cycle: plan.cycle,
        value: price,
        description: subscriptionData.description
      })

      const subscription = await asaas.createSubscription(subscriptionData)

      return {
        success: true,
        subscription
      }

    } catch (error: any) {
      const asaasError = handleAsaasError(error)
      return {
        success: false,
        error: asaasError.message
      }
    }
  }

  // Create subscription with credit card
  async createCreditCardSubscription(
    customerId: string,
    plan: SubscriptionPlan,
    creditCardData: CreditCardData
  ): Promise<{ success: boolean; subscription?: any; error?: string }> {
    try {
      if (plan.paymentMethod !== 'CREDIT_CARD') {
        return { success: false, error: 'Método de pagamento inválido para esta função' }
      }

      // Validate credit card holder CPF
      if (!validateCPFCNPJ(creditCardData.holderInfo.cpfCnpj)) {
        return { success: false, error: 'CPF do portador do cartão inválido' }
      }

      // Para criar assinatura: enviar valor total baseado no ciclo
      // MONTHLY: valor mensal | YEARLY: valor anual total
      const price = getPlanPrice(plan.plan, plan.cycle)
      const cycleMapping: Record<string, AsaasSubscription['cycle']> = {
        'MONTHLY': 'MONTHLY',
        'YEARLY': 'YEARLY'
      }

      const subscriptionData: AsaasSubscription = {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value: price,
        nextDueDate: getNextDueDate(plan.cycle),
        cycle: cycleMapping[plan.cycle],
        description: `Assinatura ${plan.plan} - ${plan.cycle === 'YEARLY' ? 'Anual' : 'Mensal'}`,
        externalReference: `subscription-${plan.plan}-${plan.cycle}-${Date.now()}`,
        creditCard: creditCardData,
        creditCardHolderInfo: {
          ...creditCardData.holderInfo,
          cpfCnpj: creditCardData.holderInfo.cpfCnpj.replace(/\D/g, ''),
          postalCode: creditCardData.holderInfo.postalCode.replace(/\D/g, ''),
          phone: creditCardData.holderInfo.phone.replace(/\D/g, '')
        }
      }

      console.log('💳 Criando assinatura:', {
        plan: plan.plan,
        cycle: plan.cycle,
        value: price,
        description: subscriptionData.description
      })

      const subscription = await asaas.createSubscription(subscriptionData)

      return {
        success: true,
        subscription
      }

    } catch (error: any) {
      const asaasError = handleAsaasError(error)
      return {
        success: false,
        error: asaasError.message
      }
    }
  }

  // Create subscription with boleto (monthly payments)
  async createBoletoSubscription(
    customerId: string,
    plan: SubscriptionPlan
  ): Promise<{ success: boolean; subscription?: any; error?: string }> {
    try {
      if (plan.paymentMethod !== 'BOLETO') {
        return { success: false, error: 'Método de pagamento inválido para esta função' }
      }

      // Boleto only supports monthly cycles effectively
      if (plan.cycle === 'YEARLY') {
        return { success: false, error: 'Boleto não suporta pagamento anual único. Use ciclo mensal.' }
      }

      const price = getPlanPrice(plan.plan, plan.cycle)

      const subscriptionData: AsaasSubscription = {
        customer: customerId,
        billingType: 'BOLETO',
        value: price,
        nextDueDate: getNextDueDate('MONTHLY'),
        cycle: 'MONTHLY',
        description: `Assinatura ${plan.plan} - Mensal via Boleto`,
        externalReference: `subscription-${plan.plan}-monthly-boleto-${Date.now()}`
      }

      const subscription = await asaas.createSubscription(subscriptionData)
      
      return { 
        success: true, 
        subscription 
      }
      
    } catch (error: any) {
      const asaasError = handleAsaasError(error)
      return { 
        success: false, 
        error: asaasError.message 
      }
    }
  }

  // Get subscription details
  async getSubscription(subscriptionId: string): Promise<{ 
    success: boolean; 
    subscription?: any; 
    error?: string 
  }> {
    try {
      const subscription = await asaas.getSubscription(subscriptionId)
      return { success: true, subscription }
    } catch (error: any) {
      const asaasError = handleAsaasError(error)
      return { success: false, error: asaasError.message }
    }
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId: string): Promise<{ 
    success: boolean; 
    error?: string 
  }> {
    try {
      await asaas.cancelSubscription(subscriptionId)
      return { success: true }
    } catch (error: any) {
      const asaasError = handleAsaasError(error)
      return { success: false, error: asaasError.message }
    }
  }

  // Update subscription (change plan/cycle)
  async updateSubscription(
    subscriptionId: string,
    newPlan: SubscriptionPlan
  ): Promise<{ success: boolean; subscription?: any; error?: string }> {
    try {
      // Para atualizar assinatura: enviar value baseado no ciclo + cycle (se mudou)
      // Sempre enviar updatePendingPayments: false
      const price = getPlanPrice(newPlan.plan, newPlan.cycle)
      const cycleMapping: Record<string, AsaasSubscription['cycle']> = {
        'MONTHLY': 'MONTHLY',
        'YEARLY': 'YEARLY'
      }

      const updateData: Partial<AsaasSubscription> & { updatePendingPayments?: boolean } = {
        value: price,
        cycle: cycleMapping[newPlan.cycle],
        description: `Assinatura ${newPlan.plan} - ${newPlan.cycle === 'YEARLY' ? 'Anual' : 'Mensal'}`,
        updatePendingPayments: false
      }

      console.log('🔄 Atualizando assinatura:', {
        subscriptionId,
        plan: newPlan.plan,
        cycle: newPlan.cycle,
        value: price,
        description: updateData.description
      })

      const subscription = await asaas.updateSubscription(subscriptionId, updateData as Partial<AsaasSubscription>)

      return { success: true, subscription }
    } catch (error: any) {
      const asaasError = handleAsaasError(error)
      return { success: false, error: asaasError.message }
    }
  }

  // Get subscription payments
  async getSubscriptionPayments(subscriptionId: string): Promise<{
    success: boolean;
    payments?: any[];
    error?: string;
  }> {
    try {
      const result = await asaas.getSubscriptionPayments(subscriptionId)
      return { success: true, payments: result.data || [] }
    } catch (error: any) {
      const asaasError = handleAsaasError(error)
      return { success: false, error: asaasError.message }
    }
  }

  // Get payment PIX QR Code (for subscription first payment)
  async getPaymentPixQrCode(paymentId: string): Promise<{
    success: boolean;
    qrCode?: { encodedImage: string; payload: string };
    error?: string;
  }> {
    try {
      const qrCode = await asaas.getPixQrCode(paymentId)
      return { success: true, qrCode }
    } catch (error: any) {
      const asaasError = handleAsaasError(error)
      return { success: false, error: asaasError.message }
    }
  }

  // Get payment boleto info
  async getPaymentBoleto(paymentId: string): Promise<{
    success: boolean;
    boleto?: { identificationField: string; nossoNumero: string };
    error?: string;
  }> {
    try {
      const boleto = await asaas.getBoletoUrl(paymentId)
      return { success: true, boleto }
    } catch (error: any) {
      const asaasError = handleAsaasError(error)
      return { success: false, error: asaasError.message }
    }
  }

  // Helper: Get plan benefits for display
  getPlanBenefits(plan: 'STARTER' | 'PREMIUM' | 'GOLD') {
    const benefits = {
      STARTER: {
        credits: '500 créditos/mês',
        models: '1 modelo incluído',
        resolution: 'Resolução padrão',
        support: 'Suporte por email',
        features: [
          '500 créditos mensais',
          '1 modelo de IA incluído',
          'Modelos adicionais: 500 créditos',
          'Resolução padrão (512x512)',
          'Galeria pessoal',
          'Suporte por email'
        ]
      },
      PREMIUM: {
        credits: '1.200 créditos/mês',
        models: '1 modelo incluído',
        resolution: 'Alta resolução',
        support: 'Suporte prioritário',
        features: [
          '1.200 créditos mensais',
          '1 modelo de IA incluído',
          'Modelos adicionais: 500 créditos',
          'Alta resolução (1024x1024)',
          'Pacotes premium inclusos',
          'Galeria ampliada',
          'Suporte prioritário'
        ]
      },
      GOLD: {
        credits: '2.500 créditos/mês',
        models: '1 modelo incluído',
        resolution: 'Máxima resolução',
        support: 'Suporte VIP + consultoria',
        features: [
          '2.500 créditos mensais',
          '1 modelo de IA incluído',
          'Modelos adicionais: 500 créditos',
          'Máxima resolução (2048x2048)',
          'Todos os pacotes premium',
          'API de integração',
          'Galeria ilimitada',
          'Suporte VIP + consultoria'
        ]
      }
    }

    return benefits[plan]
  }

  // Helper: Calculate prorated amount for plan changes
  calculateProratedAmount(
    currentPlan: 'STARTER' | 'PREMIUM' | 'GOLD',
    newPlan: 'STARTER' | 'PREMIUM' | 'GOLD',
    cycle: 'MONTHLY' | 'YEARLY',
    daysRemaining: number
  ): number {
    const currentPrice = getPlanPrice(currentPlan, cycle)
    const newPrice = getPlanPrice(newPlan, cycle)
    const daysInCycle = cycle === 'YEARLY' ? 365 : 30
    
    // Calculate daily rates
    const currentDailyRate = currentPrice / daysInCycle
    const newDailyRate = newPrice / daysInCycle
    
    // Calculate prorated amounts
    const currentRemaining = currentDailyRate * daysRemaining
    const newRemaining = newDailyRate * daysRemaining
    
    return Math.max(0, newRemaining - currentRemaining)
  }

  // Helper: Get next billing date
  getNextBillingDate(cycle: 'MONTHLY' | 'YEARLY'): Date {
    const date = new Date()
    if (cycle === 'YEARLY') {
      date.setFullYear(date.getFullYear() + 1)
    } else {
      date.setMonth(date.getMonth() + 1)
    }
    return date
  }

  // Helper: Format subscription for display
  formatSubscriptionDisplay(subscription: any) {
    return {
      id: subscription.id,
      status: subscription.status,
      plan: this.extractPlanFromDescription(subscription.description),
      value: subscription.value,
      cycle: subscription.cycle,
      nextDueDate: new Date(subscription.nextDueDate).toLocaleDateString('pt-BR'),
      paymentMethod: subscription.billingType,
      isActive: subscription.status === 'ACTIVE',
      canCancel: ['ACTIVE', 'OVERDUE'].includes(subscription.status)
    }
  }

  private extractPlanFromDescription(description: string): 'STARTER' | 'PREMIUM' | 'GOLD' {
    if (description.includes('PREMIUM')) return 'PREMIUM'
    if (description.includes('GOLD')) return 'GOLD'
    return 'STARTER'
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService()