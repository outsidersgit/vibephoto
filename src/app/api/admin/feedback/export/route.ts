import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

function toCsvRow(values: (string | number | null | undefined)[]) {
  return values
    .map(v => {
      const s = v === null || v === undefined ? '' : String(v)
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
      return s
    })
    .join(',')
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = String(((session?.user as any)?.role) || '').toUpperCase()
  if (!session || role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || undefined
  const userId = searchParams.get('userId') || undefined
  const hasFeedback = searchParams.get('hasFeedback') as 'yes' | 'no' | null

  if (hasFeedback === 'no') {
    const users = await prisma.user.findMany({
      where: q ? { OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ] } : undefined,
      select: { id: true, name: true, email: true, createdAt: true, _count: { select: { feedbacks: true } } }
    })
    const rows = [
      toCsvRow(['userId','name','email','createdAt','feedbackCount']),
      ...users.filter(u => (u as any)._count.feedbacks === 0).map(u =>
        toCsvRow([u.id, u.name || '', u.email, u.createdAt.toISOString(), 0])
      )
    ].join('\n')
    return new NextResponse(rows, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="users-without-feedback.csv"'
      }
    })
  }

  const where: any = {}
  if (userId) where.userId = userId
  if (q) {
    where.OR = [
      { comment: { contains: q, mode: 'insensitive' } },
      { user: { name: { contains: q, mode: 'insensitive' } } },
      { user: { email: { contains: q, mode: 'insensitive' } } },
    ]
  }

  const items = await prisma.feedback.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: { id: true, rating: true, comment: true, createdAt: true, userId: true, user: { select: { id: true, name: true, email: true } } }
  })

  const rows = [
    toCsvRow(['feedbackId','userId','name','email','rating','comment','createdAt']),
    ...items.map(f => toCsvRow([
      f.id,
      f.userId,
      f.user?.name || '',
      f.user?.email || '',
      f.rating,
      f.comment || '',
      f.createdAt.toISOString()
    ]))
  ].join('\n')

  return new NextResponse(rows, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="feedback-export.csv"'
    }
  })
}



