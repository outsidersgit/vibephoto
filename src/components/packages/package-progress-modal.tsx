'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'
import { cn } from '@/lib/utils'

interface PackageProgressModalProps {
  isOpen: boolean
  onClose: () => void
  userPackageId: string
  packageName: string
  totalImages: number
  onComplete?: () => void
}

export function PackageProgressModal({
  isOpen,
  onClose,
  userPackageId,
  packageName,
  totalImages,
  onComplete
}: PackageProgressModalProps) {
  const [status, setStatus] = useState<'GENERATING' | 'COMPLETED' | 'FAILED'>('GENERATING')
  const [generatedImages, setGeneratedImages] = useState(0)
  const [progress, setProgress] = useState(0)
  const [failedImages, setFailedImages] = useState(0)

  // SSE para atualizações em tempo real
  useRealtimeUpdates({
    onPackageGenerationUpdate: (packageId, data) => {
      if (packageId === userPackageId) {
        console.log('📦 [PackageProgressModal] Update received:', data)
        setStatus(data.status)
        setGeneratedImages(data.generatedImages)
        setProgress(data.progress)
        setFailedImages(data.failedImages || 0)

        // Se completou, chamar callback
        if (data.status === 'COMPLETED' && onComplete) {
          setTimeout(() => {
            onComplete()
          }, 2000) // Aguardar 2s para mostrar a conclusão
        }
      }
    }
  })

  const isCompleted = status === 'COMPLETED'
  const isFailed = status === 'FAILED'
  const isGenerating = status === 'GENERATING'

  const handleClose = () => {
    // Salvar no localStorage que o modal foi fechado pelo usuário
    localStorage.setItem(`package_modal_closed_${userPackageId}`, 'true')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {isCompleted ? 'Pacote Concluído! 🎉' : isFailed ? 'Geração Falhou' : 'Gerando Pacote'}
              </h3>
              <p className="text-sm text-gray-600">{packageName}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8"
              disabled={isGenerating}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className={cn(
                "font-medium",
                isCompleted && "text-green-600",
                isFailed && "text-red-600",
                isGenerating && "text-gray-700"
              )}>
                {isCompleted ? 'Todas as fotos prontas!' : isFailed ? 'Erro na geração' : 'Gerando fotos...'}
              </span>
              <span className="text-gray-600">
                {generatedImages}/{totalImages}
              </span>
            </div>
            
            <Progress 
              value={progress} 
              className={cn(
                "h-2 transition-all",
                isCompleted && "bg-green-100",
                isFailed && "bg-red-100"
              )}
            />

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{progress}%</span>
              {failedImages > 0 && (
                <span className="text-red-500">{failedImages} falha(s)</span>
              )}
            </div>
          </div>

          {/* Status Icon */}
          <div className="flex items-center justify-center py-4">
            {isGenerating && (
              <div className="flex flex-col items-center space-y-2">
                <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
                <p className="text-sm text-gray-600">Processando imagens com IA...</p>
              </div>
            )}
            {isCompleted && (
              <div className="flex flex-col items-center space-y-2">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
                <p className="text-sm text-gray-600">Confira suas fotos na galeria!</p>
              </div>
            )}
            {isFailed && (
              <div className="flex flex-col items-center space-y-2">
                <AlertCircle className="h-12 w-12 text-red-600" />
                <p className="text-sm text-gray-600">Ocorreu um erro na geração</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {isCompleted && (
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  window.location.href = '/gallery'
                }}
              >
                Ver na Galeria
              </Button>
            )}
            {isGenerating && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClose}
              >
                Continuar Navegando
              </Button>
            )}
            {isFailed && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClose}
              >
                Fechar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

