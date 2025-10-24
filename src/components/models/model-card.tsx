'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  MoreHorizontal,
  Play,
  Eye,
  Trash2,
  AlertCircle,
  Clock,
  CheckCircle,
  User,
  Users,
  RefreshCw,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'
import { AIModel } from '@/types'
import { formatDate } from '@/lib/utils'

interface ModelCardProps {
  model: any
  showProgress?: boolean
  showError?: boolean
}

export function ModelCard({ model, showProgress, showError }: ModelCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showActions, setShowActions] = useState(false)

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

  const getStatusText = () => {
    switch (model.status) {
      case 'READY':
        return 'Pronto'
      case 'TRAINING':
        return 'Treinando'
      case 'PROCESSING':
        return 'Processando'
      case 'UPLOADING':
        return 'Carregando'
      case 'ERROR':
        return 'Erro'
      default:
        return model.status
    }
  }

  const getStatusGradient = () => {
    switch (model.status) {
      case 'READY':
        return 'from-emerald-500/10 to-green-500/5'
      case 'TRAINING':
      case 'PROCESSING':
      case 'UPLOADING':
        return 'from-amber-500/10 to-yellow-500/5'
      case 'ERROR':
        return 'from-red-500/10 to-rose-500/5'
      default:
        return 'from-gray-500/10 to-slate-500/5'
    }
  }

  const getAvatarIcon = () => {
    const iconClass = "w-4 h-4 text-white"

    switch (model.class) {
      case 'MAN':
      case 'WOMAN':
        return <User className={iconClass} />
      case 'BOY':
      case 'GIRL':
        return <Users className={iconClass} />
      default:
        return <Sparkles className={iconClass} />
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

  return (
    <Card className={`group relative bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30 hover:border-slate-500/40 shadow-sm hover:shadow-xl transition-all duration-300 hover:scale-[1.02]`}>
      <CardContent className="p-4 overflow-visible">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-slate-600 to-slate-700 shadow-sm`}>
              {getAvatarIcon()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate text-sm leading-tight">
                {model.name}
              </h3>
            </div>
          </div>

          {/* Actions Menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowActions(!showActions)}
              className="h-7 w-7 p-0 hover:bg-slate-600/80 text-slate-100 hover:text-white transition-all"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>

            {showActions && (
              <div className="absolute right-0 top-9 bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] backdrop-blur-sm border border-slate-600 rounded-lg shadow-2xl z-20 min-w-[150px] overflow-visible">
                <div className="py-1">
                  <Link
                    href={`/models/${model.id}`}
                    className="flex items-center px-3 py-2 text-xs text-white hover:bg-slate-600/50 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 mr-2" />
                    Ver Detalhes
                  </Link>

                  <button
                    onClick={handleDelete}
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
        </div>

        {/* Progress Bar for Training */}
        {showProgress && model.status === 'TRAINING' && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-400 mb-1.5">
              <span>Progresso</span>
              <span className="font-medium">{model.progress || 0}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-400 to-amber-500 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${model.progress || 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {showError && model.errorMessage && (
          <div className="mb-3 p-2 bg-red-900/20 border border-red-700/50 rounded-lg">
            <p className="text-xs text-red-300 leading-relaxed">{model.errorMessage}</p>
          </div>
        )}

        {/* Action Button */}
        <div className="flex space-x-2">
          {model.status === 'READY' ? (
            <Button size="sm" asChild className="w-full h-7 text-xs bg-slate-600 hover:bg-slate-500 text-white border-slate-500/30 transition-colors">
              <Link href={`/generate?model=${model.id}`}>
                Gerar
              </Link>
            </Button>
          ) : (
            <Button size="sm" disabled className="w-full h-7 text-xs">
              Aguarde
            </Button>
          )}
        </div>
      </CardContent>

      {/* Click outside to close actions */}
      {showActions && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowActions(false)}
        />
      )}
    </Card>
  )
}