import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function endOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const range = searchParams.get('range') || '30d'
  const days = range.endsWith('d') ? Math.max(1, parseInt(range)) : 30

  const now = new Date()
  const series: Array<{ date: string; newUsers: number; cancellations: number; generations: number }> = []

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const from = startOfDay(day)
    const to = endOfDay(day)

    const [newUsers, cancellations, gens] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.user.count({ where: { updatedAt: { gte: from, lte: to }, subscriptionStatus: 'CANCELLED' as any } }),
      prisma.generation.count({ where: { createdAt: { gte: from, lte: to } } }),
    ])

    series.push({
      date: from.toISOString().slice(0, 10),
      newUsers,
      cancellations,
      generations: gens,
    })
  }

  return NextResponse.json({ series })
}


