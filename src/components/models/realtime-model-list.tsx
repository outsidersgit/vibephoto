'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'
import { ModelCard } from './model-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Wifi, WifiOff, Play } from 'lucide-react'

interface RealtimeModelListProps {
  initialModels: any[]
  userId: string
}

export function RealtimeModelList({ initialModels, userId }: RealtimeModelListProps) {
  const [models, setModels] = useState(initialModels)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const router = useRouter()

  const { isConnected, connectionError } = useRealtimeUpdates({
    onModelStatusChange: (modelId, status, data) => {
      console.log(`🤖 Real-time model update: ${modelId} -> ${status}`)
      
      setModels(prevModels => 
        prevModels.map(model => {
          if (model.id === modelId) {
            return {
              ...model,
              status,
              progress: data.progress ?? model.progress,
              qualityScore: data.qualityScore ?? model.qualityScore,
              errorMessage: data.errorMessage ?? model.errorMessage,
              modelUrl: data.modelUrl ?? model.modelUrl,
              trainedAt: status === 'READY' ? new Date() : model.trainedAt,
              updatedAt: new Date()
            }
          }
          return model
        })
      )
      
      setLastUpdated(new Date())
    },
    onTrainingProgress: (modelId, progress, message) => {
      console.log(`📈 Training progress: ${modelId} -> ${progress}%`)
      
      setModels(prevModels => 
        prevModels.map(model => {
          if (model.id === modelId) {
            return {
              ...model,
              progress,
              trainingMessage: message
            }
          }
          return model
        })
      )
      
      setLastUpdated(new Date())
    },
    onConnect: () => {
      console.log('🔗 Model list connected to real-time updates')
    },
    onDisconnect: () => {
      console.log('❌ Model list disconnected from real-time updates')
    }
  })

  // Manual refresh function
  const handleRefresh = async () => {
    try {
      const response = await fetch('/api/models')
      if (response.ok) {
        const data = await response.json()
        setModels(data.models || [])
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Failed to refresh models:', error)
    }
  }

  const modelsByStatus = {
    ready: models.filter(m => m.status === 'READY'),
    training: models.filter(m => ['TRAINING', 'PROCESSING', 'UPLOADING'].includes(m.status)),
    error: models.filter(m => m.status === 'ERROR'),
    draft: models.filter(m => m.status === 'DRAFT')
  }

  const handleSelectModel = (modelId: string) => {
    setSelectedModelId(modelId === selectedModelId ? null : modelId)
  }

  const handleGenerate = () => {
    if (selectedModelId) {
      router.push(`/generate?model=${selectedModelId}`)
    }
  }

  const selectedModel = models.find(m => m.id === selectedModelId)

  return (
    <div className="space-y-8">
      {/* Generate Button - Show when model is selected */}
      {selectedModelId && selectedModel && (
        <div className="sticky top-4 z-10 bg-white border-2 border-gray-200 rounded-lg shadow-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-md bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] flex items-center justify-center overflow-hidden border-2 border-gray-200">
              {selectedModel.sampleImages?.[0] ? (
                <img
                  src={selectedModel.sampleImages[0]}
                  alt={selectedModel.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-white text-xs font-bold">{selectedModel.name.charAt(0)}</div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Modelo selecionado</p>
              <p className="text-xs text-gray-600">{selectedModel.name}</p>
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            className="w-full sm:w-auto bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white shadow-lg"
          >
            <Play className="w-4 h-4 mr-2" />
            Gerar Fotos
          </Button>
        </div>
      )}

      {/* Conexão realtime acontece nos bastidores - não mostrar status */}

      {/* Models by Status */}
      {modelsByStatus.training.length > 0 && (
        <div>
          <h3 className="text-base font-semibold mb-4 flex items-center text-gray-800">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse mr-3"></div>
            Modelos em Treinamento
            <span className="ml-2 text-sm font-medium text-gray-500">({modelsByStatus.training.length})</span>
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Acompanhe o progresso do treinamento em tempo real. Tempo estimado: ~30 minutos.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
            {modelsByStatus.training.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                showProgress={true}
                isSelected={selectedModelId === model.id}
                onSelect={handleSelectModel}
              />
            ))}
          </div>
        </div>
      )}

      {modelsByStatus.ready.length > 0 && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
            {modelsByStatus.ready.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                showProgress={false}
                isSelected={selectedModelId === model.id}
                onSelect={handleSelectModel}
              />
            ))}
          </div>
        </div>
      )}

      {modelsByStatus.error.length > 0 && (
        <div>
          <h3 className="text-base font-semibold mb-4 flex items-center text-gray-800">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
            Modelos com Erro
            <span className="ml-2 text-sm font-medium text-red-500">({modelsByStatus.error.length})</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
            {modelsByStatus.error.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                showProgress={false}
                isSelected={selectedModelId === model.id}
                onSelect={handleSelectModel}
              />
            ))}
          </div>
        </div>
      )}

      {modelsByStatus.draft.length > 0 && (
        <div>
          <h3 className="text-base font-semibold mb-4 flex items-center text-gray-800">
            <div className="w-2 h-2 bg-gray-400 rounded-full mr-3"></div>
            Rascunhos
            <span className="ml-2 text-sm font-medium text-gray-500">({modelsByStatus.draft.length})</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
            {modelsByStatus.draft.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                showProgress={false}
                isSelected={selectedModelId === model.id}
                onSelect={handleSelectModel}
              />
            ))}
          </div>
        </div>
      )}

      {models.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Nenhum modelo encontrado</p>
          <p className="text-sm">Crie seu primeiro modelo para começar a gerar fotos</p>
        </div>
      )}
    </div>
  )
}