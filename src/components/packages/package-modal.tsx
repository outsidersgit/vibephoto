'use client'

import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  X,
  Eye,
  AlertCircle
} from 'lucide-react'
import { PackageConfigModal } from './package-config-modal'
import { useCreditBalance, useCreditPackages, useInvalidateCredits } from '@/hooks/useCredits'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'

interface Package {
  id: string
  name: string
  category: string
  description: string
  promptCount: number
  previewImages: string[]
  price: number
  isPremium: boolean
  estimatedTime: string
  popularity: number
  rating: number
  uses: number
  tags: string[]
  features?: string[]
}

interface PackageModalProps {
  package: Package
  onClose: () => void
}

export function PackageModal({ package: pkg, onClose }: PackageModalProps) {
  const [isActivating, setIsActivating] = useState(false)
  const [activationStatus, setActivationStatus] = useState<'idle' | 'activating' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [showCreditsPurchase, setShowCreditsPurchase] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showAllPreviews, setShowAllPreviews] = useState(false)

  // Debug: verificar preview images
  React.useEffect(() => {
    if (pkg.previewImages) {
      console.log('📦 [PackageModal] Preview images:', {
        count: pkg.previewImages.length,
        hasMoreThan4: pkg.previewImages.length > 4,
        images: pkg.previewImages
      })
    }
  }, [pkg.previewImages])

  // Performance: Usar React Query para cache instantâneo (Sprint 1)
  const queryClient = useQueryClient()
  const { update: updateSession } = useSession()
  const { data: balance, isLoading: loadingCredits } = useCreditBalance()
  const { data: creditPackages = [] } = useCreditPackages()
  const { invalidateBalance } = useInvalidateCredits()
  
  // CRITICAL: Listener SSE para invalidar queries quando créditos são atualizados via admin
  useRealtimeUpdates({
    onCreditsUpdate: () => {
      console.log('🔄 [PackageModal] Créditos atualizados via SSE - invalidando queries')
      queryClient.invalidateQueries({ queryKey: ['credits'] })
      updateSession() // Update session to reflect credit changes
    },
    onUserUpdate: (updatedFields) => {
      // CRITICAL: Admin atualizou usuário - atualizar sessão e invalidar queries
      console.log('🔄 [PackageModal] Usuário atualizado via admin - atualizando sessão e queries', updatedFields)
      queryClient.invalidateQueries({ queryKey: ['credits'] })
      queryClient.invalidateQueries({ queryKey: ['user'] })
      updateSession()
    },
  })
  
  const userCredits = balance?.totalCredits || 0

  const handleOpenConfigModal = () => {
    // Verificar se tem créditos suficientes
    if (userCredits < pkg.price) {
      setShowCreditsPurchase(true)
      return
    }

    // Abrir modal de configuração
    setShowConfigModal(true)
  }

  const handleActivatePackage = async (modelId: string, aspectRatio: string) => {
    setShowConfigModal(false)
    setIsActivating(true)
    setActivationStatus('activating')
    setErrorMessage('')

    try {
      const response = await fetch(`/api/packages/${pkg.id}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId,
          aspectRatio
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao ativar pacote')
      }

      if (data.success) {
        setActivationStatus('success')
        // Invalidar cache de créditos (React Query atualiza automaticamente)
        invalidateBalance()

        // Show success message and redirect to gallery after 3 seconds
        setTimeout(() => {
          window.location.href = '/gallery?tab=packages'
        }, 3000)
      } else {
        throw new Error(data.error || 'Erro desconhecido')
      }
    } catch (error) {
      console.error('Package activation error:', error)
      setActivationStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao ativar pacote')
    } finally {
      setIsActivating(false)
    }
  }

  const handlePurchaseCredits = (credits: number) => {
    // Simular compra de créditos e invalidar cache
    invalidateBalance()
    setShowCreditsPurchase(false)
  }


  const getCategoryColor = (category: string) => {
    const colors = {
      PROFESSIONAL: 'bg-blue-100 text-blue-800',
      SOCIAL: 'bg-pink-100 text-pink-800',
      FANTASY: 'bg-purple-100 text-purple-800',
      ARTISTIC: 'bg-green-100 text-green-800'
    }
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h2 className="text-2xl font-bold text-white">{pkg.name}</h2>
                <Badge variant="secondary" className="bg-blue-100/20 text-blue-300 border border-blue-400/20">
                  {pkg.category.toLowerCase()}
                </Badge>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                {pkg.description}
              </p>
            </div>

            <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white hover:bg-gray-700">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-6">
              {/* Preview Images */}
              {pkg.previewImages && pkg.previewImages.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {pkg.previewImages.slice(0, 4).map((image, index) => (
                      <div key={index} className="aspect-square bg-gray-900 rounded-lg overflow-hidden group cursor-pointer border border-gray-700">
                        <img
                          src={image}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                        <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center relative hidden">
                          <span className="text-3xl opacity-50 text-gray-400">🖼️</span>
                          
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-gray-900 hover:bg-white"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Ver Todas Button - aparece quando há mais de 4 imagens */}
                  {Array.isArray(pkg.previewImages) && pkg.previewImages.length > 4 && (
                    <div className="mt-4 flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          console.log('🔍 Ver todas clicado. Total de imagens:', pkg.previewImages.length)
                          setShowAllPreviews(true)
                        }}
                        className="bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver todas ({pkg.previewImages.length} imagens)
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>Nenhuma imagem de preview disponível</p>
                </div>
              )}

              <div className="h-4"></div>

              {/* Package Info and Purchase */}
              <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                <div className="flex-1">
                  <div className="text-lg font-bold text-white">{pkg.price} créditos</div>
                  <div className="text-xs text-gray-400">
                {pkg.promptCount || pkg.prompts?.length || 0} {((pkg.promptCount || pkg.prompts?.length || 0) === 1) ? 'foto gerada' : 'fotos geradas'}
              </div>
                  <div className="text-xs text-blue-300 mt-1">Seus créditos: {userCredits}</div>
                </div>
                <Button
                  size="sm"
                  className={`font-medium px-4 py-1.5 ${
                    userCredits >= pkg.price
                      ? 'bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5A6FD8] to-[#6A4190] text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                  onClick={handleOpenConfigModal}
                  disabled={isActivating || activationStatus === 'success'}
                >
                  {isActivating ? (
                    <>
                      <div className="w-3 h-3 mr-1.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Comprando...
                    </>
                  ) : activationStatus === 'success' ? (
                    <>
                      ✅ Comprado!
                    </>
                  ) : userCredits >= pkg.price ? (
                    'Comprar Agora'
                  ) : (
                    'Créditos Insuficientes'
                  )}
                </Button>
              </div>

              {/* Activation Status */}
              {activationStatus === 'activating' && (
                <Card className="bg-blue-900/20 border-blue-600">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      <div>
                        <p className="text-sm font-medium text-blue-200">Ativando pacote...</p>
                        <p className="text-xs text-blue-300">
                          Iniciando geração automática de {pkg.promptCount || pkg.prompts?.length || 0} imagens
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activationStatus === 'success' && (
                <Card className="bg-green-900/20 border-green-600">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 text-green-400">✅</div>
                      <div>
                        <p className="text-sm font-medium text-green-200">Pacote ativado com sucesso!</p>
                        <p className="text-xs text-green-300">Redirecionando para a galeria em 3 segundos...</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activationStatus === 'error' && (
                <Card className="bg-red-900/20 border-red-600">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <AlertCircle className="w-5 h-5 text-red-400" />
                      <div>
                        <p className="text-sm font-medium text-red-200">Erro ao ativar pacote</p>
                        <p className="text-xs text-red-300">{errorMessage}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
        </div>

      </div>

      {/* Modal Ver Todas as Preview Images */}
      {showAllPreviews && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4" onClick={() => setShowAllPreviews(false)}>
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto border border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Todas as Preview Images</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowAllPreviews(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pkg.previewImages.map((image, index) => (
                  <div key={index} className="aspect-square bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                    <img
                      src={image}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.nextElementSibling?.classList.remove('hidden')
                      }}
                    />
                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center relative hidden">
                      <span className="text-3xl opacity-50 text-gray-400">🖼️</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Compra Rápida de Créditos */}
      {showCreditsPurchase && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">Créditos Insuficientes</h3>
            <p className="text-gray-300 mb-4">
              Você precisa de <span className="font-bold text-white">{pkg.price} créditos</span> para este pacote.
              <br />
              Você tem apenas <span className="font-bold text-blue-300">{userCredits} créditos</span>.
            </p>

            <div className="space-y-3 mb-6">
              <h4 className="font-medium text-white">Pacotes de Créditos Disponíveis:</h4>

              <div className="space-y-2">
                {loadingCredits ? (
                  <div className="text-center py-4">
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-gray-400 text-sm mt-2">Carregando pacotes...</p>
                  </div>
                ) : creditPackages.length > 0 ? (
                  creditPackages.map((creditPkg) => (
                    <div key={creditPkg.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg border border-gray-600">
                      <div>
                        <div className="font-medium text-white">{creditPkg.creditAmount} Créditos</div>
                        <div className="text-xs text-gray-400">{creditPkg.name}</div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5A6FD8] to-[#6A4190] text-white"
                        onClick={() => {
                          handlePurchaseCredits(creditPkg.creditAmount)
                        }}
                      >
                        R$ {creditPkg.price.toFixed(2).replace('.', ',')}
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-400 text-sm">Nenhum pacote disponível no momento</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                onClick={() => setShowCreditsPurchase(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuração do Pacote */}
      {showConfigModal && (
        <PackageConfigModal
          packageId={pkg.id}
          packageName={pkg.name}
          packagePrice={pkg.price}
          totalImages={pkg.promptCount || pkg.prompts?.length || 0}
          onClose={() => setShowConfigModal(false)}
          onConfirm={handleActivatePackage}
        />
      )}
    </div>
  )
}