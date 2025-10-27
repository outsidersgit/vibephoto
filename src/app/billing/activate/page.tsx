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

function ActivatePageContent() {
  const { data: session, update: updateSession } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const planFromUrl = searchParams.get('plan')
  const cycleFromUrl = searchParams.get('cycle') // 'monthly' ou 'annual'

  const [selectedPlan, setSelectedPlan] = useState(planFromUrl || 'STARTER')
  const [step, setStep] = useState(planFromUrl ? 1 : 0)
  const [loading, setLoading] = useState(false)
  const [customerData, setCustomerData] = useState({
    name: '',
    email: '',
    cpfCnpj: '',
    phone: '',
    address: '',
    postalCode: '',
    addressNumber: '',
    complement: '',
    province: '',
    city: '',
    state: ''
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

  // Ler ciclo da URL ou usar 'monthly' como padrão
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(
    cycleFromUrl === 'annual' ? 'annual' : 'monthly'
  )

  // Usar configuração centralizada de pricing
  const planDetails: Record<string, Plan> = Object.fromEntries(
    PLANS.map(plan => [plan.id, plan])
  )

  const currentPlan = planDetails[selectedPlan as keyof typeof planDetails]

  const calculateSavings = (monthlyPrice: number, annualPrice: number) => {
    const savings = (monthlyPrice * 12) - annualPrice
    const monthsEquivalent = Math.round(savings / monthlyPrice)
    return { savings, monthsEquivalent }
  }

  const handleCreateCheckout = async () => {
    setLoading(true)
    try {
      // Validar dados obrigatórios
      const missingFields = []
      if (!customerData.name) missingFields.push('Nome completo')
      if (!customerData.email) missingFields.push('Email')
      if (!customerData.cpfCnpj) missingFields.push('CPF/CNPJ')
      if (!customerData.phone) missingFields.push('Telefone')

      if (missingFields.length > 0) {
        alert(`Campos obrigatórios faltando: ${missingFields.join(', ')}`)
        return
      }

      // Atualizar dados do usuário no banco antes de criar o checkout
      const updateResponse = await fetch('/api/profile/personal-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customerData.name,
          cpfCnpj: customerData.cpfCnpj,
          phone: customerData.phone,
          mobilePhone: customerData.phone,
          address: customerData.address,
          postalCode: customerData.postalCode,
          addressNumber: customerData.addressNumber,
          complement: customerData.complement,
          province: customerData.province,
          city: customerData.city,
          state: customerData.state
        })
      })

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({}))
        console.error('Failed to update user data:', errorData)
        alert('Erro ao atualizar dados: ' + (errorData.error || 'Tente novamente'))
        return
      }

      // Criar checkout transparente
      const response = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan,
          cycle: billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY'
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', response.status, errorText)
        alert(`Erro ao criar checkout (${response.status}): ${errorText}`)
        return
      }

      const data = await response.json()

      if (data.success) {
        // Redirecionar direto para o checkout do Asaas
        window.location.href = data.checkoutUrl
      } else {
        alert('Erro ao criar checkout: ' + (data.error || 'Erro desconhecido'))
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
                <Link href="/billing">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar para Cobrança
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
        {/* Plan Summary - Only show if plan is selected */}
        {step > 0 && (
          <Card className="mb-8 bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30 shadow-2xl">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-3 text-white text-lg mb-2">
                    Ativando {currentPlan.name}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/pricing')}
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
              <CardTitle className="text-white text-xl">Escolha Seu Novo Plano</CardTitle>
              <CardDescription className="text-slate-300">
                {session?.user?.plan && (
                  <span className="text-sm">
                    Plano atual: {session.user.plan}
                  </span>
                )}
              </CardDescription>
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
                              💸 Economize {calculateSavings(plan.monthlyPrice, plan.annualPrice).monthsEquivalent} meses!
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
                onClick={() => setStep(1)}
                className="w-full mt-6 bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5A6FDB] hover:to-[#6B4493] text-white"
                size="lg"
              >
                Continuar com {planDetails[selectedPlan].name} - R$ {
                  billingCycle === 'annual'
                    ? planDetails[selectedPlan].annualPrice
                    : planDetails[selectedPlan].monthlyPrice
                }{billingCycle === 'annual' ? '/ano' : '/mês'}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-white text-lg">Informações Pessoais</CardTitle>
              <CardDescription className="text-slate-300">
                Preencha seus dados para criar o checkout seguro
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Dados Básicos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    Nome Completo *
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
                    Email *
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
                    CPF/CNPJ *
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
                    Telefone *
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

              {/* Endereço (Opcional) */}
              <div className="border-t border-slate-600 pt-6">
                <h3 className="text-sm font-semibold text-white mb-4">Endereço (Opcional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">CEP</label>
                    <input
                      type="text"
                      value={customerData.postalCode}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, postalCode: e.target.value }))}
                      className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="00000-000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Logradouro/Rua</label>
                    <input
                      type="text"
                      value={customerData.address}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Av Paulista, Rua das Flores, etc"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Número</label>
                    <input
                      type="text"
                      value={customerData.addressNumber}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, addressNumber: e.target.value }))}
                      className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Complemento</label>
                    <input
                      type="text"
                      value={customerData.complement}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, complement: e.target.value }))}
                      className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Apto, Bloco, etc."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Bairro</label>
                    <input
                      type="text"
                      value={customerData.province}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, province: e.target.value }))}
                      className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Cidade</label>
                    <input
                      type="text"
                      value={customerData.city}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Estado</label>
                    <input
                      type="text"
                      value={customerData.state}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, state: e.target.value }))}
                      className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="SP"
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCreateCheckout}
                disabled={loading}
                className="w-full mt-6 bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5A6FDB] hover:to-[#6B4493] text-white"
                size="lg"
              >
                {loading ? 'Redirecionando para checkout seguro...' : 'Ir para Pagamento Seguro →'}
              </Button>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}

export default function ActivatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <ActivatePageContent />
    </Suspense>
  )
}