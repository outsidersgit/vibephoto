'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Clock, Zap, Image, User, AlertTriangle, Sparkles, Brain, Star, Shield, ArrowLeft, Coins } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ModelCreationStep3Props {
  modelData: {
    name: string
    class: 'MAN' | 'WOMAN' | 'BOY' | 'GIRL' | 'ANIMAL'
    facePhotos: File[]
    halfBodyPhotos: File[]
    fullBodyPhotos: File[]
  }
  isSubmitting: boolean
  onSubmit: (provider: 'astria', classWord: string) => void
  onPrevStep: () => void
}

export function ModelCreationStep4({ modelData, isSubmitting, onSubmit, onPrevStep }: ModelCreationStep3Props) {
  const { addToast } = useToast()
  const totalPhotos = modelData.facePhotos.length + modelData.halfBodyPhotos.length + modelData.fullBodyPhotos.length
  const totalSizeMB = (modelData.facePhotos.reduce((acc, file) => acc + file.size, 0) +
                      modelData.halfBodyPhotos.reduce((acc, file) => acc + file.size, 0) +
                      modelData.fullBodyPhotos.reduce((acc, file) => acc + file.size, 0)) / (1024 * 1024)

  const selectedProvider = 'astria' // Provedor fixo
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [modelCostInfo, setModelCostInfo] = useState<{
    currentModels: number
    freeModelsAvailable: number
    nextModelCost: number
    canAffordNextModel: boolean
    creditsAvailable: number
    needsCredits: boolean
    message?: string
  } | null>(null)

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
  const minPhotos = 15 // 5 rosto + 5 meio corpo + 5 corpo inteiro (mínimo)
  const maxPhotos = 30 // 10 rosto + 10 meio corpo + 10 corpo inteiro (máximo ideal)
  const quantityScore = Math.min((totalPhotos - minPhotos) / (maxPhotos - minPhotos), 1)

  const getQuantityQuality = () => {
    if (totalPhotos < minPhotos) return { level: 'RUIM', color: 'bg-red-500' }
    if (quantityScore < 0.3) return { level: 'RUIM', color: 'bg-red-500' }
    if (quantityScore < 0.7) return { level: 'RAZOÁVEL', color: 'bg-yellow-500' }
    return { level: 'EXCELENTE', color: 'bg-green-500' }
  }

  // Análise de qualidade das fotos baseada em múltiplos fatores
  const analyzePhotoQuality = () => {
    let qualityScore = 0
    const factors = []

    // 1. Análise de resolução baseada no tamanho dos arquivos
    const avgFileSize = totalSizeMB / totalPhotos
    if (avgFileSize < 0.5) {
      factors.push('Fotos muito pequenas (baixa resolução)')
      qualityScore += 0.2
    } else if (avgFileSize < 1.5) {
      factors.push('Resolução adequada')
      qualityScore += 0.6
    } else if (avgFileSize < 4) {
      factors.push('Boa resolução')
      qualityScore += 0.9
    } else {
      factors.push('Alta resolução')
      qualityScore += 1.0
    }

    // 2. Análise de variedade de tamanhos (indica diferentes tipos de fotos)
    const allFiles = [...modelData.facePhotos, ...modelData.halfBodyPhotos, ...modelData.fullBodyPhotos]
    const fileSizes = allFiles.map(f => f.size / (1024 * 1024))
    const sizeVariation = fileSizes.length > 0 ? (Math.max(...fileSizes) - Math.min(...fileSizes)) / Math.max(...fileSizes) : 0

    if (sizeVariation > 0.5) {
      factors.push('Boa variedade de tipos de foto')
      qualityScore += 0.8
    } else if (sizeVariation > 0.2) {
      factors.push('Variedade moderada')
      qualityScore += 0.5
    } else {
      factors.push('Fotos muito similares')
      qualityScore += 0.2
    }

    // 3. Análise de distribuição por categoria
    const faceRatio = modelData.facePhotos.length / totalPhotos
    const halfRatio = modelData.halfBodyPhotos.length / totalPhotos
    const fullRatio = modelData.fullBodyPhotos.length / totalPhotos

    // Distribuição ideal: ~20% rosto, ~30% meio corpo, ~50% corpo inteiro
    const distributionScore = 1 - (Math.abs(faceRatio - 0.2) + Math.abs(halfRatio - 0.3) + Math.abs(fullRatio - 0.5)) / 2

    if (distributionScore > 0.8) {
      factors.push('Distribuição ideal de categorias')
      qualityScore += 1.0
    } else if (distributionScore > 0.6) {
      factors.push('Boa distribuição de categorias')
      qualityScore += 0.7
    } else {
      factors.push('Distribuição irregular das categorias')
      qualityScore += 0.3
    }

    // Normalizar score (máximo possível: 2.8, normalizar para 0-1)
    const normalizedScore = Math.min(qualityScore / 2.8, 1)

    return {
      score: normalizedScore,
      factors,
      level: normalizedScore < 0.4 ? 'RUIM' : normalizedScore < 0.7 ? 'RAZOÁVEL' : 'EXCELENTE',
      color: normalizedScore < 0.4 ? 'bg-red-500' : normalizedScore < 0.7 ? 'bg-yellow-500' : 'bg-green-500'
    }
  }

  const photoQuality = analyzePhotoQuality()
  const quantityQuality = getQuantityQuality()

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
      required: true,
      description: photoQuality.factors.join(' • '),
      progress: photoQuality.level === 'RUIM' ? 25 : photoQuality.level === 'RAZOÁVEL' ? 60 : 100,
      quality: photoQuality
    }
  ]

  const allRequiredPassed = qualityChecks.filter(c => c.required).every(c => c.passed) &&
    consentAccepted &&
    (modelCostInfo === null || modelCostInfo.canAffordNextModel)

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

      {/* While You Wait */}
      <Card className="bg-[#34495E] border-[#4A5F7A]">
        <CardContent className="p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Enquanto Você Espera</h4>
          <div className="text-xs text-gray-400 space-y-1">
            <p>• Você receberá uma notificação por email quando o treinamento estiver completo</p>
            <p>• Você pode fechar esta página e verificar mais tarde</p>
            <p>• O progresso ficará visível no seu painel de modelos</p>
            <p>• O treinamento geralmente leva {estimatedTrainingTime} minutos</p>
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
                  onSubmit(selectedProvider, modelData.class.toLowerCase())
                }}
                disabled={!allRequiredPassed || isSubmitting}
                size="lg"
                className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 text-white border-0"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="w-5 h-5 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Modelo'
                )}
              </Button>
            </div>

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