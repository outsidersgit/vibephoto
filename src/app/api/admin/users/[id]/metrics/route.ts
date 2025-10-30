import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const role = String(((session?.user as any)?.role) || '').toUpperCase()
  if (!session || role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params

  const [imgGen, vidGen, upscales, models, photoPurchases, creditSpent, creditBought, lastGen, lastCredit] = await Promise.all([
    prisma.generation.count({ where: { userId: id } }).catch(() => 0),
    prisma.videoGeneration.count({ where: { userId: id } }).catch(() => 0),
    prisma.generation.count({ where: { userId: id, operationType: 'upscale' } as any }).catch(() => 0),
    prisma.aIModel.count({ where: { userId: id } }).catch(() => 0),
    prisma.userPackage?.count?.({ where: { userId: id } } as any).catch(() => 0),
    // Usa SQL com cast explícito para evitar conflito enum/texto
    prisma.$queryRaw<{ sum: number }[]>`SELECT COALESCE(SUM(amount),0) AS sum FROM "CreditTransaction" WHERE "userId" = ${id} AND "type"::text = 'SPENT'`
      .then(r => ({ _sum: { amount: (r?.[0]?.sum || 0) } }))
      .catch(() => ({ _sum: { amount: 0 } })),
    prisma.$queryRaw<{ sum: number }[]>`SELECT COALESCE(SUM(amount),0) AS sum FROM "CreditTransaction" WHERE "userId" = ${id} AND "type"::text = 'EARNED'`
      .then(r => ({ _sum: { amount: (r?.[0]?.sum || 0) } }))
      .catch(() => ({ _sum: { amount: 0 } })),
    prisma.generation.findFirst({ where: { userId: id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }).catch(() => null),
    prisma.creditTransaction.findFirst({ where: { userId: id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }).catch(() => null),
  ])

  const lastActivity = [lastGen?.createdAt, lastCredit?.createdAt].filter(Boolean).sort((a: any, b: any) => (b as any) - (a as any))[0] || null

  return NextResponse.json({
    totals: {
      imageGenerations: imgGen,
      videoGenerations: vidGen,
      upscales,
      models,
      photoPackagesPurchased: photoPurchases,
      creditsSpent: (creditSpent as any)?._sum?.amount || 0,
      creditsEarned: (creditBought as any)?._sum?.amount || 0,
      lastActivity,
    }
  })
}


