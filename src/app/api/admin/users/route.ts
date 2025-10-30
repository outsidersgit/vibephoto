import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

async function ensureAdmin() {
  const session = await getServerSession(authOptions)
  const role = String(((session?.user as any)?.role) || '').toUpperCase()
  if (!session || role !== 'ADMIN') return null
  return session
}

export async function GET() {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ users })
}

const PlanEnum = z.enum(['STARTER','PREMIUM','GOLD'])
const RoleEnumUpper = z.enum(['USER','ADMIN'])
const SubscriptionStatusEnum = z.enum(['ACTIVE','CANCELLED','OVERDUE','EXPIRED','PENDING']).optional()

export async function POST(request: NextRequest) {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const schema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email(),
    role: z.union([z.enum(['user','admin']), RoleEnumUpper]).optional(),
    plan: z
      .union([
        z.string().transform(v => v.toUpperCase()),
        PlanEnum
      ])
      .pipe(PlanEnum)
      .optional(),
    subscriptionStatus: z
      .union([
        z.string().transform(v => v.toUpperCase()),
        SubscriptionStatusEnum
      ])
      .pipe(SubscriptionStatusEnum)
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 })
  const payload = parsed.data as any
  const data: any = {
    name: payload.name,
    email: payload.email,
    subscriptionStatus: payload.subscriptionStatus,
  }
  // Map role string to Prisma enum (USER | ADMIN)
  data.role = ((payload.role || 'user') as string).toUpperCase()
  // Map plan if provided to Prisma enum (STARTER | PREMIUM | GOLD)
  if (payload.plan) data.plan = String(payload.plan).toUpperCase()
  if (payload.subscriptionStatus) data.subscriptionStatus = String(payload.subscriptionStatus).toUpperCase()

  const created = await prisma.user.create({ data })
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
    role: z.union([z.enum(['user','admin']), RoleEnumUpper]).optional(),
    plan: z
      .union([
        z.string().transform(v => v.toUpperCase()),
        PlanEnum
      ])
      .pipe(PlanEnum)
      .optional(),
    subscriptionStatus: z
      .union([
        z.string().transform(v => v.toUpperCase()),
        SubscriptionStatusEnum
      ])
      .pipe(SubscriptionStatusEnum)
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 })
  const { id, ...rest } = parsed.data
  const updateData: any = { ...rest }
  if (typeof rest.role === 'string') updateData.role = rest.role.toUpperCase()
  if (typeof rest.plan === 'string') updateData.plan = rest.plan.toUpperCase()
  if (typeof rest.subscriptionStatus === 'string') updateData.subscriptionStatus = rest.subscriptionStatus.toUpperCase()
  const updated = await prisma.user.update({ where: { id }, data: updateData })
  return NextResponse.json({ user: updated })
}

export async function DELETE(request: NextRequest) {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await request.json()
  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}


