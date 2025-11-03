import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

async function ensureAdmin() {
  const session = await getServerSession(authOptions)
  const role = String(((session?.user as any)?.role) || '').toUpperCase()
  if (!session || role !== 'ADMIN') return null
  return session
}

// Schema flexível para edição - permite valores 0, strings vazias e arrays vazios
// Validação rigorosa apenas na criação (não aqui)
const updatePlanSchema = z.object({
  name: z.string().optional(), // Permite string vazia
  description: z.string().optional(), // Permite string vazia
  isActive: z.boolean().optional(),
  popular: z.boolean().optional(),
  color: z.enum(['blue', 'purple', 'yellow']).optional().nullable(),
  monthlyPrice: z.number().nonnegative().optional(), // Permite 0 (não negativo)
  annualPrice: z.number().nonnegative().optional(), // Permite 0 (não negativo)
  monthlyEquivalent: z.number().nonnegative().optional(), // Permite 0 (não negativo)
  credits: z.number().int().nonnegative().optional(), // Permite 0 (não negativo)
  models: z.number().int().nonnegative().optional(), // Permite 0 (não negativo)
  resolution: z.string().optional(), // Permite string vazia
  features: z.array(z.string()).optional() // Permite array vazio
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { id } = await params
    
    // CRÍTICO: Buscar pelo id (row ID) e verificar deletedAt separadamente
    // O id é o identificador único da row no banco (ex: sub_plan_starter)
    // Usar $queryRaw para contornar problema do Prisma com Json[] vs Json
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
      WHERE id = ${id}
        AND "deletedAt" IS NULL
      LIMIT 1
    `

    if (!plans || plans.length === 0) {
      console.error('❌ [ADMIN_SUBSCRIPTION_PLANS] Plan not found by id:', id)
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }

    const planRaw = plans[0]

    // Verificar se está deletado (soft delete)
    if (planRaw.deletedAt) {
      console.warn('⚠️ [ADMIN_SUBSCRIPTION_PLANS] Plan is deleted:', id)
      return NextResponse.json({ error: 'Plano foi deletado' }, { status: 404 })
    }

    // Converter features para array se necessário
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

    const plan = {
      ...planRaw,
      features
    }

    console.log('✅ [ADMIN_SUBSCRIPTION_PLANS] Plan found:', { id: plan.id, planId: plan.planId, name: plan.name })
    return NextResponse.json({ plan })
  } catch (error: any) {
    console.error('❌ [ADMIN_SUBSCRIPTION_PLANS] Error fetching plan:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updatePlanSchema.safeParse(body)

    if (!parsed.success) {
      console.error('❌ [ADMIN_SUBSCRIPTION_PLANS] Validation error:', parsed.error.issues)
      return NextResponse.json(
        { 
          error: 'Dados inválidos', 
          issues: parsed.error.issues.map((issue: any) => ({
            path: issue.path,
            message: issue.message,
            code: issue.code
          }))
        },
        { status: 400 }
      )
    }

    // CRÍTICO: Buscar pelo id (row ID), não pelo planId
    // O id é o identificador único da row no banco (ex: sub_plan_starter)
    // Usar $queryRaw para contornar problema do Prisma com Json[] vs Json
    const existingPlans = await prisma.$queryRaw<Array<{
      id: string
      planId: string
      deletedAt: Date | null
    }>>`
      SELECT id, "planId", "deletedAt"
      FROM subscription_plans
      WHERE id = ${id}
      LIMIT 1
    `

    if (!existingPlans || existingPlans.length === 0) {
      console.error('❌ [ADMIN_SUBSCRIPTION_PLANS] Plan not found for update, id:', id)
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }

    const existing = existingPlans[0]

    // Verificar se está deletado
    if (existing.deletedAt) {
      console.warn('⚠️ [ADMIN_SUBSCRIPTION_PLANS] Attempting to update deleted plan:', id)
      return NextResponse.json({ error: 'Plano foi deletado' }, { status: 404 })
    }

    console.log('✅ [ADMIN_SUBSCRIPTION_PLANS] Updating plan:', { id: existing.id, planId: existing.planId })
    const updated = await prisma.subscriptionPlan.update({
      where: { id },
      data: parsed.data
    })

    revalidateTag('subscription-plans')
    console.log('✅ [ADMIN_SUBSCRIPTION_PLANS] Plan updated:', id)

    return NextResponse.json({ plan: updated })
  } catch (error: any) {
    console.error('❌ [ADMIN_SUBSCRIPTION_PLANS] Error updating plan:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { id } = await params

    // CRÍTICO: Buscar pelo id (row ID), não pelo planId
    // Usar $queryRaw para contornar problema do Prisma com Json[] vs Json
    const existingPlans = await prisma.$queryRaw<Array<{
      id: string
      planId: string
    }>>`
      SELECT id, "planId"
      FROM subscription_plans
      WHERE id = ${id}
      LIMIT 1
    `

    if (!existingPlans || existingPlans.length === 0) {
      console.error('❌ [ADMIN_SUBSCRIPTION_PLANS] Plan not found for delete, id:', id)
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }

    const existing = existingPlans[0]

    // Soft delete
    console.log('✅ [ADMIN_SUBSCRIPTION_PLANS] Soft deleting plan:', { id: existing.id, planId: existing.planId })
    const deleted = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false
      }
    })

    revalidateTag('subscription-plans')
    console.log('✅ [ADMIN_SUBSCRIPTION_PLANS] Plan soft deleted:', id)

    return NextResponse.json({ plan: deleted })
  } catch (error: any) {
    console.error('❌ [ADMIN_SUBSCRIPTION_PLANS] Error deleting plan:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

