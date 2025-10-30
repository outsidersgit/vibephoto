import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

/**
 * GET /api/admin/feedback
 * Get feedback analytics (admin only)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = String(((session?.user as any)?.role) || '').toUpperCase()
  if (!session || role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const schema = z.object({
    q: z.string().optional(),
    userId: z.string().optional(),
    hasFeedback: z.enum(['yes','no']).optional(),
    page: z.string().optional(),
    limit: z.string().optional()
  })
  const parsed = schema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query', issues: parsed.error.issues }, { status: 400 })
  const { q, userId, hasFeedback } = parsed.data
  const page = Math.max(1, parseInt(parsed.data.page || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(parsed.data.limit || '20')))
  const skip = (page - 1) * limit

  const where: any = {}
  if (userId) where.userId = userId
  if (q) {
    where.OR = [
      { comment: { contains: q, mode: 'insensitive' } },
      { user: { name: { contains: q, mode: 'insensitive' } } },
      { user: { email: { contains: q, mode: 'insensitive' } } },
    ]
  }

  if (hasFeedback === 'no') {
    const [total, users] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        where: q ? { OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ] } : undefined,
        select: { id: true, name: true, email: true, createdAt: true, _count: { select: { feedbacks: true } } }
      })
    ])
    const items = users.filter(u => (u as any)._count.feedbacks === 0)
    return NextResponse.json({ mode: 'usersWithoutFeedback', page, limit, itemsTotal: total, items })
  }

  const [total, items] = await Promise.all([
    prisma.feedback.count({ where }),
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: { id: true, rating: true, comment: true, createdAt: true, userId: true, user: { select: { id: true, name: true, email: true } } }
    })
  ])
  return NextResponse.json({ mode: 'feedbacks', page, limit, total, items })
}
