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
    
    // CRÍTICO: Usar $executeRaw para atualizar e evitar problema com features (Json vs Json[])
    // Construir SET dinamicamente apenas para campos que foram enviados
    const setClauses: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (parsed.data.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`)
      params.push(parsed.data.name)
      paramIndex++
    }
    if (parsed.data.description !== undefined) {
      setClauses.push(`description = $${paramIndex}`)
      params.push(parsed.data.description)
      paramIndex++
    }
    if (parsed.data.isActive !== undefined) {
      setClauses.push(`"isActive" = $${paramIndex}`)
      params.push(parsed.data.isActive)
      paramIndex++
    }
    if (parsed.data.popular !== undefined) {
      setClauses.push(`popular = $${paramIndex}`)
      params.push(parsed.data.popular)
      paramIndex++
    }
    if (parsed.data.color !== undefined) {
      setClauses.push(`color = $${paramIndex}`)
      params.push(parsed.data.color)
      paramIndex++
    }
    if (parsed.data.monthlyPrice !== undefined) {
      setClauses.push(`"monthlyPrice" = $${paramIndex}`)
      params.push(parsed.data.monthlyPrice)
      paramIndex++
    }
    if (parsed.data.annualPrice !== undefined) {
      setClauses.push(`"annualPrice" = $${paramIndex}`)
      params.push(parsed.data.annualPrice)
      paramIndex++
    }
    if (parsed.data.monthlyEquivalent !== undefined) {
      setClauses.push(`"monthlyEquivalent" = $${paramIndex}`)
      params.push(parsed.data.monthlyEquivalent)
      paramIndex++
    }
    if (parsed.data.credits !== undefined) {
      setClauses.push(`credits = $${paramIndex}`)
      params.push(parsed.data.credits)
      paramIndex++
    }
    if (parsed.data.models !== undefined) {
      setClauses.push(`models = $${paramIndex}`)
      params.push(parsed.data.models)
      paramIndex++
    }
    if (parsed.data.resolution !== undefined) {
      setClauses.push(`resolution = $${paramIndex}`)
      params.push(parsed.data.resolution)
      paramIndex++
    }
    if (parsed.data.features !== undefined) {
      setClauses.push(`features = $${paramIndex}::jsonb`)
      params.push(JSON.stringify(parsed.data.features))
      paramIndex++
    }

    // Adicionar updatedAt
    setClauses.push(`"updatedAt" = NOW()`)

    if (setClauses.length === 1) {
      // Apenas updatedAt foi adicionado, não há nada para atualizar
      console.log('⚠️ [ADMIN_SUBSCRIPTION_PLANS] No fields to update')
      // Buscar plano atualizado usando $queryRaw (mesmo método do GET)
      const updatedPlans = await prisma.$queryRaw<Array<{
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
        LIMIT 1
      `

      if (!updatedPlans || updatedPlans.length === 0) {
        return NextResponse.json({ error: 'Plano não encontrado após atualização' }, { status: 404 })
      }

      const planRaw = updatedPlans[0]
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

      revalidateTag('subscription-plans')
      console.log('✅ [ADMIN_SUBSCRIPTION_PLANS] Plan updated (no changes):', id)
      return NextResponse.json({ plan })
    }

    // Executar update usando SQL raw
    const updateQuery = `
      UPDATE subscription_plans
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
    `
    params.push(id)

    await prisma.$executeRawUnsafe(updateQuery, ...params)

    // Buscar plano atualizado usando $queryRaw (mesmo método do GET)
    const updatedPlans = await prisma.$queryRaw<Array<{
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
      LIMIT 1
    `

    if (!updatedPlans || updatedPlans.length === 0) {
      return NextResponse.json({ error: 'Plano não encontrado após atualização' }, { status: 404 })
    }

    const planRaw = updatedPlans[0]
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

    revalidateTag('subscription-plans')
    console.log('✅ [ADMIN_SUBSCRIPTION_PLANS] Plan updated:', id)

    return NextResponse.json({ plan })
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

