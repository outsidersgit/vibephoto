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
          const progress = Math.min(100, Math.round(((pkg.generatedImages || 0) / (pkg.totalImages || 1)) * 100))
          const isComplete = pkg.status === 'COMPLETED' || progress === 100
          const statusLabel = isComplete
            ? 'Concluído'
            : pkg.status === 'FAILED'
              ? 'Erro'
              : 'Gerando...'

          return (
            <Card 
              key={pkg.id} 
              className={cn(
                'border shadow-sm transition-all duration-300',
                isComplete 
                  ? 'border-green-300 bg-green-50/50' 
                  : 'border-gray-200 bg-white'
              )}
            >
              <CardHeader className="space-y-1">
                <CardTitle className={cn(
                  'text-sm font-semibold',
                  isComplete ? 'text-green-800' : 'text-gray-900'
                )}>
                  {pkg.packageName || 'Pacote de fotos'}
                </CardTitle>
                <CardDescription className={cn(
                  'text-xs',
                  isComplete ? 'text-green-600' : 'text-gray-500'
                )}>
                  {isComplete ? '✅ ' : ''}{statusLabel} • {pkg.generatedImages}/{pkg.totalImages} fotos
                  {isComplete && ' - Pronto na galeria!'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress 
                  value={progress} 
                  className={cn(
                    'h-2',
                    isComplete && 'bg-green-200'
                  )} 
                />
                <div className="flex justify-between text-xs">
                  <span className={isComplete ? 'text-green-700 font-medium' : 'text-gray-500'}>
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

