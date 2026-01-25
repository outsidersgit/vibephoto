'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { PackageGrid } from '@/components/packages/package-grid'
import { PackageModal } from '@/components/packages/package-modal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search,
  Crown,
  Package,
  TrendingUp,
  Clock,
  Users,
  Sparkles,
  Filter,
  Loader2
} from 'lucide-react'
import { EnhancedPhotoPackage } from '@/types'
import { usePackages } from '@/hooks/usePackages'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { PackageProgressPanel } from '@/components/generation/package-progress'

interface PackagesPageClientProps {
  initialPackages?: EnhancedPhotoPackage[]
}

export function PackagesPageClient({ initialPackages = [] }: PackagesPageClientProps) {
  // CRITICAL: Todos os hooks DEVEM ser chamados ANTES de qualquer early return
  // Violar esta regra causa erro React #300/#310
  const { data: session, status } = useSession()
  
  // CRITICAL: Verificar autenticação ANTES de renderizar conteúdo
  const isAuthorized = useAuthGuard()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPackage, setSelectedPackage] = useState<any>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [activeTab, setActiveTab] = useState('browse')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  // Performance: React Query com cache (Sprint 3 - Mobile Performance)
  // Usar initialPackages como fallback para melhor UX (sem delay inicial)
  const { data: packages = initialPackages, isLoading: loading, error: queryError } = usePackages()
  const error = queryError ? 'Erro ao carregar pacotes' : ''
  
  // CRITICAL: AGORA sim podemos fazer early returns após TODOS os hooks
  // Durante loading, mostrar loading state (não bloquear)
  // A página server-side já garantiu que há sessão válida
  if (status === 'loading' || isAuthorized === null) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-white">Carregando...</p>
        </div>
      </div>
    )
  }
  
  // CRITICAL: Se não autenticado após loading, aguardar (página server-side já verificou)
  if (status === 'unauthenticated' || !session?.user || isAuthorized === false) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-white">Verificando autenticação...</p>
        </div>
      </div>
    )
  }

  // Se temos initialPackages, não mostrar loading completo (melhor UX)
  // Apenas mostrar skeleton se não há dados iniciais E está carregando
  const showLoadingSkeleton = loading && initialPackages.length === 0


  const categoryOptions = [
    { id: 'LIFESTYLE', label: 'Lifestyle' },
    { id: 'PROFESSIONAL', label: 'Professional' },
    { id: 'CREATIVE', label: 'Creative' },
    { id: 'FASHION', label: 'Fashion' },
    { id: 'PREMIUM', label: 'Premium' }
  ]

  const filteredPackages = packages.filter(pkg => {
    const matchesSearch = pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         pkg.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         pkg.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesCategories = selectedCategories.length === 0 ||
                             selectedCategories.includes(pkg.category)

    return matchesSearch && matchesCategories
  })

  const stats = {
    totalPackages: packages.length,
    premiumPackages: packages.filter(p => p.isPremium).length,
    totalGenerations: packages.reduce((sum, p) => sum + (p.downloadCount || p.uses || 0), 0),
    averageRating: packages.length > 0 ? (packages.reduce((sum, p) => sum + (p.rating || 0), 0) / packages.length).toFixed(1) : '0'
  }

  if (error && packages.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <div className="text-red-600 mb-2">⚠️ Erro ao carregar pacotes</div>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header with Explanation */}
      <div className="text-center space-y-3 pb-6 border-b border-gray-700">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">
          Escolha um estilo e gere fotos prontas
        </h1>
        <p className="text-gray-400 text-xs md:text-sm max-w-2xl mx-auto leading-relaxed">
          Cada pacote gera fotos no estilo dos previews. Escolha o estilo e use seus créditos para gerar.
        </p>
      </div>

      {/* Package Progress Panel - Mostra apenas pacotes em andamento (ACTIVE ou GENERATING) */}
      <PackageProgressPanel />

      {/* Loading Skeleton (apenas se não há dados iniciais) */}
      {showLoadingSkeleton && (
        <>
          {/* Search and Filters Skeleton */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 h-10 bg-gray-800 rounded-lg animate-pulse"></div>
            <div className="w-32 h-10 bg-gray-800 rounded-lg animate-pulse"></div>
          </div>

          {/* Results Skeleton */}
          <div className="flex items-center justify-between mb-4">
            <div className="h-5 w-48 bg-gray-800 rounded animate-pulse"></div>
          </div>

          {/* Package Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-gray-800 rounded-lg overflow-hidden animate-pulse">
                <div className="aspect-video bg-gray-700"></div>
                <div className="p-4 space-y-3">
                  <div className="h-6 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-700 rounded w-full"></div>
                  <div className="h-4 bg-gray-700 rounded w-2/3"></div>
                  <div className="flex gap-2 mt-4">
                    <div className="h-6 bg-gray-700 rounded w-20"></div>
                    <div className="h-6 bg-gray-700 rounded w-16"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Conteúdo real (sempre renderizar se há dados, mesmo durante revalidação) */}
      {!showLoadingSkeleton && (
        <>
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar pacotes por nome, descrição ou tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
            />
          </div>

          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
              {selectedCategories.length > 0 && (
                <Badge className="ml-2 bg-blue-600 text-blue-100 text-xs">
                  {selectedCategories.length}
                </Badge>
              )}
            </Button>

            {/* Filter Dropdown */}
            {showFilterDropdown && (
              <div className="absolute top-full right-0 mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl min-w-64 z-50">
                <div className="p-4">
                  <h4 className="text-sm font-medium text-white mb-3">Categorias</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {categoryOptions.map((category) => (
                      <label key={category.id} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategories([...selectedCategories, category.id])
                            } else {
                              setSelectedCategories(selectedCategories.filter(c => c !== category.id))
                            }
                          }}
                          className="rounded border-gray-500 text-blue-600 focus:ring-blue-500 bg-gray-700"
                        />
                        <span className="text-sm text-gray-300">{category.label}</span>
                      </label>
                    ))}
                  </div>
                  {selectedCategories.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCategories([])}
                        className="w-full bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                      >
                        Limpar Filtros
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Backdrop to close filter dropdown */}
            {showFilterDropdown && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowFilterDropdown(false)}
              />
            )}
          </div>
        </div>

        {/* Active Category Chips */}
        {selectedCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedCategories.map((categoryId) => {
              const option = categoryOptions.find(option => option.id === categoryId)
              if (!option) return null

              return (
                <Button
                  key={categoryId}
                  variant="default"
                  className="text-xs bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-1"
                  onClick={() => setSelectedCategories(
                    selectedCategories.filter(cat => cat !== categoryId)
                  )}
                >
                  {option.label}
                  <span className="text-xs font-semibold">×</span>
                </Button>
              )
            })}
            <Button
              variant="ghost"
              className="text-xs text-gray-400 hover:text-white hover:bg-gray-700/60"
              onClick={() => setSelectedCategories([])}
            >
              Limpar categorias
            </Button>
          </div>
        )}

        {/* Results */}
        <div className="flex gap-6">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-400">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando pacotes...
                  </span>
                ) : (
                  `Mostrando ${filteredPackages.length} de ${packages.length} pacotes`
                )}
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-gray-800 rounded-lg overflow-hidden animate-pulse">
                    <div className="aspect-video bg-gray-700"></div>
                    <div className="p-4 space-y-3">
                      <div className="h-6 bg-gray-700 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-700 rounded w-full"></div>
                      <div className="h-4 bg-gray-700 rounded w-2/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PackageGrid
                packages={filteredPackages}
                onPackageSelect={setSelectedPackage}
              />
            )}
          </div>
        </div>

      {/* Package Modal */}
      {selectedPackage && (
        <PackageModal
          package={selectedPackage}
          onClose={() => setSelectedPackage(null)}
        />
      )}
        </>
      )}
    </div>
  )
}