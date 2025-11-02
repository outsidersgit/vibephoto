import { NextResponse } from 'next/server'
import { scanPackagesDirectory } from '@/lib/packages/scanner'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Performance: Cache de 10min para packages (Sprint 3 - Mobile Performance)
    // Pacotes são estáticos no filesystem, mudam raramente
    const getCachedPackages = unstable_cache(
      async () => {
        // 1) Tentar buscar do banco (fonte de verdade)
        try {
          const dbPackages = await prisma.photoPackage.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' }
          })
          if (dbPackages && dbPackages.length > 0) {
            return dbPackages.map((p: any) => ({
              id: p.id,
              name: p.name,
              category: p.category || 'PREMIUM',
              description: p.description || '',
              promptCount: Array.isArray(p.prompts) ? p.prompts.length : (p.promptCount || 0),
              previewImages: p.previewImages || [],
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
        } catch (err) {
          console.warn('⚠️ Failed to read photo packages from DB, will fallback to filesystem:', err)
        }

        // 2) Fallback: escanear diretório (compatibilidade)
        const fsPackages = scanPackagesDirectory()
        return fsPackages
      },
      ['packages-directory-scan'],
      {
        revalidate: 600, // 10 minutos
        tags: ['packages']
      }
    )

    const packages = await getCachedPackages()

    if (packages.length === 0) {
      console.warn('⚠️ No packages found in directory')
      return NextResponse.json({
        success: false,
        error: 'No packages found',
        packages: []
      })
    }

    return NextResponse.json({
      success: true,
      packages,
      total: packages.length
    })
  } catch (error) {
    console.error('❌ Error loading packages:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load packages',
        packages: []
      },
      { status: 500 }
    )
  }
}