'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { X, AlertCircle } from 'lucide-react'

interface AIModel {
  id: string
  name: string
  class: string
  status: string
  triggerWord?: string
  classWord?: string
  sampleImages: string[]
}

interface PackageConfigModalProps {
  packageId: string
  packageName: string
  packagePrice: number
  totalImages?: number // Number of images in the package
  onClose: () => void
  onConfirm: (modelId: string, aspectRatio: string, gender: 'MALE' | 'FEMALE') => void
}

const ASPECT_RATIOS = [
  { value: '1:1', label: 'Quadrado (1:1)' },
  { value: '4:3', label: 'Padrão (4:3)' },
  { value: '3:4', label: 'Retrato (3:4)' },
  { value: '9:16', label: 'Vertical (9:16)' },
  { value: '16:9', label: 'Paisagem (16:9)' }
]

export function PackageConfigModal({
  packageId,
  packageName,
  packagePrice,
  totalImages = 20, // Default to 20 for backward compatibility
  onClose,
  onConfirm
}: PackageConfigModalProps) {
  const [models, setModels] = useState<AIModel[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [selectedGender, setSelectedGender] = useState<'MALE' | 'FEMALE'>('MALE')
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('1:1')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchUserModels()
  }, [])

  const fetchUserModels = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/models')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar modelos')
      }

      // Filtrar apenas modelos READY
      const readyModels = data.models?.filter((m: AIModel) => m.status === 'READY') || []
      setModels(readyModels)

      // Selecionar primeiro modelo automaticamente
      if (readyModels.length > 0) {
        setSelectedModel(readyModels[0].id)
      } else {
        setError('Você precisa ter pelo menos um modelo treinado para usar pacotes de fotos.')
      }
    } catch (error) {
      console.error('Error fetching models:', error)
      setError(error instanceof Error ? error.message : 'Erro ao carregar modelos')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    if (!selectedModel) {
      setError('Selecione um modelo')
      return
    }
    onConfirm(selectedModel, selectedAspectRatio, selectedGender)
  }

  const selectedModelData = models.find(m => m.id === selectedModel)

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-[#1e293b] rounded-xl max-w-xl w-full max-h-[85vh] overflow-y-auto border border-slate-700 shadow-2xl" style={{fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
        {/* Header */}
        <div className="sticky top-0 bg-[#1e293b] border-b border-slate-700 px-5 py-4 z-10">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Configurar Geração</h2>
              <p className="text-xs text-slate-400 mt-0.5">{packageName} • {packagePrice} créditos</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-400 hover:text-white hover:bg-slate-800 -mr-2 -mt-1"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Loading State */}
          {loading && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3.5">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-300">Carregando seus modelos...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-3.5">
              <div className="flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-200">{error}</p>
                  {models.length === 0 && (
                    <p className="text-xs text-red-300 mt-1.5">
                      Crie seu primeiro modelo na página{' '}
                      <a href="/models/create" className="underline hover:text-red-100">
                        Treinar Modelo
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Gender Selection */}
          {!loading && models.length > 0 && (
            <div>
              <label className="text-sm font-medium text-white mb-2 block">
                Selecione o Gênero
              </label>
              <p className="text-xs text-slate-400 mb-3">
                Escolha o gênero para as {totalImages} fotos do pacote
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedGender('MALE')}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    selectedGender === 'MALE'
                      ? 'bg-purple-600 text-white border-2 border-purple-600'
                      : 'bg-slate-800 text-slate-300 border-2 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  Masculino
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedGender('FEMALE')}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    selectedGender === 'FEMALE'
                      ? 'bg-purple-600 text-white border-2 border-purple-600'
                      : 'bg-slate-800 text-slate-300 border-2 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  Feminino
                </button>
              </div>
            </div>
          )}

          {/* Model Selection */}
          {!loading && models.length > 0 && (
            <div>
              <label className="text-sm font-medium text-white mb-2 block">
                Selecione o Modelo
              </label>
              <p className="text-xs text-slate-400 mb-3">
                Escolha qual modelo será usado nas {totalImages} fotos do pacote
              </p>

              <select
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} • {model.class}
                  </option>
                ))}
              </select>

              {selectedModelData?.sampleImages?.[0] && (
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                  <img
                    src={selectedModelData.sampleImages[0]}
                    alt={selectedModelData.name}
                    className="w-12 h-12 rounded-md object-cover border border-slate-700"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  <div>
                    <p className="text-slate-300 font-medium">{selectedModelData.name}</p>
                    <p>{selectedModelData.class}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Aspect Ratio Selection */}
          {!loading && models.length > 0 && (
            <div>
              <label className="text-sm font-medium text-white mb-2 block">
                Selecione o Formato
              </label>
              <select
                value={selectedAspectRatio}
                onChange={(e) => setSelectedAspectRatio(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              >
                {ASPECT_RATIOS.map((ratio) => (
                  <option key={ratio.value} value={ratio.value}>
                    {ratio.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Summary */}
          {!loading && models.length > 0 && selectedModelData && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3.5">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Gênero:</span>
                  <span className="text-white font-medium">{selectedGender === 'MALE' ? 'Masculino' : 'Feminino'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Modelo:</span>
                  <span className="text-white font-medium">{selectedModelData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Formato:</span>
                  <span className="text-white font-medium">
                    {ASPECT_RATIOS.find(r => r.value === selectedAspectRatio)?.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Imagens:</span>
                  <span className="text-white font-medium">{totalImages} {totalImages === 1 ? 'foto' : 'fotos'}</span>
                </div>
                <div className="flex justify-between pt-1.5 mt-1.5 border-t border-slate-700">
                  <span className="text-slate-300 font-medium">Custo Total:</span>
                  <span className="text-white font-semibold">{packagePrice} créditos</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && models.length > 0 && (
          <div className="sticky bottom-0 bg-[#1e293b] border-t border-slate-700 px-5 py-4">
            <div className="flex gap-2.5">
              <Button
                variant="ghost"
                className="flex-1 text-slate-400 hover:text-slate-300 hover:bg-slate-800"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5A6FD8] hover:to-[#6A4190] text-white border-0"
                onClick={handleConfirm}
                disabled={!selectedModel}
              >
                Confirmar e Gerar {totalImages} {totalImages === 1 ? 'Foto' : 'Fotos'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
