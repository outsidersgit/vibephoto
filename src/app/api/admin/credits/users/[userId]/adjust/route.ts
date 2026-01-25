import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { revalidateTag } from 'next/cache'
import { broadcastCreditsUpdate } from '@/lib/services/realtime-service'
import { createCreditTransaction } from '@/lib/services/credit-transaction-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/credits/users/:userId/adjust
 * Ajusta créditos manualmente (adicionar ou remover)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const admin = await requireAdmin()
    const { userId } = params
    const body = await request.json()

    const { type, operation, amount, reason } = body

    // Validações
    if (!['PLAN', 'PURCHASED'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be PLAN or PURCHASED' },
        { status: 400 }
      )
    }

    if (!['ADD', 'REMOVE'].includes(operation)) {
      return NextResponse.json(
        { success: false, error: 'Invalid operation. Must be ADD or REMOVE' },
        { status: 400 }
      )
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: 'Reason is required (minimum 10 characters)' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        creditsLimit: true,
        creditsUsed: true,
        creditsBalance: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    let updatedUser

    // Executar ajuste
    if (type === 'PLAN') {
      // Ajustar créditos do plano
      if (operation === 'ADD') {
        // Adicionar = diminuir creditsUsed
        const newCreditsUsed = Math.max(0, user.creditsUsed - amount)
        updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { creditsUsed: newCreditsUsed }
        })
      } else {
        // Remover = aumentar creditsUsed
        updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { creditsUsed: { increment: amount } }
        })
      }
    } else {
      // Ajustar créditos comprados
      if (operation === 'ADD') {
        updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { creditsBalance: { increment: amount } }
        })
      } else {
        // Remover (não permitir negativo)
        const newBalance = Math.max(0, (user.creditsBalance || 0) - amount)
        updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { creditsBalance: newBalance }
        })
      }
    }

    // Registrar no ledger
    await createCreditTransaction({
      userId,
      type: operation === 'ADD' ? 'EARNED' : 'SPENT',
      source: 'ADMIN_ADJUSTMENT',
      amount: operation === 'ADD' ? amount : -amount,
      description: `Ajuste manual (${operation}) - ${reason}`,
      balanceAfter: updatedUser.creditsBalance || 0,
      metadata: {
        adminId: admin.id,
        adminEmail: admin.email,
        type,
        operation,
        reason,
        timestamp: new Date().toISOString()
      }
    })

    // Registrar auditoria
    await prisma.usageLog.create({
      data: {
        userId,
        action: 'ADMIN_CREDIT_ADJUSTMENT',
        creditsUsed: operation === 'ADD' ? -amount : amount,
        details: {
          adminId: admin.id,
          adminEmail: admin.email,
          type,
          operation,
          amount,
          reason,
          before: type === 'PLAN' 
            ? { creditsUsed: user.creditsUsed, creditsLimit: user.creditsLimit }
            : { creditsBalance: user.creditsBalance },
          after: type === 'PLAN'
            ? { creditsUsed: updatedUser.creditsUsed, creditsLimit: updatedUser.creditsLimit }
            : { creditsBalance: updatedUser.creditsBalance }
        }
      }
    })

    // Invalidar cache e notificar
    revalidateTag(`user-${userId}-credits`)
    await broadcastCreditsUpdate(
      userId,
      updatedUser.creditsUsed,
      updatedUser.creditsLimit,
      'ADMIN_ADJUSTMENT',
      updatedUser.creditsBalance || 0
    )

    console.log(`✅ [Adjust] Admin ${admin.email} adjusted credits for ${user.name}: ${operation} ${amount} (${type})`)

    return NextResponse.json({
      success: true,
      data: {
        adjusted: true,
        operation,
        type,
        amount,
        reason,
        before: type === 'PLAN'
          ? { creditsUsed: user.creditsUsed, available: user.creditsLimit - user.creditsUsed }
          : { creditsBalance: user.creditsBalance },
        after: type === 'PLAN'
          ? { creditsUsed: updatedUser.creditsUsed, available: updatedUser.creditsLimit - updatedUser.creditsUsed }
          : { creditsBalance: updatedUser.creditsBalance }
      }
    })
  } catch (error) {
    console.error('❌ [POST /api/admin/credits/users/:userId/adjust] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}
