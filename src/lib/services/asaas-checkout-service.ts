import { asaas } from '@/lib/payments/asaas'
import { prisma } from '@/lib/prisma'
import { getPlanById, PLANS_FALLBACK } from '@/config/pricing'
import { CreditPackageService } from '@/lib/services/credit-package-service'
import { getAsaasEnvironment, getAsaasCheckoutUrl, getWebhookBaseUrl } from '@/lib/utils/environment'

// URLs de callback para Asaas - usa domínio de produção
const CALLBACK_BASE = getWebhookBaseUrl() || 'https://vibephoto.app'

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

      // CRÍTICO: Verificar se o cliente tem addressNumber
      // Se não tiver, atualizar com 'S/N' (requisito do Asaas)
      if (!existingCustomer.addressNumber || existingCustomer.addressNumber.trim() === '') {
        console.log('⚠️ Cliente encontrado sem addressNumber, atualizando com "S/N"...')
        try {
          const addressNumber = user.addressNumber?.trim() || 'S/N'
          await asaas.updateCustomer(existingCustomer.id, {
            addressNumber: addressNumber
          })
          console.log('✅ Cliente atualizado com addressNumber:', addressNumber)
        } catch (updateError: any) {
          console.warn('⚠️ Erro ao atualizar addressNumber do cliente existente:', updateError.message)
          // Continuar mesmo se não conseguir atualizar - pode ser que o Asaas aceite
        }
      }

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
  
  // Asaas requer addressNumber - usar 'S/N' se não tiver
  const addressNumber = user.addressNumber?.trim() || 'S/N'
  
  console.log('📝 Dados do cliente para criar no Asaas:', {
    name: user.name,
    email: user.email,
    address: user.address,
    addressNumber,
    city: user.city,
    state: user.state,
    postalCode: user.postalCode
  })
  
  const newCustomer = await asaas.createCustomer({
    name: user.name,
    email: user.email,
    cpfCnpj: user.cpfCnpj?.replace(/\D/g, ''),
    phone: (user.mobilePhone || user.phone)?.replace(/\D/g, ''),
    address: user.address,
    addressNumber: addressNumber, // Sempre preenche com valor ou 'S/N'
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
  // Buscar pacote do banco de dados
  const creditPackage = await CreditPackageService.getPackageById(packageId)
  if (!creditPackage) {
    throw new Error('Pacote de créditos não encontrado')
  }

  if (!creditPackage.isActive) {
    throw new Error('Pacote de créditos inativo')
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
  const totalCredits = creditPackage.creditAmount + creditPackage.bonusCredits
  const packageDescription = `${creditPackage.name} - ${totalCredits} créditos`

  // Preparar dados do checkout
  const checkoutData: any = {
    billingTypes: [billingType],
    chargeTypes: ['DETACHED'], // Pagamento único
    minutesToExpire: 60, // 1 hora de validade
    autoRedirect: true, // Redireciona automaticamente após pagamento
    callback: {
      successUrl: `${CALLBACK_BASE}/`, // Redireciona para área logada após pagamento bem-sucedido
      // cancelUrl e expiredUrl são obrigatórios pelo Asaas, mas redirecionam para área logada
      // já que o usuário tem assinatura ativa e acesso ao app
      cancelUrl: `${CALLBACK_BASE}/`, // Volta para área logada (usuário já tem acesso)
      expiredUrl: `${CALLBACK_BASE}/` // Volta para área logada (usuário já tem acesso)
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

  // Calcular data de validade baseado no validityMonths do pacote
  const validUntilDate = new Date()
  validUntilDate.setMonth(validUntilDate.getMonth() + creditPackage.validityMonths)

  // Salvar no banco
  await prisma.creditPurchase.create({
    data: {
      userId: user.id,
      asaasCheckoutId: checkout.id,
      // packageId: creditPackage.id, // Removido - foreign key constraint issue
      packageName: creditPackage.name,
      creditAmount: creditPackage.creditAmount + creditPackage.bonusCredits,
      value: creditPackage.price,
      status: 'PENDING',
      validUntil: validUntilDate // Usar validityMonths do pacote do banco
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
  // Buscar plano do banco de dados
  console.log('🔍 [CHECKOUT] Buscando plano:', planId)
  const plan = await getPlanById(planId)
  
  if (!plan) {
    console.error('❌ [CHECKOUT] Plano não encontrado:', planId)
    throw new Error(`Plano não encontrado: ${planId}`)
  }
  
  // Verificar se veio do banco ou fallback comparando com valores conhecidos do fallback
  let source = 'BANCO DE DADOS'
  try {
    if (PLANS_FALLBACK && Array.isArray(PLANS_FALLBACK) && PLANS_FALLBACK.length > 0) {
      const fallbackPlan = PLANS_FALLBACK.find(p => p.id === planId)
      if (fallbackPlan && 
          plan.monthlyPrice === fallbackPlan.monthlyPrice && 
          plan.annualPrice === fallbackPlan.annualPrice) {
        source = 'FALLBACK (código)'
      }
    }
  } catch (error) {
    console.warn('⚠️ [CHECKOUT] Erro ao verificar fallback:', error)
    // Continuar com 'BANCO DE DADOS' como padrão
  }
  
  console.log('✅ [CHECKOUT] Plano encontrado:', {
    id: plan.id,
    name: plan.name,
    monthlyPrice: plan.monthlyPrice,
    annualPrice: plan.annualPrice,
    source
  })

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

  // Data de cobrança IMEDIATA (hoje no fuso horário do Brasil)
  // Usar fuso horário do Brasil (America/Sao_Paulo, UTC-3) para evitar problemas com UTC
  // que pode fazer a data mudar de dia dependendo do horário do servidor
  const now = new Date()
  // Formatar data no fuso horário do Brasil
  // toLocaleString com timeZone retorna a data no fuso especificado
  const brazilDateStr = now.toLocaleDateString('en-CA', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  // Formato já é YYYY-MM-DD (en-CA usa esse formato)
  const nextDueDate = brazilDateStr

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
      nextDueDate // Data de hoje no fuso horário do Brasil (YYYY-MM-DD)
    },
    autoRedirect: true, // Redireciona automaticamente após pagamento
    callback: {
      successUrl: `${CALLBACK_BASE}/checkout/subscription-success`, // Página dedicada de sucesso para assinaturas
      cancelUrl: `${CALLBACK_BASE}/pricing?required=true`, // Volta para escolha de plano
      expiredUrl: `${CALLBACK_BASE}/pricing?required=true` // Volta para escolha de plano
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
  // Converter nextDueDate (string YYYY-MM-DD) para Date no início do dia no fuso horário do Brasil
  const dueDateObj = new Date(`${nextDueDate}T00:00:00-03:00`) // -03:00 é UTC-3 (fuso do Brasil)

  await prisma.payment.create({
    data: {
      userId: user.id,
      asaasCheckoutId: checkout.id,
      type: 'SUBSCRIPTION',
      status: 'PENDING',
      billingType: 'CREDIT_CARD',
      value,
      description: `Assinatura ${plan.name} - ${cycle}`,
      dueDate: dueDateObj, // Agora é um Date object válido
      planType: planId,
      billingCycle: cycle
    }
  })

  // CRÍTICO: Salvar plan e billingCycle diretamente na tabela users
  // Isso garante que os dados estejam disponíveis mesmo se o Payment não for encontrado no webhook
  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: planId, // Salvar plan diretamente (Plan enum)
      billingCycle: cycle // Salvar billingCycle diretamente (MONTHLY/YEARLY)
    }
  })

  console.log('✅ [CHECKOUT] Plan e billingCycle salvos na tabela users:', {
    userId: user.id,
    plan: planId,
    billingCycle: cycle
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
