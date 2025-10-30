import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { scanPackagesDirectory, PackageData } from '@/lib/packages/scanner'

function mapCategory(cat: string): 'PROFESSIONAL' | 'SOCIAL' | 'THEMATIC' | 'ARTISTIC' | 'FANTASY' {
  const c = (cat || '').toUpperCase()
  if (['PREMIUM','PROFESSIONAL','EXECUTIVE','BUSINESS'].includes(c)) return 'PROFESSIONAL'
  if (['SOCIAL','INSTAGRAM','LIFESTYLE','URBAN'].includes(c)) return 'SOCIAL'
  if (['FASHION','VINTAGE','MAKEUP','OUTFIT','PET','COMIC','2000S','SUMMER','REBEl','URBAN','MIRROR','GOLDEN','FOOD','FLIGHT','NEO','QUIET','SOFT','VINTAGE','NOMADE'].some(k=>c.includes(k))) return 'THEMATIC'
  if (['ART','ARTISTIC','CREATIVE','CONCEITUAL'].includes(c)) return 'ARTISTIC'
  if (['FANTASY'].includes(c)) return 'FANTASY'
  return 'THEMATIC'
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
    const category = mapCategory(pkg.category)
    const prompts = (pkg as any).prompts || []
    const previewUrls = pkg.previewImages || []
    const isPremium = !!pkg.isPremium
    const price = typeof pkg.price === 'number' ? pkg.price : null

    const existing = await prisma.photoPackage.findUnique({ where: { id } })
    if (existing) {
      await prisma.photoPackage.update({
        where: { id },
        data: { name, description, category, prompts, previewUrls, isPremium, price: price ?? undefined, isActive: true }
      })
      results.push({ id, status: 'updated' })
    } else {
      await prisma.photoPackage.create({
        data: { id, name, description, category, prompts, previewUrls, isPremium, price: price ?? undefined, isActive: true }
      })
      results.push({ id, status: 'created' })
    }
  }

  return NextResponse.json({ imported: results.length, results })
}


