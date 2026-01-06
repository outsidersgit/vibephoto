'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react'

interface ModelCreationStep3Props {
  modelData: {
    fullBodyPhotos: File[]
  }
  setModelData: (data: any) => void
}

export function ModelCreationStep3FullBody({ modelData, setModelData }: ModelCreationStep3Props) {
  const [dragActive, setDragActive] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const validateFile = (file: File): string[] => {
    const errors: string[] = []

    if (!file.type.startsWith('image/')) {
      errors.push('Arquivo deve ser uma imagem')
    }

    if (file.size > 10 * 1024 * 1024) {
      errors.push('Arquivo deve ter menos de 10MB')
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
          errors.push('Imagem deve ter pelo menos 256x256 pixels')
        }

        URL.revokeObjectURL(url)
        resolve(errors)
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(['Arquivo de imagem inválido'])
      }

      img.src = url
    })
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
      setModelData({
        ...modelData,
        fullBodyPhotos: [...modelData.fullBodyPhotos, ...newFiles]
      })
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
    setModelData({
      ...modelData,
      fullBodyPhotos: newPhotos
    })
  }

  const getImagePreview = (file: File) => {
    return URL.createObjectURL(file)
  }

  return (
    <div className="space-y-6">
      {/* Full Body Photos Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Fotos de Corpo Inteiro
            <Badge variant={modelData.fullBodyPhotos.length >= 5 ? 'default' : 'secondary'}>
              {modelData.fullBodyPhotos.length}/10 fotos
            </Badge>
          </CardTitle>
          <CardDescription>
            Envie de 5 a 10 fotos de corpo inteiro. Essas fotos são essenciais para gerar imagens completas e poses variadas.
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

          {/* Photo Preview Grid */}
          {modelData.fullBodyPhotos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {modelData.fullBodyPhotos.map((file, index) => (
                <div key={index} className="relative group">
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={getImagePreview(file)}
                      alt={`Corpo inteiro ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2 left-2">
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(file.size / 1024)}KB
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

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