'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Clock, Zap, Image, User, AlertTriangle, Sparkles, Brain, Star, Shield, ArrowLeft, Coins } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ProcessingMessage } from '@/components/ui/processing-message'
import { loadQualityFromIndexedDB, loadFilesFromIndexedDB } from '@/lib/utils/indexed-db-persistence'

type ModelStatus = 'UPLOADING' | 'PROCESSING' | 'TRAINING' | 'READY' | 'ERROR' | null

interface ModelCreationStep4Props {
  modelData: {
    name: string
    class: 'MAN' | 'WOMAN' | 'BOY' | 'GIRL' | 'ANIMAL'
    facePhotos: File[]
    halfBodyPhotos: File[]
    fullBodyPhotos: File[]
  }
  isSubmitting: boolean
  onSubmit: () => void
  onPrevStep: () => void
  pendingModelId: string | null
  pendingModelStatus: ModelStatus
  pendingModelProgress: number
  pendingModelMessage: string | null
  pendingModelError: string | null
  onViewModels: () => void
  trainingActive: boolean
}

export function ModelCreationStep4({
  modelData,
  isSubmitting,
  onSubmit,
  onPrevStep,
  pendingModelId,
  pendingModelStatus,
  pendingModelProgress,
  pendingModelMessage,
  pendingModelError,
  onViewModels,
  trainingActive
}: ModelCreationStep4Props) {
  const { addToast } = useToast()

  // State for actual photo counts and size from IndexedDB
  const [photoCounts, setPhotoCounts] = useState({
    face: modelData.facePhotos.length,
    halfBody: modelData.halfBodyPhotos.length,
    fullBody: modelData.fullBodyPhotos.length
  })
  const [totalSizeMB, setTotalSizeMB] = useState(0)

  const totalPhotos = photoCounts.face + photoCounts.halfBody + photoCounts.fullBody

  const selectedProvider = 'astria' // Provedor fixo
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [photoQualityData, setPhotoQualityData] = useState<{
    score: number
    photosWithIssues: number
    photosOk: number
    factors: string[]
    level: string
    color: string
    analyzedCount: number
  } | null>(null)
  const [modelCostInfo, setModelCostInfo] = useState<{
    currentModels: number
    freeModelsAvailable: number
    nextModelCost: number
    canAffordNextModel: boolean
    creditsAvailable: number
    needsCredits: boolean
    message?: string
  } | null>(null)

  // Load photo counts and total size from IndexedDB
  useEffect(() => {
    async function loadPhotoCounts() {
      const [faceFiles, halfBodyFiles, fullBodyFiles] = await Promise.all([
        loadFilesFromIndexedDB('model_facePhotos'),
        loadFilesFromIndexedDB('model_halfBodyPhotos'),
        loadFilesFromIndexedDB('model_fullBodyPhotos')
      ])

      const counts = {
        face: faceFiles.length,
        halfBody: halfBodyFiles.length,
        fullBody: fullBodyFiles.length
      }

      // Calculate total size
      const totalBytes =
        faceFiles.reduce((acc, file) => acc + file.size, 0) +
        halfBodyFiles.reduce((acc, file) => acc + file.size, 0) +
        fullBodyFiles.reduce((acc, file) => acc + file.size, 0)

      const sizeMB = totalBytes / (1024 * 1024)

      console.log(`✅ [Step 4] Loaded photo counts from IndexedDB: Face=${counts.face}, HalfBody=${counts.halfBody}, FullBody=${counts.fullBody}, Total=${counts.face + counts.halfBody + counts.fullBody}, Size=${sizeMB.toFixed(1)}MB`)

      setPhotoCounts(counts)
      setTotalSizeMB(sizeMB)
    }
    loadPhotoCounts()
  }, []) // Run once on mount

  // Load quality analysis from IndexedDB
  useEffect(() => {
    async function loadQualityAnalysis() {
      const result = await analyzePhotoQuality()
      setPhotoQualityData(result)
    }
    loadQualityAnalysis()
  }, []) // Run once on mount

  useEffect(() => {
    // Fetch model cost info
    async function fetchCostInfo() {
      try {
        const response = await fetch('/api/models/cost-info')
        if (response.ok) {
          const data = await response.json()
          setModelCostInfo(data)
        }
      } catch (error) {
        console.error('Failed to fetch model cost info:', error)
      }
    }

    fetchCostInfo()
  }, [])

  const estimatedTrainingTime = selectedProvider === 'astria'
    ? Math.max(10, Math.min(25, totalPhotos * 1.0)) // Astria é mais rápida (10-25 min)
    : Math.max(15, Math.min(45, totalPhotos * 1.5)) // Replicate (15-45 min)

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

  // Cálculo da avaliação de quantidade de fotos
  const minPhotos = 8 // 4 rosto + 2 meio corpo + 2 corpo inteiro (mínimo)
  const maxPhotos = 15 // 8 rosto + 4 meio corpo + 3 corpo inteiro (máximo ideal)
  const quantityScore = Math.min((totalPhotos - minPhotos) / (maxPhotos - minPhotos), 1)

  const getQuantityQuality = () => {
    if (totalPhotos < minPhotos) return { level: 'RUIM', color: 'bg-red-500' }
    if (quantityScore < 0.3) return { level: 'RUIM', color: 'bg-red-500' }
    if (quantityScore < 0.7) return { level: 'RAZOÁVEL', color: 'bg-yellow-500' }
    return { level: 'EXCELENTE', color: 'bg-green-500' }
  }

  // Análise de qualidade das fotos baseada na análise AI (OpenAI GPT-4o)
  const analyzePhotoQuality = async () => {
    const factors = []
    let photosWithIssues = 0
    let photosOk = 0
    let analyzedCount = 0

    // Load quality results from IndexedDB
    try {
      const [faceQualityMap, halfBodyQualityMap, fullBodyQualityMap] = await Promise.all([
        loadQualityFromIndexedDB('facePhotosQuality'),
        loadQualityFromIndexedDB('halfBodyPhotosQuality'),
        loadQualityFromIndexedDB('fullBodyPhotosQuality')
      ])

      // Convert Maps to arrays for processing
      const faceResults = Array.from(faceQualityMap.entries())
      const halfBodyResults = Array.from(halfBodyQualityMap.entries())
      const fullBodyResults = Array.from(fullBodyQualityMap.entries())

      const allResults = [...faceResults, ...halfBodyResults, ...fullBodyResults]

      console.log(`✅ [Step 4] Loaded quality results: Face=${faceResults.length}, HalfBody=${halfBodyResults.length}, FullBody=${fullBodyResults.length}`)

      if (allResults.length > 0) {
        // Count photos with/without issues
        allResults.forEach(([index, result]: any) => {
          if (result?.quality) {
            analyzedCount++
            if (result.quality.hasIssues) {
              photosWithIssues++
            } else {
              photosOk++
            }
          }
        })

        // Build factors based on binary analysis
        if (photosWithIssues === 0) {
          factors.push('✅ Todas as fotos aprovadas')
        } else {
          const percentage = Math.round((photosWithIssues / analyzedCount) * 100)
          if (percentage >= 50) {
            factors.push(`❌ ${photosWithIssues} fotos com problemas (${percentage}%)`)
          } else if (percentage >= 25) {
            factors.push(`⚠️ ${photosWithIssues} fotos com problemas (${percentage}%)`)
          } else {
            factors.push(`⚠️ ${photosWithIssues} foto(s) com problemas`)
          }
        }

        // Count critical issues across all photos
        const criticalIssuesCount = allResults.reduce((count: number, [, result]: any) => {
          return count + (result?.quality?.criticalIssues?.length || 0)
        }, 0)

        if (criticalIssuesCount === 0) {
          factors.push('Nenhum problema crítico')
        } else {
          factors.push(`${criticalIssuesCount} problema(s) crítico(s)`)
        }

        // Determine level based on photos with issues
        const percentageWithIssues = analyzedCount > 0 ? photosWithIssues / analyzedCount : 0
        const level = percentageWithIssues > 0.3 ? 'RUIM' : percentageWithIssues > 0 ? 'RAZOÁVEL' : 'EXCELENTE'
        const color = percentageWithIssues > 0.3 ? 'bg-red-500' : percentageWithIssues > 0 ? 'bg-yellow-500' : 'bg-green-500'

        return {
          score: 1 - percentageWithIssues,
          photosWithIssues,
          photosOk,
          factors,
          level,
          color,
          analyzedCount
        }
      }
    } catch (error) {
      console.error('Error loading quality results:', error)
    }

    // Fallback if no AI analysis available
    factors.push('Análise AI não disponível')
    factors.push('Por favor, aguarde a análise das fotos')

    return {
      score: 0.5,
      photosWithIssues: 0,
      photosOk: 0,
      factors,
      level: 'RAZOÁVEL',
      color: 'bg-yellow-500',
      analyzedCount: 0
    }
  }

  const quantityQuality = getQuantityQuality()

  // Use photoQualityData from state (loaded via useEffect) with fallback
  const photoQuality = photoQualityData || {
    score: 0.5,
    photosWithIssues: 0,
    photosOk: 0,
    factors: ['Carregando análise...'],
    level: 'RAZOÁVEL',
    color: 'bg-yellow-500',
    analyzedCount: 0
  }

  const qualityChecks = [
    {
      check: 'Quantidade de Fotos',
      passed: totalPhotos >= minPhotos,
      required: true,
      description: `${totalPhotos} fotos enviadas (mín: ${minPhotos}, ideal: ${maxPhotos})`,
      progress: quantityQuality.level === 'RUIM' ? 25 : quantityQuality.level === 'RAZOÁVEL' ? 60 : 100,
      quality: quantityQuality
    },
    {
      check: 'Qualidade das Fotos',
      passed: photoQuality.score >= 0.4,
      required: false, // ← Quality is a warning, not a blocker
      description: photoQuality.factors.join(' • '),
      progress: photoQuality.level === 'RUIM' ? 25 : photoQuality.level === 'RAZOÁVEL' ? 60 : 100,
      quality: photoQuality
    }
  ]

  const allRequiredPassed = qualityChecks.filter(c => c.required).every(c => c.passed) &&
    consentAccepted &&
    (modelCostInfo === null || modelCostInfo.canAffordNextModel)

  const statusLabelMap: Record<Exclude<ModelStatus, null>, string> = {
    UPLOADING: 'Enviando fotos',
    PROCESSING: 'Processando dados',
    TRAINING: 'Treinando modelo',
    READY: 'Pronto',
    ERROR: 'Erro'
  }

  const defaultStatusMessage: Record<Exclude<ModelStatus, null>, string> = {
    UPLOADING: 'Estamos subindo suas fotos com segurança.',
    PROCESSING: 'Organizando e validando suas fotos antes do treinamento.',
    TRAINING: 'O Astria está treinando o seu modelo. Isso pode levar alguns minutos.',
    READY: 'Modelo finalizado! Você já pode usar esse modelo em suas criações.',
    ERROR: 'Algo deu errado no treinamento. Revise as fotos e tente novamente.'
  }

  const showTrainingStatus = Boolean(
    pendingModelId &&
    (pendingModelStatus || isSubmitting || trainingActive)
  )

  const currentStatus: ModelStatus =
    pendingModelStatus ||
    (isSubmitting ? 'UPLOADING' : null)

  const statusMessage =
    (pendingModelMessage && pendingModelMessage.trim().length > 0
      ? pendingModelMessage
      : (currentStatus ? defaultStatusMessage[currentStatus] : null)) ||
    'Preparando o treinamento do seu modelo.'

  const progressValue = Math.min(
    100,
    Math.max(
      currentStatus === 'READY'
        ? 100
        : currentStatus === 'ERROR'
          ? pendingModelProgress || 0
          : pendingModelProgress || (isSubmitting ? 10 : 0),
      0
    )
  )

  return (
    <div className="space-y-4" style={{fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
      {/* Model Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Detalhes do Modelo</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Nome:</span>
                <span className="font-medium text-gray-900">{modelData.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Classe:</span>
                <span className="font-medium text-gray-900">{getClassLabel(modelData.class)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Total de Fotos:</span>
                <span className="font-medium text-gray-900">{totalPhotos}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Tamanho Total:</span>
                <span className="font-medium text-gray-900">{totalSizeMB.toFixed(1)} MB</span>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>


      {/* Credit Cost Warning */}
      {modelCostInfo && (
        <Card className={modelCostInfo.nextModelCost > 0 ? "border-purple-200 bg-purple-50" : "border-green-200 bg-green-50"}>
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <Coins className={modelCostInfo.nextModelCost > 0 ? "text-purple-600 flex-shrink-0" : "text-green-600 flex-shrink-0"} size={20} />
              <div className="flex-1">
                <h4 className={`text-sm font-semibold mb-1 ${modelCostInfo.nextModelCost > 0 ? "text-purple-900" : "text-green-900"}`}>
                  {modelCostInfo.nextModelCost === 0 ? "Modelo Gratuito" : "Modelo Adicional"}
                </h4>
                {modelCostInfo.nextModelCost === 0 ? (
                  <p className="text-xs text-green-700">
                    Este é o seu primeiro modelo e está incluso gratuitamente na sua assinatura.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-purple-700">
                      Este modelo custará <strong>{modelCostInfo.nextModelCost} créditos</strong>. Você possui <strong>{modelCostInfo.creditsAvailable} créditos</strong> disponíveis.
                    </p>
                    {!modelCostInfo.canAffordNextModel && (
                      <div className="flex items-center gap-2 p-2 bg-red-100 rounded-lg">
                        <AlertTriangle className="text-red-600" size={16} />
                        <p className="text-xs text-red-700">
                          Créditos insuficientes. Você precisa de mais {modelCostInfo.nextModelCost - modelCostInfo.creditsAvailable} créditos.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quality Checks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Verificações de Qualidade</CardTitle>
          <CardDescription className="text-sm">
            Validando se suas fotos atendem aos requisitos de treinamento
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {qualityChecks.map((check, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{check.check}</p>
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-0.5 rounded text-xs font-medium ${
                      check.quality.level === 'EXCELENTE'
                        ? 'bg-green-100 text-green-800'
                        : check.quality.level === 'RAZOÁVEL'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {check.quality.level}
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${check.quality.color}`}
                      style={{ width: `${check.progress}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-600">{check.description}</p>
              </div>
            ))}
          </div>

        </CardContent>
      </Card>



      {/* Consent and Terms */}
      <Card className="bg-gray-100 border-gray-300">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="consent"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="mt-1 rounded border-gray-400 bg-white text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-100"
              />
              <label htmlFor="consent" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
                Eu aceito os{' '}
                <a href="/termos-de-uso" target="_blank" className="text-purple-600 hover:text-purple-700 underline">
                  Termos de Uso
                </a>
                , confirmo ter lido a{' '}
                <a href="/politica-privacidade" target="_blank" className="text-purple-600 hover:text-purple-700 underline">
                  Política de Privacidade
                </a>
                {' '}e declaro possuir todos os direitos sobre as fotos enviadas, incluindo consentimento das pessoas fotografadas.
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Training Status */}
      {showTrainingStatus && (
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-purple-900">Status do Treinamento</p>
                <p className="text-xs text-purple-700">
                  {currentStatus ? statusLabelMap[currentStatus] : 'Inicializando'}
                </p>
              </div>
              <Badge className="bg-purple-600 text-white">
                {currentStatus ? statusLabelMap[currentStatus] : 'Preparando'}
              </Badge>
            </div>

            <div>
              <div className="w-full bg-purple-200/70 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-purple-600 transition-all duration-500"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-purple-800">{statusMessage}</p>
            </div>

            {pendingModelError && (
              <div className="text-xs text-red-700 bg-red-100 border border-red-200 rounded-md p-2">
                {pendingModelError}
              </div>
            )}

            <div className="flex flex-wrap gap-2 text-xs text-purple-800">
              <span>• Não feche esta aba enquanto as fotos são enviadas</span>
              <span>• Você pode acompanhar em Meus Modelos após o envio</span>
              <span>• Vamos manter este painel atualizado em tempo real</span>
            </div>

            {currentStatus === 'READY' && (
              <Button
                size="sm"
                variant="outline"
                className="border-purple-400 text-purple-900 hover:bg-purple-100"
                onClick={onViewModels}
              >
                Ver modelo treinado
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* While You Wait */}
      <Card className="bg-[#34495E] border-[#4A5F7A]">
        <CardContent className="p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Enquanto Você Espera</h4>
          <div className="text-xs text-gray-400 space-y-1">
            <p>• Acompanhe o status em tempo real nesta página ou em Meus Modelos</p>
            <p>• Você pode continuar usando o app enquanto o treino acontece</p>
            <p>• Mostramos avisos na interface assim que tudo for concluído</p>
            <p>• O treinamento geralmente leva cerca de {estimatedTrainingTime} minutos</p>
          </div>
        </CardContent>
      </Card>

      {/* Start Training */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="lg"
                onClick={onPrevStep}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Anterior
              </Button>

              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">~{estimatedTrainingTime}</div>
                <div className="text-sm text-gray-600">minutos para completar</div>
              </div>

              <Button
                onClick={() => {
                  if (!consentAccepted) {
                    addToast({
                      title: "Termos não aceitos",
                      description: "Por favor, aceite os termos de consentimento para continuar.",
                      type: "error"
                    })
                    return
                  }
                  if (modelCostInfo && !modelCostInfo.canAffordNextModel) {
                    addToast({
                      title: "Créditos insuficientes",
                      description: `Você precisa de ${modelCostInfo.nextModelCost} créditos, mas possui apenas ${modelCostInfo.creditsAvailable}.`,
                      type: "error"
                    })
                    return
                  }
                  if (!allRequiredPassed) {
                    addToast({
                      title: "Requisitos não atendidos",
                      description: "Verifique todos os requisitos antes de continuar.",
                      type: "error"
                    })
                    return
                  }
                  onSubmit()
                }}
                disabled={!allRequiredPassed || isSubmitting || trainingActive}
                size="lg"
                className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 text-white border-0"
              >
                {(isSubmitting || trainingActive) ? (
                  <>
                    <Clock className="w-5 h-5 mr-2 animate-spin" />
                    {trainingActive ? 'Treinando modelo...' : 'Preparando...'}
                  </>
                ) : (
                  'Criar Modelo'
                )}
              </Button>
            </div>

            {/* Processing Message */}
            <ProcessingMessage 
              isProcessing={isSubmitting || trainingActive} 
              type="model" 
            />

            {!consentAccepted && (
              <p className="text-sm text-red-600 mt-2">
                Por favor, aceite os termos de consentimento para continuar
              </p>
            )}

            {modelCostInfo && !modelCostInfo.canAffordNextModel && (
              <p className="text-sm text-red-600 mt-2">
                Créditos insuficientes. Você precisa de {modelCostInfo.nextModelCost} créditos para criar este modelo.
              </p>
            )}

          </div>
        </CardContent>
      </Card>
    </div>
  )
}