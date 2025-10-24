import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Get Asaas payment statistics (Admin only)
 * GET /api/admin/asaas/stats
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // Check if user is admin (you should have an isAdmin field or role)
    const user = await prisma.user.findUnique({
      where: { id: session?.user?.id },
      select: { email: true }
    })

    // Simple admin check - customize based on your needs
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || []
    if (!user || !adminEmails.includes(user.email)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    // Get statistics
    const [
      totalUsers,
      usersWithAsaasId,
      totalPayments,
      totalWebhooks,
      failedWebhooks,
      recentPayments,
      recentWebhooks,
      subscriptionStats
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Users with Asaas customer ID
      prisma.user.count({
        where: { asaasCustomerId: { not: null } }
      }),

      // Total payment records in DB
      prisma.payment.count(),

      // Total webhooks received
      prisma.webhookEvent.count(),

      // Failed webhooks (not processed or with errors)
      prisma.webhookEvent.count({
        where: {
          OR: [
            { processed: false },
            { processingError: { not: null } }
          ]
        }
      }),

      // Recent payments (last 10)
      prisma.payment.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      }),

      // Recent webhooks (last 20)
      prisma.webhookEvent.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          event: true,
          processed: true,
          processingError: true,
          retryCount: true,
          createdAt: true
        }
      }),

      // Subscription statistics by plan
      prisma.user.groupBy({
        by: ['plan'],
        _count: true,
        where: {
          plan: { not: 'FREE' }
        }
      })
    ])

    // Calculate webhook success rate
    const webhookSuccessRate = totalWebhooks > 0
      ? ((totalWebhooks - failedWebhooks) / totalWebhooks * 100).toFixed(2)
      : 0

    // Get payment event distribution
    const eventDistribution = await prisma.webhookEvent.groupBy({
      by: ['event'],
      _count: true,
      orderBy: {
        _count: {
          event: 'desc'
        }
      },
      take: 10
    })

    return NextResponse.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          withAsaasId: usersWithAsaasId,
          percentage: ((usersWithAsaasId / totalUsers) * 100).toFixed(2)
        },
        payments: {
          total: totalPayments
        },
        webhooks: {
          total: totalWebhooks,
          failed: failedWebhooks,
          successRate: webhookSuccessRate
        },
        subscriptions: subscriptionStats.map(s => ({
          plan: s.plan,
          count: s._count
        }))
      },
      recentActivity: {
        payments: recentPayments,
        webhooks: recentWebhooks
      },
      eventDistribution: eventDistribution.map(e => ({
        event: e.event,
        count: e._count
      }))
    })

  } catch (error: any) {
    console.error('❌ Erro ao buscar estatísticas:', error)
    return NextResponse.json({
      error: 'Falha ao buscar estatísticas',
      message: error.message
    }, { status: 500 })
  }
}