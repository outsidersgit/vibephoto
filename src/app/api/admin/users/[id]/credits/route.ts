import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const role = String(((session?.user as any)?.role) || '').toUpperCase()
  if (!session || role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const body = await request.json()
  const schema = z.object({ delta: z.number().int(), reason: z.string().optional() })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 })
  const { delta, reason } = parsed.data

  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const creditsLimit = user.creditsLimit ?? 0
  const newLimit = Math.max(0, creditsLimit + delta)

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { creditsLimit: newLimit } }),
    prisma.creditTransaction.create({
      data: {
        userId: id,
        type: delta >= 0 ? 'EARNED' : 'SPENT',
        source: delta >= 0 ? 'BONUS' : 'GENERATION',
        amount: Math.abs(delta),
        description: reason || 'Ajuste manual (admin)',
        balanceAfter: (user.creditsBalance ?? 0) + delta,
      } as any
    })
  ])

  return NextResponse.json({ ok: true })
}


