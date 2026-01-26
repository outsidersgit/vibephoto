'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, X, User, Users, Heart, AlertCircle, CheckCircle, Shield, ExternalLink, Coins, Loader2, Info } from 'lucide-react'
import Link from 'next/link'
import { ImageQualityAnalysisResult, CRITICAL_ISSUE_LABELS, MINOR_ISSUE_LABELS } from '@/types/image-quality'
import { saveFilesToIndexedDB, loadFilesFromIndexedDB, saveQualityToIndexedDB, loadQualityFromIndexedDB, touchDraft } from '@/lib/utils/indexed-db-persistence'
import { compressImageIfNeeded } from '@/lib/utils/image-compression'

interface ModelCreationStep1Props {
  modelData: {
    name: string
    class: 'MAN' | 'WOMAN' | 'BOY' | 'GIRL' | 'ANIMAL'
    facePhotos: File[]
  }
  setModelData: (data: any) => void
  modelCostInfo?: any
  onAnalyzingChange?: (isAnalyzing: boolean) => void
}

export function ModelCreationStep1({ modelData, setModelData, modelCostInfo, onAnalyzingChange }: ModelCreationStep1Props) {
  const [dragActive, setDragActive] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [qualityResults, setQualityResults] = useState<Map<number, ImageQualityAnalysisResult>>(new Map())
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Load persisted data on mount
  useEffect(() => {
    const loadPersistedData = async () => {
      const files = await loadFilesFromIndexedDB('model_facePhotos')
      const quality = await loadQualityFromIndexedDB('facePhotosQuality')

      if (files.length > 0) {
        console.log(`✅ [Step 1] Loaded ${files.length} persisted photos from IndexedDB`)
        setModelData((prev: any) => ({ ...prev, facePhotos: files }))
      }
      if (quality.size > 0) {
        console.log(`✅ [Step 1] Loaded ${quality.size} quality results from IndexedDB`)
        setQualityResults(quality)
      }
    }

    loadPersistedData()
  }, [])

  // Notify parent component when analyzing state changes
  useEffect(() => {
    onAnalyzingChange?.(isAnalyzing)
  }, [isAnalyzing, onAnalyzingChange])

  const classOptions = [
    { value: 'WOMAN', label: 'Mulher', icon: User, description: 'Pessoa adulta do sexo feminino' },
    { value: 'MAN', label: 'Homem', icon: User, description: 'Pessoa adulta do sexo masculino' },
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
      console.log(`📸 [Step 1] Starting analysis for ${files.length} images...`)

      // Step 1: Compress and upload images to R2 (one by one to avoid memory issues)
      const imageUrls: string[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        console.log(`[Step 1] Processing image ${i + 1}/${files.length}: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)

        // Compress if needed
        let processedFile = file
        try {
          processedFile = await compressImageIfNeeded(file, 4 * 1024 * 1024)
          if (processedFile !== file) {
            console.log(`✅ [Step 1] Compressed to ${(processedFile.size / 1024 / 1024).toFixed(2)}MB`)
          }
        } catch (error) {
          console.error(`❌ [Step 1] Compression failed for ${file.name}:`, error)
        }

        // Upload to R2 via presigned URL
        try {
          console.log(`☁️ [Step 1] Uploading ${processedFile.name} to R2...`)

          // Get presigned URL
          const presignedResponse = await fetch('/api/upload/presigned-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: processedFile.name,
              contentType: processedFile.type,
              category: 'model-training'
            })
          })

          if (!presignedResponse.ok) {
            throw new Error('Failed to get presigned URL')
          }

          const { data } = await presignedResponse.json()

          // Upload directly to R2
          const uploadResponse = await fetch(data.presignedUrl, {
            method: 'PUT',
            body: processedFile,
            headers: {
              'Content-Type': processedFile.type
            }
          })

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload to R2')
          }

          imageUrls.push(data.publicUrl)
          console.log(`✅ [Step 1] Image ${i + 1} uploaded successfully`)
        } catch (error) {
          console.error(`❌ [Step 1] Upload failed for ${file.name}:`, error)
          throw new Error(`Falha ao enviar ${file.name}. Por favor, tente novamente.`)
        }
      }

      console.log(`✅ [Step 1] All ${imageUrls.length} images uploaded, starting analysis...`)

      // Step 2: Send URLs to analysis API
      const response = await fetch('/api/models/validate-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoType: 'face',
          modelClass: modelData.class,
          imageUrls: imageUrls
        })
      })

      if (!response.ok) {
        throw new Error('Failed to analyze photos')
      }

      const result = await response.json()

      if (result.success && result.data) {
        const newQualityResults = new Map(qualityResults)

        result.data.results.forEach((analysisResult: ImageQualityAnalysisResult, index: number) => {
          newQualityResults.set(startIndex + index, analysisResult)
          console.log(`✅ [Step 1] Image ${startIndex + index} analyzed: ${analysisResult.quality.hasIssues ? '⚠️ Issues found' : '✓ OK'}`)
        })

        setQualityResults(newQualityResults)

        // Save to IndexedDB for step 4
        await saveQualityToIndexedDB('facePhotosQuality', newQualityResults)
        console.log(`✅ [Step 1] Saved ${newQualityResults.size} quality results to IndexedDB`)
      }
    } catch (error) {
      console.error('Error analyzing photos:', error)
      alert(error instanceof Error ? error.message : 'Erro ao analisar fotos. Tente novamente.')
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
    if (totalFiles > 14) {
      errors.push(`Máximo de 14 fotos do rosto permitidas (você selecionou ${totalFiles})`)
      setValidationErrors(errors)
      return
    }

    setValidationErrors(errors)

    if (newFiles.length > 0) {
      const startIndex = modelData.facePhotos.length
      const updatedPhotos = [...modelData.facePhotos, ...newFiles]

      setModelData({
        ...modelData,
        facePhotos: updatedPhotos
      })

      // Save to IndexedDB
      await saveFilesToIndexedDB('model_facePhotos', updatedPhotos)
      console.log(`✅ [Step 1] Saved ${updatedPhotos.length} photos to IndexedDB`)

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

  const removePhoto = async (index: number) => {
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

    // Save to IndexedDB
    await saveFilesToIndexedDB('model_facePhotos', newPhotos)
    await saveQualityToIndexedDB('facePhotosQuality', reindexedResults)
    console.log(`✅ [Step 1] Removed photo, saved ${newPhotos.length} photos to IndexedDB`)
  }

  const getImagePreview = (file: File) => {
    return URL.createObjectURL(file)
  }

  // Calculate overall quality statistics
  const qualityStats = {
    analyzed: qualityResults.size,
    total: modelData.facePhotos.length,
    photosWithIssues: Array.from(qualityResults.values()).filter(r => r.quality.hasIssues).length,
    photosOk: Array.from(qualityResults.values()).filter(r => !r.quality.hasIssues).length
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

      {/* Tips for Better Results */}
      <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30 shadow-2xl">
        <CardContent className="pt-3 pb-3">
          <div className="space-y-0.5 text-slate-300" style={{fontSize: '8px'}}>
            <p>• <strong>Use apenas fotos com aparência natural ou maquiagem mínima</strong>. Maquiagem pesada (contorno marcado, iluminação excessiva, sobrancelhas desenhadas ou olhos muito carregados) reduz a qualidade do modelo treinado</p>
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
                    src="/images/examples/step-1-face/good-1.jpg?v=2"
                    alt="Bom exemplo 1"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%2310b981" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-size="14"%3E✓%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 border-2 border-green-200">
                  <img
                    src="/images/examples/step-1-face/good-2.jpg?v=2"
                    alt="Bom exemplo 2"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%2310b981" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-size="14"%3E✓%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 border-2 border-green-200">
                  <img
                    src="/images/examples/step-1-face/good-3.jpg?v=2"
                    alt="Bom exemplo 3"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%2310b981" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-size="14"%3E✓%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 border-2 border-green-200">
                  <img
                    src="/images/examples/step-1-face/good-4.jpg?v=2"
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
                  <p className="text-xs text-gray-700">Rosto bem enquadrado (ombros para cima)</p>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Olhando diretamente para a câmera</p>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Iluminação natural e uniforme no rosto</p>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Expressão neutra ou sorriso natural</p>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Fundo limpo e sem distrações</p>
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
                    src="/images/examples/step-1-face/bad-1.jpg?v=2"
                    alt="Mau exemplo 1"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ef4444" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-size="14"%3E✕%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 border-2 border-red-200">
                  <img
                    src="/images/examples/step-1-face/bad-2.jpg?v=2"
                    alt="Mau exemplo 2"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ef4444" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-size="14"%3E✕%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 border-2 border-red-200">
                  <img
                    src="/images/examples/step-1-face/bad-3.jpg?v=2"
                    alt="Mau exemplo 3"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ef4444" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-size="14"%3E✕%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 border-2 border-red-200">
                  <img
                    src="/images/examples/step-1-face/bad-4.jpg?v=2"
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
                  <p className="text-xs text-gray-700">Rosto cortado ou mal enquadrado</p>
                </div>
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Óculos escuros, chapéu ou acessórios no rosto</p>
                </div>
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Filtros, preto e branco ou efeitos</p>
                </div>
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Outras pessoas na foto</p>
                </div>
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Foto desfocada ou com baixa qualidade</p>
                </div>
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">Imagens geradas por IA</p>
                </div>
              </div>
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
            <Badge variant={modelData.facePhotos.length >= 10 ? 'default' : 'secondary'}>
              {modelData.facePhotos.length}/14 fotos
            </Badge>
          </CardTitle>
          <CardDescription>
            Envie de 10 a 14 fotos claras do rosto. Elas serão analisadas automaticamente para garantir qualidade ideal.
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

                      {/* Quality Badge - Problems */}
                      {quality && quality.hasIssues && (
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-red-500 text-white">⚠️ Problema</Badge>
                        </div>
                      )}

                      {/* Quality Badge - Approved */}
                      {quality && !quality.hasIssues && (
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-green-500 text-white flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Aprovada
                          </Badge>
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

      {/* Analyzing Progress Notice */}
      {isAnalyzing && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-blue-900">
                  <strong>Analisando imagens...</strong> O processo pode demorar alguns segundos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Images Approved Success Banner */}
      {!isAnalyzing && qualityStats.analyzed > 0 && qualityStats.total === qualityStats.analyzed && qualityStats.photosWithIssues === 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold mb-1 text-green-900">
                  ✅ Parabéns! Todas as imagens foram aprovadas
                </h4>
                <p className="text-xs text-green-700">
                  Todas as {qualityStats.total} {qualityStats.total === 1 ? 'imagem foi analisada e aprovada' : 'imagens foram analisadas e aprovadas'}. Você pode prosseguir para a próxima etapa com confiança!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Info: How to view analysis details */}
      {!isAnalyzing && qualityStats.analyzed > 0 && (
        <Card className="border-gray-200 bg-gray-50">
          <CardContent className="p-3">
            <p className="text-xs text-gray-600 text-center">
              💡 <strong>Dica:</strong> Clique nas fotos para ver os detalhes da análise
            </p>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
