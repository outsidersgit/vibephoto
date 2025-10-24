import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
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
      }
    })

    // Get session data
    const sessionData = {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      plan: (session.user as any).plan,
      subscriptionId: (session.user as any).subscriptionId,
      subscriptionStatus: (session.user as any).subscriptionStatus,
      asaasCustomerId: (session.user as any).asaasCustomerId
    }

    return NextResponse.json({
      database: user,
      session: sessionData,
      hasSubscriptionInDB: !!user?.subscriptionId,
      hasSubscriptionInSession: !!(session.user as any).subscriptionId,
      match: user?.subscriptionId === (session.user as any).subscriptionId
    })

  } catch (error: any) {
    console.error('Debug error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
