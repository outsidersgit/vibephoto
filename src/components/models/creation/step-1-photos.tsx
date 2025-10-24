'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, X, User, Users, Heart, AlertCircle, CheckCircle, Shield, ExternalLink, Coins } from 'lucide-react'
import Link from 'next/link'

interface ModelCreationStep1Props {
  modelData: {
    name: string
    class: 'MAN' | 'WOMAN' | 'BOY' | 'GIRL' | 'ANIMAL'
    facePhotos: File[]
  }
  setModelData: (data: any) => void
}

export function ModelCreationStep1({ modelData, setModelData }: ModelCreationStep1Props) {
  const [dragActive, setDragActive] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const classOptions = [
    { value: 'MAN', label: 'Homem', icon: User, description: 'Pessoa adulta do sexo masculino' },
    { value: 'WOMAN', label: 'Mulher', icon: User, description: 'Pessoa adulta do sexo feminino' },
    { value: 'BOY', label: 'Menino', icon: Users, description: 'Pessoa jovem do sexo masculino' },
    { value: 'GIRL', label: 'Menina', icon: Users, description: 'Pessoa jovem do sexo feminino' },
    { value: 'ANIMAL', label: 'Animal', icon: Heart, description: 'Pet ou animal de estimação' }
  ]

  const validateFile = (file: File): string[] => {
    const errors: string[] = []
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      errors.push('File must be an image')
    }
    
    // Check file size (max 10MB)
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
        
        // Check minimum resolution
        if (img.width < 256 || img.height < 256) {
          errors.push('Image must be at least 256x256 pixels')
        }
        
        // Check aspect ratio (should be roughly square for face photos)
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

  const handleFileSelect = async (files: FileList) => {
    const newFiles: File[] = []
    const errors: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      // Basic validation
      const fileErrors = validateFile(file)
      if (fileErrors.length > 0) {
        errors.push(`${file.name}: ${fileErrors.join(', ')}`)
        continue
      }
      
      // Image validation
      const imageErrors = await validateImage(file)
      if (imageErrors.length > 0) {
        errors.push(`${file.name}: ${imageErrors.join(', ')}`)
        continue
      }
      
      newFiles.push(file)
    }

    // Check total count
    const totalFiles = modelData.facePhotos.length + newFiles.length
    if (totalFiles > 10) {
      errors.push(`Máximo de 10 fotos do rosto permitidas (você selecionou ${totalFiles})`)
      setValidationErrors(errors)
      return
    }

    setValidationErrors(errors)
    
    if (newFiles.length > 0) {
      setModelData({
        ...modelData,
        facePhotos: [...modelData.facePhotos, ...newFiles]
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
    const newPhotos = modelData.facePhotos.filter((_, i) => i !== index)
    setModelData({
      ...modelData,
      facePhotos: newPhotos
    })
  }

  const getImagePreview = (file: File) => {
    return URL.createObjectURL(file)
  }

  return (
    <div className="space-y-6">
      {/* Credit Cost Warning */}
      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="p-4">
          <div className="flex-1">
            <h4 className="text-sm font-semibold mb-1 text-purple-900">
              ⚠️ Atenção - Modelo Adicional
            </h4>
            <p className="text-xs text-purple-700">
              Este modelo custará <strong>500 créditos</strong> para treinar. Certifique-se de ter créditos suficientes antes de continuar.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tips for Better Results */}
      <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30 shadow-2xl">
        <CardContent className="pt-3 pb-3">
          <div className="space-y-0.5 text-slate-300" style={{fontSize: '8px'}}>
            <p>• Use fotos de alta qualidade (pelo menos 512x512 pixels)</p>
            <p>• Garanta boa iluminação e traços faciais claros</p>
            <p>• Inclua variedade em expressões, ângulos e fundos</p>
            <p>• Evite fotos com muito filtro ou editadas</p>
            <p>• Sem nudez</p>
            <p>• O treinamento geralmente leva 15-30 minutos</p>
          </div>
        </CardContent>
      </Card>

      {/* Model Name */}
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
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

      {/* Face Photos Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Fotos do Rosto
            <Badge variant={modelData.facePhotos.length >= 5 ? 'default' : 'secondary'}>
              {modelData.facePhotos.length}/10 fotos
            </Badge>
          </CardTitle>
          <CardDescription>
            Envie de 5 a 10 fotos claras do rosto. Elas devem focar no rosto com boa iluminação.
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

          {/* Photo Preview Grid */}
          {modelData.facePhotos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {modelData.facePhotos.map((file, index) => (
                <div key={index} className="relative group">
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={getImagePreview(file)}
                      alt={`Face photo ${index + 1}`}
                      className="w-full h-full object-contain"
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

    </div>
  )
}