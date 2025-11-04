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
    // CRÍTICO: Usar $queryRaw para contornar problema do Prisma com Json[] vs Json
    const plans = await prisma.$queryRaw<Array<{
      id: string
      planId: string
      name: string
      description: string
      isActive: boolean
      popular: boolean
      color: string | null
      monthlyPrice: number
      annualPrice: number
      monthlyEquivalent: number
      credits: number
      models: number
      resolution: string
      features: any
      createdAt: Date
      updatedAt: Date
      deletedAt: Date | null
    }>>`
      SELECT 
        id, 
        "planId",
        name, 
        description, 
        "isActive", 
        popular, 
        color, 
        "monthlyPrice", 
        "annualPrice", 
        "monthlyEquivalent", 
        credits, 
        models, 
        resolution, 
        features,
        "createdAt", 
        "updatedAt", 
        "deletedAt"
      FROM subscription_plans
      WHERE "deletedAt" IS NULL
      ORDER BY popular DESC, "monthlyPrice" ASC
    `

    // Converter features para array se necessário
    const plansWithFeatures = plans.map(planRaw => {
      let features = planRaw.features
      if (!Array.isArray(features)) {
        try {
          if (typeof features === 'string') {
            features = JSON.parse(features)
          }
          if (!Array.isArray(features)) {
            features = []
          }
        } catch {
          features = []
        }
      }

      return {
        ...planRaw,
        features: Array.isArray(features) 
          ? (features as any[]).map((f: any) => typeof f === 'string' ? f : f.toString())
          : []
      }
    })

    return NextResponse.json({ plans: plansWithFeatures })
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
    // CRÍTICO: Usar $queryRaw para contornar problema do Prisma com Json[] vs Json
    const existingPlans = await prisma.$queryRaw<Array<{
      id: string
      planId: string
      deletedAt: Date | null
    }>>`
      SELECT id, "planId", "deletedAt"
      FROM subscription_plans
      WHERE "planId" = ${parsed.data.planId}::"Plan"
      LIMIT 1
    `

    const existing = existingPlans && existingPlans.length > 0 ? existingPlans[0] : null

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

