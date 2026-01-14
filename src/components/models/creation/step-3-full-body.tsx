'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, X, AlertCircle, CheckCircle, Loader2, RefreshCw, ArrowLeft, ArrowRight, User, Users, Heart } from 'lucide-react'
import Link from 'next/link'
import { ImageQualityAnalysisResult, CRITICAL_ISSUE_LABELS, MINOR_ISSUE_LABELS } from '@/types/image-quality'

interface ModelCreationStep3FullBodyProps {
  modelData: {
    class?: 'MAN' | 'WOMAN' | 'BOY' | 'GIRL' | 'ANIMAL'
    fullBodyPhotos: File[]
  }
  setModelData: (data: any) => void
  onNextStep?: () => void
  onPrevStep?: () => void
  canProceed?: boolean
}

export function ModelCreationStep3FullBody({ modelData, setModelData, onNextStep, onPrevStep, canProceed = true }: ModelCreationStep3FullBodyProps) {
  const [dragActive, setDragActive] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [qualityResults, setQualityResults] = useState<Map<number, ImageQualityAnalysisResult>>(new Map())
  const [isAnalyzing, setIsAnalyzing] = useState(false)


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
      formData.append('photoType', 'full_body')
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

        // Save to localStorage for step 4
        const resultsArray = Array.from(newQualityResults.entries())
        localStorage.setItem('fullBodyPhotosQuality', JSON.stringify(resultsArray))
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

    const totalFiles = modelData.fullBodyPhotos.length + newFiles.length
    if (totalFiles > 10) {
      errors.push(`Máximo 10 fotos de corpo inteiro permitidas (você selecionou ${totalFiles})`)
      setValidationErrors(errors)
      return
    }

    setValidationErrors(errors)

    if (newFiles.length > 0) {
      const startIndex = modelData.fullBodyPhotos.length

      setModelData({
        ...modelData,
        fullBodyPhotos: [...modelData.fullBodyPhotos, ...newFiles]
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
    const newPhotos = modelData.fullBodyPhotos.filter((_, i) => i !== index)
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
      fullBodyPhotos: newPhotos
    })
  }

  const reanalyzePhoto = async (index: number) => {
    const file = modelData.fullBodyPhotos[index]
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
    total: modelData.fullBodyPhotos.length,
    photosWithIssues: Array.from(qualityResults.values()).filter(r => r.quality.hasIssues).length,
    photosOk: Array.from(qualityResults.values()).filter(r => !r.quality.hasIssues).length
  }

  return (
    <div className="space-y-6">
      {/* Half Body Photos Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              Fotos de Corpo Inteiro
              {isAnalyzing && <Loader2 className="w-4 h-4 animate-spin text-purple-600" />}
            </span>
            <Badge variant={modelData.fullBodyPhotos.length >= 5 ? 'default' : 'secondary'}>
              {modelData.fullBodyPhotos.length}/10 fotos
            </Badge>
          </CardTitle>
          <CardDescription>
            Envie de 5 a 10 fotos de corpo inteiro (corpo completo da cabeça aos pés). Elas serão analisadas automaticamente para garantir qualidade ideal.
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
            onClick={() => document.getElementById('full-body-file-input')?.click()}
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
                  id="full-body-file-input"
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
          {modelData.fullBodyPhotos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {modelData.fullBodyPhotos.map((file, index) => {
                const qualityResult = qualityResults.get(index)
                const quality = qualityResult?.quality

                return (
                  <div key={index} className="relative group">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                      <img
                        src={getImagePreview(file)}
                        alt={`Corpo inteiro ${index + 1}`}
                        className="w-full h-full object-contain"
                      />

                      {/* Quality Badge */}
                      {quality && quality.hasIssues && (
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-red-500 text-white">⚠️ Problema</Badge>
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

                    {/* Quality Details Tooltip - Show for ALL photos */}
                    {quality && (
                      <div className="absolute inset-x-0 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                        <div className={`text-white text-xs rounded-lg p-3 shadow-xl max-w-xs ${quality.hasIssues ? 'bg-red-600' : 'bg-green-600'}`}>
                          {!quality.hasIssues ? (
                            <div className="font-semibold">✅ Foto aprovada</div>
                          ) : (
                            <div className="space-y-2">
                              <div className="font-semibold">⚠️ Problemas:</div>
                              {quality.criticalIssues.length > 0 && (
                                <div className="space-y-1">
                                  {quality.criticalIssues.map((issue, i) => (
                                    <div key={i} className="text-xs">
                                      • {CRITICAL_ISSUE_LABELS[issue]}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {quality.minorIssues.length > 0 && (
                                <div className="space-y-1">
                                  {quality.minorIssues.map((issue, i) => (
                                    <div key={i} className="text-xs">
                                      • {MINOR_ISSUE_LABELS[issue]}
                                    </div>
                                  ))}
                                </div>
                              )}
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

      {/* Quality Analysis Warning */}
      {qualityStats.analyzed > 0 && qualityStats.photosWithIssues > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold mb-1 text-yellow-900">
                  ⚠️ Atenção: Qualidade das Fotos
                </h4>
                <p className="text-xs text-yellow-700 mb-2">
                  {qualityStats.photosWithIssues} {qualityStats.photosWithIssues === 1 ? 'foto apresenta' : 'fotos apresentam'} problemas.
                  Substituir as fotos marcadas melhorará significativamente os resultados do treinamento.
                </p>
                <div className="flex gap-3 text-xs">
                  <span className="text-red-600">⚠️ {qualityStats.photosWithIssues} com problemas</span>
                  <span className="text-green-600">✅ {qualityStats.photosOk} aprovadas</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onPrevStep}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Button
          type="button"
          onClick={onNextStep}
          disabled={!canProceed || modelData.fullBodyPhotos.length < 5}
        >
          Próximo
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      {/* Good and Bad Examples */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Good Examples */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <h3 className="font-semibold text-sm text-gray-900">Bons Exemplos</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 border-2 border-green-200">
                  <img
                    src="/images/examples/good-1.jpg"
                    alt="Bom exemplo 1"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%2310b981" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-size="14"%3E✓%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 border-2 border-green-200">
                  <img
                    src="/images/examples/good-2.jpg"
                    alt="Bom exemplo 2"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%2310b981" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-size="14"%3E✓%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 border-2 border-green-200">
                  <img
                    src="/images/examples/good-3.jpg"
                    alt="Bom exemplo 3"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%2310b981" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-size="14"%3E✓%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 border-2 border-green-200">
                  <img
                    src="/images/examples/good-4.jpg"
                    alt="Bom exemplo 4"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%2310b981" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-size="14"%3E✓%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>
              </div>

              {/* Good Examples Guidelines */}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Use imagens de ombros para cima</p>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Imagens da cintura para cima e do corpo todo</p>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Olhando para a câmera</p>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Fotos de dias diferentes</p>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Mudança de fundos, iluminação e roupas</p>
                </div>
              </div>
            </div>

            {/* Bad Examples */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                </div>
                <h3 className="font-semibold text-sm text-gray-900">Maus Exemplos</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 border-2 border-red-200">
                  <img
                    src="/images/examples/bad-1.jpg"
                    alt="Mau exemplo 1"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ef4444" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-size="14"%3E✕%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 border-2 border-red-200">
                  <img
                    src="/images/examples/bad-2.jpg"
                    alt="Mau exemplo 2"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ef4444" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-size="14"%3E✕%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 border-2 border-red-200">
                  <img
                    src="/images/examples/bad-3.jpg"
                    alt="Mau exemplo 3"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ef4444" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-size="14"%3E✕%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 border-2 border-red-200">
                  <img
                    src="/images/examples/bad-4.jpg"
                    alt="Mau exemplo 4"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ef4444" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-size="14"%3E✕%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>
              </div>

              {/* Bad Examples Guidelines */}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Imagens geradas por IA</p>
                </div>
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Pessoas extras</p>
                </div>
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Caretas</p>
                </div>
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Filtros, Preto e Branco</p>
                </div>
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Iluminação ruim, baixa qualidade, desfocada</p>
                </div>
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Chapéu, óculos escuros</p>
                </div>
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Ângulos ruins</p>
                </div>
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Rosto cortado</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
