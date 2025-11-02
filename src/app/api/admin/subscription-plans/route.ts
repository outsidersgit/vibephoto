import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { Plan } from '@prisma/client'

async function ensureAdmin() {
  const session = await getServerSession(authOptions)
  const role = String(((session?.user as any)?.role) || '').toUpperCase()
  if (!session || role !== 'ADMIN') return null
  return session
}

const createPlanSchema = z.object({
  planId: z.enum(['STARTER', 'PREMIUM', 'GOLD']),
  name: z.string().min(1),
  description: z.string().min(1),
  isActive: z.boolean().default(true),
  popular: z.boolean().default(false),
  color: z.enum(['blue', 'purple', 'yellow']).optional(),
  monthlyPrice: z.number().positive(),
  annualPrice: z.number().positive(),
  monthlyEquivalent: z.number().positive(),
  credits: z.number().int().positive(),
  models: z.number().int().positive(),
  resolution: z.string().min(1),
  features: z.array(z.string()).min(1)
})

export async function GET() {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: {
        deletedAt: null
      },
      orderBy: [
        { popular: 'desc' },
        { monthlyPrice: 'asc' }
      ]
    })

    return NextResponse.json({ plans })
  } catch (error: any) {
    console.error('❌ [ADMIN_SUBSCRIPTION_PLANS] Error fetching plans:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createPlanSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    // Verificar se já existe plano com este planId
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { planId: parsed.data.planId }
    })

    if (existing && !existing.deletedAt) {
      return NextResponse.json(
        { error: `Plano ${parsed.data.planId} já existe. Use PUT para atualizar.` },
        { status: 409 }
      )
    }

    // Se existe mas está deletado, restaurar
    if (existing && existing.deletedAt) {
      const updated = await prisma.subscriptionPlan.update({
        where: { id: existing.id },
        data: {
          ...parsed.data,
          deletedAt: null,
          updatedAt: new Date()
        }
      })
      revalidateTag('subscription-plans')
      return NextResponse.json({ plan: updated })
    }

    const created = await prisma.subscriptionPlan.create({
      data: parsed.data
    })

    revalidateTag('subscription-plans')
    console.log('✅ [ADMIN_SUBSCRIPTION_PLANS] Plan created:', created.id)

    return NextResponse.json({ plan: created })
  } catch (error: any) {
    console.error('❌ [ADMIN_SUBSCRIPTION_PLANS] Error creating plan:', error)
    
    // Unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Plano com este ID já existe' },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

