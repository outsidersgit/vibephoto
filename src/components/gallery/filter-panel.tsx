'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, User, ArrowUpDown } from 'lucide-react'

interface FilterPanelProps {
  models: any[]
  selectedModel?: string
  selectedSort: 'newest' | 'oldest'
  onModelSelect: (modelId: string | null) => void
  onSortChange: (sort: 'newest' | 'oldest') => void
  onClose: () => void
}

const sortOptions: Array<{ value: 'newest' | 'oldest'; label: string }> = [
  { value: 'newest', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigas' }
]

export function FilterPanel({
  models,
  selectedModel,
  selectedSort,
  onModelSelect,
  onSortChange,
  onClose
}: FilterPanelProps) {
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
        {/* Sort */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3 flex items-center">
            <ArrowUpDown className="w-4 h-4 mr-2" />
            Ordenar por
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onSortChange(option.value)}
                className={`p-3 text-left border rounded-lg transition-colors ${
                  selectedSort === option.value
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="font-medium">{option.label}</div>
              </button>
            ))}
          </div>
        </div>

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

        {/* Clear Filters */}
        <div className="pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onModelSelect(null)
              onSortChange('newest')
            }}
          >
            Limpar Todos os Filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}