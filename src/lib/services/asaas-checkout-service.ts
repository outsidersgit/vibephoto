import { asaas } from '@/lib/payments/asaas'
import type { AsaasCustomer } from '@/lib/payments/asaas'
import { prisma } from '@/lib/prisma'
import { getPlanById, PLANS_FALLBACK } from '@/config/pricing'
import { CreditPackageService } from '@/lib/services/credit-package-service'
import { getAsaasEnvironment, getAsaasCheckoutUrl, getWebhookBaseUrl } from '@/lib/utils/environment'
import { findInfluencerByCouponCode } from '@/lib/db/influencers'
import { validateCoupon } from '@/lib/services/coupon-service'
import { getSubscriptionPlanById } from '@/lib/db/subscription-plans'

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
      const requiredAddressFields: Partial<AsaasCustomer> = {}

      if (!existingCustomer.addressNumber || existingCustomer.addressNumber.trim() === '') {
        requiredAddressFields.addressNumber = user.addressNumber?.trim() || 'S/N'
      }
      if (!existingCustomer.address && user.address) {
        requiredAddressFields.address = user.address
      }
      if (!existingCustomer.city && user.city) {
        requiredAddressFields.city = user.city
      }
      if (!existingCustomer.state && user.state) {
        requiredAddressFields.state = user.state
      }
      if (!existingCustomer.postalCode && user.postalCode) {
        requiredAddressFields.postalCode = user.postalCode.replace(/\D/g, '')
      }
      if (!existingCustomer.province && user.province) {
        requiredAddressFields.province = user.province
      }

      if (Object.keys(requiredAddressFields).length > 0) {
        console.log('⚠️ Cliente existente sem dados completos, atualizando no Asaas:', requiredAddressFields)
        try {
          await asaas.updateCustomer(existingCustomer.id, requiredAddressFields)
          console.log('✅ Cliente atualizado com dados de endereço obrigatórios')
        } catch (updateError: any) {
          console.warn('⚠️ Erro ao atualizar dados obrigatórios do cliente existente:', updateError.message)
          // Continuar mesmo se não conseguir atualizar - tentaremos seguir com o checkout
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
  billingType: 'PIX' | 'CREDIT_CARD',
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
      packageId: creditPackage.id,
      packageName: creditPackage.name,
      creditAmount: creditPackage.creditAmount + creditPackage.bonusCredits,
      bonusCredits: creditPackage.bonusCredits,
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
 * Suporta dois formatos:
 * - TRADITIONAL (Formato A): STARTER, PREMIUM, GOLD com cycles MONTHLY/YEARLY
 * - MEMBERSHIP (Formato B): MEMBERSHIP_QUARTERLY, MEMBERSHIP_SEMI_ANNUAL, MEMBERSHIP_ANNUAL
 */
export async function createSubscriptionCheckout(
  planId: string, // Aceita qualquer plan ID (STARTER, PREMIUM, GOLD, MEMBERSHIP_QUARTERLY, etc)
  cycle: string,  // MONTHLY, YEARLY, QUARTERLY, SEMI_ANNUAL, ANNUAL
  userId: string,
  referralCode?: string,
  couponCode?: string
): Promise<{ checkoutId: string; checkoutUrl: string }> {
  console.log('🔍 [CHECKOUT] Iniciando checkout:', { planId, cycle })

  // Buscar plano do banco de dados (suporta ambos formatos)
  let planFromDb: any = null

  // Para planos tradicionais (STARTER, PREMIUM, GOLD), usar getPlanById
  if (['STARTER', 'PREMIUM', 'GOLD'].includes(planId)) {
    console.log('🔍 [CHECKOUT] Plano tradicional detectado, usando getPlanById')
    planFromDb = await getPlanById(planId as 'STARTER' | 'PREMIUM' | 'GOLD')
  } else {
    // Para planos membership, buscar direto do banco
    console.log('🔍 [CHECKOUT] Plano membership detectado, buscando do banco')
    planFromDb = await getSubscriptionPlanById(planId as any)
  }

  if (!planFromDb) {
    console.error('❌ [CHECKOUT] Plano não encontrado:', planId)
    throw new Error(`Plano não encontrado: ${planId}`)
  }

  // Detectar formato do plano
  const planFormat = planFromDb.planFormat || 'TRADITIONAL'
  console.log('✅ [CHECKOUT] Formato do plano:', planFormat)

  // Determinar o objeto 'plan' baseado no formato
  const plan = planFromDb // Usar o objeto do banco diretamente

  console.log('✅ [CHECKOUT] Plano encontrado:', {
    id: plan.planId || plan.id,
    name: plan.name,
    format: planFormat,
    monthlyPrice: plan.monthlyPrice,
    annualPrice: plan.annualPrice,
    cycleCredits: plan.cycleCredits,
    cycleDurationMonths: plan.cycleDurationMonths
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
      postalCode: true,
      referralCodeUsed: true,
      referredByInfluencerId: true
    }
  })

  if (!user) {
    throw new Error('Usuário não encontrado')
  }

  let influencer: Awaited<ReturnType<typeof findInfluencerByCouponCode>> | null = null
  if (referralCode) {
    influencer = await findInfluencerByCouponCode(referralCode, { includeUser: true })
    if (!influencer) {
      console.warn('⚠️ [CHECKOUT] Código de indicação inválido informado:', referralCode)
    } else if (!influencer.asaasWalletId) {
      console.warn('⚠️ [CHECKOUT] Influenciador encontrado, porém sem walletId configurado:', influencer.id)
    }
  }

  // Calcular valor baseado no formato e ciclo
  let originalPrice: number
  let asaasCycle: 'MONTHLY' | 'YEARLY' // Asaas só suporta MONTHLY e YEARLY

  if (planFormat === 'TRADITIONAL') {
    // Formato A: lógica atual (INTACTA)
    originalPrice = cycle === 'YEARLY' ? plan.annualPrice : plan.monthlyPrice
    asaasCycle = cycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY'
  } else {
    // Formato B: preço do ciclo específico
    // Para Asaas, converter ciclos longos para MONTHLY com valor total
    originalPrice = plan.monthlyPrice // No formato B, monthlyPrice = preço total do ciclo

    // Asaas subscription cycle - converter baseado na duração
    // QUARTERLY (3 meses) → MONTHLY (mas cobrança única de 3 meses)
    // SEMI_ANNUAL (6 meses) → MONTHLY (mas cobrança única de 6 meses)
    // ANNUAL (12 meses) → YEARLY
    const cycleDuration = plan.cycleDurationMonths || 3
    asaasCycle = cycleDuration >= 12 ? 'YEARLY' : 'MONTHLY'

    console.log('💰 [CHECKOUT] Formato B - Ciclo detectado:', {
      billingCycle: cycle,
      cycleDuration,
      asaasCycle,
      price: originalPrice
    })
  }

  let value = originalPrice
  let discountApplied = 0
  let validatedCoupon: Awaited<ReturnType<typeof validateCoupon>>['coupon'] | null = null
  let needsPriceUpdate = false // Flag para indicar se preço deve ser atualizado após primeiro pagamento

  // Validate discount coupon if provided
  if (couponCode) {
    const couponValidation = await validateCoupon(couponCode, planId, cycle, userId)

    if (couponValidation.valid && couponValidation.coupon) {
      validatedCoupon = couponValidation.coupon
      value = couponValidation.coupon.finalPrice
      discountApplied = couponValidation.coupon.discountAmount

      // Se cupom é FIRST_CYCLE, marcar para atualizar preço após primeiro pagamento
      if (couponValidation.coupon.durationType === 'FIRST_CYCLE') {
        needsPriceUpdate = true
        console.log('🔄 [CHECKOUT] Cupom FIRST_CYCLE detectado - preço será atualizado após primeiro pagamento')
      }

      console.log('🎟️ [CHECKOUT] Cupom de desconto aplicado:', {
        code: couponValidation.coupon.code,
        type: couponValidation.coupon.type,
        durationType: couponValidation.coupon.durationType,
        originalPrice: couponValidation.coupon.originalPrice,
        discountAmount: discountApplied,
        finalPrice: value,
        needsPriceUpdate
      })

      // If HYBRID coupon with influencer data, use it for split
      if (couponValidation.coupon.type === 'HYBRID' && couponValidation.coupon.influencer) {
        // Override influencer from referral code with coupon influencer
        influencer = {
          id: couponValidation.coupon.influencer.id,
          couponCode: couponValidation.coupon.influencer.couponCode,
          commissionPercentage: couponValidation.coupon.influencer.commissionPercentage,
          commissionFixedValue: couponValidation.coupon.influencer.commissionFixedValue,
          asaasWalletId: couponValidation.coupon.influencer.asaasWalletId,
          userId: '',
          asaasApiKey: null,
          monthlyIncome: null,
          totalReferrals: 0,
          totalCommissions: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        console.log('🎟️ [CHECKOUT] Cupom HÍBRIDO detectado - configurando split:', {
          influencerId: influencer.id,
          asaasWalletId: influencer.asaasWalletId,
          commissionPercentage: influencer.commissionPercentage,
          commissionFixedValue: influencer.commissionFixedValue
        })
      }
    } else {
      console.warn('⚠️ [CHECKOUT] Cupom inválido, continuando com preço normal:', couponCode)
      // Don't throw error - just continue with normal price
    }
  }

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

  // Preparar descrição baseada no formato
  let planDescription: string
  if (planFormat === 'TRADITIONAL') {
    planDescription = `Assinatura ${plan.name} ${cycle === 'YEARLY' ? 'anual' : 'mensal'} - VibePhoto`
  } else {
    // Formato B: incluir duração do ciclo
    const cycleNames: Record<string, string> = {
      'QUARTERLY': 'trimestral (3 meses)',
      'SEMI_ANNUAL': 'semestral (6 meses)',
      'ANNUAL': 'anual (12 meses)'
    }
    planDescription = `${plan.name} ${cycleNames[cycle] || cycle} - VibePhoto`
  }

  // Preparar dados do checkout
  const checkoutData: any = {
    billingTypes: ['CREDIT_CARD'], // Apenas CREDIT_CARD permitido para RECURRENT (limitação do Asaas)
    chargeTypes: ['RECURRENT'], // Pagamento recorrente
    minutesToExpire: 100, // 100 minutos de validade
    items: [
      {
        name: `Plano ${plan.name}`,
        description: planDescription,
        value,
        quantity: 1
      }
    ],
    subscription: {
      cycle: asaasCycle, // Usar asaasCycle (MONTHLY ou YEARLY) para compatibilidade com Asaas
      nextDueDate // Data de hoje no fuso horário do Brasil (YYYY-MM-DD)
    },
    autoRedirect: true, // Redireciona automaticamente após pagamento
    callback: {
      successUrl: `${CALLBACK_BASE}/checkout/subscription-success`, // Página dedicada de sucesso para assinaturas
      cancelUrl: `${CALLBACK_BASE}/pricing?required=true`, // Volta para escolha de plano
      expiredUrl: `${CALLBACK_BASE}/pricing?required=true` // Volta para escolha de plano
    }
  }

  console.log('💰 [CHECKOUT] Verificando split para influencer:', {
    hasInfluencer: !!influencer,
    asaasWalletId: influencer?.asaasWalletId,
    commissionPercentage: influencer?.commissionPercentage,
    commissionFixedValue: influencer?.commissionFixedValue
  })

  if (influencer?.asaasWalletId) {
    const influencerSplit: Record<string, any> = {
      walletId: influencer.asaasWalletId
    }

    // Convert Decimal to number if needed
    const fixedValue = influencer.commissionFixedValue?.toNumber?.() ??
                       (typeof influencer.commissionFixedValue === 'number' ? influencer.commissionFixedValue : null)
    const percentage = influencer.commissionPercentage?.toNumber?.() ??
                       (typeof influencer.commissionPercentage === 'number' ? influencer.commissionPercentage : null)

    console.log('💰 [CHECKOUT] Comissões convertidas:', { fixedValue, percentage })

    if (fixedValue && fixedValue > 0) {
      influencerSplit.fixedValue = fixedValue
      console.log('✅ [CHECKOUT] Split configurado com fixedValue:', fixedValue)
    } else if (percentage && percentage > 0) {
      influencerSplit.percentageValue = percentage
      console.log('✅ [CHECKOUT] Split configurado com percentageValue:', percentage)
    }

    if (influencerSplit.fixedValue || influencerSplit.percentageValue) {
      if (!checkoutData.splits) {
        checkoutData.splits = []
      }
      checkoutData.splits.push(influencerSplit)
      console.log('✅ [CHECKOUT] Split adicionado ao checkoutData:', influencerSplit)
    } else {
      console.warn('⚠️ [CHECKOUT] Influenciador sem fixedValue/percentageValue válido, split ignorado:', {
        influencerId: influencer.id,
        fixedValue,
        percentage
      })
    }
  } else {
    console.log('⚠️ [CHECKOUT] Nenhum influencer válido ou asaasWalletId ausente')
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

  const paymentData: any = {
    userId: user.id,
    asaasCheckoutId: checkout.id,
    type: 'SUBSCRIPTION',
    status: 'PENDING',
    billingType: 'CREDIT_CARD',
    value,
    description: planDescription,
    dueDate: dueDateObj, // Agora é um Date object válido
    planType: ['STARTER', 'PREMIUM', 'GOLD'].includes(planId) ? planId : null, // Apenas planos tradicionais
    billingCycle: asaasCycle // Salvar cycle que o Asaas entende (MONTHLY ou YEARLY)
  }

  // Add influencer data if applicable
  if (influencer) {
    paymentData.influencerId = influencer.id
    paymentData.referralCodeUsed = referralCode || validatedCoupon?.code
  }

  // Add coupon data if applicable
  if (validatedCoupon) {
    paymentData.couponCodeUsed = validatedCoupon.code
    paymentData.discountApplied = discountApplied

    // Se cupom DISCOUNT é FIRST_CYCLE, salvar preço original e flag de atualização
    if (needsPriceUpdate) {
      paymentData.originalPrice = originalPrice
      paymentData.needsPriceUpdate = true
    }

    // Se cupom HYBRID tem SPLIT com FIRST_CYCLE, marcar para remover split após primeiro pagamento
    // CRITICAL: Só aplica se for HYBRID com influencer E splitDurationType for FIRST_CYCLE
    if (validatedCoupon.type === 'HYBRID' &&
        validatedCoupon.influencer &&
        validatedCoupon.splitDurationType === 'FIRST_CYCLE') {
      paymentData.needsSplitRemoval = true
      console.log('🔄 [CHECKOUT] HYBRID coupon with FIRST_CYCLE split detected - will remove split after first payment')
    }

    // CRITICAL: Se cupom DISCOUNT tem influencer associado, registrar no Payment
    // Isso permite que o webhook saiba que precisa incrementar totalReferrals
    if (validatedCoupon.type === 'DISCOUNT' && validatedCoupon.influencer) {
      paymentData.influencerId = validatedCoupon.influencer.id
      paymentData.referralCodeUsed = validatedCoupon.code
      console.log('🎟️ [CHECKOUT] DISCOUNT coupon with influencer detected - saving influencer reference:', {
        influencerId: validatedCoupon.influencer.id,
        couponCode: validatedCoupon.code
      })
    }
  }

  const payment = await prisma.payment.create({
    data: paymentData
  })

  // CRÍTICO: Salvar plan e billingCycle diretamente na tabela users
  // Isso garante que os dados estejam disponíveis mesmo se o Payment não for encontrado no webhook
  const userUpdateData: Record<string, any> = {
    billingCycle: cycle // Salvar billingCycle original (MONTHLY, YEARLY, QUARTERLY, etc)
  }

  // Salvar planFormat e dados específicos do formato
  if (planFormat === 'TRADITIONAL') {
    // Formato A: salvar plan enum
    userUpdateData.plan = planId
    userUpdateData.planFormat = 'TRADITIONAL'
  } else {
    // Formato B: NÃO salvar plan (não é um enum válido), salvar formato e créditos de ciclo
    userUpdateData.plan = null // Planos membership não usam o enum Plan
    userUpdateData.planFormat = 'MEMBERSHIP'
    userUpdateData.cycleCredits = plan.cycleCredits // Créditos fixos por ciclo
  }

  if (influencer) {
    userUpdateData.referralCodeUsed = referralCode || validatedCoupon?.code
    userUpdateData.referredByInfluencerId = influencer.id
  }

  // CRITICAL: Se cupom DISCOUNT tem influencer mas variável influencer não foi setada,
  // registrar mesmo assim (isso acontece quando cupom DISCOUNT é usado sem referralCode)
  if (validatedCoupon?.type === 'DISCOUNT' && validatedCoupon.influencer && !influencer) {
    userUpdateData.referralCodeUsed = validatedCoupon.code
    userUpdateData.referredByInfluencerId = validatedCoupon.influencer.id
    console.log('🎟️ [CHECKOUT] Saving DISCOUNT coupon influencer reference in users table:', {
      userId: user.id,
      influencerId: validatedCoupon.influencer.id,
      couponCode: validatedCoupon.code
    })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: userUpdateData
  })

  console.log('✅ [CHECKOUT] Dados salvos na tabela users:', {
    userId: user.id,
    planFormat,
    plan: userUpdateData.plan,
    billingCycle: cycle,
    cycleCredits: userUpdateData.cycleCredits
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
