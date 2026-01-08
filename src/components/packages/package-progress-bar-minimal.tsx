'use client'

import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { X } from 'lucide-react'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'
import { cn } from '@/lib/utils'

interface PackageProgressBarMinimalProps {
  className?: string
}

interface PackageProgress {
  userPackageId: string
  packageName: string
  status: 'GENERATING' | 'COMPLETED' | 'FAILED'
  generatedImages: number
  totalImages: number
  progress: number
}

export function PackageProgressBarMinimal({ className }: PackageProgressBarMinimalProps) {
  const [activePackage, setActivePackage] = useState<PackageProgress | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  // Verificar se há modal aberto para este pacote
  const isModalOpen = (packageId: string) => {
    return localStorage.getItem(`package_modal_open_${packageId}`) === 'true'
  }

  // Carregar pacote em andamento do servidor
  useEffect(() => {
    const loadActivePackage = async () => {
      try {
        const response = await fetch('/api/user-packages?status=GENERATING')
        if (!response.ok) return
        
        const data = await response.json()
        const packages = data.userPackages || []
        
        // Pegar o primeiro pacote em andamento ou recém-completado
        const generatingPackage = packages.find((pkg: any) =>
          pkg.status === 'GENERATING' || pkg.status === 'ACTIVE' || pkg.status === 'COMPLETED'
        )
        
        if (generatingPackage) {
          // Só mostrar se o modal não estiver aberto
          if (!isModalOpen(generatingPackage.id)) {
            // CRITICAL: Always show 100% progress when status is COMPLETED
            const isCompleted = generatingPackage.status === 'COMPLETED'
            const calculatedProgress = Math.min(100, Math.round(
              ((generatingPackage.generatedImages || 0) / (generatingPackage.totalImages || 1)) * 100
            ))

            setActivePackage({
              userPackageId: generatingPackage.id,
              packageName: generatingPackage.packageName || 'Pacote',
              status: generatingPackage.status,
              generatedImages: isCompleted ? generatingPackage.totalImages : (generatingPackage.generatedImages || 0),
              totalImages: generatingPackage.totalImages || 20,
              progress: isCompleted ? 100 : calculatedProgress
            })
            setIsVisible(true)

            // Auto-hide after 5 seconds if completed
            if (isCompleted) {
              setTimeout(() => {
                setActivePackage(null)
                setIsVisible(false)
              }, 5000)
            }
          }
        }
      } catch (error) {
        console.error('Failed to load active package:', error)
      }
    }

    loadActivePackage()
    
    // Verificar a cada 5 segundos como fallback
    const interval = setInterval(loadActivePackage, 5000)
    return () => clearInterval(interval)
  }, [])

  // SSE para atualizações em tempo real
  useRealtimeUpdates({
    onPackageGenerationUpdate: (packageId, data) => {
      console.log('📦 [PackageProgressBarMinimal] SSE update:', { packageId, data })
      
      // Verificar se o modal está aberto
      if (isModalOpen(packageId)) {
        console.log('📦 [PackageProgressBarMinimal] Modal is open, hiding bar')
        setIsVisible(false)
        return
      }

      // Atualizar ou criar activePackage
      if (data.status === 'GENERATING' || data.status === 'ACTIVE') {
        setActivePackage({
          userPackageId: packageId,
          packageName: data.packageName || 'Pacote',
          status: data.status,
          generatedImages: data.generatedImages,
          totalImages: data.totalImages,
          progress: data.progress
        })
        setIsVisible(true)
      } else if (data.status === 'COMPLETED') {
        // Atualizar para mostrar estado de sucesso
        setActivePackage({
          userPackageId: packageId,
          packageName: data.packageName || 'Pacote',
          status: 'COMPLETED',
          generatedImages: data.totalImages,
          totalImages: data.totalImages,
          progress: 100
        })
        setIsVisible(true)
        // Remover após 5 segundos
        setTimeout(() => {
          setActivePackage(null)
          setIsVisible(false)
        }, 5000)
      } else if (data.status === 'FAILED') {
        // Remover após 3 segundos se falhar
        setTimeout(() => {
          setActivePackage(null)
          setIsVisible(false)
        }, 3000)
      }
    }
  })

  // Esconder se não há pacote ou se o modal estiver aberto
  useEffect(() => {
    if (activePackage && isModalOpen(activePackage.userPackageId)) {
      setIsVisible(false)
    }
  }, [activePackage])

  if (!isVisible || !activePackage) {
    return null
  }

  const isCompleted = activePackage.status === 'COMPLETED'
  const isFailed = activePackage.status === 'FAILED'

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-40",
        "rounded-lg shadow-lg px-4 py-2.5 min-w-[320px] max-w-md",
        "animate-in slide-in-from-bottom-5 duration-300",
        isCompleted && "bg-gradient-to-r from-green-500 to-emerald-600 border-2 border-green-400",
        isFailed && "bg-gradient-to-r from-red-500 to-red-600 border-2 border-red-400",
        !isCompleted && !isFailed && "bg-white border border-gray-200",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Progress Section */}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-xs font-semibold",
              isCompleted && "text-white drop-shadow-md",
              isFailed && "text-white drop-shadow-md",
              !isCompleted && !isFailed && "text-gray-900"
            )}>
              {isCompleted ? '✓ Pacote concluído!' : isFailed ? '✗ Erro na geração' : 'Gerando pacote...'}
            </span>
            <span className={cn(
              "text-xs font-medium",
              isCompleted && "text-white drop-shadow-md",
              isFailed && "text-white drop-shadow-md",
              !isCompleted && !isFailed && "text-gray-600"
            )}>
              {activePackage.generatedImages}/{activePackage.totalImages}
            </span>
          </div>

          <Progress
            value={activePackage.progress}
            className={cn(
              "h-1.5",
              isCompleted && "bg-green-300/50",
              isFailed && "bg-red-300/50",
              !isCompleted && !isFailed && "bg-gray-100"
            )}
          />

          <div className="flex items-center justify-between">
            <span className={cn(
              "text-xs font-medium",
              isCompleted && "text-green-50 drop-shadow",
              isFailed && "text-red-50 drop-shadow",
              !isCompleted && !isFailed && "text-gray-500"
            )}>
              {activePackage.packageName}
            </span>
            <span className={cn(
              "text-xs font-bold",
              isCompleted && "text-white drop-shadow-md",
              isFailed && "text-white drop-shadow-md",
              !isCompleted && !isFailed && "text-purple-600"
            )}>
              {activePackage.progress}%
            </span>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={() => setIsVisible(false)}
          className={cn(
            "flex-shrink-0 p-1 rounded transition-colors",
            isCompleted && "hover:bg-green-400/30 text-white",
            isFailed && "hover:bg-red-400/30 text-white",
            !isCompleted && !isFailed && "hover:bg-gray-100 text-gray-500"
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

