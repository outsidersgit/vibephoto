import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCreditsLimitForPlan } from '@/lib/constants/plans'
import { broadcastCreditsUpdate } from '@/lib/services/realtime-service'

/**
 * Endpoint para corrigir creditsLimit zerado para usuários com subscription ACTIVE
 * POST /api/admin/users/[id]/fix-credits-limit
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const role = String(((session?.user as any)?.role) || '').toUpperCase()
  
  if (!session || role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  // Buscar usuário
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      plan: true,
      billingCycle: true,
      subscriptionStatus: true,
      creditsLimit: true,
      creditsUsed: true,
      subscriptionStartedAt: true
    }
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Validar que usuário tem subscription ACTIVE e plan definido
  if (user.subscriptionStatus !== 'ACTIVE') {
    return NextResponse.json(
      { error: 'User subscription is not ACTIVE', subscriptionStatus: user.subscriptionStatus },
      { status: 400 }
    )
  }

  if (!user.plan) {
    return NextResponse.json(
      { error: 'User does not have a plan defined' },
      { status: 400 }
    )
  }

  // Se creditsLimit já está correto, não precisa fazer nada
  const creditsLimit = await getCreditsLimitForPlan(user.plan)
  const expectedCreditsLimit = user.billingCycle === 'YEARLY' 
    ? creditsLimit * 12 
    : creditsLimit

  if (user.creditsLimit === expectedCreditsLimit && user.creditsLimit > 0) {
    return NextResponse.json({
      message: 'CreditsLimit already correct',
      creditsLimit: user.creditsLimit
    })
  }

  // Calcular datas de expiração
  const now = new Date()
  const creditsExpiresAt = user.billingCycle === 'YEARLY'
    ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // + 1 ano
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // + 1 mês

  // Atualizar creditsLimit
  const updated = await prisma.user.update({
    where: { id },
    data: {
      creditsLimit: expectedCreditsLimit,
      creditsUsed: 0, // Reset créditos usados também
      lastCreditRenewalAt: now,
      creditsExpiresAt,
      // Se não tinha subscriptionStartedAt, definir agora
      ...(user.subscriptionStartedAt ? {} : { subscriptionStartedAt: now })
    }
  })

  // Buscar dados atualizados para broadcast
  const updatedUser = await prisma.user.findUnique({
    where: { id },
    select: {
      creditsUsed: true,
      creditsLimit: true,
      creditsBalance: true
    }
  })

  // Broadcast atualização
  if (updatedUser) {
    await broadcastCreditsUpdate(
      id,
      updatedUser.creditsUsed,
      updatedUser.creditsLimit,
      'ADMIN_FIX_CREDITSLIMIT',
      updatedUser.creditsBalance
    ).catch((error) => {
      console.error('❌ [Fix CreditsLimit] Erro ao broadcast:', error)
    })

    // Broadcast to admins
    try {
      const { broadcastAdminUserUpdated } = await import('@/lib/services/realtime-service')
      await broadcastAdminUserUpdated(id, {
        creditsLimit: updated.creditsLimit,
        creditsUsed: updated.creditsUsed,
        creditsBalance: updatedUser.creditsBalance,
        action: 'ADMIN_FIX_CREDITSLIMIT'
      })
    } catch (broadcastError) {
      console.error('❌ Failed to broadcast admin user updated event:', broadcastError)
    }
  }

  // Criar log
  await prisma.usageLog.create({
    data: {
      userId: id,
      action: 'ADMIN_FIX_CREDITSLIMIT',
      creditsUsed: 0,
      details: {
        previousCreditsLimit: user.creditsLimit,
        newCreditsLimit: expectedCreditsLimit,
        plan: user.plan,
        billingCycle: user.billingCycle,
        fixedBy: session.user.email || 'admin'
      }
    }
  })

  return NextResponse.json({
    success: true,
    message: 'CreditsLimit fixed successfully',
    user: {
      id: updated.id,
      email: updated.email,
      plan: updated.plan,
      billingCycle: updated.billingCycle,
      creditsLimit: updated.creditsLimit,
      creditsUsed: updated.creditsUsed,
      previousCreditsLimit: user.creditsLimit
    }
  })
}

