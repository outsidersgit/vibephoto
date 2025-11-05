'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  MoreHorizontal,
  Eye,
  Trash2,
  AlertCircle,
  Clock,
  CheckCircle,
  Sparkles,
  Check
} from 'lucide-react'
import Link from 'next/link'
import { VibePhotoLogo } from '@/components/ui/vibephoto-logo'

interface ModelCardProps {
  model: any
  showProgress?: boolean
  showError?: boolean
  isSelected?: boolean
  onSelect?: (modelId: string) => void
}

export function ModelCard({ model, showProgress, showError, isSelected = false, onSelect }: ModelCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showActions, setShowActions] = useState(false)

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

  const getStatusIcon = () => {
    switch (model.status) {
      case 'READY':
        return <CheckCircle className="w-3 h-3 text-emerald-500" />
      case 'TRAINING':
      case 'PROCESSING':
      case 'UPLOADING':
        return <Clock className="w-3 h-3 text-amber-500" />
      case 'ERROR':
        return <AlertCircle className="w-3 h-3 text-red-500" />
      default:
        return <Clock className="w-3 h-3 text-slate-400" />
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este modelo? Esta ação não pode ser desfeita.')) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/models/${model.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        window.location.reload()
      } else {
        alert('Falha ao excluir modelo')
      }
    } catch (error) {
      alert('Erro ao excluir modelo')
    } finally {
      setIsDeleting(false)
      setShowActions(false)
    }
  }

  const handleSyncStatus = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch(`/api/models/${model.id}/sync-status`, {
        method: 'POST',
      })

      const result = await response.json()

      if (result.success) {
        window.location.reload()
      } else {
        alert(`Falha ao sincronizar status: ${result.error || result.message}`)
      }
    } catch (error) {
      alert('Erro ao sincronizar status do modelo')
    } finally {
      setIsSyncing(false)
    }
  }

  // Get first sample image or preview image
  const previewImage = model.sampleImages?.[0] || model.previewImages?.[0] || null

  return (
    <>
      <Card 
        className={`group relative bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border text-white transition-all hover:shadow-lg overflow-visible cursor-pointer ${
          isSelected 
            ? 'border-2 border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.2),0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] transform scale-[1.02]' 
            : 'border border-slate-600/30 hover:border-slate-500/40'
        }`}
        onClick={() => onSelect && onSelect(model.id)}
      >
        <CardContent className={`p-1 relative ${isSelected ? 'bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] rounded' : ''}`}>
          <div className="space-y-1.5">
            {/* Model Preview */}
            <div className="aspect-square bg-slate-700 rounded-md overflow-hidden relative">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt={`${model.name} sample`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <VibePhotoLogo size="sm" layout="iconOnly" variant="white" showText={false} />
                </div>
              )}

              {/* Selection Check Icon - Only when selected */}
              {isSelected && (
                <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              {/* VibePhoto Logo Overlay - Bottom Right (only when there's an image and not selected) */}
              {previewImage && !isSelected && (
                <div className="absolute bottom-1 right-1">
                  <VibePhotoLogo size="xs" layout="iconOnly" variant="white" showText={false} />
                </div>
              )}
            </div>

            {/* Model Info */}
            <div className="space-y-0.5">
              <h3 className="font-medium text-xs truncate text-white">
                {model.name}
              </h3>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {getClassLabel(model.class)}
                </span>

                {/* Quality Score */}
                {model.qualityScore && (
                  <Badge
                    variant="secondary"
                    className="text-xs px-1 py-0 h-4 bg-gray-600 text-gray-200"
                  >
                    {Math.round(model.qualityScore * 100)}%
                  </Badge>
                )}
              </div>
            </div>

            {/* Actions Button - Bottom Right Corner of Card */}
            <div className="absolute bottom-2 right-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowActions(!showActions)
                }}
                className="h-6 w-6 p-0 hover:bg-slate-600/80 text-slate-100 hover:text-white transition-all rounded-full z-10"
                title="Mais opções"
              >
                <MoreHorizontal className="w-3 h-3" />
              </Button>

              {/* Actions Dropdown */}
              {showActions && (
                <div className="absolute right-0 bottom-8 bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] backdrop-blur-sm border border-slate-600 rounded-lg shadow-2xl z-30 min-w-[150px] overflow-visible">
                  <div className="py-1">
                    <Link
                      href={`/models/${model.id}`}
                      onClick={() => setShowActions(false)}
                      className="flex items-center px-3 py-2 text-xs text-white hover:bg-slate-600/50 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 mr-2" />
                      Ver Detalhes
                    </Link>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete()
                      }}
                      disabled={isDeleting}
                      className="flex items-center px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 w-full text-left transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                      {isDeleting ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Progress Bar for Training - Show below info if needed */}
            {showProgress && ['TRAINING', 'PROCESSING', 'UPLOADING'].includes(model.status) && (
              <div className="mt-1.5">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>
                    {model.status === 'TRAINING' ? 'Treinando' : 
                     model.status === 'PROCESSING' ? 'Processando' : 
                     'Carregando'}
                    {model.trainingMessage && ` • ${model.trainingMessage}`}
                  </span>
                  <span className="font-medium">{model.progress || 0}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-400 to-amber-500 h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${model.progress || 0}%` }}
                  />
                </div>
                {model.status === 'TRAINING' && (
                  <p className="text-xs text-slate-400 mt-1">
                    Tempo estimado: ~30 minutos
                  </p>
                )}
              </div>
            )}

            {/* Error Message */}
            {showError && model.errorMessage && (
              <div className="mt-1.5 p-1.5 bg-red-900/20 border border-red-700/50 rounded text-xs text-red-300 leading-relaxed">
                {model.errorMessage}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Click outside to close actions */}
      {showActions && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowActions(false)}
        />
      )}
    </>
  )
}
