import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
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

const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  popular: z.boolean().optional(),
  color: z.enum(['blue', 'purple', 'yellow']).optional().nullable(),
  monthlyPrice: z.number().positive().optional(),
  annualPrice: z.number().positive().optional(),
  monthlyEquivalent: z.number().positive().optional(),
  credits: z.number().int().positive().optional(),
  models: z.number().int().positive().optional(),
  resolution: z.string().min(1).optional(),
  features: z.array(z.string()).min(1).optional()
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
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id }
    })

    if (!plan) {
      console.error('❌ [ADMIN_SUBSCRIPTION_PLANS] Plan not found by id:', id)
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }

    // Verificar se está deletado (soft delete)
    if (plan.deletedAt) {
      console.warn('⚠️ [ADMIN_SUBSCRIPTION_PLANS] Plan is deleted:', id)
      return NextResponse.json({ error: 'Plano foi deletado' }, { status: 404 })
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
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    // CRÍTICO: Buscar pelo id (row ID), não pelo planId
    // O id é o identificador único da row no banco (ex: sub_plan_starter)
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { id }
    })

    if (!existing) {
      console.error('❌ [ADMIN_SUBSCRIPTION_PLANS] Plan not found for update, id:', id)
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }

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
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { id }
    })

    if (!existing) {
      console.error('❌ [ADMIN_SUBSCRIPTION_PLANS] Plan not found for delete, id:', id)
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }

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

