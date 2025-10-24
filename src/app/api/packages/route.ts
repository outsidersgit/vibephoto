import { NextResponse } from 'next/server'
import { scanPackagesDirectory } from '@/lib/packages/scanner'

export async function GET() {
  try {
    console.log('📦 Scanning packages from directory...')

    const packages = scanPackagesDirectory()

    if (packages.length === 0) {
      console.warn('⚠️ No packages found in directory')
      return NextResponse.json({
        success: false,
        error: 'No packages found',
        packages: []
      })
    }

    console.log(`✅ Found ${packages.length} packages from directory`)

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