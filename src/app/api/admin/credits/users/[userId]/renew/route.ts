import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { revalidateTag } from 'next/cache'
import { broadcastCreditsUpdate } from '@/lib/services/realtime-service'
import { recordSubscriptionRenewal } from '@/lib/services/credit-transaction-service'
import { getCreditsLimitForPlan } from '@/lib/constants/plans'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/credits/users/:userId/renew
 * Força renovação manual de créditos (bypass webhook/cron)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const admin = await requireAdmin()
    const { userId } = params
    const body = await request.json()

    const { reason } = body

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
        plan: true,
        billingCycle: true,
        subscriptionStatus: true,
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

    if (!user.plan || !['STARTER', 'PREMIUM', 'GOLD'].includes(user.plan)) {
      return NextResponse.json(
        { success: false, error: 'User does not have an active plan' },
        { status: 400 }
      )
    }

    // Calcular novos créditos
    const creditsLimit = await getCreditsLimitForPlan(user.plan)
    const totalCredits = user.billingCycle === 'YEARLY' ? creditsLimit * 12 : creditsLimit
    const now = new Date()
    const newExpiresAt = user.billingCycle === 'YEARLY'
      ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Executar renovação em transação
    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          creditsUsed: 0,
          creditsLimit: totalCredits,
          lastCreditRenewalAt: now,
          creditsExpiresAt: newExpiresAt
        }
      })

      await recordSubscriptionRenewal(
        userId,
        totalCredits,
        {
          plan: user.plan || undefined,
          billingCycle: user.billingCycle,
          reason: 'ADMIN_MANUAL_RENEWAL'
        },
        tx
      )

      await tx.usageLog.create({
        data: {
          userId,
          action: 'ADMIN_MANUAL_RENEWAL',
          creditsUsed: 0,
          details: {
            adminId: admin.id,
            adminEmail: admin.email,
            plan: user.plan,
            billingCycle: user.billingCycle,
            creditsRenewed: totalCredits,
            reason,
            before: {
              creditsUsed: user.creditsUsed,
              creditsLimit: user.creditsLimit,
              creditsExpiresAt: user.creditsExpiresAt,
              lastCreditRenewalAt: user.lastCreditRenewalAt
            },
            after: {
              creditsUsed: 0,
              creditsLimit: totalCredits,
              creditsExpiresAt: newExpiresAt,
              lastCreditRenewalAt: now
            }
          }
        }
      })

      return {
        creditsUsed: updatedUser.creditsUsed,
        creditsLimit: updatedUser.creditsLimit,
        creditsBalance: updatedUser.creditsBalance ?? 0
      }
    })

    // Notificar frontend
    await broadcastCreditsUpdate(
      userId,
      result.creditsUsed,
      result.creditsLimit,
      'ADMIN_RENEWAL',
      result.creditsBalance
    )

    revalidateTag(`user-${userId}-credits`)

    console.log(`✅ [Manual Renewal] Admin ${admin.email} renewed credits for ${user.name}: ${totalCredits} credits`)

    return NextResponse.json({
      success: true,
      data: {
        renewed: true,
        credits: {
          previous: {
            used: user.creditsUsed,
            limit: user.creditsLimit,
            available: Math.max(0, user.creditsLimit - user.creditsUsed)
          },
          current: {
            used: 0,
            limit: totalCredits,
            available: totalCredits
          }
        },
        dates: {
          previous: {
            expiresAt: user.creditsExpiresAt,
            lastRenewalAt: user.lastCreditRenewalAt
          },
          current: {
            expiresAt: newExpiresAt,
            lastRenewalAt: now
          }
        },
        reason
      }
    })
  } catch (error) {
    console.error('❌ [POST /api/admin/credits/users/:userId/renew] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}
