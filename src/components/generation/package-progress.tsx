'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface UserPackageSummary {
  id: string
  packageId: string
  packageName?: string | null
  category?: string | null
  status: 'ACTIVE' | 'GENERATING' | 'FAILED' | 'COMPLETED'
  totalImages: number
  generatedImages: number
  failedImages: number
  previewUrls: string[]
  createdAt: string
  updatedAt: string
}

export function PackageProgressPanel() {
  const [packages, setPackages] = useState<UserPackageSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [completedPackages, setCompletedPackages] = useState<Set<string>>(new Set())
  const previousPackagesRef = useRef<UserPackageSummary[]>([])
  const isInitialLoadRef = useRef(true) // Flag para identificar primeira carga
  const { addToast } = useToast()

  const loadPackages = async () => {
    try {
      const response = await fetch('/api/user-packages')
      if (!response.ok) {
        throw new Error('Failed to load packages')
      }
      const payload = await response.json()
      const loadedPackages = payload.userPackages || []

      console.log('[PACKAGE_PROGRESS] Loaded packages from API:', loadedPackages.map(p => ({
        id: p.id,
        name: p.packageName,
        status: p.status,
        generatedImages: p.generatedImages,
        totalImages: p.totalImages,
        progress: Math.round((p.generatedImages / p.totalImages) * 100)
      })))

      setPackages(loadedPackages)
      
      // Na primeira carga, inicializar previousPackagesRef com os dados carregados
      // Isso evita que pacotes já completados sejam tratados como "novos"
      if (isInitialLoadRef.current) {
        previousPackagesRef.current = loadedPackages
        isInitialLoadRef.current = false
      }
    } catch (error) {
      console.error('Failed to load user packages:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPackages()
    const interval = setInterval(loadPackages, 6000)
    return () => clearInterval(interval)
  }, [])

  // Detectar quando um pacote completa e mostrar notificação
  // IMPORTANTE: Só detectar mudanças REAIS de status (não na primeira carga)
  useEffect(() => {
    // Ignorar primeira carga (já foi tratada no loadPackages)
    if (isInitialLoadRef.current || isLoading) {
      return
    }

    const previousPackages = previousPackagesRef.current
    const currentPackages = packages

    // Verificar se algum pacote mudou de status para COMPLETED
    currentPackages.forEach((currentPkg) => {
      if (currentPkg.status === 'COMPLETED') {
        const previousPkg = previousPackages.find((p) => p.id === currentPkg.id)
        
        // Só considerar uma mudança real se:
        // 1. O pacote existia antes E estava em ACTIVE ou GENERATING
        // 2. Agora está COMPLETED
        // Isso evita mostrar pacotes já completados na primeira carga
        const wasInProgress = previousPkg && 
          (previousPkg.status === 'ACTIVE' || previousPkg.status === 'GENERATING')
        const isNowCompleted = currentPkg.status === 'COMPLETED'
        
        if (wasInProgress && isNowCompleted) {
          // Adicionar aos pacotes completados para mostrar por mais tempo
          setCompletedPackages((prev) => new Set(prev).add(currentPkg.id))
          
          // Mostrar notificação toast
          addToast({
            type: 'success',
            title: 'Pacote concluído! 🎉',
            description: `${currentPkg.packageName || 'Pacote'} está pronto com ${currentPkg.generatedImages} fotos. Veja na galeria!`,
            duration: 8000,
            action: {
              label: 'Abrir galeria',
              onClick: () => {
                const url = `/gallery?package=${currentPkg.packageId}`
                window.location.href = url
              }
            }
          })

          // Remover da lista de completados após 10 segundos
          setTimeout(() => {
            setCompletedPackages((prev) => {
              const newSet = new Set(prev)
              newSet.delete(currentPkg.id)
              return newSet
            })
          }, 10000)
        }
      }
    })

    // Atualizar referência para próxima verificação
    previousPackagesRef.current = currentPackages
  }, [packages, addToast, isLoading])

  const visiblePackages = useMemo(() => {
    // Mostrar pacotes em andamento (ACTIVE ou GENERATING)
    // E também pacotes COMPLETED que acabaram de completar (por 10 segundos)
    return packages.filter((pkg) => {
      const isInProgress = pkg.status === 'ACTIVE' || pkg.status === 'GENERATING'
      const isRecentlyCompleted = pkg.status === 'COMPLETED' && completedPackages.has(pkg.id)

      // Log para debug
      if (pkg.status === 'COMPLETED') {
        console.log(`[PACKAGE_PROGRESS] Package ${pkg.id} (${pkg.packageName}):`, {
          status: pkg.status,
          generatedImages: pkg.generatedImages,
          totalImages: pkg.totalImages,
          isRecentlyCompleted,
          inCompletedSet: completedPackages.has(pkg.id),
          willBeVisible: isInProgress || isRecentlyCompleted
        })
      }

      return isInProgress || isRecentlyCompleted
    })
  }, [packages, completedPackages])

  if (!visiblePackages.length && !isLoading) {
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white">Pacotes em andamento</h3>
      <div className="grid gap-3">
        {visiblePackages.map((pkg) => {
          // CRITICAL: Calculate progress based on actual completed images vs total
          const generatedCount = pkg.generatedImages || 0
          const totalCount = pkg.totalImages || 1
          const progress = Math.min(100, Math.round((generatedCount / totalCount) * 100))

          // Package is complete when status is COMPLETED AND all images are generated
          const isComplete = pkg.status === 'COMPLETED' && generatedCount >= totalCount

          const statusLabel = isComplete
            ? 'Concluído'
            : pkg.status === 'FAILED'
              ? 'Erro'
              : 'Gerando...'

          console.log(`[PACKAGE_PROGRESS] Rendering ${pkg.packageName}:`, {
            generatedCount,
            totalCount,
            progress,
            status: pkg.status,
            isComplete
          })

          return (
            <Card
              key={pkg.id}
              className="border border-gray-200 bg-white shadow-sm transition-all duration-300"
            >
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm font-semibold text-gray-900">
                  {pkg.packageName || 'Pacote de fotos'}
                </CardTitle>
                <CardDescription className="text-xs text-gray-500 flex items-center gap-1.5">
                  {isComplete && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-600">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                  {statusLabel} • {pkg.generatedImages}/{pkg.totalImages} fotos
                  {isComplete && ' - Pronto na galeria!'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress
                  value={progress}
                  className="h-2"
                />
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">
                    {progress}%
                  </span>
                  {pkg.failedImages > 0 && (
                    <span className="text-red-500">{pkg.failedImages} falha(s)</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={isComplete ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      'flex-1 text-xs font-medium',
                      isComplete
                        ? 'bg-green-600 hover:bg-green-700 text-white border-green-600'
                        : 'border-gray-200 text-gray-700'
                    )}
                    onClick={() => {
                      const url = `/gallery?package=${pkg.packageId}`
                      window.location.href = url
                    }}
                  >
                    {isComplete ? 'Ver fotos na galeria' : 'Abrir galeria'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

