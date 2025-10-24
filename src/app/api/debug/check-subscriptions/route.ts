import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Get all users with their subscription info
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        subscriptionId: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
        asaasCustomerId: true,
        creditsUsed: true,
        creditsLimit: true
      },
      take: 10 // Limit to 10 users for safety
    })

    const summary = {
      totalUsers: users.length,
      usersWithSubscriptionId: users.filter(u => u.subscriptionId).length,
      usersWithAsaasCustomerId: users.filter(u => u.asaasCustomerId).length,
      subscriptionStatuses: users.reduce((acc: any, user) => {
        const status = user.subscriptionStatus || 'NONE'
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {}),
      users: users.map(u => ({
        email: u.email,
        plan: u.plan,
        hasSubscriptionId: !!u.subscriptionId,
        subscriptionStatus: u.subscriptionStatus,
        hasAsaasCustomerId: !!u.asaasCustomerId
      }))
    }

    return NextResponse.json(summary)

  } catch (error: any) {
    console.error('Debug error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
