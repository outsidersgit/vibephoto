'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, X, User, Users, Heart, AlertCircle, CheckCircle, Shield, ExternalLink, Coins, Loader2, RefreshCw, Info } from 'lucide-react'
import Link from 'next/link'
import { ImageQualityAnalysisResult, getStatusColor, getStatusIcon, getStatusLabel, CRITICAL_ISSUE_LABELS, MINOR_ISSUE_LABELS } from '@/types/image-quality'

interface ModelCreationStep1Props {
  modelData: {
    name: string
    class: 'MAN' | 'WOMAN' | 'BOY' | 'GIRL' | 'ANIMAL'
    facePhotos: File[]
  }
  setModelData: (data: any) => void
  modelCostInfo?: any
}

export function ModelCreationStep1({ modelData, setModelData, modelCostInfo }: ModelCreationStep1Props) {
  const [dragActive, setDragActive] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [qualityResults, setQualityResults] = useState<Map<number, ImageQualityAnalysisResult>>(new Map())
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const classOptions = [
    { value: 'MAN', label: 'Homem', icon: User, description: 'Pessoa adulta do sexo masculino' },
    { value: 'WOMAN', label: 'Mulher', icon: User, description: 'Pessoa adulta do sexo feminino' },
    { value: 'BOY', label: 'Menino', icon: Users, description: 'Pessoa jovem do sexo masculino' },
    { value: 'GIRL', label: 'Menina', icon: Users, description: 'Pessoa jovem do sexo feminino' },
    { value: 'ANIMAL', label: 'Animal', icon: Heart, description: 'Pet ou animal de estimação' }
  ]

  const validateFile = (file: File): string[] => {
    const errors: string[] = []

    if (!file.type.startsWith('image/')) {
      errors.push('File must be an image')
    }

    if (file.size > 10 * 1024 * 1024) {
      errors.push('File size must be less than 10MB')
    }

    return errors
  }

  const validateImage = (file: File): Promise<string[]> => {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        const errors: string[] = []

        if (img.width < 256 || img.height < 256) {
          errors.push('Image must be at least 256x256 pixels')
        }

        const aspectRatio = img.width / img.height
        if (aspectRatio < 0.5 || aspectRatio > 2) {
          errors.push('Image aspect ratio should be closer to square')
        }

        URL.revokeObjectURL(url)
        resolve(errors)
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(['Invalid image file'])
      }

      img.src = url
    })
  }

  // Analyze photo quality using AI
  const analyzePhotoQuality = async (files: File[], startIndex: number) => {
    setIsAnalyzing(true)

    try {
      const formData = new FormData()
      formData.append('photoType', 'face')
      formData.append('modelClass', modelData.class)

      files.forEach((file, index) => {
        formData.append(`photo_${index}`, file)
      })

      const response = await fetch('/api/models/validate-photos', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to analyze photos')
      }

      const result = await response.json()

      if (result.success && result.data) {
        const newQualityResults = new Map(qualityResults)

        result.data.results.forEach((analysisResult: ImageQualityAnalysisResult, index: number) => {
          newQualityResults.set(startIndex + index, analysisResult)
        })

        setQualityResults(newQualityResults)
      }
    } catch (error) {
      console.error('Error analyzing photos:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleFileSelect = async (files: FileList) => {
    const newFiles: File[] = []
    const errors: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      const fileErrors = validateFile(file)
      if (fileErrors.length > 0) {
        errors.push(`${file.name}: ${fileErrors.join(', ')}`)
        continue
      }

      const imageErrors = await validateImage(file)
      if (imageErrors.length > 0) {
        errors.push(`${file.name}: ${imageErrors.join(', ')}`)
        continue
      }

      newFiles.push(file)
    }

    const totalFiles = modelData.facePhotos.length + newFiles.length
    if (totalFiles > 10) {
      errors.push(`Máximo de 10 fotos do rosto permitidas (você selecionou ${totalFiles})`)
      setValidationErrors(errors)
      return
    }

    setValidationErrors(errors)

    if (newFiles.length > 0) {
      const startIndex = modelData.facePhotos.length

      setModelData({
        ...modelData,
        facePhotos: [...modelData.facePhotos, ...newFiles]
      })

      // Analyze new photos
      await analyzePhotoQuality(newFiles, startIndex)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files)
    }
  }, [modelData])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const removePhoto = (index: number) => {
    const newPhotos = modelData.facePhotos.filter((_, i) => i !== index)
    const newQualityResults = new Map(qualityResults)
    newQualityResults.delete(index)

    // Reindex remaining quality results
    const reindexedResults = new Map()
    newQualityResults.forEach((value, key) => {
      if (key > index) {
        reindexedResults.set(key - 1, value)
      } else {
        reindexedResults.set(key, value)
      }
    })

    setQualityResults(reindexedResults)
    setModelData({
      ...modelData,
      facePhotos: newPhotos
    })
  }

  const reanalyzePhoto = async (index: number) => {
    const file = modelData.facePhotos[index]
    if (file) {
      await analyzePhotoQuality([file], index)
    }
  }

  const getImagePreview = (file: File) => {
    return URL.createObjectURL(file)
  }

  // Calculate overall quality statistics
  const qualityStats = {
    analyzed: qualityResults.size,
    total: modelData.facePhotos.length,
    averageScore: qualityResults.size > 0
      ? Array.from(qualityResults.values()).reduce((sum, r) => sum + r.quality.score, 0) / qualityResults.size
      : 0,
    poor: Array.from(qualityResults.values()).filter(r => r.quality.score < 50).length,
    acceptable: Array.from(qualityResults.values()).filter(r => r.quality.score >= 50 && r.quality.score < 70).length,
    excellent: Array.from(qualityResults.values()).filter(r => r.quality.score >= 70 && r.quality.score < 90).length,
    perfect: Array.from(qualityResults.values()).filter(r => r.quality.score >= 90).length
  }

  return (
    <div className="space-y-6">
      {/* Credit Cost Warning */}
      {modelCostInfo && modelCostInfo.nextModelCost > 0 && (
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <div className="flex-1">
              <h4 className="text-sm font-semibold mb-1 text-purple-900">
                ⚠️ Atenção - Modelo Adicional
              </h4>
              <p className="text-xs text-purple-700">
                Este modelo custará <strong>500 créditos</strong> para treinar. Certifique-se de ter créditos suficientes antes de continuar.
              </p>
              <p className="text-xs text-purple-600 mt-2">
                Você possui <strong>{modelCostInfo.creditsAvailable} créditos</strong> disponíveis.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Free Model Message */}
      {modelCostInfo && modelCostInfo.nextModelCost === 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex-1">
              <h4 className="text-sm font-semibold mb-1 text-green-900">
                ✅ Primeiro Modelo Gratuito
              </h4>
              <p className="text-xs text-green-700">
                Este é seu primeiro modelo e está <strong>incluso na sua assinatura</strong>. Nenhum crédito será cobrado!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quality Analysis Warning */}
      {qualityStats.analyzed > 0 && qualityStats.averageScore < 70 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold mb-1 text-yellow-900">
                  ⚠️ Atenção: Qualidade das Fotos
                </h4>
                <p className="text-xs text-yellow-700 mb-2">
                  Algumas fotos estão com qualidade abaixo do recomendado (score médio: {qualityStats.averageScore.toFixed(1)}/100).
                  Substituir as fotos marcadas melhorará significativamente os resultados do treinamento.
                </p>
                <div className="flex gap-3 text-xs">
                  {qualityStats.poor > 0 && (
                    <span className="text-red-600">❌ {qualityStats.poor} ruim</span>
                  )}
                  {qualityStats.acceptable > 0 && (
                    <span className="text-yellow-600">⚠️ {qualityStats.acceptable} aceitável</span>
                  )}
                  {qualityStats.excellent > 0 && (
                    <span className="text-green-600">✅ {qualityStats.excellent} excelente</span>
                  )}
                  {qualityStats.perfect > 0 && (
                    <span className="text-green-700">⭐ {qualityStats.perfect} perfeita</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips for Better Results */}
      <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30 shadow-2xl">
        <CardContent className="pt-3 pb-3">
          <div className="space-y-0.5 text-slate-300" style={{fontSize: '8px'}}>
            <p>• Use fotos de alta qualidade (pelo menos 512x512 pixels)</p>
            <p>• Garanta boa iluminação e traços faciais claros</p>
            <p>• <strong>SEM bonés, chapéus ou óculos escuros</strong></p>
            <p>• <strong>Apenas UMA pessoa por foto</strong></p>
            <p>• Inclua variedade em expressões, ângulos e fundos</p>
            <p>• Evite fotos com filtro, caretas ou olhos fechados</p>
            <p>• O treinamento geralmente leva 15-30 minutos</p>
          </div>
        </CardContent>
      </Card>

      {/* Model Name and Class - Same as original */}
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div>
            <label htmlFor="name" className="block text-lg font-semibold text-gray-900 mb-2">
              Nome do Modelo
            </label>
            <input
              id="name"
              type="text"
              value={modelData.name}
              onChange={(e) => setModelData({ ...modelData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="ex: Modelo do João, IA da Maria, etc."
              maxLength={50}
            />
            <p className="text-xs text-gray-500 mt-1">
              Escolha um nome que ajude você a identificar este modelo
            </p>
          </div>

          <div>
            <label className="block text-lg font-semibold text-gray-900 mb-2">
              Classe
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
              {classOptions.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    onClick={() => setModelData({ ...modelData, class: option.value as any })}
                    className={`p-2 border rounded-lg text-center transition-colors ${
                      modelData.class === option.value
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Icon className="w-4 h-4 mx-auto mb-0.5" />
                    <div className="font-medium text-xs leading-tight">{option.label}</div>
                    <div className="text-xs text-gray-500 leading-tight" style={{fontSize: '0.6rem'}}>{option.description}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Face Photos Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              Fotos do Rosto
              {isAnalyzing && <Loader2 className="w-4 h-4 animate-spin text-purple-600" />}
            </span>
            <Badge variant={modelData.facePhotos.length >= 5 ? 'default' : 'secondary'}>
              {modelData.facePhotos.length}/10 fotos
            </Badge>
          </CardTitle>
          <CardDescription>
            Envie de 5 a 10 fotos claras do rosto. Elas serão analisadas automaticamente para garantir qualidade ideal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-all duration-200 cursor-pointer ${
              dragActive
                ? 'border-purple-500 bg-purple-50 scale-102'
                : 'border-gray-300 hover:border-purple-300 hover:bg-gray-50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <div className="flex flex-col items-center space-y-2">
              <div className={`p-1.5 rounded-full transition-colors ${
                dragActive ? 'bg-purple-100' : 'bg-gray-100'
              }`}>
                <Upload className={`w-4 h-4 ${
                  dragActive ? 'text-purple-600' : 'text-gray-400'
                }`} />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-900">
                  {dragActive ? 'Solte as fotos aqui!' : 'Arraste ou clique aqui'}
                </p>

                <input
                  id="file-input"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                />

                <p className="text-xs text-gray-500">
                  PNG, JPG, WEBP (máx. 10MB)
                </p>
              </div>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50/50 border border-red-200/60 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-red-700 mb-1">Problemas no Upload</h4>
                  <ul className="text-xs text-red-600 space-y-0.5">
                    {validationErrors.map((error, index) => (
                      <li key={index} className="flex items-start gap-1">
                        <span className="text-red-400 mt-0.5">•</span>
                        <span className="leading-tight">{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Photo Preview Grid with Quality Badges */}
          {modelData.facePhotos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {modelData.facePhotos.map((file, index) => {
                const qualityResult = qualityResults.get(index)
                const quality = qualityResult?.quality

                return (
                  <div key={index} className="relative group">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                      <img
                        src={getImagePreview(file)}
                        alt={`Face photo ${index + 1}`}
                        className="w-full h-full object-contain"
                      />

                      {/* Quality Badge */}
                      {quality && (
                        <div className={`absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-medium border ${getStatusColor(quality.status)}`}>
                          <span className="mr-1">{getStatusIcon(quality.status)}</span>
                          {quality.score}
                        </div>
                      )}

                      {/* Analyzing Overlay */}
                      {!quality && isAnalyzing && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    {/* Reanalyze Button */}
                    {quality && (
                      <button
                        onClick={() => reanalyzePhoto(index)}
                        className="absolute -bottom-2 -right-2 bg-purple-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title="Reanalisar qualidade"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    )}

                    {/* File Size Badge */}
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(file.size / 1024)}KB
                      </Badge>
                    </div>

                    {/* Quality Details Tooltip */}
                    {quality && quality.score < 70 && (
                      <div className="absolute inset-x-0 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                        <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl max-w-xs">
                          <div className="font-semibold mb-1">
                            {getStatusLabel(quality.status)} ({quality.score}/100)
                          </div>
                          <p className="text-gray-300 mb-2">{quality.feedback}</p>

                          {quality.criticalIssues.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-red-400 font-medium">Problemas críticos:</div>
                              {quality.criticalIssues.map((issue, i) => (
                                <div key={i} className="text-xs text-red-300">
                                  • {CRITICAL_ISSUE_LABELS[issue]}
                                </div>
                              ))}
                            </div>
                          )}

                          {quality.recommendations.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="text-blue-400 font-medium">Recomendações:</div>
                              {quality.recommendations.map((rec, i) => (
                                <div key={i} className="text-xs text-blue-300">
                                  • {rec}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

        </CardContent>
      </Card>

    </div>
  )
}
