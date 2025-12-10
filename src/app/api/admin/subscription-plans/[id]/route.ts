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
  displayOrder: z.number().int().nonnegative().optional(), // Order for display
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
      displayOrder: number
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
        display_order as "displayOrder",
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
    
    // CRÍTICO: Construir SET dinamicamente apenas para campos que foram enviados
    // Separar campos simples (usando Prisma.sql) de campos JSONB (usando raw SQL)
    const setParts: string[] = []
    const sqlParams: any[] = []
    let paramIndex = 1
    const updateData: any = {}

    if (parsed.data.name !== undefined) {
      setParts.push(`name = $${paramIndex}`)
      sqlParams.push(parsed.data.name)
      paramIndex++
      updateData.name = parsed.data.name
    }
    if (parsed.data.description !== undefined) {
      setParts.push(`description = $${paramIndex}`)
      sqlParams.push(parsed.data.description)
      paramIndex++
      updateData.description = parsed.data.description
    }
    if (parsed.data.isActive !== undefined) {
      setParts.push(`"isActive" = $${paramIndex}`)
      sqlParams.push(parsed.data.isActive)
      paramIndex++
      updateData.isActive = parsed.data.isActive
    }
    if (parsed.data.popular !== undefined) {
      setParts.push(`popular = $${paramIndex}`)
      sqlParams.push(parsed.data.popular)
      paramIndex++
      updateData.popular = parsed.data.popular
    }
    if (parsed.data.displayOrder !== undefined) {
      setParts.push(`display_order = $${paramIndex}`)
      sqlParams.push(parsed.data.displayOrder)
      paramIndex++
      updateData.displayOrder = parsed.data.displayOrder
    }
    if (parsed.data.color !== undefined) {
      if (parsed.data.color === null) {
        setParts.push(`color = NULL`)
      } else {
        setParts.push(`color = $${paramIndex}`)
        sqlParams.push(parsed.data.color)
        paramIndex++
      }
      updateData.color = parsed.data.color
    }
    if (parsed.data.monthlyPrice !== undefined) {
      setParts.push(`"monthlyPrice" = $${paramIndex}`)
      sqlParams.push(parsed.data.monthlyPrice)
      paramIndex++
      updateData.monthlyPrice = parsed.data.monthlyPrice
    }
    if (parsed.data.annualPrice !== undefined) {
      setParts.push(`"annualPrice" = $${paramIndex}`)
      sqlParams.push(parsed.data.annualPrice)
      paramIndex++
      updateData.annualPrice = parsed.data.annualPrice
    }
    if (parsed.data.monthlyEquivalent !== undefined) {
      setParts.push(`"monthlyEquivalent" = $${paramIndex}`)
      sqlParams.push(parsed.data.monthlyEquivalent)
      paramIndex++
      updateData.monthlyEquivalent = parsed.data.monthlyEquivalent
    }
    if (parsed.data.credits !== undefined) {
      setParts.push(`credits = $${paramIndex}`)
      sqlParams.push(parsed.data.credits)
      paramIndex++
      updateData.credits = parsed.data.credits
    }
    if (parsed.data.models !== undefined) {
      setParts.push(`models = $${paramIndex}`)
      sqlParams.push(parsed.data.models)
      paramIndex++
      updateData.models = parsed.data.models
    }
    if (parsed.data.resolution !== undefined) {
      setParts.push(`resolution = $${paramIndex}`)
      sqlParams.push(parsed.data.resolution)
      paramIndex++
      updateData.resolution = parsed.data.resolution
    }
    if (parsed.data.features !== undefined) {
      // Para JSONB, usar cast direto no SQL
      const featuresJson = JSON.stringify(parsed.data.features)
      setParts.push(`features = $${paramIndex}::jsonb`)
      sqlParams.push(featuresJson)
      paramIndex++
      updateData.features = parsed.data.features
    }

    // Adicionar updatedAt
    setParts.push(`"updatedAt" = NOW()`)

    if (setParts.length === 1) {
      // Apenas updatedAt foi adicionado, não há nada para atualizar
      console.log('⚠️ [ADMIN_SUBSCRIPTION_PLANS] No fields to update (only updatedAt)')
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

    // Executar update usando $executeRaw com parâmetros nomeados
    const setClause = setParts.join(', ')
    const query = `UPDATE subscription_plans SET ${setClause} WHERE id = $${paramIndex}`
    sqlParams.push(id)
    
    await prisma.$executeRawUnsafe(query, ...sqlParams)

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

    // Hard delete - Excluir permanentemente do banco de dados
    console.log('🗑️ [ADMIN_SUBSCRIPTION_PLANS] Deleting plan permanently:', { id: existing.id, planId: existing.planId })
    await prisma.subscriptionPlan.delete({
      where: { id }
    })

    revalidateTag('subscription-plans')
    console.log('✅ [ADMIN_SUBSCRIPTION_PLANS] Plan permanently deleted:', id)

    return NextResponse.json({ success: true, message: 'Plano deletado com sucesso' })
  } catch (error: any) {
    console.error('❌ [ADMIN_SUBSCRIPTION_PLANS] Error deleting plan:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

