import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
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

  // Ajuste deve afetar o saldo disponível (creditsBalance), não o limite do plano.
  const currentBalance = user.creditsBalance ?? 0
  const newBalance = Math.max(0, currentBalance + delta)

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { creditsBalance: newBalance } }),
    prisma.creditTransaction.create({
      data: {
        userId: id,
        type: delta >= 0 ? 'EARNED' : 'SPENT',
        source: delta >= 0 ? 'BONUS' : 'ADJUSTMENT',
        amount: Math.abs(delta),
        description: reason || 'Ajuste manual (admin)',
        balanceAfter: newBalance,
      } as any
    })
  ])

  // Invalida cache do saldo de créditos exibido no app
  try { revalidateTag(`user-${id}-credits`) } catch {}

  return NextResponse.json({ ok: true })
}


