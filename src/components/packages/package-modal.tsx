'use client'

import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  X,
  Eye,
  AlertCircle
} from 'lucide-react'
import { PackageConfigModal } from './package-config-modal'
import { PackageProgressModal } from './package-progress-modal'
import { useCreditBalance, useInvalidateCredits } from '@/hooks/useCredits'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'
import { notifyError, notifySuccess } from '@/lib/errors'
import { PackageSelectorModal } from '@/components/credits/package-selector-modal'

interface Package {
  id: string
  name: string
  category: string
  description: string
  promptCount: number
  previewImages: string[]
  previewUrlsMale?: string[]
  previewUrlsFemale?: string[]
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
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [activeUserPackageId, setActiveUserPackageId] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [previewGender, setPreviewGender] = useState<'MALE' | 'FEMALE'>('FEMALE') // Pre-select FEMALE (maior público)

  const router = useRouter()

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
  const { data: balance } = useCreditBalance()
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

  const handleActivatePackage = async (modelId: string, aspectRatio: string, gender: 'MALE' | 'FEMALE') => {
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
          aspectRatio,
          gender
        })
      })

      const data = await response.json()

      console.log('📦 [PackageModal] Activation response:', {
        ok: response.ok,
        status: response.status,
        success: data.success,
        hasUserPackage: !!data.userPackage,
        userPackageId: data.userPackage?.id,
        fullData: data
      })

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao gerar pacote')
      }

      if (data.success) {
        setActivationStatus('success')
        // Invalidar cache de créditos (React Query atualiza automaticamente)
        invalidateBalance()

        // 🔄 NOVO FLUXO: Fechar modal e redirecionar para galeria
        setActiveUserPackageId(data.userPackage.id)

        // Marcar no localStorage para exibir painel de progresso na página /packages
        localStorage.setItem(`package_progress_${data.userPackage.id}`, 'true')

        console.log('✅ [PackageModal] Closing modal and redirecting to gallery...')

        // Fechar o modal de seleção
        onClose()

        setIsActivating(false)

        // Redirecionar para galeria após fechar o modal
        setTimeout(() => {
          console.log('🔄 [PackageModal] Redirecting now...')
          router.push('/gallery')
        }, 300)
      } else {
        console.error('❌ [PackageModal] Activation failed - data.success is false')
        throw new Error(data.error || 'Erro desconhecido')
      }
    } catch (error) {
      console.error('❌ [PackageModal] Package generation error:', error)
      console.error('❌ [PackageModal] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      setActivationStatus('error')
      notifyError(error, 'PACKAGE_GENERATION')
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao gerar pacote')
      setIsActivating(false)
    }
  }

  const handleProgressModalClose = () => {
    setShowProgressModal(false)
    // Remover flag de modal aberto
    if (activeUserPackageId) {
      localStorage.removeItem(`package_modal_open_${activeUserPackageId}`)
    }
  }

  const handleProgressComplete = () => {
    // Quando a geração completar, fechar modal e redirecionar
    setShowProgressModal(false)
    if (activeUserPackageId) {
      localStorage.removeItem(`package_modal_open_${activeUserPackageId}`)
    }
    window.location.href = '/gallery?tab=packages'
  }

  const handleCreditPurchaseSuccess = () => {
    console.log('🔄 [PackageModal] Checkout concluído - invalidando queries')
    setShowCreditsPurchase(false)
    invalidateBalance()
  }


  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      LIFESTYLE: 'bg-emerald-100 text-emerald-700',
      PROFESSIONAL: 'bg-blue-100 text-blue-700',
      CREATIVE: 'bg-purple-100 text-purple-700',
      FASHION: 'bg-pink-100 text-pink-700',
      PREMIUM: 'bg-amber-100 text-amber-700'
    }
    return colors[category] || 'bg-gray-100 text-gray-800'
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
              {/* Gender Toggle - Discreto */}
              <div className="flex justify-end mb-3">
                <div className="inline-flex gap-1 bg-gray-700/30 rounded-md p-1">
                  <button
                    type="button"
                    onClick={() => setPreviewGender('MALE')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      previewGender === 'MALE'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    Masculino
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewGender('FEMALE')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      previewGender === 'FEMALE'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    Feminino
                  </button>
                </div>
              </div>

              {/* Preview Images */}
              {(() => {
                const previews = previewGender === 'MALE'
                  ? (pkg.previewUrlsMale && Array.isArray(pkg.previewUrlsMale) && pkg.previewUrlsMale.length > 0
                      ? pkg.previewUrlsMale
                      : pkg.previewImages)
                  : (pkg.previewUrlsFemale && Array.isArray(pkg.previewUrlsFemale) && pkg.previewUrlsFemale.length > 0
                      ? pkg.previewUrlsFemale
                      : pkg.previewImages)

                return previews && previews.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {previews.slice(0, 4).map((image: string, index: number) => (
                      <div 
                        key={index} 
                        className="aspect-square bg-gray-900 rounded-lg overflow-hidden group cursor-pointer border border-gray-700 hover:border-purple-500 transition-colors"
                        onClick={() => setSelectedImageIndex(index)}
                      >
                        <img
                          src={image}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
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
                  {Array.isArray(previews) && previews.length > 4 && (
                    <div className="mt-4 flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          console.log('🔍 Ver todas clicado. Total de imagens:', previews.length)
                          setShowAllPreviews(true)
                        }}
                        className="bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                      >
                        Ver todas as previews
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>Nenhuma imagem de preview disponível para {previewGender === 'MALE' ? 'Masculino' : 'Feminino'}</p>
                </div>
              )
            })()}

              <div className="h-4"></div>

              {/* Aviso de Créditos Insuficientes */}
              {userCredits < pkg.price && (
                <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3 mb-3">
                  <p className="text-sm text-red-300">
                    ⚠️ Créditos Insuficientes: Você precisa de <strong>{pkg.price} créditos</strong>, mas tem apenas <strong>{userCredits} créditos</strong>.
                  </p>
                </div>
              )}

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
                      Gerando...
                    </>
                  ) : activationStatus === 'success' ? (
                    <>
                      ✅ Gerado!
                    </>
                  ) : userCredits >= pkg.price ? (
                    'Gerar Agora'
                  ) : (
                    'Comprar Créditos'
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
      {showAllPreviews && (() => {
        const allPreviews = previewGender === 'MALE'
          ? (pkg.previewUrlsMale && Array.isArray(pkg.previewUrlsMale) && pkg.previewUrlsMale.length > 0
              ? pkg.previewUrlsMale
              : pkg.previewImages)
          : (pkg.previewUrlsFemale && Array.isArray(pkg.previewUrlsFemale) && pkg.previewUrlsFemale.length > 0
              ? pkg.previewUrlsFemale
              : pkg.previewImages)

        return (
          <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4" onClick={() => setShowAllPreviews(false)}>
            <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto border border-gray-700" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Todas as Previews - {previewGender === 'MALE' ? 'Masculino' : 'Feminino'}</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowAllPreviews(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {allPreviews.map((image, index) => (
                    <div
                      key={index}
                      className="aspect-square bg-gray-900 rounded-lg overflow-hidden border border-gray-700 cursor-pointer hover:border-purple-500 transition-colors"
                      onClick={() => setSelectedImageIndex(index)}
                    >
                      <img
                        src={image}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
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
        )
      })()}

      {/* PackageSelectorModal */}
      <PackageSelectorModal
        isOpen={showCreditsPurchase}
        onClose={() => setShowCreditsPurchase(false)}
        onSuccess={handleCreditPurchaseSuccess}
      />

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

      {/* Modal de Progresso - Mantém usuário informado durante a geração */}
      {showProgressModal && activeUserPackageId && (
        <PackageProgressModal
          isOpen={showProgressModal}
          onClose={handleProgressModalClose}
          userPackageId={activeUserPackageId}
          packageName={pkg.name}
          totalImages={pkg.promptCount || pkg.prompts?.length || 20}
          onComplete={handleProgressComplete}
        />
      )}

      {/* Modal de Visualização de Imagem em Tamanho Real */}
      {selectedImageIndex !== null && (() => {
        const currentPreviews = previewGender === 'MALE'
          ? (pkg.previewUrlsMale && Array.isArray(pkg.previewUrlsMale) && pkg.previewUrlsMale.length > 0
              ? pkg.previewUrlsMale
              : pkg.previewImages)
          : (pkg.previewUrlsFemale && Array.isArray(pkg.previewUrlsFemale) && pkg.previewUrlsFemale.length > 0
              ? pkg.previewUrlsFemale
              : pkg.previewImages)

        return (
          <div
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center"
            onClick={() => setSelectedImageIndex(null)}
          >
            {/* Botão Fechar */}
            <button
              onClick={() => setSelectedImageIndex(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Imagem */}
            <img
              src={currentPreviews[selectedImageIndex]}
              alt={`Preview ${selectedImageIndex + 1}`}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Navegação */}
            {currentPreviews.length > 1 && (
              <>
                {selectedImageIndex > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedImageIndex(selectedImageIndex - 1)
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors"
                  >
                    ←
                  </button>
                )}
                {selectedImageIndex < currentPreviews.length - 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedImageIndex(selectedImageIndex + 1)
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors"
                  >
                    →
                  </button>
                )}
              </>
            )}

            {/* Contador */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm">
              {selectedImageIndex + 1} / {currentPreviews.length}
            </div>
          </div>
        )
      })()}

    </div>
  )
}