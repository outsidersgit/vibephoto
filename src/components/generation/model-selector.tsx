'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle } from 'lucide-react'
import { VibePhotoLogo } from '@/components/ui/vibephoto-logo'

interface ModelSelectorProps {
  models: Array<{
    id: string
    name: string
    class: string
    sampleImages: any[]
    qualityScore?: number
  }>
  selectedModelId: string
  onModelSelect: (modelId: string) => void
}

export function ModelSelector({ models, selectedModelId, onModelSelect }: ModelSelectorProps) {

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
    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
      {models.map((model) => (
        <Card
          key={model.id}
          className={`cursor-pointer transition-all hover:shadow-lg ${
            selectedModelId === model.id
              ? 'ring-2 ring-purple-400 border-purple-300 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] text-white'
              : 'bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border-slate-600/30 hover:border-slate-500/40 text-white'
          }`}
          onClick={() => onModelSelect(model.id)}
        >
          <CardContent className="p-2">
            <div className="space-y-1.5">
              {/* Model Preview */}
              <div className="aspect-square bg-slate-700 rounded-md overflow-hidden relative">
                {model.sampleImages.length > 0 ? (
                  <img
                    src={model.sampleImages[0]}
                    alt={`${model.name} sample`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <VibePhotoLogo size="sm" layout="iconOnly" variant="white" showText={false} />
                  </div>
                )}

                {/* Selected Indicator Badge */}
                {selectedModelId === model.id && (
                  <div className="absolute top-1 right-1">
                    <CheckCircle className="w-4 h-4 text-purple-400 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] rounded-full" />
                  </div>
                )}

                {/* VibePhoto Logo Overlay - Only show when there's an image */}
                {model.sampleImages.length > 0 && (
                  <div className="absolute bottom-1 right-1">
                    <VibePhotoLogo size="xs" layout="iconOnly" variant="white" showText={false} />
                  </div>
                )}
              </div>

              {/* Model Info */}
              <div className="space-y-0.5">
                <h3 className={`font-medium text-xs truncate ${
                  selectedModelId === model.id ? 'text-white' : 'text-gray-200'
                }`}>
                  {model.name}
                </h3>

                <div className="flex items-center justify-between">
                  <span className={`text-xs ${
                    selectedModelId === model.id ? 'text-gray-300' : 'text-gray-400'
                  }`}>
                    {getClassLabel(model.class)}
                  </span>

                  {/* Quality Score */}
                  {model.qualityScore && (
                    <Badge
                      variant="secondary"
                      className={`text-xs px-1 py-0 h-4 ${
                        selectedModelId === model.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-600 text-gray-200'
                      }`}
                    >
                      {Math.round(model.qualityScore * 100)}%
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}