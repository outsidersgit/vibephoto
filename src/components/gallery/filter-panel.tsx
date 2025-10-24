'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, User, Calendar, Image, CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface FilterPanelProps {
  models: any[]
  selectedModel?: string
  onModelSelect: (modelId: string | null) => void
  onClose: () => void
}

export function FilterPanel({ models, selectedModel, onModelSelect, onClose }: FilterPanelProps) {
  const statusOptions = [
    { value: 'COMPLETED', label: 'Concluída', icon: CheckCircle, color: 'text-green-600' },
    { value: 'PROCESSING', label: 'Processando', icon: Clock, color: 'text-yellow-600' },
    { value: 'FAILED', label: 'Falhada', icon: AlertCircle, color: 'text-red-600' }
  ]

  const timeRanges = [
    { value: 'today', label: 'Hoje' },
    { value: 'week', label: 'Esta Semana' },
    { value: 'month', label: 'Este Mês' },
    { value: 'year', label: 'Este Ano' }
  ]

  const imageCountRanges = [
    { value: '1', label: '1 Imagem' },
    { value: '2-3', label: '2-3 Imagens' },
    { value: '4+', label: '4+ Imagens' }
  ]

  const getClassIcon = (modelClass: string) => {
    return <User className="w-4 h-4" />
  }

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Filtros</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Models Filter */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3 flex items-center">
            <User className="w-4 h-4 mr-2" />
            Filtrar por Modelo
          </h3>
          <div className="space-y-2">
            <button
              onClick={() => onModelSelect(null)}
              className={`w-full p-3 text-left border rounded-lg transition-colors ${
                !selectedModel
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="font-medium">Todos os Modelos</div>
              <div className="text-sm text-gray-500">Mostrar gerações de todos os modelos</div>
            </button>
            
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => onModelSelect(model.id)}
                className={`w-full p-3 text-left border rounded-lg transition-colors ${
                  selectedModel === model.id
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getClassIcon(model.class)}
                    <div>
                      <div className="font-medium">{model.name}</div>
                      <div className="text-sm text-gray-500 capitalize">
                        {getClassLabel(model.class)}
                      </div>
                    </div>
                  </div>
                  {model.qualityScore && (
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(model.qualityScore * 100)}%
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3 flex items-center">
            <CheckCircle className="w-4 h-4 mr-2" />
            Status
          </h3>
          <div className="space-y-2">
            {statusOptions.map((status) => {
              const Icon = status.icon
              return (
                <button
                  key={status.value}
                  className="w-full p-3 text-left border border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Icon className={`w-4 h-4 ${status.color}`} />
                    <span>{status.label}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Time Range Filter */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3 flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            Criado em
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {timeRanges.map((range) => (
              <button
                key={range.value}
                className="p-3 text-sm border border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Image Count Filter */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3 flex items-center">
            <Image className="w-4 h-4 mr-2" />
            Quantidade de Imagens
          </h3>
          <div className="space-y-2">
            {imageCountRanges.map((range) => (
              <button
                key={range.value}
                className="w-full p-3 text-left border border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Filters */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Filtros Rápidos</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              Recentes
            </Button>
            <Button variant="outline" size="sm">
              Favoritos
            </Button>
            <Button variant="outline" size="sm">
              Alta Qualidade
            </Button>
            <Button variant="outline" size="sm">
              Múltiplas Imagens
            </Button>
          </div>
        </div>

        {/* Clear Filters */}
        <div className="pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onModelSelect(null)
              // Reset other filters here
            }}
          >
            Limpar Todos os Filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}