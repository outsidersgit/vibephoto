'use client'

import { useState, useEffect } from 'react'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'
import { ModelCard } from './model-card'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Wifi, WifiOff } from 'lucide-react'

interface RealtimeModelListProps {
  initialModels: any[]
  userId: string
}

export function RealtimeModelList({ initialModels, userId }: RealtimeModelListProps) {
  const [models, setModels] = useState(initialModels)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

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

  return (
    <div className="space-y-8">
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
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {modelsByStatus.training.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                showProgress={true}
              />
            ))}
          </div>
        </div>
      )}

      {modelsByStatus.ready.length > 0 && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {modelsByStatus.ready.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                showProgress={false}
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
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {modelsByStatus.error.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                showProgress={false}
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
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {modelsByStatus.draft.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                showProgress={false}
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