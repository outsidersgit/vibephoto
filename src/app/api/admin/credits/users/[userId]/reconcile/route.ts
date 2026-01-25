import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { revalidateTag } from 'next/cache'
import { broadcastCreditsUpdate } from '@/lib/services/realtime-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/credits/users/:userId/reconcile
 * Reconcilia o badge de créditos com o banco de dados
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const admin = await requireAdmin()
    const { userId } = params

    // Buscar dados do banco
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        creditsLimit: true,
        creditsUsed: true,
        creditsBalance: true,
        creditsExpiresAt: true,
        lastCreditRenewalAt: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Calcular créditos esperados (mesma lógica do sistema)
    const now = new Date()
    let subscriptionCredits = 0
    
    if (user.creditsExpiresAt && user.creditsExpiresAt < now) {
      const jaRenovou = user.lastCreditRenewalAt && 
                        user.lastCreditRenewalAt >= user.creditsExpiresAt
      
      if (jaRenovou) {
        subscriptionCredits = Math.max(0, user.creditsLimit - user.creditsUsed)
      } else {
        const umDiaAposExpiracao = new Date(user.creditsExpiresAt.getTime() + 24 * 60 * 60 * 1000)
        
        if (now < umDiaAposExpiracao) {
          subscriptionCredits = Math.max(0, user.creditsLimit - user.creditsUsed)
        } else {
          subscriptionCredits = 0
        }
      }
    } else {
      subscriptionCredits = Math.max(0, user.creditsLimit - user.creditsUsed)
    }
    
    const purchasedCredits = user.creditsBalance || 0
    const expectedTotal = subscriptionCredits + purchasedCredits

    // Invalidar cache Next.js
    revalidateTag(`user-${userId}-credits`)

    // Broadcast via SSE para frontend
    await broadcastCreditsUpdate(
      userId,
      user.creditsUsed,
      user.creditsLimit,
      'ADMIN_RECONCILIATION',
      user.creditsBalance || 0
    )

    // Registrar ação de auditoria
    await prisma.usageLog.create({
      data: {
        userId: userId,
        action: 'ADMIN_CREDIT_RECONCILIATION',
        creditsUsed: 0,
        details: {
          adminId: admin.id,
          adminEmail: admin.email,
          subscriptionCredits,
          purchasedCredits,
          expectedTotal,
          timestamp: now.toISOString()
        }
      }
    })

    console.log(`✅ [Reconcile] Admin ${admin.email} reconciled credits for user ${user.name}`)

    return NextResponse.json({
      success: true,
      data: {
        reconciled: true,
        credits: {
          subscription: subscriptionCredits,
          purchased: purchasedCredits,
          total: expectedTotal
        },
        actions: {
          cacheInvalidated: true,
          frontendNotified: true,
          auditLogged: true
        }
      }
    })
  } catch (error) {
    console.error('❌ [POST /api/admin/credits/users/:userId/reconcile] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}
