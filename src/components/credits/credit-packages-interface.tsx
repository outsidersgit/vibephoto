'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Wallet,
  Zap,
  Gift,
  Clock,
  CheckCircle,
  Check,
  Star,
  TrendingUp,
  Award,
  Sparkles,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { CreditBalance } from './credit-balance'
import { CheckoutModal } from '@/components/checkout/checkout-modal'
import { CREDIT_PACKAGES } from '@/config/pricing'

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

interface CreditPackagesInterfaceProps {
  user: {
    id: string
    plan: string
    creditsUsed: number
    creditsLimit: number
  }
}

export function CreditPackagesInterface({ user }: CreditPackagesInterfaceProps) {
  const { data: session, status } = useSession()
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [balance, setBalance] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [previousSelectedId, setPreviousSelectedId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [checkoutUrl, setCheckoutUrl] = useState<string>('')
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)

  // Pré-selecionar o pacote "Popular" ao carregar
  useEffect(() => {
    const popularPackage = CREDIT_PACKAGES.find(pkg => pkg.popular)
    if (popularPackage) {
      setSelectedPackageId(popularPackage.id)
    }
  }, [])

  useEffect(() => {
    // CRITICAL: Verificar se há sessão antes de fazer fetch
    if (status !== 'loading' && session?.user && user?.id) {
      loadPackagesAndBalance()
    } else if (status !== 'loading' && !session?.user) {
      // Não autenticado - parar loading sem fazer fetch
      setLoading(false)
    }
  }, [status, session, user?.id])

  const loadPackagesAndBalance = async () => {
    // CRITICAL: Verificar novamente antes de fazer fetch
    if (!session?.user || !user?.id) {
      setLoading(false)
      return
    }
    
    try {
      const [packagesRes, balanceRes] = await Promise.all([
        fetch('/api/credit-packages'),
        fetch('/api/credits/balance')
      ])

      // CRITICAL: Verificar se response é 401 e ignorar (usuário não autenticado)
      if (balanceRes.status === 401) {
        console.log('🚫 [CreditPackagesInterface] Não autenticado - ignorando fetch de balance')
        // Ainda tentar carregar packages (podem ser públicos)
        const packagesData = await packagesRes.json()
        if (packagesData.success) {
          setPackages(packagesData.packages)
        }
        setLoading(false)
        return
      }

      const packagesData = await packagesRes.json()
      const balanceData = await balanceRes.json()

      if (packagesData.success) {
        setPackages(packagesData.packages)
      }

      if (balanceData.success) {
        setBalance(balanceData.balance)
      }
    } catch (error) {
      // CRITICAL: Não logar erros 401 como erros (são esperados após logout)
      if (error instanceof Error && error.message.includes('401')) {
        console.log('🚫 [CreditPackagesInterface] Não autenticado - ignorando erro')
        return
      }
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPackage = (packageId: string) => {
    setSelectedPackageId(packageId)
  }

  const handleBuyPackage = (packageId?: string) => {
    // Salvar seleção anterior
    setPreviousSelectedId(selectedPackageId)

    // Se foi passado um packageId (clique no botão Comprar), selecionar ele
    if (packageId) {
      setSelectedPackageId(packageId)
    }

    setShowPaymentModal(true)
  }

  const handlePurchase = async (method: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD') => {
    if (!selectedPackageId) return

    setPurchasing(selectedPackageId)
    setPaymentMethod(method)

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
        setShowPaymentModal(false)
        setCheckoutUrl(data.checkoutUrl)
        setShowCheckoutModal(true)
      } else {
        alert(`❌ Erro: ${data.error || 'Erro ao criar checkout'}`)
        setPurchasing(null)
      }
    } catch (error) {
      console.error('Erro ao processar compra:', error)
      alert('❌ Erro ao processar compra')
      setPurchasing(null)
    }
  }

  const handleCheckoutSuccess = () => {
    setShowCheckoutModal(false)
    setPurchasing(null)
    setCheckoutUrl('')

    // Recarregar saldo
    setTimeout(() => {
      loadPackagesAndBalance()
    }, 2000)
  }

  const handleCheckoutClose = () => {
    setShowCheckoutModal(false)
    setPurchasing(null)
    setCheckoutUrl('')
  }

  const selectedPackage = CREDIT_PACKAGES.find(pkg => pkg.id === selectedPackageId)


  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  // Use official credit packages from pricing config
  const creditPackages = CREDIT_PACKAGES

  return (
    <div className="space-y-8" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
      {/* Informações dos Créditos - Tema Escuro Compacto */}
      <div className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] rounded-2xl p-6 border border-slate-600/30 shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-4">Como Funcionam os Créditos</h3>

        <div className="space-y-3 text-sm text-slate-300">
          <div className="flex items-start">
            <span className="text-white font-medium mr-2">•</span>
            <span>Pacotes de créditos são válidos por <span className="text-white font-medium">1 ano</span> após a compra</span>
          </div>

          <div className="flex items-start">
            <span className="text-white font-medium mr-2">•</span>
            <span>O sistema usa primeiro os créditos de <span className="text-white font-medium">assinatura</span>, depois os créditos de <span className="text-white font-medium">pacotes únicos</span></span>
          </div>

          <div className="flex items-start">
            <span className="text-amber-400 font-medium mr-2">⚠</span>
            <span>Pacotes de fotos podem consumir <span className="text-white font-medium">mais créditos</span> que a geração básica, variando conforme o pacote escolhido</span>
          </div>
        </div>
      </div>

      {/* Credit Packages Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto mb-8" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
        {creditPackages.map((pkg) => {
          const isSelected = selectedPackageId === pkg.id
          return (
          <Card
            key={pkg.id}
            onClick={() => handleSelectPackage(pkg.id)}
            className={`relative transition-all hover:shadow-lg cursor-pointer border-gray-300 bg-gray-200 ${
              isSelected ? 'ring-2 ring-gray-900 shadow-md' : ''
            }`}
          >
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
                <div className="text-xs text-gray-600 font-medium">
                  Válido por 1 ano
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
                    {pkg.credits} créditos
                  </span>
                </li>
                <li className="flex items-center text-xs">
                  <div className="w-4 h-4 bg-gray-100 rounded-full flex items-center justify-center mr-2">
                    <Check className="w-2.5 h-2.5 text-gray-600" />
                  </div>
                  <span className="text-gray-700" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                    {pkg.photos} fotos
                  </span>
                </li>
              </ul>

              <Button
                className={`w-full font-medium py-2.5 h-auto text-sm transition-all ${
                  isSelected
                    ? 'bg-gray-900 hover:bg-gray-800 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                }`}
                style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
                onClick={(e) => {
                  e.stopPropagation()
                  handleBuyPackage(pkg.id)
                }}
              >
                Comprar
              </Button>
            </CardContent>
          </Card>
        )
        })}
      </div>

      {/* Payment Method Selection Modal */}
      {showPaymentModal && selectedPackage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-2" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
              Escolha o Método de Pagamento
            </h3>
            <p className="text-gray-600 mb-6" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
              {selectedPackage.name} – R$ {selectedPackage.price}
            </p>

            <div className="space-y-4 mb-6">
              {/* PIX Option */}
              <button
                onClick={() => handlePurchase('PIX')}
                disabled={!!purchasing}
                className="w-full p-6 border-2 border-gray-300 bg-gray-200 rounded-xl hover:shadow-lg transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-bold text-gray-900 text-lg" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                  PIX
                </div>
                {purchasing === 'PIX' && (
                  <Loader2 className="w-5 h-5 text-gray-900 animate-spin mt-2" />
                )}
              </button>

              {/* Credit Card Option */}
              <button
                onClick={() => handlePurchase('CREDIT_CARD')}
                disabled={!!purchasing}
                className="w-full p-6 border-2 border-gray-300 bg-gray-200 rounded-xl hover:shadow-lg transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-bold text-gray-900 text-lg" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                  Cartão de Crédito
                </div>
                {purchasing === 'CREDIT_CARD' && (
                  <Loader2 className="w-5 h-5 text-gray-900 animate-spin mt-2" />
                )}
              </button>

              {/* Debit Card Option */}
              <button
                onClick={() => handlePurchase('DEBIT_CARD')}
                disabled={!!purchasing}
                className="w-full p-6 border-2 border-gray-300 bg-gray-200 rounded-xl hover:shadow-lg transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-bold text-gray-900 text-lg" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                  Cartão de Débito
                </div>
                {purchasing === 'DEBIT_CARD' && (
                  <Loader2 className="w-5 h-5 text-gray-900 animate-spin mt-2" />
                )}
              </button>
            </div>

            <button
              onClick={() => {
                setShowPaymentModal(false)
                // Restaurar seleção anterior ao cancelar
                if (previousSelectedId) {
                  setSelectedPackageId(previousSelectedId)
                }
              }}
              disabled={!!purchasing}
              className="w-full py-2 text-gray-600 hover:text-gray-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Checkout Modal with Asaas iframe */}
      {showCheckoutModal && checkoutUrl && (
        <CheckoutModal
          isOpen={showCheckoutModal}
          onClose={handleCheckoutClose}
          checkoutUrl={checkoutUrl}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </div>
  )
}