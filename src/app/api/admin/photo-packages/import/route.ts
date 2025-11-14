import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { scanPackagesDirectory, PackageData } from '@/lib/packages/scanner'

type PackageCategoryType = 'LIFESTYLE' | 'PROFESSIONAL' | 'CREATIVE' | 'FASHION' | 'PREMIUM'

function mapCategory(cat: string, name: string): PackageCategoryType {
  const normalizedCategory = (cat || '').trim().toUpperCase()
  const normalizedName = (name || '').trim().toUpperCase()

  if (['LIFESTYLE', 'PROFESSIONAL', 'CREATIVE', 'FASHION', 'PREMIUM'].includes(normalizedCategory)) {
    return normalizedCategory as PackageCategoryType
  }

  if ([
    'QUIET LUXURY',
    'SOFT POWER',
    'GOLDEN HOUR'
  ].includes(normalizedName)) {
    return 'PREMIUM'
  }

  if ([
    'EXECUTIVE MINIMALIST',
    'URBAN'
  ].includes(normalizedName)) {
    return 'PROFESSIONAL'
  }

  if ([
    'CONCEITUAL',
    'COMIC BOOK',
    'VINTAGE',
    '2000S CAM'
  ].includes(normalizedName)) {
    return 'CREATIVE'
  }

  if ([
    'MAKEUP',
    'REBEL',
    'OUTFIT'
  ].includes(normalizedName)) {
    return 'FASHION'
  }

  if ([
    'LIFE AESTHETIC',
    'SUMMER VIBES',
    'WANDERLUST',
    'NEO CASUAL',
    'MIRROR SELFIE',
    'PET SHOT',
    'FOOD MOOD',
    'FLIGHT MODE',
    'FITNESS AESTHETIC'
  ].includes(normalizedName)) {
    return 'LIFESTYLE'
  }

  return 'LIFESTYLE'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = String(((session?.user as any)?.role) || '').toUpperCase()
  if (!session || role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const scanned = await scanPackagesDirectory()

  if (!Array.isArray(scanned) || scanned.length === 0) {
    return NextResponse.json({ imported: 0, message: 'Nenhum pacote encontrado no filesystem' })
  }

  const results: Array<{ id: string; status: 'created' | 'updated' }> = []

  for (const pkg of scanned as PackageData[]) {
    const id = pkg.id
    const name = pkg.name
    const description = pkg.description
    const category = mapCategory(pkg.category, name)
    const prompts = (pkg as any).prompts || []
    const previewUrls = pkg.previewImages || []
    const isPremium = !!pkg.isPremium
    const price = typeof pkg.price === 'number' ? pkg.price : null

    const existing = await prisma.photoPackage.findUnique({ where: { id } })
    if (existing) {
      await prisma.photoPackage.update({
        where: { id },
        data: { name, description, category, prompts, previewUrls, isPremium, price, isActive: true }
      })
      results.push({ id, status: 'updated' })
    } else {
      await prisma.photoPackage.create({
        data: { id, name, description, category, prompts, previewUrls, isPremium, price, isActive: true }
      })
      results.push({ id, status: 'created' })
    }
  }

  return NextResponse.json({ imported: results.length, results })
}


