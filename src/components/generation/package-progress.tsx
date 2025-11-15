'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

  const loadPackages = async () => {
    try {
      const response = await fetch('/api/user-packages')
      if (!response.ok) {
        throw new Error('Failed to load packages')
      }
      const payload = await response.json()
      setPackages(payload.userPackages || [])
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

  const visiblePackages = useMemo(() => {
    return packages.filter((pkg) => pkg.status !== 'COMPLETED' || (pkg.generatedImages ?? 0) < (pkg.totalImages ?? 0))
  }, [packages])

  if (!visiblePackages.length && !isLoading) {
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">Pacotes em andamento</h3>
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
            <Card key={pkg.id} className="border-gray-200 bg-white shadow-sm">
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm font-semibold text-gray-900">
                  {pkg.packageName || 'Pacote de fotos'}
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  {statusLabel} • {pkg.generatedImages}/{pkg.totalImages} fotos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={progress} className="h-2" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{progress}%</span>
                  {pkg.failedImages > 0 && (
                    <span className="text-red-500">{pkg.failedImages} falha(s)</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'flex-1 text-xs',
                      isComplete ? 'border-green-200 text-green-700' : 'border-gray-200 text-gray-700'
                    )}
                    onClick={() => {
                      const url = `/gallery?package=${pkg.packageId}`
                      window.location.href = url
                    }}
                  >
                    {isComplete ? 'Ver fotos' : 'Abrir galeria'}
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

