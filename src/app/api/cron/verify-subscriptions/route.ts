import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/monitoring/logger'
import { AsaasClient } from '@/lib/payments/asaas'
import { prisma } from '@/lib/db'
import { updateSubscriptionStatus } from '@/lib/db/subscriptions'
import { Plan } from '@prisma/client'

/**
 * Subscription Verification Cron Job
 * Runs every 6 hours to verify subscription status with Asaas
 *
 * Checks:
 * 1. OVERDUE payments that haven't been updated
 * 2. Annual subscriptions that expired after 12 months
 * 3. Subscriptions marked ACTIVE in DB but CANCELLED/EXPIRED in Asaas
 *
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/verify-subscriptions",
 *     "schedule": "0 */6 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await logger.info('🔄 Starting subscription verification job')

    const asaas = new AsaasClient({
      apiKey: process.env.ASAAS_API_KEY!,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
    })

    const verificationResults = {
      users_checked: 0,
      overdue_detected: 0,
      expired_annual: 0,
      status_synced: 0,
      errors: 0
    }

    // Get all users with subscriptions (subscriptionId exists)
    const usersWithSubscriptions = await prisma.user.findMany({
      where: {
        subscriptionId: { not: null }
        // Do NOT filter by plan - all plans are paid, check subscriptionId only
      },
      select: {
        id: true,
        email: true,
        plan: true,
        subscriptionId: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
        billingCycle: true
      }
    })

    await logger.info(`Found ${usersWithSubscriptions.length} users with active subscriptions`)

    for (const user of usersWithSubscriptions) {
      verificationResults.users_checked++

      try {
        // Check 1: Verify annual subscriptions expiration
        if (user.billingCycle === 'YEARLY' && user.subscriptionEndsAt) {
          const now = new Date()
          const expirationDate = new Date(user.subscriptionEndsAt)

          // If subscription ended more than 7 days ago, mark as EXPIRED
          const gracePeriodEnd = new Date(expirationDate)
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7)

          if (now > gracePeriodEnd && user.subscriptionStatus === 'ACTIVE') {
            await logger.info(`Annual subscription expired for user ${user.email}`, {
              userId: user.id,
              expirationDate: expirationDate.toISOString(),
              gracePeriodEnd: gracePeriodEnd.toISOString()
            })

            await updateSubscriptionStatus(user.id, 'EXPIRED')
            verificationResults.expired_annual++
            continue
          }
        }

        // Check 2: Verify subscription status with Asaas API
        if (user.subscriptionId) {
          try {
            const asaasSubscription = await asaas.getSubscription(user.subscriptionId)

            // Map Asaas status to our status
            let newStatus: string | null = null

            if (asaasSubscription.status === 'ACTIVE' && user.subscriptionStatus !== 'ACTIVE') {
              newStatus = 'ACTIVE'
            } else if (asaasSubscription.deleted && user.subscriptionStatus !== 'CANCELLED') {
              newStatus = 'CANCELLED'
            }

            // Check for overdue payments in Asaas
            if (asaasSubscription.status === 'ACTIVE') {
              // Get last payment for this subscription
              try {
                const payments = await asaas.request(`/subscriptions/${user.subscriptionId}/payments`, {
                  method: 'GET'
                })

                if (payments.data && payments.data.length > 0) {
                  const lastPayment = payments.data[0]

                  // If last payment is overdue, mark subscription as OVERDUE
                  if (lastPayment.status === 'OVERDUE' && user.subscriptionStatus !== 'OVERDUE') {
                    newStatus = 'OVERDUE'
                    verificationResults.overdue_detected++

                    await logger.warn(`Overdue payment detected for user ${user.email}`, {
                      userId: user.id,
                      paymentId: lastPayment.id,
                      dueDate: lastPayment.dueDate
                    })
                  }
                }
              } catch (paymentError) {
                // Log but don't fail - payment check is optional
                await logger.warn(`Failed to check payments for subscription ${user.subscriptionId}`, paymentError as Error)
              }
            }

            // Apply status update if needed
            if (newStatus && newStatus !== user.subscriptionStatus) {
              await logger.info(`Syncing subscription status for user ${user.email}`, {
                userId: user.id,
                oldStatus: user.subscriptionStatus,
                newStatus: newStatus
              })

              await updateSubscriptionStatus(user.id, newStatus)
              verificationResults.status_synced++
            }

          } catch (asaasError: any) {
            // If subscription not found in Asaas (404), mark as CANCELLED
            if (asaasError.message?.includes('404') || asaasError.message?.includes('not found')) {
              await logger.warn(`Subscription not found in Asaas for user ${user.email}`, {
                userId: user.id,
                subscriptionId: user.subscriptionId
              })

              await updateSubscriptionStatus(user.id, 'CANCELLED')
              verificationResults.status_synced++
            } else {
              throw asaasError
            }
          }
        }

      } catch (error) {
        verificationResults.errors++
        await logger.error(`Error verifying subscription for user ${user.email}`, error as Error, {
          userId: user.id
        })
      }
    }

    await logger.info('✅ Subscription verification job completed', verificationResults)

    return NextResponse.json({
      success: true,
      message: 'Subscription verification completed',
      results: verificationResults
    })

  } catch (error) {
    await logger.error('❌ Subscription verification job failed', error as Error)

    return NextResponse.json(
      { error: 'Subscription verification failed', message: (error as Error).message },
      { status: 500 }
    )
  }
}
