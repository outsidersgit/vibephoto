'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Sparkles } from 'lucide-react'

interface Package {
  id: string
  name: string
  category: string
  description: string
  promptCount: number
  previewImages: string[]
  price: number
  isPremium: boolean
  estimatedTime: string
  popularity: number
  rating: number
  uses: number
  tags: string[]
  features?: string[]
}

interface PackageGridProps {
  packages: Package[]
  onPackageSelect: (pkg: Package) => void
}

export function PackageGrid({ packages, onPackageSelect }: PackageGridProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'PROFESSIONAL':
        return '👔'
      case 'SOCIAL':
        return '📱'
      case 'FANTASY':
        return '🏰'
      case 'ARTISTIC':
        return '🎨'
      default:
        return '📦'
    }
  }

  if (packages.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Nenhum pacote encontrado</h3>
        <p className="text-gray-400">
          Tente ajustar sua busca ou filtros para encontrar o que você está procurando
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {packages.map((pkg) => (
        <Card
          key={pkg.id}
          className="group bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300 cursor-pointer relative overflow-hidden"
          onClick={() => onPackageSelect(pkg)}
        >

          {/* Preview Images Grid */}
          <div className="aspect-[4/3] overflow-hidden bg-gray-900">
            <div className="grid grid-cols-2 h-full gap-1">
              {(pkg.previewImages || []).slice(0, 4).map((image, index) => (
                <div key={index} className="relative overflow-hidden">
                  <img
                    src={image}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                  <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center hidden">
                    <span className="text-2xl opacity-50">
                      {getCategoryIcon(pkg.category)}
                    </span>
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent group-hover:from-black/60 transition-all duration-300" />
                </div>
              ))}
            </div>
          </div>

          <CardContent className="p-3">
            <h3 className="text-sm font-medium text-white text-center group-hover:text-blue-400 transition-colors">
              {pkg.name}
            </h3>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}