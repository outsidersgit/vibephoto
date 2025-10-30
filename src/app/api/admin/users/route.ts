import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

async function ensureAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return null
  return session
}

export async function GET() {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ users })
}

export async function POST(request: NextRequest) {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const schema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email(),
    role: z.enum(['user','admin']).optional(),
    plan: z.string().optional(),
    subscriptionStatus: z.string().optional()
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 })
  const created = await prisma.user.create({ data: parsed.data as any })
  return NextResponse.json({ user: created })
}

export async function PUT(request: NextRequest) {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const schema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    role: z.enum(['user','admin']).optional(),
    plan: z.string().optional(),
    subscriptionStatus: z.string().optional()
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 })
  const { id, ...rest } = parsed.data
  const updated = await prisma.user.update({ where: { id }, data: rest as any })
  return NextResponse.json({ user: updated })
}

export async function DELETE(request: NextRequest) {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await request.json()
  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}


