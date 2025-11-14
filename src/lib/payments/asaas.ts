interface AsaasConfig {
  apiKey: string
  environment: 'sandbox' | 'production'
}

// Enhanced types for better TypeScript support
interface AsaasCustomer {
  id?: string
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
  externalReference?: string
  notificationDisabled?: boolean
  observations?: string
}

interface AsaasPayment {
  id?: string
  customer: string
  billingType: 'CREDIT_CARD' | 'PIX' | 'BOLETO' | 'UNDEFINED'
  dueDate: string
  value: number
  description?: string
  externalReference?: string
  installmentCount?: number
  installmentValue?: number
  discount?: {
    value?: number
    dueDateLimitDays?: number
    type?: 'FIXED' | 'PERCENTAGE'
  }
  interest?: {
    value?: number
    type?: 'PERCENTAGE'
  }
  fine?: {
    value?: number
    type?: 'FIXED' | 'PERCENTAGE'
  }
  postalService?: boolean
  split?: Array<{
    walletId: string
    fixedValue?: number
    percentualValue?: number
  }>
  callback?: {
    successUrl?: string
    autoRedirect?: boolean
  }
  creditCard?: {
    holderName: string
    number: string
    expiryMonth: string
    expiryYear: string
    ccv: string
  }
  creditCardHolderInfo?: {
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
  creditCardToken?: string
}

interface AsaasSubscription {
  id?: string
  customer: string
  billingType: 'CREDIT_CARD' | 'PIX' | 'BOLETO' | 'UNDEFINED'
  value: number
  nextDueDate: string
  cycle: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY'
  description?: string
  endDate?: string
  maxPayments?: number
  externalReference?: string
  discount?: {
    value: number
    dueDateLimitDays?: number
    type?: 'FIXED' | 'PERCENTAGE'
  }
  split?: Array<{
    walletId: string
    fixedValue?: number
    percentualValue?: number
  }>
  creditCard?: {
    holderName: string
    number: string
    expiryMonth: string
    expiryYear: string
    ccv: string
  }
  creditCardHolderInfo?: {
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
  creditCardToken?: string
}

interface AsaasSubaccountRequest {
  name: string
  email: string
  cpfCnpj: string
  postalCode: string
  incomeValue: number
  phone?: string
  mobilePhone?: string
  personType?: 'FISICA' | 'JURIDICA'
  companyType?: string
}

class AsaasAPI {
  private apiKey: string
  private baseURL: string

  constructor(config: AsaasConfig) {
    if (!config.apiKey) {
      throw new Error('ASAAS_API_KEY is required')
    }

    this.apiKey = config.apiKey
    this.baseURL = config.environment === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3'
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'access_token': this.apiKey,
        'User-Agent': 'EnsaioFotos/1.0',
        ...options.headers,
      },
    })

    if (!response.ok) {
      let errorMessage = response.statusText
      let errorCode: string | undefined

      try {
        // Tenta parsear a resposta como JSON
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json()

          // Asaas retorna erros no formato: { errors: [{ code: 'xxx', description: 'yyy' }] }
          if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
            const firstError = errorData.errors[0]
            errorCode = firstError.code
            errorMessage = firstError.description || errorMessage

            // Mapeamento específico para erros 401
            if (response.status === 401) {
              const error401Messages: Record<string, string> = {
                'access_token_not_found': 'Header de autenticação não enviado. Verifique se a chave API está configurada.',
                'invalid_access_token_format': 'Formato da chave API incorreto. Deve começar com $aact_prod_ ou $aact_hmlg_',
                'invalid_access_token': 'Chave API inválida, desabilitada ou revogada. Gere uma nova chave no dashboard.',
                'invalid_environment': 'Chave API não corresponde ao ambiente (sandbox vs produção). Verifique suas configurações.'
              }
              errorMessage = error401Messages[errorCode] || errorMessage
            }
          } else {
            errorMessage = errorData.message || errorData.error || JSON.stringify(errorData)
          }
        } else {
          // Se não for JSON, lê como texto
          const textError = await response.text()
          if (textError) {
            errorMessage = textError
          }
        }
      } catch (parseError) {
        // Se falhar ao parsear, mantém o statusText
        console.error('Failed to parse error response:', parseError)
      }

      const errorDetail = errorCode ? ` [${errorCode}]` : ''
      throw new Error(`Asaas API Error (${response.status})${errorDetail}: ${errorMessage}`)
    }

    // Verifica se a resposta tem conteúdo antes de parsear como JSON
    const text = await response.text()
    if (!text) {
      return {}
    }

    try {
      return JSON.parse(text)
    } catch (error) {
      console.error('Failed to parse response as JSON:', text)
      throw new Error('Invalid JSON response from Asaas API')
    }
  }

  // Customer management
  async createCustomer(customerData: AsaasCustomer) {
    return this.request('/customers', {
      method: 'POST',
      body: JSON.stringify(customerData),
    })
  }

  async getCustomer(customerId: string) {
    return this.request(`/customers/${customerId}`)
  }

  async updateCustomer(customerId: string, customerData: Partial<AsaasCustomer>) {
    return this.request(`/customers/${customerId}`, {
      method: 'PUT',
      body: JSON.stringify(customerData),
    })
  }

  async getCustomers(filters?: {
    name?: string
    email?: string
    cpfCnpj?: string
    offset?: number
    limit?: number
  }) {
    const queryParams = new URLSearchParams()

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString())
        }
      })
    }

    const endpoint = `/customers${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return this.request(endpoint)
  }

  async findCustomerByEmail(email: string) {
    return this.getCustomers({ email })
  }

  async findCustomerByCpfCnpj(cpfCnpj: string) {
    return this.getCustomers({ cpfCnpj: cpfCnpj.replace(/\D/g, '') })
  }

  async deleteCustomer(customerId: string) {
    return this.request(`/customers/${customerId}`, {
      method: 'DELETE',
    })
  }

  // Subscription management
  async createSubscription(subscriptionData: AsaasSubscription) {
    console.log('🌐 Asaas API - Create Subscription:', {
      method: 'POST',
      path: '/subscriptions',
      fullUrl: `${this.baseURL}/subscriptions`,
      data: subscriptionData
    })
    return this.request('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(subscriptionData),
    })
  }

  async getSubscription(subscriptionId: string) {
    return this.request(`/subscriptions/${subscriptionId}`)
  }

  async updateSubscription(subscriptionId: string, data: Partial<AsaasSubscription>) {
    const path = `/subscriptions/${subscriptionId}`
    console.log('🌐 Asaas API - Update Subscription:', {
      method: 'PUT',
      path,
      fullUrl: `${this.baseURL}${path}`,
      subscriptionId,
      data
    })
    return this.request(path, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async cancelSubscription(subscriptionId: string) {
    const path = `/subscriptions/${subscriptionId}`
    console.log('🌐 Asaas API - Cancel Subscription:', {
      method: 'DELETE',
      path,
      fullUrl: `${this.baseURL}${path}`,
      subscriptionId
    })
    return this.request(path, {
      method: 'DELETE',
    })
  }

  async createSubaccount(data: AsaasSubaccountRequest) {
    const cleanPostalCode = data.postalCode.replace(/\D/g, '')
    if (cleanPostalCode.length !== 8) {
      throw new Error('O CEP informado para criação da subconta é inválido.')
    }

    const sanitizedDocument = data.cpfCnpj.replace(/\D/g, '')
    const personType =
      data.personType || (sanitizedDocument.length > 11 ? 'JURIDICA' : 'FISICA')

    const payload = {
      name: data.name,
      email: data.email,
      cpfCnpj: sanitizedDocument,
      personType,
      phone: data.phone,
      mobilePhone: data.mobilePhone ?? data.phone,
      postalCode: cleanPostalCode,
      incomeValue: data.incomeValue,
      notificationDisabled: true,
      ...(personType === 'JURIDICA' && data.companyType
        ? { companyType: data.companyType }
        : {})
    }

    console.log('🌐 Asaas API - Create Subaccount:', {
      method: 'POST',
      path: '/accounts',
      fullUrl: `${this.baseURL}/accounts`,
      payload
    })

    const response: any = await this.request('/accounts', {
      method: 'POST',
      body: JSON.stringify(payload)
    })

    if (!response?.walletId) {
      throw new Error(
        'A criação da subconta não retornou um walletId válido no Asaas.'
      )
    }

    return {
      walletId: String(response.walletId),
      apiKey: response.apiKey ? String(response.apiKey) : null,
      raw: response
    }
  }

  // Update subscription credit card
  async updateSubscriptionCreditCard(subscriptionId: string, creditCardData: {
    creditCard: {
      holderName: string
      number: string
      expiryMonth: string
      expiryYear: string
      ccv: string
    }
    creditCardHolderInfo: {
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
    remoteIp: string
  }) {
    return this.request(`/subscriptions/${subscriptionId}/updateCreditCard`, {
      method: 'PUT',
      body: JSON.stringify(creditCardData)
    })
  }

  // Payment management
  async createPayment(paymentData: AsaasPayment) {
    return this.request('/payments', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    })
  }

  async getPayment(paymentId: string) {
    return this.request(`/payments/${paymentId}`)
  }

  async getPayments(filters?: {
    customer?: string
    subscription?: string
    status?: string
    billingType?: string
    dateCreated?: string
    offset?: number
    limit?: number
  }) {
    const queryParams = new URLSearchParams()

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString())
        }
      })
    }

    const endpoint = `/payments${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return this.request(endpoint)
  }

  async updatePayment(paymentId: string, data: {
    dueDate?: string
    value?: number
    description?: string
  }) {
    return this.request(`/payments/${paymentId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async cancelPayment(paymentId: string) {
    return this.request(`/payments/${paymentId}`, {
      method: 'DELETE'
    })
  }

  async refundPayment(paymentId: string, value?: number, description?: string) {
    const body: any = {}
    if (value) body.value = value
    if (description) body.description = description

    return this.request(`/payments/${paymentId}/refund`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async restorePayment(paymentId: string) {
    return this.request(`/payments/${paymentId}/restore`, {
      method: 'POST'
    })
  }

  // Webhook management
  async createWebhook(webhookData: {
    name: string
    url: string
    events: string[]
    enabled?: boolean
    interrupted?: boolean
    authToken?: string
  }) {
    return this.request('/webhooks', {
      method: 'POST',
      body: JSON.stringify(webhookData),
    })
  }

  async getWebhooks() {
    return this.request('/webhooks')
  }

  // PIX specific methods
  async getPixQrCode(paymentId: string) {
    return this.request(`/payments/${paymentId}/pixQrCode`)
  }

  async getPixKey(paymentId: string) {
    return this.request(`/payments/${paymentId}/pixKey`)
  }

  // Boleto specific methods
  async getBoletoUrl(paymentId: string) {
    return this.request(`/payments/${paymentId}/identificationField`)
  }

  async getBoletoBarCode(paymentId: string) {
    return this.request(`/payments/${paymentId}/identificationField`)
  }

  // Credit card tokenization
  async tokenizeCreditCard(creditCardData: {
    customer: string
    creditCard: {
      holderName: string
      number: string
      expiryMonth: string
      expiryYear: string
      ccv: string
    }
    creditCardHolderInfo: {
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
    remoteIp: string
  }) {
    return this.request('/creditCard/tokenize', {
      method: 'POST',
      body: JSON.stringify(creditCardData),
    })
  }

  // Account information
  async getAccountInfo() {
    return this.request('/myAccount')
  }

  async getBalance() {
    return this.request('/finance/balance')
  }

  // Installments calculation
  async getInstallments(value: number, creditCardBin: string) {
    const queryParams = new URLSearchParams({
      value: value.toString(),
      creditCardBin: creditCardBin
    })
    return this.request(`/installments?${queryParams.toString()}`)
  }

  // Payment methods validation
  async validateCreditCard(bin: string) {
    const queryParams = new URLSearchParams({ bin })
    return this.request(`/creditCard/validate?${queryParams.toString()}`)
  }

  // Transfer management (for marketplace scenarios)
  async createTransfer(transferData: {
    value: number
    pixKey?: string
    bankAccount?: {
      bank: string
      accountName: string
      ownerName: string
      cpfCnpj: string
      agency: string
      account: string
      accountDigit: string
    }
    description?: string
    scheduleDate?: string
    externalReference?: string
  }) {
    return this.request('/transfers', {
      method: 'POST',
      body: JSON.stringify(transferData),
    })
  }

  // Subscription payments management
  async getSubscriptionPayments(subscriptionId: string, filters?: {
    status?: string
    offset?: number
    limit?: number
  }) {
    const queryParams = new URLSearchParams()
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString())
        }
      })
    }

    const endpoint = `/subscriptions/${subscriptionId}/payments${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return this.request(endpoint)
  }

  // Payment link generation
  async createPaymentLink(linkData: {
    name: string
    description?: string
    endDate?: string
    value?: number
    billingType?: 'UNDEFINED' | 'CREDIT_CARD' | 'PIX' | 'BOLETO'
    chargeType: 'DETACHED' | 'RECURRENT'
    subscriptionCycle?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY'
    maxInstallmentCount?: number
    notificationEnabled?: boolean
  }) {
    return this.request('/paymentLinks', {
      method: 'POST',
      body: JSON.stringify(linkData),
    })
  }

  // Checkout Transparente - Asaas Checkouts API
  async createCheckout(checkoutData: {
    billingTypes: ('PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO')[]
    chargeTypes: ('DETACHED' | 'RECURRENT')[]
    minutesToExpire?: number
    description?: string // Descrição geral do checkout
    callback?: {
      successUrl: string
      cancelUrl?: string
      expiredUrl?: string
    }
    items: Array<{
      name: string
      description?: string
      value: number
      quantity: number
      imageBase64?: string
    }>
    customer?: string // Customer ID if already exists
    customerData?: {
      name: string
      cpfCnpj: string
      email: string
      phone: string
      address?: string
      addressNumber?: string
      complement?: string
      postalCode?: string
      province?: string
      city?: number | string
    }
    subscription?: {
      cycle: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY'
      nextDueDate: string // YYYY-MM-DD
      endDate?: string // YYYY-MM-DD
    }
  }) {
    return this.request('/checkouts', {
      method: 'POST',
      body: JSON.stringify(checkoutData),
    })
  }

  async getCheckout(checkoutId: string) {
    return this.request(`/checkouts/${checkoutId}`)
  }

  // Anticipation (for advanced cash flow management)
  async requestAnticipation(anticipationData: {
    payment: string
    value: number
  }) {
    return this.request('/anticipations', {
      method: 'POST',
      body: JSON.stringify(anticipationData),
    })
  }

  // Webhook management enhancements
  async updateWebhook(webhookId: string, webhookData: {
    name?: string
    url?: string
    events?: string[]
    enabled?: boolean
    authToken?: string
  }) {
    return this.request(`/webhooks/${webhookId}`, {
      method: 'PUT',
      body: JSON.stringify(webhookData),
    })
  }

  async deleteWebhook(webhookId: string) {
    return this.request(`/webhooks/${webhookId}`, {
      method: 'DELETE',
    })
  }
}

// Lazy-loaded Asaas client to ensure environment variables are available
let _asaas: AsaasAPI | null = null

function getAsaasClient(): AsaasAPI {
  if (!_asaas) {
    const apiKey = process.env.ASAAS_API_KEY
    const environment = (process.env.ASAAS_ENVIRONMENT === 'production' ? 'production' : 'sandbox') as 'production' | 'sandbox'

    console.log('🔑 Initializing Asaas client:', {
      hasApiKey: !!apiKey,
      keyLength: apiKey?.length || 0,
      keyPreview: apiKey ? `${apiKey.substring(0, 15)}...` : 'MISSING',
      environment,
      nodeEnv: process.env.NODE_ENV,
      allAsaasVars: Object.keys(process.env).filter(k => k.includes('ASAAS'))
    })

    if (!apiKey) {
      console.error('❌ ASAAS_API_KEY not found in environment!')
      throw new Error('ASAAS_API_KEY is required. Please check your .env.local file.')
    }

    _asaas = new AsaasAPI({
      apiKey,
      environment
    })
  }
  return _asaas
}

// Export the getter function as asaas
export const asaas = new Proxy({} as AsaasAPI, {
  get(target, prop) {
    const client = getAsaasClient()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  }
})

export { AsaasAPI }
export { AsaasAPI as AsaasClient }
export type { AsaasCustomer, AsaasPayment, AsaasSubscription }

// Helper functions for our SaaS
export const PLAN_PRICES = {
  STARTER: {
    monthly: 89.00,
    annual: 708.00,
    monthlyEquivalent: 59.00 // Para plano anual (708/12)
  },
  PREMIUM: {
    monthly: 179.00,
    annual: 1428.00,
    monthlyEquivalent: 119.00 // Para plano anual (1428/12)
  },
  GOLD: {
    monthly: 359.00,
    annual: 2868.00,
    monthlyEquivalent: 239.00 // Para plano anual (2868/12)
  }
} as const

export const PLAN_CYCLES = {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY'
} as const

export const PLAN_FEATURES = {
  STARTER: {
    models: 1, // por mês
    credits: 50, // por mês
    resolution: 'Resolução padrão'
  },
  PREMIUM: {
    models: 3, // por mês
    credits: 200, // por mês
    resolution: 'Alta resolução'
  },
  GOLD: {
    models: 10, // por mês
    credits: 1000, // por mês
    resolution: 'Máxima resolução'
  }
} as const

export function getPlanPrice(plan: 'STARTER' | 'PREMIUM' | 'GOLD', cycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY') {
  return cycle === 'YEARLY' ? PLAN_PRICES[plan].annual : PLAN_PRICES[plan].monthly
}

// Função para calcular economia anual (4 meses grátis)
export function calculateAnnualSavings(plan: 'STARTER' | 'PREMIUM' | 'GOLD') {
  const monthlyPrice = PLAN_PRICES[plan].monthly
  const annualPrice = PLAN_PRICES[plan].annual
  const savings = (monthlyPrice * 12) - annualPrice
  const monthsEquivalent = Math.round(savings / monthlyPrice)

  return {
    savings,
    monthsEquivalent,
    percentage: Math.round((savings / (monthlyPrice * 12)) * 100),
    formattedSavings: `R$ ${savings.toFixed(2)}`
  }
}

// Função para calcular o desconto mensal para planos anuais
export function calculateMonthlyDiscount(plan: 'STARTER' | 'PREMIUM' | 'GOLD') {
  const monthlyPrice = PLAN_PRICES[plan].monthly
  const annualPrice = PLAN_PRICES[plan].annual

  // Economia total = (preço mensal * 12) - preço anual
  const totalSavings = (monthlyPrice * 12) - annualPrice

  // Desconto mensal = economia total / 12 meses
  const monthlyDiscount = totalSavings / 12

  return {
    monthlyDiscount: Number(monthlyDiscount.toFixed(2)),
    totalSavings,
    monthlyPrice,
    effectiveMonthlyPrice: Number((monthlyPrice - monthlyDiscount).toFixed(2))
  }
}

export function formatBrazilianDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function getNextDueDate(cycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY'): string {
  const date = new Date()
  if (cycle === 'YEARLY') {
    date.setFullYear(date.getFullYear() + 1)
  } else {
    date.setMonth(date.getMonth() + 1)
  }
  return formatBrazilianDate(date)
}

// Enhanced Brazilian validation integration
import { 
  validateCPFCNPJ, 
  validateCEP, 
  validatePhone, 
  validateEmail,
  formatCPFCNPJ,
  formatCEP,
  formatPhone,
  formatBrazilianCurrency,
  validateBrazilianAddress,
  BRAZILIAN_STATES
} from '../utils/brazilian-validators'

// Credit packages for one-time purchases
export const CREDIT_PACKAGES = {
  ESSENCIAL: {
    name: 'Pacote Essencial',
    credits: 100,
    price: 89.00,
    description: 'Ideal para começar suas criações',
    popular: false
  },
  PROFISSIONAL: {
    name: 'Pacote Profissional', 
    credits: 300,
    price: 239.00,
    description: 'Para criadores mais ativos',
    popular: true,
    bonus: 50 // Bonus credits
  },
  PREMIUM: {
    name: 'Pacote Premium',
    credits: 600,
    price: 449.00,
    description: 'Máximo valor para profissionais',
    popular: false,
    bonus: 100 // Bonus credits  
  },
  MEGA: {
    name: 'Pacote Mega',
    credits: 1500,
    price: 899.00,
    description: 'Para uso intensivo e equipes',
    popular: false,
    bonus: 300 // Bonus credits
  }
} as const

// Photo packages for premium content
export const PHOTO_PACKAGES_PRICES = {
  BASIC: 39.00,
  PREMIUM: 69.00,
  DELUXE: 99.00
} as const

// Validation helper for customer data
export function validateCustomerData(customer: AsaasCustomer): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // Nome é obrigatório
  if (!customer.name || customer.name.trim().length < 2) {
    errors.push('Nome deve ter pelo menos 2 caracteres')
  }

  // Email OU mobilePhone é obrigatório (pelo menos um)
  const hasEmail = customer.email && validateEmail(customer.email)
  const hasMobilePhone = customer.mobilePhone && validatePhone(customer.mobilePhone)

  if (!hasEmail && !hasMobilePhone) {
    errors.push('Email ou telefone celular é obrigatório')
  }

  // Se email foi fornecido, valida formato
  if (customer.email && !validateEmail(customer.email)) {
    errors.push('Email inválido')
  }

  // CPF/CNPJ é obrigatório para clientes brasileiros
  if (!customer.cpfCnpj || !validateCPFCNPJ(customer.cpfCnpj)) {
    errors.push('CPF/CNPJ é obrigatório e deve ser válido')
  }

  // Validações opcionais
  if (customer.phone && !validatePhone(customer.phone)) {
    errors.push('Telefone inválido')
  }

  if (customer.mobilePhone && !validatePhone(customer.mobilePhone)) {
    errors.push('Celular inválido')
  }

  if (customer.postalCode && !validateCEP(customer.postalCode)) {
    errors.push('CEP inválido')
  }

  if (customer.state && !BRAZILIAN_STATES.find(state => state.code === customer.state)) {
    errors.push('Estado inválido')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Format customer data for Asaas API
export function formatCustomerForAsaas(customer: Partial<AsaasCustomer>): AsaasCustomer {
  const formatted: AsaasCustomer = {
    name: customer.name || '',
    email: customer.email || ''
  }
  
  if (customer.cpfCnpj) {
    formatted.cpfCnpj = customer.cpfCnpj.replace(/\D/g, '')
  }
  
  if (customer.phone) {
    formatted.phone = customer.phone.replace(/\D/g, '')
  }
  
  if (customer.mobilePhone) {
    formatted.mobilePhone = customer.mobilePhone.replace(/\D/g, '')
  }
  
  if (customer.postalCode) {
    formatted.postalCode = customer.postalCode.replace(/\D/g, '')
  }
  
  // Copy other fields
  if (customer.address) formatted.address = customer.address
  if (customer.addressNumber) formatted.addressNumber = customer.addressNumber
  if (customer.complement) formatted.complement = customer.complement
  if (customer.province) formatted.province = customer.province
  if (customer.city) formatted.city = customer.city
  if (customer.state) formatted.state = customer.state
  if (customer.externalReference) formatted.externalReference = customer.externalReference
  if (customer.observations) formatted.observations = customer.observations
  if (typeof customer.notificationDisabled === 'boolean') {
    formatted.notificationDisabled = customer.notificationDisabled
  }
  
  return formatted
}

// Helper to create PIX payment
export async function createPixPayment(
  customerId: string,
  value: number,
  description: string,
  externalReference?: string
): Promise<any> {
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 1) // PIX due in 1 day
  
  return asaas.createPayment({
    customer: customerId,
    billingType: 'PIX',
    dueDate: formatBrazilianDate(dueDate),
    value,
    description,
    externalReference
  })
}

// Helper to create boleto payment
export async function createBoletoPayment(
  customerId: string,
  value: number,
  description: string,
  daysToExpire: number = 7,
  externalReference?: string
): Promise<any> {
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + daysToExpire)
  
  return asaas.createPayment({
    customer: customerId,
    billingType: 'BOLETO',
    dueDate: formatBrazilianDate(dueDate),
    value,
    description,
    externalReference,
    fine: {
      value: 2.0,
      type: 'PERCENTAGE'
    },
    interest: {
      value: 1.0,
      type: 'PERCENTAGE'
    }
  })
}

// Helper to create credit card payment with installments
export async function createCreditCardPayment(
  customerId: string,
  value: number,
  description: string,
  installments: number = 1,
  creditCardToken?: string,
  externalReference?: string
): Promise<any> {
  const dueDate = new Date()
  
  const paymentData: AsaasPayment = {
    customer: customerId,
    billingType: 'CREDIT_CARD',
    dueDate: formatBrazilianDate(dueDate),
    value,
    description,
    externalReference,
    installmentCount: installments > 1 ? installments : undefined,
    installmentValue: installments > 1 ? value / installments : undefined
  }
  
  if (creditCardToken) {
    paymentData.creditCardToken = creditCardToken
  }
  
  return asaas.createPayment(paymentData)
}

// Helper to get payment methods for display
export function getPaymentMethodsForPlan(plan: 'STARTER' | 'PREMIUM' | 'GOLD') {
  const methods = [
    {
      type: 'PIX' as const,
      name: 'PIX',
      description: 'Aprovação instantânea',
      discount: 0,
      icon: '💳'
    },
    {
      type: 'CREDIT_CARD' as const,
      name: 'Cartão de Crédito',
      description: 'Parcelamento disponível',
      discount: 0,
      maxInstallments: plan === 'GOLD' ? 12 : plan === 'PREMIUM' ? 6 : 3,
      icon: '💳'
    },
    {
      type: 'BOLETO' as const,
      name: 'Boleto Bancário',
      description: 'Vencimento em 7 dias',
      discount: 0,
      icon: '🧾'
    }
  ]
  
  return methods
}

// Rate limiting helper
export class AsaasRateLimiter {
  private requests: number[] = []
  private maxRequests: number = 100 // 100 requests per minute
  private timeWindow: number = 60000 // 1 minute
  
  canMakeRequest(): boolean {
    const now = Date.now()
    
    // Remove old requests outside time window
    this.requests = this.requests.filter(time => now - time < this.timeWindow)
    
    return this.requests.length < this.maxRequests
  }
  
  recordRequest(): void {
    this.requests.push(Date.now())
  }
  
  getWaitTime(): number {
    if (this.requests.length === 0) return 0
    
    const oldestRequest = Math.min(...this.requests)
    const timeToWait = this.timeWindow - (Date.now() - oldestRequest)
    
    return Math.max(0, timeToWait)
  }
}

// Error handling helper
export function handleAsaasError(error: any): { message: string; code?: string; details?: any } {
  if (error.message?.includes('Asaas API Error')) {
    // Parse Asaas API error - novo formato inclui código de erro: Asaas API Error (401) [invalid_access_token]: mensagem
    const matchWithCode = error.message.match(/Asaas API Error \((\d+)\) \[([^\]]+)\]: (.+)/)
    const matchSimple = error.message.match(/Asaas API Error \((\d+)\): (.+)/)

    if (matchWithCode) {
      const [, statusCode, errorCode, errorMessage] = matchWithCode

      return {
        message: errorMessage,
        code: errorCode,
        details: { statusCode, errorCode, errorMessage }
      }
    }

    if (matchSimple) {
      const [, statusCode, errorMessage] = matchSimple

      const commonErrors: Record<string, string> = {
        '400': 'Dados inválidos fornecidos. Verifique os campos obrigatórios.',
        '401': 'Erro de autenticação. Verifique sua chave API.',
        '403': 'Acesso negado. Verifique as permissões da sua conta.',
        '404': 'Recurso não encontrado. Verifique o ID fornecido.',
        '429': 'Limite de requisições excedido. Aguarde alguns instantes e tente novamente.',
        '500': 'Erro interno do Asaas. Tente novamente mais tarde.',
        '503': 'Serviço temporariamente indisponível. Tente novamente em alguns minutos.'
      }

      return {
        message: commonErrors[statusCode] || errorMessage,
        code: statusCode,
        details: errorMessage
      }
    }
  }

  return {
    message: 'Erro interno - tente novamente mais tarde',
    details: error.message
  }
}