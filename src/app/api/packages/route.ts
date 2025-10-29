import { NextResponse } from 'next/server'
import { scanPackagesDirectory } from '@/lib/packages/scanner'
import { unstable_cache } from 'next/cache'

export async function GET() {
  try {
    // Performance: Cache de 10min para packages (Sprint 3 - Mobile Performance)
    // Pacotes são estáticos no filesystem, mudam raramente
    const getCachedPackages = unstable_cache(
      async () => {
        if (process.env.NODE_ENV === 'development') {
          console.log('📦 Scanning packages from directory...')
        }
        
        const packages = scanPackagesDirectory()
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Found ${packages.length} packages from directory`)
        }
        
        return packages
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