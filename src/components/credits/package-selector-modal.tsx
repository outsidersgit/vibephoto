'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, ArrowLeft, Check } from 'lucide-react'
import { CheckoutModal } from '@/components/checkout/checkout-modal'

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

interface PackageSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD'
type Step = 'select-package' | 'select-method' | 'checkout'

export function PackageSelectorModal({
  isOpen,
  onClose,
  onSuccess
}: PackageSelectorModalProps) {
  const queryClient = useQueryClient()
  const { update: updateSession } = useSession()
  const [step, setStep] = useState<Step>('select-package')
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [checkoutUrl, setCheckoutUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [loadingPackages, setLoadingPackages] = useState(true)

  // Buscar pacotes da API quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      async function fetchPackages() {
        try {
          setLoadingPackages(true)
          const response = await fetch('/api/credit-packages')
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.packages) {
              setPackages(data.packages)
              // Pré-selecionar o primeiro pacote ou o mais popular
              if (data.packages.length > 0 && !selectedPackageId) {
                const popularPackage = data.packages.find((pkg: CreditPackage) => pkg.sortOrder === 1 || pkg.sortOrder === 2) || data.packages[0]
                if (popularPackage) {
                  setSelectedPackageId(popularPackage.id)
                }
              }
            }
          }
        } catch (err) {
          console.error('Error fetching packages:', err)
        } finally {
          setLoadingPackages(false)
        }
      }
      fetchPackages()
    }
  }, [isOpen])

  const handlePackageSelect = (packageId: string) => {
    setSelectedPackageId(packageId)
    setStep('select-method')
    setError(null)
  }

  const handleMethodSelect = async (method: PaymentMethod) => {
    if (!selectedPackageId) return

    setSelectedMethod(method)
    setLoading(true)
    setError(null)

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

      if (!response.ok || !data.success) {
        setError(data.error || 'Erro ao criar checkout')
        setLoading(false)
        return
      }

      setCheckoutUrl(data.checkoutUrl)
      setStep('checkout')
    } catch (err: any) {
      console.error('Checkout error:', err)
      setError(err.message || 'Erro ao processar pagamento')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckoutSuccess = () => {
    // CRITICAL: Invalidar todas as queries relacionadas a créditos após compra
    console.log('🔄 [PackageSelectorModal] Invalidando queries após compra de créditos')
    queryClient.invalidateQueries({ queryKey: ['credits'] })
    queryClient.invalidateQueries({ queryKey: ['user'] })
    
    // Atualizar sessão para refletir mudanças
    updateSession()
    
    onSuccess()
    handleClose()
  }

  const handleClose = () => {
    setStep('select-package')
    setSelectedPackageId(null)
    setSelectedMethod(null)
    setCheckoutUrl('')
    setError(null)
    onClose()
  }

  const handleBack = () => {
    if (step === 'select-method') {
      setStep('select-package')
    } else if (step === 'checkout') {
      setStep('select-method')
      setCheckoutUrl('')
    }
  }

  const selectedPackage = packages.find(pkg => pkg.id === selectedPackageId)

  return (
    <>
      <Dialog open={isOpen && step === 'select-package'} onOpenChange={handleClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-white" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
              Comprar Créditos
            </DialogTitle>
            <DialogDescription className="text-gray-600" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
              Escolha o pacote de créditos ideal para você
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Select Package */}
          {step === 'select-package' && (
            <div className="space-y-6 mt-4">
                {loadingPackages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  </div>
                ) : (
                  <>
                    {/* Grid de Pacotes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {packages.map((pkg) => {
                        const isSelected = selectedPackageId === pkg.id
                        return (
                          <Card
                            key={pkg.id}
                            onClick={() => handlePackageSelect(pkg.id)}
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
                              <CardTitle className="text-2xl font-bold text-gray-900 mb-4" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                                {pkg.name}
                              </CardTitle>
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
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </>
                )}
                </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Method Selection Modal - Custom Style */}
      {step === 'select-method' && selectedPackage && (
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
                onClick={() => !loading && handleMethodSelect('PIX')}
                disabled={loading}
                className="w-full p-6 border-2 border-gray-300 bg-gray-200 rounded-xl hover:shadow-lg transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-bold text-gray-900 text-lg" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                  PIX
                </div>
                {loading && selectedMethod === 'PIX' && (
                  <Loader2 className="w-5 h-5 text-gray-900 animate-spin mt-2" />
                )}
              </button>

              {/* Credit Card Option */}
              <button
                onClick={() => !loading && handleMethodSelect('CREDIT_CARD')}
                disabled={loading}
                className="w-full p-6 border-2 border-gray-300 bg-gray-200 rounded-xl hover:shadow-lg transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-bold text-gray-900 text-lg" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                  Cartão de Crédito
                </div>
                {loading && selectedMethod === 'CREDIT_CARD' && (
                  <Loader2 className="w-5 h-5 text-gray-900 animate-spin mt-2" />
                )}
              </button>

              {/* Debit Card Option */}
              <button
                onClick={() => !loading && handleMethodSelect('DEBIT_CARD')}
                disabled={loading}
                className="w-full p-6 border-2 border-gray-300 bg-gray-200 rounded-xl hover:shadow-lg transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-bold text-gray-900 text-lg" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                  Cartão de Débito
                </div>
                {loading && selectedMethod === 'DEBIT_CARD' && (
                  <Loader2 className="w-5 h-5 text-gray-900 animate-spin mt-2" />
                )}
              </button>
            </div>

            {error && (
              <Alert className="bg-red-50 border-red-200 mb-4">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            <button
              onClick={handleClose}
              disabled={loading}
              className="w-full py-2 text-gray-600 hover:text-gray-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {step === 'checkout' && checkoutUrl && (
        <CheckoutModal
          isOpen={true}
          onClose={handleClose}
          checkoutUrl={checkoutUrl}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </>
  )
}
