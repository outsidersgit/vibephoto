'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreditCard, Smartphone, FileText, Building2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { PLANS, calculateAnnualSavings, getPlanById, type Plan } from '@/config/pricing'

function UpgradePageContent() {
  const { data: session, update: updateSession } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const planFromUrl = searchParams.get('plan')
  const cycleFromUrl = searchParams.get('cycle')

  const [selectedPlan, setSelectedPlan] = useState(planFromUrl || 'STARTER')
  const [step, setStep] = useState(planFromUrl ? 1 : 0)
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('CREDIT_CARD')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(
    cycleFromUrl === 'annual' ? 'annual' : 'monthly'
  )
  const [customerData, setCustomerData] = useState({
    name: '',
    email: '',
    cpfCnpj: '',
    phone: '',
    address: {
      postalCode: '',
      addressNumber: '',
      complement: '',
      province: '',
      city: '',
      state: ''
    }
  })

  const [creditCardData, setCreditCardData] = useState({
    holderName: '',
    number: '',
    expiryMonth: '',
    expiryYear: '',
    ccv: '',
    holderInfo: {
      name: '',
      email: '',
      cpfCnpj: '',
      postalCode: '',
      addressNumber: '',
      complement: '',
      province: '',
      city: '',
      state: '',
      phone: ''
    }
  })

  useEffect(() => {
    if (session?.user) {
      setCustomerData(prev => ({
        ...prev,
        name: session.user.name || '',
        email: session.user.email || ''
      }))
    }
  }, [session])

  // Se usuário já tem assinatura e veio da URL com plano/ciclo, mostra confirmação
  useEffect(() => {
    const hasSubscription = !!(session?.user as any)?.subscriptionId
    const hasUrlParams = planFromUrl && cycleFromUrl

    if (hasSubscription && hasUrlParams) {
      setStep(-1) // Step especial para confirmação de troca
    }
  }, [session])

  // Pré-carregar nome do titular do cartão com o nome do cliente
  useEffect(() => {
    if (customerData.name && !creditCardData.holderName) {
      setCreditCardData(prev => ({
        ...prev,
        holderName: customerData.name
      }))
    }
  }, [customerData.name, creditCardData.holderName])

  // Usar configuração centralizada de pricing
  const planDetails: Record<string, Plan> = Object.fromEntries(
    PLANS.map(plan => [plan.id, plan])
  )

  const currentPlan = planDetails[selectedPlan as keyof typeof planDetails]

  const handleCreateCustomer = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/payments/asaas/create-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', response.status, errorText)
        alert(`Erro do servidor (${response.status}): ${errorText}`)
        return
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text()
        console.error('Non-JSON response:', textResponse)
        alert('Resposta inválida do servidor')
        return
      }

      const data = await response.json()

      if (data.success) {
        // Atualizar a sessão para incluir o asaasCustomerId
        await updateSession()
        setStep(2)
      } else {
        alert('Erro ao criar cliente: ' + (data.error || 'Erro desconhecido'))
      }
    } catch (error) {
      console.error('Client error:', error)
      alert('Erro na comunicação com servidor: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSubscription = async () => {
    setLoading(true)
    try {
      // Check if user already has an active subscription
      const existingSubscriptionId = (session?.user as any)?.subscriptionId
      const customerId = (session?.user as any)?.asaasCustomerId

      // If user has existing subscription, update it directly (no forms needed)
      if (existingSubscriptionId) {
        try {
          const updateResponse = await fetch('/api/payments/subscriptions/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscriptionId: existingSubscriptionId,
              newPlan: {
                plan: selectedPlan,
                cycle: billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY'
              }
            })
          })

          const updateData = await updateResponse.json()

          if (updateData.success) {
            alert('✅ Plano atualizado com sucesso!')
            // Force session update
            await fetch('/api/auth/session', { method: 'GET' })
            router.push('/billing')
            return
          } else {
            alert(`❌ Erro ao atualizar plano: ${updateData.error}`)
            setLoading(false)
            return
          }
        } catch (error) {
          console.error('Erro ao atualizar plano:', error)
          alert('❌ Erro ao atualizar plano')
          setLoading(false)
          return
        }
      }

      // No existing subscription, create new one
      if (!customerId) {
        alert('Por favor, complete seu cadastro antes de assinar um plano')
        setStep(1) // Go back to customer creation step
        return
      }

      // Validar dados obrigatórios para cartão de crédito
      if (paymentMethod === 'CREDIT_CARD') {
        const missingFields = []
        if (!creditCardData.holderName) missingFields.push('Nome do titular')
        if (!customerData.email) missingFields.push('Email')
        if (!customerData.cpfCnpj) missingFields.push('CPF/CNPJ')
        if (!customerData.address.postalCode) missingFields.push('CEP')
        if (!customerData.address.addressNumber) missingFields.push('Número do endereço')
        if (!customerData.phone) missingFields.push('Telefone')

        if (missingFields.length > 0) {
          alert(`Campos obrigatórios faltando: ${missingFields.join(', ')}. Por favor, volte ao Step 1 e preencha todos os dados.`)
          setStep(1)
          return
        }
      }

      const subscriptionData = {
        customerId,
        plan: selectedPlan,
        cycle: billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY',
        billingType: paymentMethod,
        ...(paymentMethod === 'CREDIT_CARD' && {
          creditCard: {
            holderName: creditCardData.holderName,
            number: creditCardData.number.replace(/\s/g, ''), // Remove espaços
            expiryMonth: creditCardData.expiryMonth,
            expiryYear: creditCardData.expiryYear,
            ccv: creditCardData.ccv
          },
          creditCardHolderInfo: {
            name: creditCardData.holderName, // Usa o nome editável do campo
            email: customerData.email,
            cpfCnpj: customerData.cpfCnpj.replace(/\D/g, ''), // Somente números
            postalCode: creditCardData.holderInfo.postalCode.replace(/\D/g, ''), // Somente números
            addressNumber: creditCardData.holderInfo.addressNumber,
            addressComplement: creditCardData.holderInfo.complement || null,
            province: creditCardData.holderInfo.province,
            city: creditCardData.holderInfo.city,
            state: creditCardData.holderInfo.state,
            phone: customerData.phone.replace(/\D/g, ''), // Somente números
            mobilePhone: customerData.phone.replace(/\D/g, '') // Mesmo valor que phone
          }
        })
      }

      console.log('📦 Dados da assinatura:', JSON.stringify(subscriptionData, null, 2))

      const response = await fetch('/api/payments/asaas/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriptionData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', response.status, errorText)
        alert(`Erro do servidor (${response.status}): ${errorText}`)
        return
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text()
        console.error('Non-JSON response:', textResponse)
        alert('Resposta inválida do servidor')
        return
      }

      const data = await response.json()
      
      if (data.success) {
        if (data.subscription.paymentLink) {
          // Redirect to payment link for non-credit card payments
          window.location.href = data.subscription.paymentLink
        } else {
          // Payment processed, redirect to success
          router.push('/billing/success')
        }
      } else {
        alert('Erro ao criar assinatura: ' + (data.error || 'Erro desconhecido'))
      }
    } catch (error) {
      console.error('Client error:', error)
      alert('Erro na comunicação com servidor: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/billing?tab=plans">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar para Planos
                </Link>
              </Button>
            </div>
            <Badge variant="secondary">
              {step === 0 ? 'Escolha do Plano' : `Etapa ${step} de 2`}
            </Badge>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Confirmation screen for plan change */}
        {step === -1 && (
          <Card className="mb-8 bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-white text-2xl mb-2">
                Confirmar Troca de Plano
              </CardTitle>
              <CardDescription className="text-slate-300">
                Você está prestes a trocar seu plano. Confirme os detalhes abaixo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-4">
                <p className="text-sm text-blue-200">
                  ℹ️ Sua assinatura será atualizada automaticamente. O novo valor será cobrado no próximo ciclo.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <p className="text-xs text-slate-400 mb-2">Plano Atual</p>
                  <p className="text-xl font-bold text-white">
                    {((session?.user as any)?.plan || 'Free').charAt(0).toUpperCase() + ((session?.user as any)?.plan || 'Free').slice(1).toLowerCase()}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    Ciclo: {(session?.user as any)?.billingCycle === 'YEARLY' ? 'Anual' : 'Mensal'}
                  </p>
                </div>

                <div className="bg-purple-500/20 border border-purple-500 rounded-lg p-4">
                  <p className="text-xs text-purple-300 mb-2">Novo Plano</p>
                  <p className="text-xl font-bold text-white">{currentPlan.name}</p>
                  <p className="text-sm text-slate-300 mt-1">
                    R$ {billingCycle === 'annual' ? currentPlan.annualPrice : currentPlan.monthlyPrice}
                    <span className="text-xs">/{billingCycle === 'annual' ? 'ano' : 'mês'}</span>
                  </p>
                  <p className="text-sm text-purple-200 mt-1">
                    Ciclo: {billingCycle === 'annual' ? 'Anual' : 'Mensal'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-4">
                <p className="text-sm font-semibold text-white mb-3">Recursos do Novo Plano:</p>
                <ul className="space-y-2">
                  {currentPlan.features.slice(0, 4).map((feature, idx) => (
                    <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                      <span className="text-green-400">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push('/billing')}
                  className="flex-1 bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateSubscription}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-br from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white shadow-lg shadow-[#667EEA]/25 transition-all duration-200"
                >
                  {loading ? 'Processando...' : 'Confirmar Troca de Plano'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plan Summary - Only show if plan is selected */}
        {step > 0 && (
          <Card className="mb-8 bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30 shadow-2xl">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-3 text-white text-lg mb-2">
                    Upgrading to {currentPlan.name}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep(0)}
                      className="text-xs bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                    >
                      Alterar Plano
                    </Button>
                  </CardTitle>
                  <div className="flex items-center gap-4">
                    <div className="text-white font-semibold text-xl">
                      R$ {billingCycle === 'annual' ? currentPlan.annualPrice : currentPlan.monthlyPrice}
                      <span className="text-sm text-slate-300 font-normal">
                        {billingCycle === 'annual' ? '/ano' : '/mês'}
                      </span>
                    </div>
                    <Badge className="bg-purple-600 text-white">
                      {billingCycle === 'annual' ? 'Cobrança Anual' : 'Cobrança Mensal'}
                    </Badge>
                  </div>
                  <p className="text-slate-300 text-sm mt-2">
                    {currentPlan.features.slice(0, 2).join(' • ')}
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>
        )}

        {step === 0 && (
          <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-white text-xl">
                {(session?.user as any)?.subscriptionId ? 'Trocar de Plano' : 'Escolha Seu Novo Plano'}
              </CardTitle>
              {(session?.user as any)?.plan && (
                <>
                  <CardDescription className="text-slate-300 text-sm">
                    Plano atual: <Badge variant="outline" className="bg-slate-700 text-white border-slate-600">{(session.user as any).plan}</Badge>
                  </CardDescription>
                  {(session?.user as any)?.subscriptionId && (
                    <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-3 mt-2">
                      <p className="text-xs text-blue-200">
                        ℹ️ Você já possui uma assinatura ativa. Ao escolher um novo plano, sua assinatura atual será atualizada automaticamente.
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardHeader>
            <CardContent>
              {/* Billing Cycle Toggle */}
              <div className="flex items-center justify-center mb-8">
                <div className="bg-slate-700/50 p-1 rounded-lg flex border border-slate-600">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                      billingCycle === 'monthly'
                        ? 'bg-gradient-to-r from-[#667EEA] to-[#764BA2] text-white shadow-md'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setBillingCycle('annual')}
                    className={`px-8 py-2 rounded-md text-sm font-medium transition-all relative ${
                      billingCycle === 'annual'
                        ? 'bg-gradient-to-r from-[#667EEA] to-[#764BA2] text-white shadow-md'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Anual
                    <span className="absolute -top-3 -right-3 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
                      4 meses grátis
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {Object.values(planDetails).map((plan) => (
                  <Card 
                    key={plan.id}
                    className={`cursor-pointer transition-colors border-2 ${
                      selectedPlan === plan.id 
                        ? `border-${plan.color}-500 bg-${plan.color}-50 scale-105` 
                        : `border-gray-200 hover:border-${plan.color}-300`
                    } ${plan.popular ? 'relative' : ''}`}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    {plan.popular && (
                      <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-600">
                        Mais Popular
                      </Badge>
                    )}
                    
                    <CardHeader className="text-center pb-4">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <div className="text-center">
                        {billingCycle === 'annual' ? (
                          <>
                            <div className="text-2xl font-bold">
                              R$ {plan.annualPrice}
                              <span className="text-sm font-normal text-gray-500">/ano</span>
                            </div>
                            <div className="text-sm text-green-600 font-medium">
                              R$ {plan.monthlyEquivalent}/mês
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              💸 Economize {calculateAnnualSavings(plan.monthlyPrice, plan.annualPrice).monthsEquivalent} meses!
                            </div>
                          </>
                        ) : (
                          <div className="text-2xl font-bold">
                            R$ {plan.monthlyPrice}
                            <span className="text-sm font-normal text-gray-500">/mês</span>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-sm text-gray-600 mb-3">{plan.description}</div>
                      <div className="space-y-1 text-sm">
                        {plan.features.map((feature, index) => {
                          // Adjust credits display based on billing cycle
                          let displayFeature = feature
                          if (billingCycle === 'annual' && feature.includes('créditos/mês')) {
                            const yearlyCredits = plan.credits * 12
                            displayFeature = feature.replace(/\d+\.?\d*\s*créditos\/mês/, `${yearlyCredits.toLocaleString('pt-BR')} créditos/ano`)
                          }
                          return (
                          <div key={index}>✓ {displayFeature}</div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button
                onClick={() => {
                  // Se já tem assinatura, atualiza direto
                  if ((session?.user as any)?.subscriptionId) {
                    handleCreateSubscription()
                  } else {
                    // Se não tem, vai para formulário
                    setStep(1)
                  }
                }}
                disabled={loading}
                className="w-full mt-6 bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5A6FDB] hover:to-[#6B4493] text-white"
                size="lg"
              >
                {loading ? 'Processando...' : (
                  (session?.user as any)?.subscriptionId
                    ? `Trocar para ${planDetails[selectedPlan].name}`
                    : `Continuar com ${planDetails[selectedPlan].name} - R$ ${
                        billingCycle === 'annual'
                          ? planDetails[selectedPlan].annualPrice
                          : planDetails[selectedPlan].monthlyPrice
                      }${billingCycle === 'annual' ? '/ano' : '/mês'}`
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-white text-lg">Informações do Cliente</CardTitle>
              <CardDescription className="text-slate-300">
                Precisamos de algumas informações básicas para processar seu pagamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={customerData.name}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={customerData.email}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    CPF/CNPJ
                  </label>
                  <input
                    type="text"
                    value={customerData.cpfCnpj}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, cpfCnpj: e.target.value.replace(/\D/g, '') }))}
                    className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="11144477735 (apenas números)"
                    required
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Para testes, use: 11144477735
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={customerData.phone}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="(11) 99999-9999"
                    required
                  />
                </div>
              </div>

              <Button
                onClick={handleCreateCustomer}
                disabled={loading}
                className="w-full mt-6 bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5A6FDB] hover:to-[#6B4493] text-white"
              >
                {loading ? 'Processando...' : 'Continuar para Pagamento'}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <div className="space-y-6">
            {/* Info: Only Credit Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-900 font-medium">Assinaturas: Apenas Cartão de Crédito</p>
                <p className="text-xs text-blue-700 mt-1">
                  Para planos de assinatura, aceitamos apenas pagamento via cartão de crédito para garantir a renovação automática.
                </p>
              </div>
            </div>

            {/* Credit Card Form */}
            {(
              <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Informações do Cartão</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Card Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-white mb-1">
                        Nome do Titular
                      </label>
                      <input
                        type="text"
                        value={creditCardData.holderName}
                        onChange={(e) => setCreditCardData(prev => ({ ...prev, holderName: e.target.value }))}
                        className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-white mb-1">
                        Número do Cartão
                      </label>
                      <input
                        type="text"
                        value={creditCardData.number}
                        onChange={(e) => setCreditCardData(prev => ({ ...prev, number: e.target.value }))}
                        className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="1234 5678 9012 3456"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-1">
                        Mês de Validade
                      </label>
                      <input
                        type="text"
                        value={creditCardData.expiryMonth}
                        onChange={(e) => setCreditCardData(prev => ({ ...prev, expiryMonth: e.target.value }))}
                        className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="MM"
                        maxLength={2}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-1">
                        Ano de Validade
                      </label>
                      <input
                        type="text"
                        value={creditCardData.expiryYear}
                        onChange={(e) => setCreditCardData(prev => ({ ...prev, expiryYear: e.target.value }))}
                        className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="AAAA"
                        maxLength={4}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-1">
                        CVV
                      </label>
                      <input
                        type="text"
                        value={creditCardData.ccv}
                        onChange={(e) => setCreditCardData(prev => ({ ...prev, ccv: e.target.value }))}
                        className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="123"
                        maxLength={4}
                        required
                      />
                    </div>
                  </div>

                  {/* Cardholder Address */}
                  <div className="border-t border-slate-600 pt-6">
                    <h3 className="text-sm font-semibold text-white mb-2">Endereço do Titular do Cartão</h3>
                    <p className="text-xs text-slate-300 mb-4">
                      Informe o endereço de cobrança cadastrado no cartão de crédito
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white mb-1">CEP</label>
                        <input
                          type="text"
                          value={creditCardData.holderInfo.postalCode}
                          onChange={(e) => setCreditCardData(prev => ({
                            ...prev,
                            holderInfo: { ...prev.holderInfo, postalCode: e.target.value }
                          }))}
                          className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="00000-000"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white mb-1">Número</label>
                        <input
                          type="text"
                          value={creditCardData.holderInfo.addressNumber}
                          onChange={(e) => setCreditCardData(prev => ({
                            ...prev,
                            holderInfo: { ...prev.holderInfo, addressNumber: e.target.value }
                          }))}
                          className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white mb-1">Complemento</label>
                        <input
                          type="text"
                          value={creditCardData.holderInfo.complement}
                          onChange={(e) => setCreditCardData(prev => ({
                            ...prev,
                            holderInfo: { ...prev.holderInfo, complement: e.target.value }
                          }))}
                          className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Apto, Bloco, etc."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white mb-1">Bairro</label>
                        <input
                          type="text"
                          value={creditCardData.holderInfo.province}
                          onChange={(e) => setCreditCardData(prev => ({
                            ...prev,
                            holderInfo: { ...prev.holderInfo, province: e.target.value }
                          }))}
                          className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white mb-1">Cidade</label>
                        <input
                          type="text"
                          value={creditCardData.holderInfo.city}
                          onChange={(e) => setCreditCardData(prev => ({
                            ...prev,
                            holderInfo: { ...prev.holderInfo, city: e.target.value }
                          }))}
                          className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white mb-1">Estado</label>
                        <input
                          type="text"
                          value={creditCardData.holderInfo.state}
                          onChange={(e) => setCreditCardData(prev => ({
                            ...prev,
                            holderInfo: { ...prev.holderInfo, state: e.target.value }
                          }))}
                          className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="SP"
                          maxLength={2}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button
              onClick={handleCreateSubscription}
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5A6FDB] hover:to-[#6B4493] text-white"
            >
              {loading ? 'Processando...' : `Finalizar Pagamento - R$ ${billingCycle === 'annual' ? currentPlan.annualPrice : currentPlan.monthlyPrice}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <UpgradePageContent />
    </Suspense>
  )
}