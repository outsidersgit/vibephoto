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
import { Badge } from '@/components/ui/badge'
import {
  Play,
  Sparkles,
  Settings,
  Image,
  Zap,
  Clock,
  RefreshCw,
  Download,
  Heart,
  Share2,
  Copy,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Check,
  FileText,
  Eye,
  X
} from 'lucide-react'
import { ModelSelector } from './model-selector'
import { PromptInput } from './prompt-input'
import { GenerationSettings } from './generation-settings'
import { ResultsGallery } from './results-gallery'
import { PromptExamples } from './prompt-examples'

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
  const [currentStep, setCurrentStep] = useState(1)
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

  const steps = [
    { number: 1, title: 'Escolher Modelo', description: 'Selecione qual modelo de IA usar' },
    { number: 2, title: 'Descrever Imagem', description: 'Escreva uma descrição detalhada' },
    { number: 3, title: 'Revisar e Gerar', description: 'Confirme os detalhes e gere sua foto' }
  ]

  const isStepComplete = (stepNumber: number) => {
    switch (stepNumber) {
      case 1: return !!selectedModel
      case 2: return !!prompt.trim()
      case 3: return !!selectedModel && !!prompt.trim()
      default: return false
    }
  }

  const goToStep = (stepNumber: number) => {
    if (stepNumber <= 3) {
      setCurrentStep(stepNumber)
    }
  }

  return (
    <div className="space-y-8">
      {/* Step Navigation */}
      <div className="bg-white rounded-lg border p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4 sm:gap-0">
          {steps.map((step, index) => (
            <div key={step.number} className="flex flex-col sm:flex-row items-start sm:items-center w-full sm:w-auto">
              <div
                className={`flex items-center cursor-pointer ${
                  currentStep === step.number ? 'text-purple-600' :
                  isStepComplete(step.number) ? 'text-green-600' : 'text-gray-400'
                }`}
                onClick={() => goToStep(step.number)}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 flex-shrink-0 ${
                  currentStep === step.number ? 'border-purple-600 bg-purple-50' :
                  isStepComplete(step.number) ? 'border-green-600 bg-green-50' : 'border-gray-300 bg-gray-50'
                }`}>
                  {isStepComplete(step.number) && currentStep !== step.number ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="font-semibold">{step.number}</span>
                  )}
                </div>
                <div className="ml-3 text-left">
                  <div className="font-medium text-sm sm:text-base">{step.title}</div>
                  <div className="text-xs sm:text-sm text-gray-500">{step.description}</div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <ChevronRight className="hidden sm:block w-5 h-5 mx-6 text-slate-300" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Generation Controls */}
        <div className="lg:col-span-2 space-y-6">
        {/* Step 1: Model Selection */}
        {currentStep === 1 && (
          <Card className="border-2 border-slate-600/30 bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569]">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center mr-3">
                  <span className="text-white font-bold">1</span>
                </div>
                Escolher Modelo de IA
              </CardTitle>
              <CardDescription className="text-gray-400">
                Selecione qual modelo de IA personalizado usar para gerar suas fotos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ModelSelector
                models={models}
                selectedModelId={selectedModel}
                onModelSelect={setSelectedModel}
              />
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => goToStep(2)}
                  disabled={!selectedModel}
                  className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-[#667EEA] shadow-lg shadow-[#667EEA]/25"
                >
                  Próximo
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Prompt Input */}
        {currentStep === 2 && (
          <Card className="border-2 border-slate-600/30 bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569]">
            <CardHeader>
              <CardTitle className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center mr-3">
                  <span className="text-white font-bold">2</span>
                </div>
                <span className="text-white">Descrever sua Foto</span>
              </CardTitle>
              <CardDescription className="text-gray-400">
                Escreva uma descrição detalhada da foto que deseja criar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PromptInput
                prompt={prompt}
                negativePrompt={negativePrompt}
                onPromptChange={setPrompt}
                onNegativePromptChange={setNegativePrompt}
                isGenerating={isGenerating}
                modelClass={selectedModelData?.class || 'MAN'}
              />


              <div className="mt-6 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => goToStep(1)}
                  className="border-slate-400 text-slate-600 hover:bg-slate-50"
                >
                  <ChevronRight className="w-4 h-4 mr-2 rotate-180" />
                  Voltar
                </Button>
                <Button
                  onClick={() => goToStep(3)}
                  disabled={!prompt.trim()}
                  className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-[#667EEA] shadow-lg shadow-[#667EEA]/25"
                >
                  Próximo
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review and Generate */}
        {currentStep === 3 && (
          <>
            {/* Configurations First */}
            <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border-slate-600/30">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <Settings className="w-4 h-4 mr-2" />
                  Configurações
                </CardTitle>
                <CardDescription className="text-gray-400">
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

            {/* Review Summary */}
            <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border-slate-600/30">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center mr-3">
                    <span className="text-white font-bold">3</span>
                  </div>
                  Revisar e Gerar
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Confirme os detalhes da sua geração
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Summary */}
                <div className="space-y-2">
                  <div className="p-2 bg-slate-700 rounded">
                    <h4 className="text-xs font-medium text-white mb-1">Modelo:</h4>
                    <p className="text-xs text-slate-300">{selectedModelData?.name}</p>
                  </div>

                  <div className="p-2 bg-slate-700 rounded">
                    <h4 className="text-xs font-medium text-white mb-1">Descrição:</h4>
                    <p className="text-xs text-slate-300 line-clamp-2">{prompt || 'Nenhuma descrição fornecida'}</p>
                  </div>

                  <div className="p-2 bg-slate-700 rounded">
                    <h4 className="text-xs font-medium text-white mb-1">Resumo:</h4>
                    <div className="space-y-1">
                      <p className="text-xs text-slate-300">• {settings.variations} variação{settings.variations > 1 ? 'ões' : ''}</p>
                      <p className="text-xs text-slate-300">• {settings.aspectRatio}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => goToStep(2)}
                    className="border-slate-400 text-slate-600 hover:bg-slate-50"
                  >
                    <ChevronRight className="w-4 h-4 mr-2 rotate-180" />
                    Voltar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Generate Button - Only show on step 3 */}
        {currentStep === 3 && (
          <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border-slate-600/30">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                {!canUseCredits && (
                  <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 mb-4">
                    <p className="text-red-300 font-medium">Limite de Créditos Atingido</p>
                    <p className="text-red-400 text-sm">
                      Você usou todos os seus créditos este mês. Faça upgrade do seu plano para continuar gerando.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-center space-x-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">{settings.variations}</div>
                    <div className="text-sm text-gray-400">variações</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">{settings.variations * 10}</div>
                    <div className="text-sm text-gray-400">créditos</div>
                  </div>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  size="lg"
                  className="w-full max-w-md bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-[#667EEA] shadow-lg shadow-[#667EEA]/25"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Gerar {settings.variations} Foto{settings.variations > 1 ? 's' : ''}
                    </>
                  )}
                </Button>

                {!canGenerate && !isGenerating && (
                  <p className="text-sm text-gray-400">
                    {!prompt.trim()
                      ? 'Digite um prompt para gerar fotos'
                      : !canUseCredits
                      ? 'Limite de créditos atingido'
                      : creditsRemaining < creditsNeeded
                      ? `Precisa de ${creditsNeeded} créditos (você tem ${creditsRemaining})`
                      : 'Pronto para gerar'
                    }
                  </p>
                )}

                {/* Info message after generation */}
                <p className="text-xs text-gray-500 mt-2">
                  💡 Após gerar, acesse a <Link href="/gallery" className="text-purple-400 hover:text-purple-300 underline">galeria</Link> para visualizar suas imagens
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Generation Status - Only show when failed (processing status is handled by button state) */}
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

      {/* Right Column - Examples and Results */}
      <div className="space-y-6">

        {/* Toggle for Examples - Only show on step 2 */}
        {currentStep === 2 && (
          <>
            <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border-slate-600/30">
              <CardContent className="pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowExamples(!showExamples)}
                  className="w-full border-slate-600/30 text-slate-300 hover:bg-slate-600 bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569]"
                >
                  {showExamples ? 'Ocultar' : 'Ver'} Exemplos de Descrições
                  {showExamples ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
                </Button>
              </CardContent>
            </Card>

            {/* Prompt Examples - Only show when toggle is on */}
            {showExamples && (
              <PromptExamples
                modelClass={selectedModelData?.class || 'MAN'}
                onPromptSelect={handlePromptSelect}
              />
            )}
          </>
        )}

        {/* Recent Results */}
        {generationResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Image className="w-5 h-5 mr-2" />
                Resultados Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResultsGallery generations={generationResults.slice(0, 6)} />
            </CardContent>
          </Card>
        )}

      </div>

      {/* Success Modal - Simple image preview */}
      {showSuccessModal && successImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={() => {
                setShowSuccessModal(false)
                setSuccessImageUrl(null)
              }}
              className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <img
              src={successImageUrl}
              alt="Generated image"
              className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
    </div>
  )
}