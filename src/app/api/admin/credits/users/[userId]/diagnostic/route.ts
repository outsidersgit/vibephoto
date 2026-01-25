import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { unstable_noStore as noStore } from 'next/cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/admin/credits/users/:userId/diagnostic
 * Retorna diagnóstico completo de créditos de um usuário
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  noStore()
  
  try {
    await requireAdmin()

    const { userId } = params

    // Buscar dados do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        billingCycle: true,
        subscriptionStatus: true,
        subscriptionId: true,
        subscriptionStartedAt: true,
        subscriptionEndsAt: true,
        subscriptionCancelledAt: true,
        creditsLimit: true,
        creditsUsed: true,
        creditsBalance: true,
        creditsExpiresAt: true,
        lastCreditRenewalAt: true,
        nextDueDate: true,
        asaasCustomerId: true,
        createdAt: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Calcular saldo de créditos
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
    const totalCredits = subscriptionCredits + purchasedCredits

    // Calcular status do ciclo
    let cycleStatus = 'ACTIVE'
    let cycleMessage = 'Dentro do ciclo'
    
    if (user.creditsExpiresAt) {
      const daysUntilExpiration = Math.floor((user.creditsExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysUntilExpiration < 0) {
        const hoursOverdue = Math.floor((now.getTime() - user.creditsExpiresAt.getTime()) / (1000 * 60 * 60))
        
        if (hoursOverdue > 24) {
          cycleStatus = 'EXPIRED'
          cycleMessage = `Expirado há ${Math.floor(hoursOverdue / 24)} dia(s)`
        } else {
          cycleStatus = 'GRACE_PERIOD'
          cycleMessage = `Grace period (${hoursOverdue}h)`
        }
      } else if (daysUntilExpiration <= 1) {
        cycleStatus = 'EXPIRING_SOON'
        cycleMessage = 'Expira hoje ou amanhã'
      }
    }

    // Buscar últimas transações
    const transactions = await prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        type: true,
        source: true,
        amount: true,
        description: true,
        balanceAfter: true,
        createdAt: true,
        metadata: true
      }
    })

    // Buscar compras de créditos
    const creditPurchases = await prisma.creditPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        packageName: true,
        creditAmount: true,
        usedCredits: true,
        value: true,
        status: true,
        validUntil: true,
        isExpired: true,
        createdAt: true
      }
    })

    // Status comparativo (badge vs banco)
    // Nota: Badge é calculado no frontend, aqui mostramos o esperado
    const badgeStatus = {
      expected: totalCredits,
      message: 'Calcular no frontend para comparar'
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          plan: user.plan,
          billingCycle: user.billingCycle,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionId: user.subscriptionId,
          asaasCustomerId: user.asaasCustomerId,
          createdAt: user.createdAt
        },
        credits: {
          subscription: {
            limit: user.creditsLimit,
            used: user.creditsUsed,
            available: subscriptionCredits,
            percentage: user.creditsLimit > 0 ? Math.round((user.creditsUsed / user.creditsLimit) * 100) : 0
          },
          purchased: {
            balance: user.creditsBalance || 0,
            purchases: creditPurchases
          },
          total: {
            available: totalCredits
          }
        },
        cycle: {
          startedAt: user.subscriptionStartedAt,
          expiresAt: user.creditsExpiresAt,
          lastRenewalAt: user.lastCreditRenewalAt,
          nextDueDate: user.nextDueDate,
          endsAt: user.subscriptionEndsAt,
          cancelledAt: user.subscriptionCancelledAt,
          status: cycleStatus,
          message: cycleMessage
        },
        badge: badgeStatus,
        transactions,
        issues: {
          hasExpired: cycleStatus === 'EXPIRED',
          inGracePeriod: cycleStatus === 'GRACE_PERIOD',
          missingSubscriptionId: !user.subscriptionId && user.subscriptionStatus === 'ACTIVE',
          needsRenewal: cycleStatus === 'EXPIRED' || cycleStatus === 'EXPIRING_SOON'
        }
      }
    })
  } catch (error) {
    console.error('❌ [GET /api/admin/credits/users/:userId/diagnostic] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}
