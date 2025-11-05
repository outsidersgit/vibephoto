'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'
import { useToast } from '@/hooks/use-toast'
import { useImageGeneration, useManualSync, useGenerationPolling } from '@/hooks/useImageGeneration'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Play,
  Image,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react'
import { PromptInput } from './prompt-input'
import { GenerationSettings } from './generation-settings'
import { ResultsGallery } from './results-gallery'
import { PromptExamples } from './prompt-examples'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GenerationResultModal } from '@/components/ui/generation-result-modal'

interface GenerationInterfaceProps {
  models: Array<{
    id: string
    name: string
    class: string
    sampleImages: any[]
    qualityScore?: number
  }>
  selectedModelId: string
  user: {
    id: string
    plan: string
    creditsUsed: number
    creditsLimit: number
  }
  canUseCredits: boolean
}

export function GenerationInterface({
  models,
  selectedModelId,
  user,
  canUseCredits
}: GenerationInterfaceProps) {
  // CRITICAL: Todos os hooks DEVEM ser chamados ANTES de qualquer early return
  // Violar esta regra causa erro React #310 (can't set state on unmounted component)
  const { data: session, status } = useSession()
  const router = useRouter()
  const { addToast } = useToast()
  
  const [selectedModel, setSelectedModel] = useState(selectedModelId)
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [generationResults, setGenerationResults] = useState<any[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [currentGeneration, setCurrentGeneration] = useState<any>(null)
  const [showExamples, setShowExamples] = useState(false)

  // Success modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successImageUrl, setSuccessImageUrl] = useState<string | null>(null)
  // Flag para evitar toasts duplicados
  const [completedGenerationIds, setCompletedGenerationIds] = useState<Set<string>>(new Set())

  // React Query hooks
  const generateImage = useImageGeneration()
  const manualSync = useManualSync()
  
  // Polling como fallback caso SSE falhe
  // CRITICAL: Habilitar polling se há uma geração em PROCESSING OU se SSE desconectou
  const shouldPoll = !!currentGeneration && (
    currentGeneration.status === 'PROCESSING' || 
    currentGeneration.status === 'PENDING'
  )
  
  const generationPolling = useGenerationPolling(
    currentGeneration?.id || null,
    shouldPoll
  )
  
  // Log polling status para debug
  useEffect(() => {
    if (currentGeneration?.id) {
      console.log(`🔍 [POLLING] Generation ${currentGeneration.id}:`, {
        status: currentGeneration.status,
        pollingEnabled: shouldPoll,
        pollingData: generationPolling.data?.status,
        pollingError: generationPolling.error,
        isLoading: generationPolling.isLoading
      })
    }
  }, [currentGeneration?.id, currentGeneration?.status, shouldPoll, generationPolling.data?.status, generationPolling.error, generationPolling.isLoading])
  
  // Botão deve permanecer em loading enquanto:
  // - Requisição HTTP está em andamento OU
  // - Geração está processando (aguardando webhook)
  const isGenerating = generateImage.isPending || currentGeneration?.status === 'PROCESSING'

  // Real-time updates for generation status
  useRealtimeUpdates({
    onGenerationStatusChange: (generationId, status, data) => {
      console.log(`🔄 Real-time generation update: ${generationId} -> ${status}`, {
        hasImageUrls: !!data.imageUrls,
        imageUrlsLength: data.imageUrls?.length,
        currentGenerationId: currentGeneration?.id
      })
      
      // Update current generation if it matches
      if (currentGeneration?.id === generationId) {
        console.log(`✅ Matched current generation: ${generationId}`)
        setCurrentGeneration((prev: any) => ({
          ...prev,
          status,
          imageUrls: data.imageUrls || prev.imageUrls,
          thumbnailUrls: data.thumbnailUrls || prev.thumbnailUrls,
          processingTime: data.processingTime || prev.processingTime,
          errorMessage: data.errorMessage || prev.errorMessage
        }))

        // If completed successfully, show success message and redirect
        // CRITICAL: Verificar se já mostramos feedback para evitar duplicação
        if (status === 'COMPLETED' && data.imageUrls && data.imageUrls.length > 0) {
          // Evitar feedback duplicado
          if (completedGenerationIds.has(generationId)) {
            console.log(`⚠️ Feedback já mostrado para generation ${generationId}, ignorando duplicação`)
            return
          }
          
          console.log(`✅ Generation ${generationId} completed - showing success message and redirecting`)
          
          // Marcar como completado para evitar duplicação
          setCompletedGenerationIds((prev) => new Set([...prev, generationId]))
          
          // Show success message immediately (webhook guarantees DB is updated)
          addToast({
            type: 'success',
            title: '🎉 Sua imagem está pronta!',
            description: `${data.imageUrls.length} imagem${data.imageUrls.length > 1 ? 's' : ''} disponível${data.imageUrls.length > 1 ? 'eis' : ''} na galeria • Redirecionando em instantes...`,
            duration: 4000
          })

          // Show success modal - validar que imageUrls existe e tem elementos
          if (data.imageUrls && data.imageUrls.length > 0) {
            setSuccessImageUrl(data.imageUrls[0])
            setShowSuccessModal(true)
          }

          // Redirect to gallery after 2 seconds
          setTimeout(() => {
            console.log('🚀 Redirecting to gallery...')
            window.location.href = '/gallery'
          }, 2000)
        }

        // Show error message if failed
        if (status === 'FAILED') {
          const errorMessage = data.errorMessage || 'Erro desconhecido na geração'
          addToast({
            type: 'error',
            title: 'Falha na geração de imagem',
            description: errorMessage,
            duration: 6000
          })
        }
      }
    },
    onConnect: () => {
      console.log('✅ Connected to real-time updates')
    },
    onDisconnect: () => {
      console.log('❌ Disconnected from real-time updates')
      
      // Se há uma geração em andamento e SSE desconectou, polling vai cuidar
      if (currentGeneration?.status === 'PROCESSING') {
        console.log('⚠️ SSE disconnected during generation - polling will handle status updates')
      }
    },
    onError: (error) => {
      console.error('❌ SSE connection error:', error)
      
      // Se há uma geração em andamento e SSE falhou, polling vai cuidar
      if (currentGeneration?.status === 'PROCESSING') {
        console.log('⚠️ SSE error during generation - polling will handle status updates')
      }
    }
  })

  // Sincronizar polling com estado da geração (fallback caso SSE falhe)
  useEffect(() => {
    // Log todas as chamadas deste useEffect para debug
    if (generationPolling.data) {
      console.log(`🔍 [POLLING_SYNC] Checking polling data:`, {
        pollingId: generationPolling.data.id,
        currentId: currentGeneration?.id,
        pollingStatus: generationPolling.data.status,
        currentStatus: currentGeneration?.status,
        matches: generationPolling.data.id === currentGeneration?.id,
        statusChanged: generationPolling.data.status !== currentGeneration?.status,
        hasImageUrls: !!(generationPolling.data.imageUrls && generationPolling.data.imageUrls.length > 0)
      })
    }

    if (generationPolling.data && currentGeneration?.id === generationPolling.data.id) {
      const pollingStatus = generationPolling.data.status
      const pollingData = generationPolling.data

      // Atualizar estado local se polling detectar mudança OU se polling tem imageUrls mas currentGeneration não tem
      const statusChanged = pollingStatus !== currentGeneration.status
      const hasNewImages = pollingData.imageUrls && pollingData.imageUrls.length > 0 && 
                          (!currentGeneration.imageUrls || currentGeneration.imageUrls.length === 0)

      if (statusChanged || hasNewImages) {
        console.log(`🔄 Polling detected change:`, {
          statusChange: statusChanged ? `${currentGeneration.status} -> ${pollingStatus}` : 'none',
          newImages: hasNewImages ? `${pollingData.imageUrls.length} images` : 'none',
          generationId: currentGeneration.id
        })
        
        setCurrentGeneration((prev: any) => ({
          ...prev,
          status: pollingStatus,
          imageUrls: pollingData.imageUrls || prev.imageUrls,
          thumbnailUrls: pollingData.thumbnailUrls || prev.thumbnailUrls,
          processingTime: pollingData.processingTime || prev.processingTime,
          errorMessage: pollingData.errorMessage || prev.errorMessage,
          completedAt: pollingStatus === 'COMPLETED' ? (pollingData.completedAt ? new Date(pollingData.completedAt) : new Date()) : prev.completedAt
        }))

        // Se completou via polling, mostrar feedback mesmo se SSE falhou
        // CRITICAL: Verificar se já mostramos feedback para evitar duplicação
        if (pollingStatus === 'COMPLETED' && pollingData.imageUrls && pollingData.imageUrls.length > 0) {
          // Evitar feedback duplicado se SSE já mostrou
          if (completedGenerationIds.has(currentGeneration.id)) {
            console.log(`⚠️ Feedback já mostrado para generation ${currentGeneration.id} (via SSE), ignorando polling`)
            return
          }
          
          console.log(`✅ Generation ${currentGeneration.id} completed via polling - showing success message`)
          
          // Marcar como completado para evitar duplicação
          setCompletedGenerationIds((prev) => new Set([...prev, currentGeneration.id]))
          
          addToast({
            type: 'success',
            title: '🎉 Sua imagem está pronta!',
            description: `${pollingData.imageUrls.length} imagem${pollingData.imageUrls.length > 1 ? 's' : ''} disponível${pollingData.imageUrls.length > 1 ? 'eis' : ''} na galeria • Redirecionando em instantes...`,
            duration: 4000
          })

          // Validar que imageUrls existe antes de usar
          if (pollingData.imageUrls && pollingData.imageUrls.length > 0) {
            setSuccessImageUrl(pollingData.imageUrls[0])
            setShowSuccessModal(true)
          }

          setTimeout(() => {
            console.log('🚀 Redirecting to gallery (via polling)...')
            window.location.href = '/gallery'
          }, 2000)
        }

        // Se falhou via polling
        if (pollingStatus === 'FAILED') {
          const errorMessage = pollingData.errorMessage || 'Erro desconhecido na geração'
          addToast({
            type: 'error',
            title: 'Falha na geração de imagem',
            description: errorMessage,
            duration: 6000
          })
        }
      } else {
        // Log quando não há mudança para debug
        if (generationPolling.data && currentGeneration?.id === generationPolling.data.id) {
          console.log(`ℹ️ [POLLING_SYNC] No change detected:`, {
            pollingStatus,
            currentStatus: currentGeneration.status,
            pollingHasImages: !!(pollingData.imageUrls && pollingData.imageUrls.length > 0),
            currentHasImages: !!(currentGeneration.imageUrls && currentGeneration.imageUrls.length > 0)
          })
        }
      }
    } else if (generationPolling.data && !currentGeneration) {
      // Polling retornou dados mas não há currentGeneration - pode ser problema de sincronização
      console.warn(`⚠️ [POLLING_SYNC] Polling data exists but no currentGeneration:`, {
        pollingId: generationPolling.data.id,
        pollingStatus: generationPolling.data.status
      })
    }
  }, [generationPolling.data, generationPolling.isLoading, currentGeneration?.id, currentGeneration?.status, currentGeneration?.imageUrls, completedGenerationIds])
  
  const [settings, setSettings] = useState({
    aspectRatio: '1:1',
    resolution: '1024x1024',
    variations: 1,
    strength: 0.8,
    seed: undefined as number | undefined,
    style: 'photographic',
    // FLUX parameters
    steps: undefined as number | undefined,
    guidance_scale: undefined as number | undefined,
    raw_mode: false,
    output_quality: 95,
    safety_tolerance: 2,
    output_format: 'jpg',
    // AI Provider selection
    aiProvider: 'replicate' as 'replicate' | 'astria',
    // Astria enhancement parameters
    astria_super_resolution: true,
    astria_inpaint_faces: true,
    astria_face_correct: true,
    astria_face_swap: true,
    astria_hires_fix: true,
    astria_model_type: 'faceid' as 'faceid' | 'sd15' | 'sdxl1' | 'flux-lora'
  })

  // CRITICAL: AGORA sim podemos fazer early returns após TODOS os hooks
  // Durante loading, mostrar loading state (não bloquear)
  // A página server-side já garantiu que há sessão válida
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }
  
  // CRITICAL: Se não autenticado após loading, aguardar (página server-side já verificou)
  // Retornar null só se realmente não autenticado (proteção extra)
  if (status === 'unauthenticated' || !session?.user) {
    // Em caso de perda de sessão, aguardar um momento antes de redirecionar
    // (pode ser um problema temporário de hidratação)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando autenticação...</p>
        </div>
      </div>
    )
  }

  const selectedModelData = models.find(m => m.id === selectedModel)

  const handleGenerate = async () => {
    if (!prompt.trim() || !canUseCredits) return

    // Limpar estado anterior antes de iniciar nova geração
    setCurrentGeneration(null)
    setSuccessImageUrl(null)
    setShowSuccessModal(false)

    try {
      const generation = await generateImage.mutateAsync({
        modelId: selectedModel,
        prompt: prompt,
        negativePrompt: negativePrompt,
        settings: {
          ...settings,
          // Astria specific parameters
          astriaEnhancements: settings.aiProvider === 'astria' ? {
            super_resolution: settings.astria_super_resolution,
            inpaint_faces: settings.astria_inpaint_faces,
            face_correct: settings.astria_face_correct,
            face_swap: settings.astria_face_swap,
            hires_fix: settings.astria_hires_fix,
            model_type: settings.astria_model_type
          } : undefined
        }
      })

      // CRITICAL: Garantir que status seja PROCESSING ao setar currentGeneration
      setCurrentGeneration({
        ...generation,
        status: generation.status || 'PROCESSING' // Garantir PROCESSING se não veio no response
      })
      console.log('🚀 Generation started, waiting for real-time updates...', {
        generationId: generation.id,
        status: generation.status || 'PROCESSING'
      })
    } catch (error) {
      console.error('❌ Generation request error:', error)
      
      // CRITICAL: Limpar estado após erro para resetar o botão
      setCurrentGeneration(null)
      setSuccessImageUrl(null)
      setShowSuccessModal(false)
      
      // Extrair mensagem de erro
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      
      // Detectar tipo de erro para mostrar mensagem apropriada
      let userFriendlyMessage = 'Erro desconhecido ao iniciar a geração. Tente novamente.'
      let userFriendlyTitle = 'Erro ao iniciar geração'
      
      // Erro de saldo do Astria (conta VibePhoto) - NÃO mostrar ao usuário
      if (errorMessage.includes('Not enough balance') || errorMessage.includes('balance in account')) {
        // Este é um erro técnico interno - não mostrar detalhes ao usuário
        console.error('⚠️ [ASTRIA_BALANCE_ERROR] Saldo insuficiente na conta do Astria:', errorMessage)
        userFriendlyMessage = 'Erro temporário no serviço. Nossa equipe foi notificada. Por favor, tente novamente em alguns instantes.'
        userFriendlyTitle = 'Serviço temporariamente indisponível'
      }
      // Erro de créditos do usuário - MOSTRAR (já validado antes, mas pode acontecer em race condition)
      else if (errorMessage.includes('insufficient credits') || errorMessage.includes('créditos insuficientes') || errorMessage.includes('credits')) {
        userFriendlyMessage = 'Você não tem créditos suficientes para esta geração. Adquira mais créditos para continuar.'
        userFriendlyTitle = 'Créditos insuficientes'
      }
      // Erro de parâmetros inválidos
      else if (errorMessage.includes('Invalid parameters')) {
        userFriendlyMessage = 'Parâmetros inválidos. Verifique suas configurações e tente novamente.'
        userFriendlyTitle = 'Configuração inválida'
      }
      // Erro genérico do Astria
      else if (errorMessage.includes('Astria API error') || errorMessage.includes('Astria')) {
        console.error('⚠️ [ASTRIA_ERROR] Erro do provedor Astria:', errorMessage)
        userFriendlyMessage = 'Erro temporário no serviço de geração. Por favor, tente novamente em alguns instantes.'
        userFriendlyTitle = 'Erro no serviço'
      }
      
      // Usar toast em vez de alert para melhor UX
      addToast({
        type: 'error',
        title: userFriendlyTitle,
        description: userFriendlyMessage,
        duration: 8000 // 8 segundos para ler mensagem completa
      })
    }
  }


  const handlePromptSelect = (selectedPrompt: string) => {
    setPrompt(selectedPrompt)
    // Scroll automático para a caixa de prompt
    setTimeout(() => {
      const promptElement = document.getElementById('prompt')
      if (promptElement) {
        const rect = promptElement.getBoundingClientRect()
        const offset = window.pageYOffset + rect.top - 150 // 150px from top para subir mais
        
        window.scrollTo({
          top: offset,
          behavior: 'smooth'
        })
        
        // Focar no textarea após scroll
        setTimeout(() => {
          promptElement.focus()
        }, 500)
      }
    }, 100)
  }

  const handleManualSync = async (generationId: string) => {
    try {
      const data = await manualSync.mutateAsync(generationId)

      if (data.success) {
        // Refresh the current generation status
        const statusResponse = await fetch(`/api/generations/${generationId}`)
        const statusData = await statusResponse.json()

        if (statusData.generation) {
          setCurrentGeneration(statusData.generation)

          // If completed, add to results gallery
          if (statusData.generation.status === 'COMPLETED') {
            setGenerationResults(prev => {
              // Avoid duplicates
              const exists = prev.find(g => g.id === statusData.generation.id)
              if (!exists) {
                return [statusData.generation, ...prev]
              }
              return prev
            })
          }

          addToast({
            type: 'success',
            title: '✅ Geração sincronizada com sucesso!',
            description: `Status atualizado`
          })
        }
      } else {
        alert(data.error || 'Falha ao sincronizar status da geração')
      }
    } catch (error) {
      console.error('Error syncing generation:', error)
      addToast({
        type: 'error',
        title: 'Falha ao sincronizar',
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    }
  }

  // Formula: credits_available = (credits_limit - credits_used) + credits_balance
  const creditsRemaining = (user.creditsLimit || 0) - (user.creditsUsed || 0) + ((user as any).creditsBalance || 0)
  const creditsNeeded = settings.variations * 10
  const canGenerate = prompt.trim() && canUseCredits && !isGenerating && creditsRemaining >= creditsNeeded

  const getClassLabel = (modelClass: string) => {
    const labels = {
      MAN: 'Homem',
      WOMAN: 'Mulher',
      BOY: 'Menino',
      GIRL: 'Menina',
      ANIMAL: 'Animal'
    }
    return labels[modelClass as keyof typeof labels] || modelClass
  }

  return (
    <div className="space-y-6">
      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Model Selection and Settings */}
        <div className="lg:col-span-1 space-y-4">
          {/* Model Selection Card */}
          <Card className="border-gray-200 bg-white rounded-lg shadow-lg">
            <CardHeader>
              <CardDescription className="text-sm font-medium text-gray-900">
                Selecione qual modelo usar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-full bg-gray-200 border-gray-900 text-gray-900">
                  <SelectValue placeholder="Selecione um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name} ({getClassLabel(model.class)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Settings Card */}
          <Card className="border-gray-200 bg-white rounded-lg shadow-lg">
            <CardHeader>
              <CardDescription className="text-sm font-medium text-gray-900">
                Ajuste os parâmetros de geração
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GenerationSettings
                settings={settings}
                onSettingsChange={setSettings}
                userPlan={user.plan}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Prompt Input and Examples */}
        <div className="lg:col-span-2 space-y-4">
          {/* Prompt Card */}
          <Card className="border-gray-200 bg-white rounded-lg shadow-lg">
            <CardHeader>
              <CardDescription className="text-sm font-medium text-gray-900">
                Escreva uma descrição detalhada da foto que deseja criar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PromptInput
                prompt={prompt}
                negativePrompt={negativePrompt}
                onPromptChange={setPrompt}
                isGenerating={isGenerating}
                modelClass={selectedModelData?.class || 'MAN'}
              />

              {/* Generate Button */}
              <div className="space-y-3">
                {!canUseCredits && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-800 font-medium text-sm">Limite de Créditos Atingido</p>
                    <p className="text-red-600 text-xs mt-1">
                      Você usou todos os seus créditos este mês. Faça upgrade do seu plano para continuar gerando.
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className={`w-full shadow-lg ${
                    canGenerate
                      ? 'bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Gerar {settings.variations} Foto{settings.variations > 1 ? 's' : ''} ({settings.variations * 10} créditos)
                    </>
                  )}
                </Button>

                {!canGenerate && !isGenerating && (
                  <p className="text-xs text-gray-500 text-center">
                    {!canUseCredits
                      ? 'Limite de créditos atingido'
                      : creditsRemaining < creditsNeeded
                      ? `Precisa de ${creditsNeeded} créditos (você tem ${creditsRemaining})`
                      : null
                    }
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Examples Card - Collapsible */}
          <Card className="border-gray-200 bg-white rounded-lg shadow-lg">
            <CardContent className="pt-4">
              <Button
                variant="outline"
                onClick={() => setShowExamples(!showExamples)}
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                {showExamples ? 'Ocultar' : 'Ver'} Exemplos de Descrições
                {showExamples ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
              </Button>

              {/* Prompt Examples - Show when expanded */}
              {showExamples && (
                <div className="mt-4">
                  <PromptExamples
                    modelClass={selectedModelData?.class || 'MAN'}
                    onPromptSelect={handlePromptSelect}
                    onClose={() => setShowExamples(false)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Generation Status - Only show when failed */}
          {currentGeneration && currentGeneration.status === 'FAILED' && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-red-900">
                      Geração Falhou
                    </h3>
                    {currentGeneration.errorMessage && (
                      <p className="text-xs text-red-700 mt-1">
                        {currentGeneration.errorMessage}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentGeneration(null)}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    Fechar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Recent Results */}
      {generationResults.length > 0 && (
        <Card className="border-gray-200 bg-white rounded-lg shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-base font-semibold text-gray-900">
              <Image className="w-5 h-5 mr-2" />
              Resultados Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResultsGallery generations={generationResults.slice(0, 6)} />
          </CardContent>
        </Card>
      )}

      {/* Success Modal */}
      <GenerationResultModal
        open={showSuccessModal}
        onOpenChange={(open) => {
          setShowSuccessModal(open)
          if (!open) setSuccessImageUrl(null)
        }}
        imageUrl={successImageUrl}
        title="Imagem Gerada"
        type="image"
      />
    </div>
  )
}