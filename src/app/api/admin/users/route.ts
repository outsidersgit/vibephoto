import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { broadcastCreditsUpdate, broadcastUserUpdate } from '@/lib/services/realtime-service'
import { getCreditsLimitForPlan } from '@/lib/constants/plans'
import { createInfluencer, generateCouponCode } from '@/lib/services/influencer-service'

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

const walletIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const InfluencerSchema = z.object({
  couponCode: z.string().trim().optional(),
  walletId: z.string().regex(walletIdRegex, 'Wallet ID inválido'),
  commissionPercentage: z.number().min(0).max(100).optional(),
  commissionFixedValue: z.number().min(0).optional()
}).optional()

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
      .pipe(SubscriptionStatusEnum),
    cpfCnpj: z.string().optional(),
    phone: z.string().optional(),
    postalCode: z.string().optional(),
    influencer: InfluencerSchema
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 })
  const payload = parsed.data as any
  const data: Record<string, any> = {
    name: payload.name,
    email: payload.email,
    subscriptionStatus: payload.subscriptionStatus,
  }
  // Map role string to Prisma enum (USER | ADMIN)
  data.role = ((payload.role || 'user') as string).toUpperCase()
  // Map plan if provided to Prisma enum (STARTER | PREMIUM | GOLD)
  if (payload.plan) data.plan = String(payload.plan).toUpperCase()
  if (payload.subscriptionStatus) data.subscriptionStatus = String(payload.subscriptionStatus).toUpperCase()
  if (payload.cpfCnpj) data.cpfCnpj = String(payload.cpfCnpj).replace(/\D/g, '')
  if (payload.phone) data.phone = String(payload.phone).replace(/\D/g, '')
  if (payload.postalCode) data.postalCode = String(payload.postalCode).replace(/\D/g, '')

  let created
  try {
    created = await prisma.user.create({ data })
    
    // Broadcast to admins
    try {
      const { broadcastAdminUserCreated } = await import('@/lib/services/realtime-service')
      await broadcastAdminUserCreated({
        id: created.id,
        email: created.email,
        name: created.name,
        plan: created.plan,
        role: created.role,
        createdAt: created.createdAt
      })
    } catch (broadcastError) {
      console.error('❌ Failed to broadcast admin user created event:', broadcastError)
      // Don't fail user creation if broadcast fails
    }
  } catch (error) {
    console.error('❌ [Admin Users] Erro ao criar usuário base:', error)
    return NextResponse.json({ error: 'Falha ao criar usuário.' }, { status: 500 })
  }

  if (payload.influencer) {
    const influencerData = payload.influencer
    const normalizedWallet = influencerData.walletId.trim().toLowerCase()
    let couponCode = influencerData.couponCode?.trim().toUpperCase() || ''

    if (!couponCode) {
      couponCode = generateCouponCode(payload.name || created.name || created.email)
    }

    const hasPercentage = typeof influencerData.commissionPercentage === 'number'
    const hasFixedValue = typeof influencerData.commissionFixedValue === 'number'

    if (hasPercentage && hasFixedValue) {
      await prisma.user.delete({ where: { id: created.id } }).catch(() => null)
      return NextResponse.json({
        error: 'Selecione apenas um tipo de comissão por influenciador (percentual ou valor fixo).'
      }, { status: 400 })
    }

    try {
      const [existingCoupon, existingWallet] = await Promise.all([
        prisma.influencer.findUnique({ where: { couponCode } }),
        prisma.influencer.findUnique({ where: { asaasWalletId: normalizedWallet } })
      ])

      if (existingCoupon) {
        throw new Error('DUPLICATE_COUPON')
      }

      if (existingWallet) {
        throw new Error('DUPLICATE_WALLET')
      }

      await createInfluencer({
        userId: created.id,
        couponCode,
        asaasWalletId: normalizedWallet,
        commissionPercentage: influencerData.commissionPercentage,
        commissionFixedValue: influencerData.commissionFixedValue ?? undefined,
        name: payload.name || created.name || created.email,
        incomeValue: undefined
      })
    } catch (error) {
      console.error('❌ [Admin Users] Erro ao configurar influenciador:', error)
      await prisma.user.delete({ where: { id: created.id } }).catch(() => null)

      if (error instanceof Error) {
        if (error.message === 'DUPLICATE_COUPON') {
          return NextResponse.json({ error: 'Código de afiliado já está em uso. Escolha outro código.' }, { status: 409 })
        }
        if (error.message === 'DUPLICATE_WALLET') {
          return NextResponse.json({ error: 'Este Wallet ID já está vinculado a outro influenciador.' }, { status: 409 })
        }
      }

      return NextResponse.json({
        error: 'Falha ao criar influenciador'
      }, { status: 500 })
    }
  }

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
    // CRITICAL: Incluir creditsBalance no broadcast
    if (updateData.plan || updateData.subscriptionStatus) {
      await broadcastCreditsUpdate(
        id,
        updatedUser.creditsUsed,
        updatedUser.creditsLimit,
        'ADMIN_UPDATE',
        updatedUser.creditsBalance // CRITICAL: Incluir creditsBalance
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


