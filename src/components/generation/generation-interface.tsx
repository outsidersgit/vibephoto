'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'
import { useToast } from '@/hooks/use-toast'
import { useImageGeneration, useManualSync } from '@/hooks/useImageGeneration'
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
  Eye
} from 'lucide-react'
import { ModelSelector } from './model-selector'
import { PromptInput } from './prompt-input'
import { GenerationSettings } from './generation-settings'
import { ResultsGallery } from './results-gallery'
import { PromptExamples } from './prompt-examples'
import { ImageModal } from '@/components/gallery/image-modal'

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
  const router = useRouter()
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

  // Toast notifications
  const { addToast } = useToast()

  // React Query hooks
  const generateImage = useImageGeneration()
  const manualSync = useManualSync()
  const isGenerating = generateImage.isPending

  // Real-time updates for generation status
  useRealtimeUpdates({
    onGenerationStatusChange: (generationId, status, data) => {
      console.log(`🔄 Real-time generation update: ${generationId} -> ${status}`)
      
      // Update current generation if it matches
      if (currentGeneration?.id === generationId) {
        setCurrentGeneration((prev: any) => ({
          ...prev,
          status,
          imageUrls: data.imageUrls || prev.imageUrls,
          thumbnailUrls: data.thumbnailUrls || prev.thumbnailUrls,
          processingTime: data.processingTime || prev.processingTime,
          errorMessage: data.errorMessage || prev.errorMessage
        }))

        // If completed successfully, show success message and redirect
        if (status === 'COMPLETED' && data.imageUrls && data.imageUrls.length > 0) {
          const completedGeneration = { ...currentGeneration, ...data, status }
          
          setGenerationResults(prevResults => [
            completedGeneration,
            ...prevResults
          ])
          
          // Show success message immediately (webhook guarantees DB is updated)
          addToast({
            type: 'success',
            title: '🎉 Sua imagem está pronta!',
            description: `${data.imageUrls.length} imagem${data.imageUrls.length > 1 ? 's' : ''} disponível${data.imageUrls.length > 1 ? 'eis' : ''} na galeria • Redirecionando em instantes...`,
            duration: 4000
          })

          // Show success modal
          setSuccessImageUrl(data.imageUrls[0])
          setShowSuccessModal(true)

          // Redirect to gallery after 2 seconds
          setTimeout(() => {
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
    }
  })
  
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

  const selectedModelData = models.find(m => m.id === selectedModel)

  const handleGenerate = async () => {
    if (!prompt.trim() || !canUseCredits) return

    setCurrentGeneration(null)

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

      setCurrentGeneration(generation)
      console.log('🚀 Generation started, waiting for real-time updates...')
    } catch (error) {
      console.error('Generation request error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      alert(`Erro ao iniciar geração: ${errorMessage}`)
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
            <div key={step.number} className="flex flex-col sm:flex-row items-center w-full sm:w-auto">
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
                <div className="ml-3">
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Generation Status - Only show when processing or when verified in gallery */}
        {currentGeneration && (currentGeneration.status === 'PROCESSING' || currentGeneration.status === 'FAILED') && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-blue-900 font-[system-ui,-apple-system,'SF Pro Display',sans-serif]">
                    {currentGeneration.status === 'PROCESSING' ? 'Gerando Fotos...' : 'Geração Falhou'}
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  {currentGeneration.status === 'PROCESSING' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleManualSync(currentGeneration.id)}
                      className="text-blue-600 border-blue-300 hover:bg-blue-50"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Sincronizar
                    </Button>
                  )}
                  <div className="text-right">
                    {currentGeneration.status === 'PROCESSING' ? (
                      <div className="flex items-center text-blue-600">
                        <Clock className="w-4 h-4 mr-1 animate-pulse" />
                        <span className="text-sm">~30 segundos</span>
                      </div>
                    ) : (
                      <Badge variant="default">
                        {currentGeneration.imageUrls?.length || 0} imagens
                      </Badge>
                    )}
                  </div>
                </div>
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

      {/* Success Modal */}
      {showSuccessModal && successImageUrl && (
        <ImageModal
          imageUrl={successImageUrl}
          onClose={() => {
            setShowSuccessModal(false)
            setSuccessImageUrl(null)
          }}
          generations={generationResults}
        />
      )}
    </div>
    </div>
  )
}