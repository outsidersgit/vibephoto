'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import type React from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreditCard, Smartphone, FileText, Building2, ArrowLeft, Check } from 'lucide-react'
import Link from 'next/link'
import { type Plan } from '@/config/pricing'
import { useToast } from '@/hooks/use-toast'

function ActivatePageContent() {
  const { data: session, update: updateSession } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const planFromUrl = searchParams.get('plan')
  const cycleFromUrl = searchParams.get('cycle') // 'monthly' ou 'annual'

  const { addToast } = useToast()
  const [selectedPlan, setSelectedPlan] = useState(planFromUrl || 'STARTER')
  const [step, setStep] = useState(planFromUrl ? 1 : 0)
  const [loading, setLoading] = useState(false)
  const [loadingCEP, setLoadingCEP] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
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
  const lastFetchedCepRef = useRef<string | null>(null)

  useEffect(() => {
    if (session?.user) {
      setCustomerData(prev => ({
        ...prev,
        name: session.user.name || '',
        email: session.user.email || ''
      }))
    }
  }, [session])

  // Carregar planos do banco de dados
  useEffect(() => {
    async function fetchPlans() {
      try {
        setLoadingPlans(true)
        const response = await fetch('/api/subscription-plans', {
          cache: 'no-store',
          credentials: 'include'
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('❌ [ACTIVATE] Erro ao buscar planos:', response.status, errorData)
          
          // Se for erro de configuração do banco, usar fallback
          if (errorData.code === 'DATABASE_CONFIG_ERROR' || response.status === 500) {
            console.warn('⚠️ [ACTIVATE] Erro na API, usando fallback hardcoded')
            // Importar fallback dinamicamente
            import('@/config/pricing').then(({ PLANS }) => {
              setPlans(PLANS)
              setLoadingPlans(false)
            })
            return
          }
          
          throw new Error(errorData.message || `Erro ${response.status}`)
        }

        const data = await response.json()
        
        if (data.plans && Array.isArray(data.plans) && data.plans.length > 0) {
          console.log('✅ [ACTIVATE] Planos carregados do banco:', data.plans.length)
          setPlans(data.plans)
        } else {
          console.warn('⚠️ [ACTIVATE] Nenhum plano retornado, usando fallback')
          // Usar fallback se não houver planos
          const { PLANS } = await import('@/config/pricing')
          setPlans(PLANS)
        }
      } catch (error: any) {
        console.error('❌ [ACTIVATE] Erro ao buscar planos da API:', error)
        // Em caso de erro, usar fallback
        try {
          const { PLANS } = await import('@/config/pricing')
          console.warn('⚠️ [ACTIVATE] Usando planos fallback devido ao erro')
          setPlans(PLANS)
        } catch (fallbackError) {
          console.error('❌ [ACTIVATE] Erro ao carregar fallback:', fallbackError)
          setError('Erro ao carregar planos. Por favor, recarregue a página.')
        }
      } finally {
        setLoadingPlans(false)
      }
    }

    fetchPlans()
  }, [])

  // Ler ciclo da URL ou usar 'monthly' como padrão
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(
    cycleFromUrl === 'annual' ? 'annual' : 'monthly'
  )

  // Função para formatar CEP com máscara 00000-000
  const formatCEP = (cep: string): string => {
    const numbers = cep.replace(/\D/g, '')
    if (numbers.length <= 5) {
      return numbers
    }
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`
  }

  // Função para buscar endereço por CEP na API ViaCEP
  const fetchAddressByCEP = async (cep: string): Promise<void> => {
    const cleanCEP = cep.replace(/\D/g, '')
    
    // Validar se tem 8 dígitos
    if (cleanCEP.length !== 8) {
      return
    }

    if (lastFetchedCepRef.current === cleanCEP && loadingCEP) {
      return
    }

    if (lastFetchedCepRef.current === cleanCEP) {
      return
    }

    lastFetchedCepRef.current = cleanCEP
    setLoadingCEP(true)
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`)
      const data = await response.json()

      // Verificar se houve erro na API (erro: true ou cep não encontrado)
      if (data.erro || !data.logradouro) {
        addToast({
          type: 'error',
          title: 'CEP não encontrado',
          description: 'O CEP informado não foi encontrado. Verifique e tente novamente.'
        })
        lastFetchedCepRef.current = null
        return
      }

      // Popular campos com os dados retornados
      setCustomerData(prev => ({
        ...prev,
        address: data.logradouro || prev.address,
        province: data.bairro || prev.province,
        city: data.localidade || prev.city,
        state: data.uf ? data.uf.toUpperCase() : prev.state
      }))

      addToast({
        type: 'success',
        title: 'Endereço encontrado',
        description: 'Os dados de endereço foram preenchidos automaticamente.'
      })
    } catch (error) {
      console.error('Erro ao buscar CEP:', error)
      addToast({
        type: 'error',
        title: 'Erro ao buscar CEP',
        description: 'Não foi possível buscar o endereço. Tente novamente mais tarde.'
      })
      lastFetchedCepRef.current = null
    } finally {
      setLoadingCEP(false)
    }
  }

  // Handler para onChange do campo CEP
  const handleCEPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedCEP = formatCEP(e.target.value)
    setCustomerData(prev => ({ ...prev, postalCode: formattedCEP }))
    
    // Se atingiu 8 dígitos, buscar automaticamente
    const cleanCEP = formattedCEP.replace(/\D/g, '')
    if (cleanCEP.length < 8) {
      lastFetchedCepRef.current = null
    }
    if (cleanCEP.length === 8) {
      fetchAddressByCEP(formattedCEP)
    }
  }

  // Handler para onBlur do campo CEP
  const handleCEPBlur = () => {
    const cleanCEP = customerData.postalCode.replace(/\D/g, '')
    if (cleanCEP.length === 8) {
      fetchAddressByCEP(cleanCEP)
    }
  }

  // Usar planos do banco de dados
  const planDetails: Record<string, Plan> = Object.fromEntries(
    plans.map(plan => [plan.id, plan])
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
      if (!customerData.address) missingFields.push('Endereço')
      if (!customerData.addressNumber) missingFields.push('Número do endereço')
      if (!customerData.city) missingFields.push('Cidade')
      if (!customerData.state) missingFields.push('Estado')
      if (!customerData.postalCode) missingFields.push('CEP')

      if (missingFields.length > 0) {
        addToast({
          type: 'error',
          title: 'Campos obrigatórios faltando',
          description: `Por favor, preencha: ${missingFields.join(', ')}`
        })
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

  if (!session || loadingPlans) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (plans.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Nenhum plano disponível no momento.</p>
        </div>
      </div>
    )
  }

  if (!currentPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Plano selecionado não encontrado.</p>
          <Link href="/pricing">
            <Button className="mt-4">Voltar para planos</Button>
          </Link>
        </div>
      </div>
    )
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
                          let displayFeature = feature

                          if (billingCycle === 'annual') {
                            if (feature.includes('créditos/mês')) {
                              const yearlyCredits = (plan.credits || 0) * 12
                              displayFeature = feature.replace(/\d+[.,]?\d*\s*créditos\/mês/, `${yearlyCredits.toLocaleString('pt-BR')} créditos/ano`)
                            }

                            if (/fotos\//i.test(feature) || feature.toLowerCase().includes('fotos por')) {
                              displayFeature = displayFeature.replace(/(\d+[.,]?\d*)\s*fotos\s*(?:\/|por)\s*m[eê]s/gi, (match, value) => {
                                const monthlyPhotos = parseInt(String(value).replace(/\D/g, ''), 10)
                                if (Number.isNaN(monthlyPhotos)) {
                                  return match
                                }
                                const yearlyPhotos = monthlyPhotos * 12
                                return `${yearlyPhotos.toLocaleString('pt-BR')} fotos por ano`
                              })
                            }
                          }

                          return (
                            <div key={index} className="flex items-start gap-2">
                              <Check className="h-4 w-4 mt-0.5 text-purple-500" />
                              <span>{displayFeature}</span>
                            </div>
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
              <p className="text-xs text-slate-300">
                Campos marcados com <span className="text-red-300">*</span> são obrigatórios.
              </p>
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
                    placeholder="Digite apenas números"
                    required
                  />
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

              {/* Endereço (Obrigatório) */}
              <div className="border-t border-slate-600 pt-6">
                <h3 className="text-sm font-semibold text-white mb-4">Endereço *</h3>
                <p className="text-xs text-slate-400 mb-4">Campos obrigatórios para criação do checkout</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">
                      CEP *
                      {loadingCEP && (
                        <span className="ml-2 text-xs text-slate-400">Buscando...</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={customerData.postalCode}
                      onChange={handleCEPChange}
                      onBlur={handleCEPBlur}
                      className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                      placeholder="00000-000"
                      disabled={loadingCEP}
                      maxLength={9}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Logradouro/Rua *</label>
                    <input
                      type="text"
                      value={customerData.address}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Av Paulista, Rua das Flores, etc"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">
                      Número *
                    </label>
                    <input
                      type="text"
                      value={customerData.addressNumber}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, addressNumber: e.target.value }))}
                      className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Ex: 123, S/N"
                      required
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
                    <label className="block text-sm font-medium text-white mb-1">Cidade *</label>
                    <input
                      type="text"
                      value={customerData.city}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Estado *</label>
                    <input
                      type="text"
                      value={customerData.state}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                      className="w-full h-11 px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="SP"
                      maxLength={2}
                      required
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