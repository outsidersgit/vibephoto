import { requireActiveSubscription } from '@/lib/subscription'
import { PackagesPageClient } from './packages-client'
import { ProtectedPageScript } from '@/components/auth/protected-page-script'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'

// Force dynamic rendering para sempre buscar dados frescos
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Cache de pacotes no servidor (melhor performance)
async function getPackages() {
  const getCachedPackages = unstable_cache(
    async () => {
      const dbPackages = await prisma.photoPackage.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      })

      if (dbPackages && dbPackages.length > 0) {
        return dbPackages.map((p: any) => ({
          id: p.id,
          name: p.name,
          category: p.category || 'PREMIUM',
          description: p.description || '',
          promptCount: Array.isArray(p.prompts) ? p.prompts.length : 0,
          previewImages: p.previewUrls || [],
          price: p.price || 200,
          isPremium: p.isPremium ?? true,
          estimatedTime: p.estimatedTime || '5-8 min',
          popularity: p.popularity || 0,
          rating: p.rating || 5,
          uses: p.uses || 0,
          tags: p.tags || [],
          features: p.features || [],
          userStatus: { activated: false, status: null }
        }))
      }

      return []
    },
    ['packages-ssr'],
    {
      revalidate: 60, // Revalidar cache a cada 1 minuto no servidor
      tags: ['packages']
    }
  )

  return getCachedPackages()
}

export default async function PackagesPage() {
  const session = await requireActiveSubscription()
  
  // Buscar pacotes no servidor para SSR (melhor performance inicial)
  const initialPackages = await getPackages()

  return (
    <>
      <ProtectedPageScript />
      <div className="min-h-screen bg-gray-50" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>Pacotes de Fotos</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Content Area with Dark Theme */}
      <div className="bg-gray-900 border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PackagesPageClient initialPackages={initialPackages} />
        </div>
      </div>
    </div>
    </>
  )
}