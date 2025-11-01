import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { broadcastCreditsUpdate, broadcastUserUpdate } from '@/lib/services/realtime-service'
import { getCreditsLimitForPlan } from '@/lib/constants/plans'

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
  
  // CRITICAL: Se plano mudou, atualizar creditsLimit
  if (updateData.plan) {
    updateData.creditsLimit = getCreditsLimitForPlan(updateData.plan as any)
    // Se plano mudou e status é ACTIVE, resetar créditos usados
    if (updateData.subscriptionStatus === 'ACTIVE' || (!updateData.subscriptionStatus)) {
      // Verificar status atual para ver se deve resetar
      const currentUser = await prisma.user.findUnique({ where: { id }, select: { subscriptionStatus: true } })
      if (currentUser?.subscriptionStatus === 'ACTIVE') {
        updateData.creditsUsed = 0
      }
    }
  }
  
  const updated = await prisma.user.update({ where: { id }, data: updateData })
  
  // CRITICAL: Buscar dados atualizados completos do usuário para broadcast
  const updatedUser = await prisma.user.findUnique({
    where: { id },
    select: {
      plan: true,
      subscriptionStatus: true,
      creditsUsed: true,
      creditsLimit: true,
      creditsBalance: true
    }
  })
  
  // CRITICAL: Broadcast evento SSE para atualização em tempo real
  if (updatedUser) {
    // Se mudou algo relacionado a créditos, broadcast credits_updated
    if (updateData.plan || updateData.subscriptionStatus) {
      await broadcastCreditsUpdate(
        id,
        updatedUser.creditsUsed,
        updatedUser.creditsLimit,
        'ADMIN_UPDATE'
      ).catch((error) => {
        console.error('❌ [Admin Users] Erro ao broadcast créditos:', error)
      })
    }
    
    // Broadcast evento genérico de atualização de usuário
    const updatedFields: any = {}
    if (updateData.plan) updatedFields.plan = updatedUser.plan
    if (updateData.subscriptionStatus) updatedFields.subscriptionStatus = updatedUser.subscriptionStatus
    if (updateData.name) updatedFields.name = updated.name
    if (updateData.email) updatedFields.email = updated.email
    
    if (Object.keys(updatedFields).length > 0) {
      await broadcastUserUpdate(
        id,
        {
          ...updatedFields,
          creditsUsed: updatedUser.creditsUsed,
          creditsLimit: updatedUser.creditsLimit,
          creditsBalance: updatedUser.creditsBalance
        },
        'ADMIN_UPDATE'
      ).catch((error) => {
        console.error('❌ [Admin Users] Erro ao broadcast user update:', error)
      })
    }
  }
  
  return NextResponse.json({ user: updated })
}

export async function DELETE(request: NextRequest) {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await request.json()
  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}


