'use client'

import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Check,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CreditCard
} from 'lucide-react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { PLANS, type Plan } from '@/config/pricing'
import { CheckoutModal } from '@/components/checkout/checkout-modal'
import { PaymentMethodModal } from '@/components/credits/payment-method-modal'
import { UpdateCardModal } from '@/components/payments/update-card-modal'
import { ProtectedPageScript } from '@/components/auth/protected-page-script'
import { useAuthGuard } from '@/hooks/useAuthGuard'

interface CreditPackage {
  id: string
  name: string
  description?: string
  creditAmount: number
  bonusCredits: number
  price: number
  validityMonths: number
  isActive: boolean
  sortOrder: number
}

function BillingPageContent() {
  // CRITICAL: Todos os hooks DEVEM ser chamados ANTES de qualquer early return
  // Violar esta regra causa erro React #300/#310
  const { data: session, status, update: updateSession } = useSession()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams?.get('tab')
  
  // CRITICAL: Verificar autenticação ANTES de renderizar conteúdo
  const isAuthorized = useAuthGuard()
  
  const [activeTab, setActiveTab] = useState('overview')
  const [plans, setPlans] = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [plansError, setPlansError] = useState<string | null>(null)
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([])
  const [loadingCreditPackages, setLoadingCreditPackages] = useState(true)
  const [planFormat, setPlanFormat] = useState<'TRADITIONAL' | 'MEMBERSHIP'>('TRADITIONAL')

  // Buscar planos do banco de dados (com fallback para planos hardcoded)
  useEffect(() => {
    async function fetchPlans() {
      try {
        setPlansError(null)
        const response = await fetch('/api/subscription-plans')
        if (response.ok) {
          const data = await response.json()
          const fetchedPlans = data.plans || []
          const format = data.format || 'TRADITIONAL'

          // Se a API retornou planos, usar eles
          if (fetchedPlans.length > 0) {
            setPlans(fetchedPlans)
            setPlanFormat(format)
          } else {
            // Se não retornou planos, usar fallback hardcoded
            console.warn('⚠️ [BILLING] Nenhum plano retornado da API, usando fallback hardcoded')
            setPlans(PLANS)
          }
        } else {
          // Se a API retornou erro, usar fallback hardcoded
          console.warn('⚠️ [BILLING] Erro na API, usando fallback hardcoded')
          setPlans(PLANS)

          const errorData = await response.json().catch(() => ({}))
          console.error('Erro ao buscar planos da API:', response.status, errorData)
        }
      } catch (error) {
        // Se houver erro de conexão, usar fallback hardcoded
        console.error('❌ [BILLING] Erro ao conectar com API, usando fallback hardcoded:', error)
        setPlans(PLANS)
      } finally {
        setLoadingPlans(false)
      }
    }

    fetchPlans()
  }, [])

  // Buscar pacotes de créditos da API
  useEffect(() => {
    async function fetchCreditPackages() {
      try {
        const response = await fetch('/api/credit-packages')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.packages) {
            setCreditPackages(data.packages)
          }
        }
      } catch (error) {
        console.error('❌ [BILLING] Erro ao buscar pacotes de créditos:', error)
      } finally {
        setLoadingCreditPackages(false)
      }
    }
    
    fetchCreditPackages()
  }, [])

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showSubscriptionDetails, setShowSubscriptionDetails] = useState(false)
  const [showUpdateCardModal, setShowUpdateCardModal] = useState(false)
  const [cancellingSubscription, setCancellingSubscription] = useState(false)

  // Estados para compra de créditos
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD' | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [checkoutUrl, setCheckoutUrl] = useState<string>('')
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)

  // Estados para seleção de planos
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  // Set tab from URL (redirect 'cards' to 'overview' since cards tab was removed)
  useEffect(() => {
    if (tabFromUrl === 'cards') {
      setActiveTab('overview')
    } else if (tabFromUrl === 'plans') {
      setActiveTab('plans')
    } else if (tabFromUrl === 'credits') {
      setActiveTab('credits')
    }
  }, [tabFromUrl])

  // Pré-selecionar pacote popular quando entrar na aba credits
  useEffect(() => {
    if (activeTab === 'credits' && !selectedPackageId && creditPackages.length > 0) {
      const popularPackage = creditPackages.find(pkg => pkg.sortOrder === 1 || pkg.sortOrder === 2) || creditPackages[0]
      if (popularPackage) {
        setSelectedPackageId(popularPackage.id)
      }
    }
  }, [activeTab, selectedPackageId, creditPackages])

  // Pré-selecionar plano popular quando entrar na aba plans
  useEffect(() => {
    if (activeTab === 'plans' && !selectedPlanId) {
      const popularPlan = plans.find(p => p.popular)
      if (popularPlan) {
        setSelectedPlanId(popularPlan.id)
      }
    }
  }, [activeTab, selectedPlanId])

  // Mock subscription data
  // Calculate next renewal date based on billing cycle
  const calculateNextRenewal = () => {
    const billingCycle = (session?.user as any)?.billingCycle
    const now = new Date()

    if (billingCycle === 'YEARLY') {
      // Add 12 months for annual plans
      return new Date(now.setFullYear(now.getFullYear() + 1))
    } else {
      // Add 1 month for monthly plans (default)
      return new Date(now.setMonth(now.getMonth() + 1))
    }
  }

  const subscription = {
    subscriptionStatus: 'ACTIVE',
    subscriptionEndsAt: calculateNextRenewal()
  }
  
  // CRITICAL: AGORA sim podemos fazer early returns após TODOS os hooks
  // Durante loading, mostrar loading state (não bloquear)
  // A página server-side já garantiu que há sessão válida
  if (status === 'loading' || isAuthorized === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }
  
  // CRITICAL: Se não autenticado após loading, aguardar (página server-side já verificou)
  if (status === 'unauthenticated' || !session?.user || isAuthorized === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando autenticação...</p>
        </div>
      </div>
    )
  }

  // Buscar plano atual - se não tiver, mostrar "Sem plano"
  const userPlan = (session.user as any)?.plan
  const currentPlan = userPlan ? plans.find(plan => plan.id === userPlan) : null

  const handleSelectPackage = (packageId: string) => {
    setSelectedPackageId(packageId)
  }

  const handleBuyPackage = (packageId: string) => {
    setSelectedPackageId(packageId)
    setPaymentMethod(null)
    setPaymentError(null)
    setShowPaymentModal(true)
  }

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId)
  }

  const handlePurchase = async (method: 'PIX' | 'CREDIT_CARD') => {
    if (!selectedPackageId) return

    setPurchasing(selectedPackageId)
    setPaymentMethod(method)
    setPaymentError(null)

    try {
      const response = await fetch('/api/checkout/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: selectedPackageId,
          billingType: method
        })
      })

      const data = await response.json()

      if (data.success && data.checkoutUrl) {
        setPaymentError(null)
        setShowPaymentModal(false)
        setCheckoutUrl(data.checkoutUrl)
        setShowCheckoutModal(true)
      } else {
        setPaymentError(data.error || 'Erro ao criar checkout')
        setPurchasing(null)
      }
    } catch (error) {
      console.error('Erro ao processar compra:', error)
      setPaymentError('Erro ao processar compra')
      setPurchasing(null)
    } finally {
      setPaymentMethod(null)
    }
  }

  const handleCheckoutSuccess = async () => {
    setShowCheckoutModal(false)
    setPurchasing(null)
    setPaymentMethod(null)
    setPaymentError(null)
    setCheckoutUrl('')
    // Auto-update session after billing mutations
    await updateSession()
    window.location.reload()
  }

  const handleCheckoutClose = () => {
    setShowCheckoutModal(false)
    setPurchasing(null)
    setPaymentMethod(null)
    setPaymentError(null)
    setCheckoutUrl('')
  }

  const selectedPackage = creditPackages.find(pkg => pkg.id === selectedPackageId)

  const handleRefreshSession = async () => {
    try {
      await updateSession()
      alert('✅ Sessão atualizada! Recarregando página...')
      window.location.reload()
    } catch (error) {
      console.error('Erro ao atualizar sessão:', error)
      alert('❌ Erro ao atualizar sessão')
    }
  }

  const handleCancelSubscription = async () => {
    // First check database directly
    const checkResponse = await fetch('/api/debug/user-subscription')
    const checkData = await checkResponse.json()

    console.log('Debug - Subscription check:', checkData)

    const subscriptionId = checkData.database?.subscriptionId || (session?.user as any)?.subscriptionId

    if (!subscriptionId) {
      alert('❌ Nenhuma assinatura ativa encontrada no banco de dados')
      return
    }

    setCancellingSubscription(true)

    try {
      const response = await fetch('/api/payments/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: subscriptionId,
          reason: 'Cancelamento solicitado pelo usuário'
        })
      })

      const data = await response.json()

      if (data.success) {
        alert('✅ Assinatura cancelada com sucesso. Você continuará tendo acesso até o final do período atual.')
        setShowCancelModal(false)
        // Auto-update session after billing mutations
        await updateSession()
        window.location.reload()
      } else {
        alert(`❌ Erro ao cancelar assinatura: ${data.error}`)
      }
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error)
      alert('❌ Erro ao cancelar assinatura')
    } finally {
      setCancellingSubscription(false)
    }
  }

  const handleUpdateCardSuccess = async () => {
    alert('✅ Método de pagamento atualizado com sucesso!')
    setShowUpdateCardModal(false)
    // Auto-update session after billing mutations
    await updateSession()
    window.location.reload()
  }

  const handleDeleteAccount = () => {
    // Lógica de exclusão de conta
    console.log('Excluindo conta...')
  }

  return (
    <>
      <ProtectedPageScript />
      <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
        {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Minha Assinatura
            </h1>
            {/* Botão Atualizar Método de Pagamento - Mobile optimized */}
            {session?.user?.subscriptionId && (
              <div className="flex justify-end sm:justify-start">
                <Button
                  onClick={() => setShowUpdateCardModal(true)}
                  className="w-auto bg-gradient-to-br from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white shadow-lg shadow-[#667EEA]/25 transition-all duration-200 text-xs sm:text-base px-3 sm:px-4 py-1.5 sm:py-2 h-auto"
                >
                  Atualizar Método de Pagamento
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ALERTA CRÍTICO: Pagamento em Atraso (OVERDUE) */}
        {searchParams?.get('overdue') === 'true' && (
          <Alert variant="destructive" className="mb-6 border-red-600 bg-red-50">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="text-lg font-bold">Pagamento em Atraso</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-4">
                Sua assinatura <strong>{currentPlan?.name || 'atual'}</strong> está com pagamento pendente.
                Atualize seu pagamento para reativar o acesso imediatamente.
              </p>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => setShowUpdateCardModal(true)}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Atualizar Cartão de Crédito
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* ALERTA: Assinatura Expirada */}
        {searchParams?.get('expired') === 'true' && (
          <Alert className="mb-6 border-orange-600 bg-orange-50">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <AlertTitle className="text-lg font-bold text-orange-900">Assinatura Expirada</AlertTitle>
            <AlertDescription className="mt-2 text-orange-800">
              <p className="mb-4">
                Sua assinatura expirou. Renove agora para continuar aproveitando todos os benefícios.
              </p>
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => window.location.href = '/billing?tab=plans'}
              >
                Renovar Assinatura
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* ALERTA: Assinatura Cancelada */}
        {searchParams?.get('cancelled') === 'true' && (
          <Alert className="mb-6 border-gray-600 bg-gray-50">
            <AlertCircle className="h-5 w-5 text-gray-600" />
            <AlertTitle className="text-lg font-bold text-gray-900">Assinatura Cancelada</AlertTitle>
            <AlertDescription className="mt-2 text-gray-800">
              <p className="mb-4">
                Sua assinatura foi cancelada. Você pode reativar a qualquer momento escolhendo um plano.
              </p>
              <Button
                className="bg-gray-800 hover:bg-gray-900 text-white"
                onClick={() => window.location.href = '/billing?tab=plans'}
              >
                Escolher Plano
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Current Subscription */}
            <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30 shadow-2xl">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Plano</h3>
                    <p className="text-xl font-bold text-white">{currentPlan?.name || 'Sem plano'}</p>
                  </div>

                  {/* Mobile: Stack buttons vertically, Desktop: Horizontal */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 sm:px-3 text-xs text-slate-300 border-slate-500/30 hover:bg-slate-700/50 bg-transparent"
                        onClick={() => setActiveTab('plans')}
                      >
                        Trocar de plano
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 sm:px-3 text-xs text-slate-300 border-slate-500/30 hover:bg-slate-700/50 bg-transparent"
                        onClick={() => setActiveTab('credits')}
                      >
                        Comprar créditos
                      </Button>

                      {/* Mobile: Cancelar assinatura ao lado de Comprar créditos */}
                      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 sm:px-3 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-400/5 border border-red-400/20 hover:border-red-400/40 rounded-lg sm:ml-2 sm:w-auto"
                          >
                            Cancelar assinatura
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Cancelar Assinatura</DialogTitle>
                            <DialogDescription>
                              Tem certeza que deseja cancelar sua assinatura? Você continuará tendo acesso até o final do período atual.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                            <Button
                              variant="outline"
                              onClick={() => setShowCancelModal(false)}
                              disabled={cancellingSubscription}
                              className="w-full sm:w-auto"
                            >
                              Manter Assinatura
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={handleCancelSubscription}
                              disabled={cancellingSubscription}
                              className="w-full sm:w-auto"
                            >
                              {cancellingSubscription ? 'Cancelando...' : 'Confirmar Cancelamento'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSubscriptionDetails(!showSubscriptionDetails)}
                      className="p-1 text-white hover:bg-slate-700 sm:ml-1 w-8 h-8 sm:w-auto sm:h-auto"
                    >
                      {showSubscriptionDetails ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {showSubscriptionDetails && (
                  <div className="mt-4 pt-4 border-t border-slate-600/30">
                    <div className="space-y-2 text-sm text-slate-300">
                      <div className="flex items-start">
                        <span className="text-white mr-2">•</span>
                        <span>{currentPlan?.credits ?? 0} créditos mensais</span>
                      </div>
                      <div className="flex items-start">
                        <span className="text-white mr-2">•</span>
                        <span>{currentPlan?.models || 1} modelo{(currentPlan?.models || 1) > 1 ? 's' : ''} de IA</span>
                      </div>
                      <div className="flex items-start">
                        <span className="text-white mr-2">•</span>
                        <span>Ciclo: {(session.user as any)?.billingCycle === 'YEARLY' ? 'Anual' : 'Mensal'}</span>
                      </div>
                      <div className="flex items-start">
                        <span className="text-white mr-2">•</span>
                        <span>Próxima renovação: {subscription.subscriptionEndsAt.toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>

          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-6">
            {/* Back Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('overview')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            {/* Billing Cycle Toggle - Only show for TRADITIONAL format */}
            {planFormat === 'TRADITIONAL' && (
              <div className="flex justify-center mb-8">
                <div className="bg-gray-50 p-0.5 rounded-lg border border-gray-200 flex w-full max-w-xs">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      billingCycle === 'monthly'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setBillingCycle('annual')}
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all relative ${
                      billingCycle === 'annual'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
                  >
                    Anual
                    {billingCycle === 'annual' && (
                      <span className="absolute -top-2.5 -right-2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold shadow-sm whitespace-nowrap">
                        4 meses grátis
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loadingPlans && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
                  <p className="text-gray-600">Carregando planos...</p>
                </div>
              </div>
            )}

            {/* Error State - Só mostrar se realmente houver erro E não estiver usando fallback */}
            {!loadingPlans && plansError && plans.length === 0 && (
              <Alert variant="destructive" className="max-w-2xl mx-auto">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle>Erro ao carregar planos</AlertTitle>
                <AlertDescription>{plansError}</AlertDescription>
              </Alert>
            )}

            {/* Plans Grid - Mostrar planos se houver (do banco ou fallback) */}
            {!loadingPlans && plans.length > 0 && (
            <div className={`grid gap-8 mx-auto mb-8 ${plans.length === 4 ? 'md:grid-cols-4 max-w-7xl' : 'md:grid-cols-3 max-w-6xl'}`} style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
              {plans.map((plan) => {
                const userPlan = (session.user as any)?.plan || 'STARTER'
                const userBillingCycle = (session.user as any)?.billingCycle || 'MONTHLY'

                // Bloquear apenas se for o MESMO plano E MESMO ciclo
                const currentCycle = billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY'
                const isCurrentPlan = userPlan === plan.id && userBillingCycle === currentCycle

                const isSelected = selectedPlanId === plan.id
                const savings = plan.monthlyPrice * 12 - plan.annualPrice

                return (
                  <Card
                    key={plan.id}
                    onClick={() => !isCurrentPlan && handleSelectPlan(plan.id)}
                    className={`relative transition-all hover:shadow-lg border-gray-300 bg-gray-200 ${
                      isSelected ? 'ring-2 ring-gray-900 shadow-md' : ''
                    } ${!isCurrentPlan ? 'cursor-pointer' : ''}`}
                  >
                    {plan.popular && (
                      <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                        Popular
                      </Badge>
                    )}

                    <CardHeader className="text-left pb-6">
                      <CardTitle className="text-3xl font-bold text-gray-900 mb-6" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>{plan.name}</CardTitle>
                      <div className="mb-6">
                        {billingCycle === 'annual' ? (
                          <>
                            <div className="text-2xl font-bold text-gray-900 mb-1" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                              R$ {plan.annualPrice}
                              <span className="text-base font-normal text-gray-500">/ano</span>
                            </div>
                            <div className="text-sm text-gray-600 font-medium">
                              R$ {plan.monthlyEquivalent}/mês
                            </div>
                          </>
                        ) : (
                          <div className="text-2xl font-bold text-gray-900 mb-1" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                            R$ {plan.monthlyPrice}
                            <span className="text-base font-normal text-gray-500">/mês</span>
                          </div>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent>
                      <ul className="space-y-3 mb-8">
                        {plan.features.map((feature, index) => {
                          // Adjust credits display based on billing cycle
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
                          <li key={index} className="flex items-center text-sm">
                            <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                              <Check className="w-3 h-3 text-gray-600" />
                            </div>
                            <span className="text-gray-700 flex items-center" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                              {displayFeature}
                              {feature === '1 modelo de IA' && (
                                <div className="relative ml-2 group">
                                  <button className="w-3 h-3 bg-gray-600 text-white rounded-full flex items-center justify-center text-xs hover:bg-gray-700 transition-colors">
                                    !
                                  </button>
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-10">
                                    <div className="text-center">
                                      Você pode criar modelos adicionais ao custo de 500 créditos cada.
                                    </div>
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                  </div>
                                </div>
                              )}
                            </span>
                          </li>
                          )
                        })}
                      </ul>

                      {isCurrentPlan ? (
                        <Button
                          disabled
                          className="w-full font-medium py-3 h-auto transition-all bg-gray-400 text-gray-600"
                          style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
                        >
                          Plano Atual
                        </Button>
                      ) : (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                          className={`w-full font-medium py-3 h-auto transition-all ${
                            isSelected
                              ? 'bg-gray-900 hover:bg-gray-800 text-white'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                          }`}
                          style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
                          asChild
                        >
                          <Link href={`/billing/upgrade?plan=${plan.id}&cycle=${billingCycle}`}>
                            Escolher Plano
                          </Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            )}

            {/* Subscription Cancellation Notice */}
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center text-center">
                <Check className="w-4 h-4 text-gray-600 mr-2" />
                <span className="text-sm font-medium text-gray-600" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                  Cancele a qualquer momento
                </span>
              </div>
            </div>
          </TabsContent>

          {/* Credit Packages Tab */}
          <TabsContent value="credits" className="space-y-6">
            {/* Back Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('overview')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto mb-8" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
              {creditPackages.map((pkg) => {
                const isSelected = selectedPackageId === pkg.id
                return (
                <Card
                  key={pkg.id}
                  onClick={() => handleSelectPackage(pkg.id)}
                  className={`relative transition-all hover:shadow-lg cursor-pointer border-gray-300 bg-gray-200 ${
                    isSelected ? 'ring-2 ring-gray-900 shadow-md' : ''
                  }`}>
                  {pkg.popular && (
                    <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                      Popular
                    </Badge>
                  )}

                  <CardHeader className="text-left pb-4">
                    <CardTitle className="text-2xl font-bold text-gray-900 mb-4" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>{pkg.name}</CardTitle>
                    <div className="mb-4">
                      <div className="text-xl font-bold text-gray-900 mb-1" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                        R$ {pkg.price}
                        <span className="text-sm font-normal text-gray-500"> único</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <ul className="space-y-2 mb-6">
                      <li className="flex items-center text-xs">
                        <div className="w-4 h-4 bg-gray-100 rounded-full flex items-center justify-center mr-2">
                          <Check className="w-2.5 h-2.5 text-gray-600" />
                        </div>
                        <span className="text-gray-700" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                          {pkg.creditAmount + pkg.bonusCredits} créditos
                          {pkg.bonusCredits > 0 && (
                            <span className="text-green-600 ml-1">(+{pkg.bonusCredits} bônus)</span>
                          )}
                        </span>
                      </li>
                      <li className="flex items-center text-xs">
                        <div className="w-4 h-4 bg-gray-100 rounded-full flex items-center justify-center mr-2">
                          <Check className="w-2.5 h-2.5 text-gray-600" />
                        </div>
                        <span className="text-gray-700" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                          Válido por {pkg.validityMonths} {pkg.validityMonths === 1 ? 'mês' : 'meses'}
                        </span>
                      </li>
                    </ul>

                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleBuyPackage(pkg.id)
                      }}
                      disabled={purchasing === pkg.id}
                      className={`w-full font-medium py-2.5 h-auto text-sm transition-all ${
                        isSelected
                          ? 'bg-gray-900 hover:bg-gray-800 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                      }`}
                      style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
                    >
                      {purchasing === pkg.id ? (
                        <div className="flex items-center">
                          <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                          Processando...
                        </div>
                      ) : (
                        'Comprar'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )
              })}
            </div>

          </TabsContent>

        </Tabs>
      </div>

      <PaymentMethodModal
        isOpen={Boolean(showPaymentModal && selectedPackage)}
        packageName={selectedPackage?.name ?? ''}
        packagePrice={selectedPackage?.price ?? ''}
        description={selectedPackage?.description}
        onSelect={handlePurchase}
        onClose={() => {
          setShowPaymentModal(false)
          setPurchasing(null)
          setPaymentMethod(null)
          setPaymentError(null)
        }}
        loading={Boolean(purchasing)}
        loadingMethod={paymentMethod}
        errorMessage={paymentError}
      />

      {/* Checkout Modal with Asaas iframe */}
      {showCheckoutModal && checkoutUrl && (
        <CheckoutModal
          isOpen={showCheckoutModal}
          onClose={handleCheckoutClose}
          checkoutUrl={checkoutUrl}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {/* Update Card Modal */}
      {showUpdateCardModal && (
        <UpdateCardModal
          onClose={() => setShowUpdateCardModal(false)}
          onSuccess={handleUpdateCardSuccess}
        />
      )}
    </div>
    </>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#667EEA] mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    }>
      <BillingPageContent />
    </Suspense>
  )
}