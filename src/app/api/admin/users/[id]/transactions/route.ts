import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const skip = (page - 1) * limit

  const [creditTotal, credits, pkgTotal, packages] = await Promise.all([
    prisma.creditTransaction.count({ where: { userId: id } }),
    prisma.creditTransaction.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: { id: true, type: true, source: true, amount: true, description: true, createdAt: true }
    }),
    prisma.userPackage?.count?.({ where: { userId: id } } as any).catch(() => 0),
    prisma.userPackage?.findMany?.({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: { id: true, packageId: true, status: true, createdAt: true }
    } as any).catch(() => [])
  ])

  return NextResponse.json({
    credits: {
      total: creditTotal,
      page,
      limit,
      items: credits
    },
    photoPackages: {
      total: pkgTotal as number,
      page,
      limit,
      items: Array.isArray(packages) ? packages : []
    }
  })
}


