import { asaas } from '@/lib/payments/asaas'
import { prisma } from '@/lib/prisma'
import { getCreditPackageById, getPlanById } from '@/config/pricing'
import { getAsaasEnvironment, getAsaasCheckoutUrl, getWebhookBaseUrl } from '@/lib/utils/environment'

// URLs de callback para Asaas
const CALLBACK_BASE = getWebhookBaseUrl() || 'https://vibephoto-delta.vercel.app'

// URL base do Asaas baseada no ambiente (com validação automática)
const ASAAS_ENVIRONMENT = getAsaasEnvironment()
const ASAAS_CHECKOUT_BASE = getAsaasCheckoutUrl()

/**
 * Buscar ou criar cliente no Asaas
 * Evita criar duplicados ao buscar por CPF primeiro
 *
 * IMPORTANTE: Customer IDs são específicos por ambiente (sandbox vs production)
 * Não podemos reutilizar um customer ID de sandbox em produção e vice-versa
 */
async function getOrCreateAsaasCustomer(user: any): Promise<string> {
  console.log('='.repeat(80))
  console.log('🔍 BUSCANDO/CRIANDO CLIENTE NO ASAAS')
  console.log('🌍 Ambiente Asaas:', ASAAS_ENVIRONMENT)
  console.log('👤 Usuário:', user.email)
  console.log('💾 Customer ID salvo no DB:', user.asaasCustomerId || 'nenhum')
  console.log('='.repeat(80))

  // ⚠️ NÃO reutilizar customer ID salvo - ele pode ser de outro ambiente!
  // Sempre buscar/criar no ambiente atual baseado no CPF

  // Buscar cliente existente no Asaas por CPF (no ambiente atual)
  if (user.cpfCnpj) {
    const cpfClean = user.cpfCnpj.replace(/\D/g, '')
    console.log(`🔎 Buscando cliente no Asaas ${ASAAS_ENVIRONMENT} por CPF:`, cpfClean)

    const existingCustomers = await asaas.findCustomerByCpfCnpj(cpfClean)

    if (existingCustomers?.data && existingCustomers.data.length > 0) {
      const existingCustomer = existingCustomers.data[0]
      console.log(`♻️ Cliente encontrado no Asaas ${ASAAS_ENVIRONMENT}:`, existingCustomer.id)

      // Salvar customer ID no usuário (sobrescrever se for de outro ambiente)
      if (user.asaasCustomerId !== existingCustomer.id) {
        console.log(`💾 Atualizando customer ID no DB: ${user.asaasCustomerId || 'null'} → ${existingCustomer.id}`)
        await prisma.user.update({
          where: { id: user.id },
          data: { asaasCustomerId: existingCustomer.id }
        })
      }

      return existingCustomer.id
    }

    console.log(`⚠️ Cliente NÃO encontrado no Asaas ${ASAAS_ENVIRONMENT} - criando novo...`)
  }

  // Cliente não existe, criar novo
  console.log(`📝 Criando novo cliente no Asaas ${ASAAS_ENVIRONMENT}...`)
  const newCustomer = await asaas.createCustomer({
    name: user.name,
    email: user.email,
    cpfCnpj: user.cpfCnpj?.replace(/\D/g, ''),
    phone: (user.mobilePhone || user.phone)?.replace(/\D/g, ''),
    address: user.address,
    addressNumber: user.addressNumber,
    complement: user.complement,
    province: user.province,
    city: user.city,
    state: user.state,
    postalCode: user.postalCode?.replace(/\D/g, '')
  })

  if (!newCustomer.id) {
    throw new Error('Erro ao criar cliente no Asaas')
  }

  console.log(`✅ Novo cliente criado no ${ASAAS_ENVIRONMENT}:`, newCustomer.id)

  // Salvar customer ID no usuário
  await prisma.user.update({
    where: { id: user.id },
    data: { asaasCustomerId: newCustomer.id }
  })

  return newCustomer.id
}

/**
 * Criar checkout para pacote de créditos
 */
export async function createCreditPackageCheckout(
  packageId: string,
  billingType: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD',
  userId: string
): Promise<{ checkoutId: string; checkoutUrl: string }> {
  // Buscar pacote
  const creditPackage = getCreditPackageById(packageId)
  if (!creditPackage) {
    throw new Error('Pacote de créditos não encontrado')
  }

  // Buscar usuário
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      asaasCustomerId: true,
      cpfCnpj: true,
      phone: true,
      mobilePhone: true,
      address: true,
      addressNumber: true,
      complement: true,
      province: true,
      city: true,
      state: true,
      postalCode: true
    }
  })

  if (!user) {
    throw new Error('Usuário não encontrado')
  }

  // Preparar descrição do pacote
  const packageDescription = `${creditPackage.name} - ${creditPackage.credits} créditos`

  // Preparar dados do checkout
  const checkoutData: any = {
    billingTypes: [billingType],
    chargeTypes: ['DETACHED'], // Pagamento único
    minutesToExpire: 60, // 1 hora de validade
    callback: {
      successUrl: `${CALLBACK_BASE}/success`,
      cancelUrl: `${CALLBACK_BASE}/cancel`,
      expiredUrl: `${CALLBACK_BASE}/expired`
    },
    items: [
      {
        name: creditPackage.name,
        description: packageDescription,
        value: creditPackage.price,
        quantity: 1
      }
    ],
    // Adicionar descrição também no nível do checkout
    description: packageDescription
  }

  // Validar dados do cliente
  if (!user.name || !user.email || !user.cpfCnpj || !user.phone) {
    throw new Error('INCOMPLETE_PROFILE:Usuário precisa completar cadastro com CPF e telefone')
  }

  // Buscar ou criar cliente no Asaas (evita duplicados)
  const customerId = await getOrCreateAsaasCustomer(user)
  checkoutData.customer = customerId

  // Verificar se já existe um checkout PENDING recente (últimas 2 horas)
  const existingPendingCheckout = await prisma.creditPurchase.findFirst({
    where: {
      userId: user.id,
      packageName: creditPackage.name,
      status: 'PENDING',
      purchasedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }
    },
    orderBy: { purchasedAt: 'desc' }
  })

  // Se existe checkout pendente válido, reutilizar
  if (existingPendingCheckout?.asaasCheckoutId) {
    console.log('♻️ Reutilizando checkout existente:', existingPendingCheckout.asaasCheckoutId)

    const checkoutUrl = `${ASAAS_CHECKOUT_BASE}/checkoutSession/show?id=${existingPendingCheckout.asaasCheckoutId}`

    return {
      checkoutId: existingPendingCheckout.asaasCheckoutId,
      checkoutUrl
    }
  }

  // Criar checkout no Asaas
  const checkout = await asaas.createCheckout(checkoutData)

  if (!checkout.id) {
    throw new Error('Erro ao criar checkout no Asaas')
  }

  // Salvar no banco
  await prisma.creditPurchase.create({
    data: {
      userId: user.id,
      asaasCheckoutId: checkout.id,
      // packageId: creditPackage.id, // Removido - foreign key constraint issue
      packageName: creditPackage.name,
      creditAmount: creditPackage.credits,
      value: creditPackage.price,
      status: 'PENDING',
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
    }
  })

  // Montar URL do checkout
  const checkoutUrl = `${ASAAS_CHECKOUT_BASE}/checkoutSession/show?id=${checkout.id}`

  console.log('✅ Checkout criado com sucesso!')
  console.log('🔗 URL do checkout:', checkoutUrl)
  console.log('='.repeat(80))

  return {
    checkoutId: checkout.id,
    checkoutUrl
  }
}

/**
 * Criar checkout para assinatura de plano
 */
export async function createSubscriptionCheckout(
  planId: 'STARTER' | 'PREMIUM' | 'GOLD',
  cycle: 'MONTHLY' | 'YEARLY',
  userId: string
): Promise<{ checkoutId: string; checkoutUrl: string }> {
  // Buscar plano
  const plan = getPlanById(planId)
  if (!plan) {
    throw new Error('Plano não encontrado')
  }

  // Buscar usuário
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      asaasCustomerId: true,
      cpfCnpj: true,
      phone: true,
      mobilePhone: true,
      address: true,
      addressNumber: true,
      complement: true,
      province: true,
      city: true,
      state: true,
      postalCode: true
    }
  })

  if (!user) {
    throw new Error('Usuário não encontrado')
  }

  // Calcular valor baseado no ciclo
  const value = cycle === 'YEARLY' ? plan.annualPrice : plan.monthlyPrice

  // Data de cobrança IMEDIATA (hoje) - primeira cobrança acontece assim que checkout for pago
  const nextDueDate = new Date()

  // Preparar dados do checkout
  const checkoutData: any = {
    billingTypes: ['CREDIT_CARD'], // Apenas crédito para recorrência
    chargeTypes: ['RECURRENT'], // Pagamento recorrente
    minutesToExpire: 100, // 100 minutos de validade
    items: [
      {
        name: `Plano ${plan.name}`,
        description: `Assinatura ${plan.name} ${cycle === 'YEARLY' ? 'anual' : 'mensal'} - VibePhoto`,
        value,
        quantity: 1
      }
    ],
    subscription: {
      cycle,
      nextDueDate: nextDueDate.toISOString().split('T')[0] // Cobrança imediata no dia do pagamento
    },
    callback: {
      successUrl: `${CALLBACK_BASE}/success`,
      cancelUrl: `${CALLBACK_BASE}/cancel`,
      expiredUrl: `${CALLBACK_BASE}/expired`
    }
  }

  // Validar dados do cliente
  if (!user.name || !user.email || !user.cpfCnpj || !user.phone) {
    throw new Error('Usuário precisa completar cadastro com CPF e telefone')
  }

  // Buscar ou criar cliente no Asaas (evita duplicados)
  const customerId = await getOrCreateAsaasCustomer(user)
  checkoutData.customer = customerId

  // Log completo para debug
  console.log('='.repeat(80))
  console.log('📦 CRIANDO CHECKOUT DE ASSINATURA')
  console.log('🌍 Ambiente:', ASAAS_ENVIRONMENT)
  console.log('='.repeat(80))
  console.log('JSON COMPLETO sendo enviado para Asaas:')
  console.log(JSON.stringify(checkoutData, null, 2))
  console.log('='.repeat(80))

  // Criar checkout no Asaas
  const checkout = await asaas.createCheckout(checkoutData)

  if (!checkout.id) {
    throw new Error('Erro ao criar checkout no Asaas')
  }

  // Salvar no banco
  await prisma.payment.create({
    data: {
      userId: user.id,
      asaasCheckoutId: checkout.id,
      type: 'SUBSCRIPTION',
      status: 'PENDING',
      billingType: 'CREDIT_CARD',
      value,
      description: `Assinatura ${plan.name} - ${cycle}`,
      dueDate: nextDueDate,
      planType: planId,
      billingCycle: cycle
    }
  })

  // Montar URL do checkout
  const checkoutUrl = `${ASAAS_CHECKOUT_BASE}/checkoutSession/show?id=${checkout.id}`

  console.log('✅ Checkout criado com sucesso!')
  console.log('🔗 URL do checkout:', checkoutUrl)
  console.log('='.repeat(80))

  return {
    checkoutId: checkout.id,
    checkoutUrl
  }
}

/**
 * Consultar status de um checkout
 */
export async function getCheckoutStatus(checkoutId: string) {
  try {
    const checkout = await asaas.getCheckout(checkoutId)
    return {
      success: true,
      checkout
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    }
  }
}
