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
        
        // Pegar o primeiro pacote em andamento
        const generatingPackage = packages.find((pkg: any) => 
          pkg.status === 'GENERATING' || pkg.status === 'ACTIVE'
        )
        
        if (generatingPackage) {
          // Só mostrar se o modal não estiver aberto
          if (!isModalOpen(generatingPackage.id)) {
            setActivePackage({
              userPackageId: generatingPackage.id,
              packageName: generatingPackage.packageName || 'Pacote',
              status: generatingPackage.status,
              generatedImages: generatingPackage.generatedImages || 0,
              totalImages: generatingPackage.totalImages || 20,
              progress: Math.min(100, Math.round(
                ((generatingPackage.generatedImages || 0) / (generatingPackage.totalImages || 1)) * 100
              ))
            })
            setIsVisible(true)
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
      } else if (data.status === 'COMPLETED' || data.status === 'FAILED') {
        // Remover após 2 segundos
        setTimeout(() => {
          setActivePackage(null)
          setIsVisible(false)
        }, 2000)
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

  return (
    <div 
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-40",
        "bg-white border border-gray-200 rounded-lg shadow-lg",
        "px-4 py-2.5 min-w-[320px] max-w-md",
        "animate-in slide-in-from-bottom-5 duration-300",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Progress Section */}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-900">
              Gerando pacote...
            </span>
            <span className="text-xs text-gray-600">
              {activePackage.generatedImages}/{activePackage.totalImages}
            </span>
          </div>
          
          <Progress 
            value={activePackage.progress} 
            className="h-1.5 bg-gray-100"
          />
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {activePackage.packageName}
            </span>
            <span className="text-xs font-medium text-purple-600">
              {activePackage.progress}%
            </span>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={() => setIsVisible(false)}
          className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="h-3.5 w-3.5 text-gray-500" />
        </button>
      </div>
    </div>
  )
}

