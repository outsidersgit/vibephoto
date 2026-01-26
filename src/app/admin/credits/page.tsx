import { requireAdmin } from '@/lib/auth'
import { unstable_noStore as noStore } from 'next/cache'
import CreditsDashboardClient from './credits-dashboard-client'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminCreditsPage() {
  noStore()
  await requireAdmin()

  // Buscar dados diretamente do banco (evitar fetch interno que não passa cookies)
  let initialData = null
  try {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const next7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    const totalPaying = await prisma.user.count({
      where: {
        subscriptionStatus: 'ACTIVE',
        plan: { in: ['STARTER', 'PREMIUM', 'GOLD'] }
      }
    })

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

    const gracePeriodExpired = await prisma.user.count({
      where: {
        subscriptionStatus: 'ACTIVE',
        billingCycle: 'MONTHLY',
        creditsExpiresAt: {
          lt: new Date(now.getTime() - 24 * 60 * 60 * 1000)
        }
      }
    })

    const missingSubId = await prisma.user.count({
      where: {
        subscriptionStatus: 'ACTIVE',
        plan: { in: ['STARTER', 'PREMIUM', 'GOLD'] },
        subscriptionId: null
      }
    })

    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const recentTransactions = await prisma.creditTransaction.findMany({
      where: {
        createdAt: { gte: last24h },
        amount: { gt: 0 }
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

    const problems = {
      expiredGracePeriod: gracePeriodExpired,
      badgeMismatch: 0,
      missingSubscriptionId: missingSubId
    }

    initialData = {
      metrics: {
        totalPaying,
        renewalsToday,
        totalProblems: Object.values(problems).reduce((sum, val) => sum + val, 0),
        criticalAlerts: problems.expiredGracePeriod
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
        createdAt: tx.createdAt.toISOString()
      }))
    }
  } catch (error) {
    console.error('❌ Error loading initial data:', error)
  }

  return <CreditsDashboardClient initialData={initialData} />
}
