import { asaas } from '@/lib/payments/asaas'
import { prisma } from '@/lib/prisma'
import { getCreditPackageById, getPlanById } from '@/config/pricing'

// URLs de callback para Asaas (não aceita localhost)
const CALLBACK_BASE = 'https://example.com/asaas/checkout'

// URL base do Asaas baseada no ambiente
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox'
const ASAAS_CHECKOUT_BASE = ASAAS_ENVIRONMENT === 'production'
  ? 'https://www.asaas.com'
  : 'https://sandbox.asaas.com'

/**
 * Buscar ou criar cliente no Asaas
 * Evita criar duplicados ao buscar por CPF primeiro
 */
async function getOrCreateAsaasCustomer(user: any): Promise<string> {
  // Se já tem customer ID salvo, retornar
  if (user.asaasCustomerId) {
    console.log('♻️ Reutilizando customer ID existente:', user.asaasCustomerId)
    return user.asaasCustomerId
  }

  // Buscar cliente existente no Asaas por CPF
  if (user.cpfCnpj) {
    const cpfClean = user.cpfCnpj.replace(/\D/g, '')
    const existingCustomers = await asaas.findCustomerByCpfCnpj(cpfClean)

    if (existingCustomers?.data && existingCustomers.data.length > 0) {
      const existingCustomer = existingCustomers.data[0]
      console.log('♻️ Cliente encontrado no Asaas:', existingCustomer.id)

      // Salvar customer ID no usuário para próximas compras
      await prisma.user.update({
        where: { id: user.id },
        data: { asaasCustomerId: existingCustomer.id }
      })

      return existingCustomer.id
    }
  }

  // Cliente não existe, criar novo
  console.log('📝 Criando novo cliente no Asaas...')
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

  console.log('✅ Novo cliente criado:', newCustomer.id)

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

  // Calcular próxima data de cobrança
  const nextDueDate = new Date()
  if (cycle === 'YEARLY') {
    nextDueDate.setFullYear(nextDueDate.getFullYear() + 1)
  } else {
    nextDueDate.setMonth(nextDueDate.getMonth() + 1)
  }

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
      nextDueDate: nextDueDate.toISOString().split('T')[0]
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
