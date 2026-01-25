import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { unstable_noStore as noStore } from 'next/cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/admin/credits/dashboard
 * Retorna métricas gerais do sistema de créditos
 */
export async function GET(request: NextRequest) {
  noStore()
  
  try {
    // Verificar autenticação admin
    await requireAdmin()

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const next7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    // 1. Total de usuários pagantes (ACTIVE)
    const totalPaying = await prisma.user.count({
      where: {
        subscriptionStatus: 'ACTIVE',
        plan: { in: ['STARTER', 'PREMIUM', 'GOLD'] }
      }
    })

    // 2. Renovações programadas para hoje
    const renewalsToday = await prisma.user.count({
      where: {
        subscriptionStatus: 'ACTIVE',
        billingCycle: 'MONTHLY',
        creditsExpiresAt: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    // 3. Renovações programadas próximos 7 dias
    const renewalsNext7Days = await prisma.user.findMany({
      where: {
        subscriptionStatus: 'ACTIVE',
        billingCycle: 'MONTHLY',
        creditsExpiresAt: {
          gte: today,
          lt: next7Days
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        creditsExpiresAt: true,
        creditsLimit: true
      },
      orderBy: { creditsExpiresAt: 'asc' }
    })

    // 4. Detectar problemas críticos
    const problems = {
      expiredGracePeriod: 0,
      badgeMismatch: 0,
      missingSubscriptionId: 0
    }

    // Usuários com grace period expirado (> 24h após creditsExpiresAt)
    const gracePeriodExpired = await prisma.user.count({
      where: {
        subscriptionStatus: 'ACTIVE',
        billingCycle: 'MONTHLY',
        creditsExpiresAt: {
          lt: new Date(now.getTime() - 24 * 60 * 60 * 1000)
        }
      }
    })
    problems.expiredGracePeriod = gracePeriodExpired

    // Usuários sem subscriptionId (não podem renovar via cron)
    const missingSubId = await prisma.user.count({
      where: {
        subscriptionStatus: 'ACTIVE',
        plan: { in: ['STARTER', 'PREMIUM', 'GOLD'] },
        subscriptionId: null
      }
    })
    problems.missingSubscriptionId = missingSubId

    const totalProblems = Object.values(problems).reduce((sum, val) => sum + val, 0)

    // 5. Histórico de renovações (últimas 24h)
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    const recentTransactions = await prisma.creditTransaction.findMany({
      where: {
        createdAt: { gte: last24h },
        type: 'EARNED' // Renovação de créditos é sempre EARNED
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            plan: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    // 6. Contar alertas críticos
    const criticalAlerts = problems.expiredGracePeriod

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          totalPaying,
          renewalsToday,
          totalProblems,
          criticalAlerts
        },
        problems,
        renewalsNext7Days,
        recentRenewals: recentTransactions.map(tx => ({
          id: tx.id,
          userId: tx.userId,
          userName: tx.user?.name || 'N/A',
          userEmail: tx.user?.email || 'N/A',
          plan: tx.user?.plan || 'N/A',
          amount: tx.amount,
          description: tx.description,
          createdAt: tx.createdAt,
          metadata: tx.metadata
        }))
      }
    })
  } catch (error) {
    console.error('❌ [GET /api/admin/credits/dashboard] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}
