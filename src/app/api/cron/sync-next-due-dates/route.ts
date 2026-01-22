import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/monitoring/logger'
import { AsaasClient } from '@/lib/payments/asaas'
import { prisma } from '@/lib/db'

/**
 * CRON: Sincronizar nextDueDate de assinaturas ativas
 * Corrige usuários que não têm nextDueDate definido
 * Busca a data real no Asaas e atualiza o banco
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

    await logger.info('🔄 Starting nextDueDate sync job')

    const asaas = new AsaasClient({
      apiKey: process.env.ASAAS_API_KEY!,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
    })

    const results = {
      users_checked: 0,
      users_updated: 0,
      errors: 0
    }

    // Buscar usuários com assinatura ACTIVE mas sem nextDueDate OU subscriptionEndsAt
    const usersWithoutNextDueDate = await prisma.user.findMany({
      where: {
        subscriptionStatus: 'ACTIVE',
        subscriptionId: { not: null },
        OR: [
          { nextDueDate: null },
          { subscriptionEndsAt: null }
        ]
      },
      select: {
        id: true,
        email: true,
        subscriptionId: true,
        billingCycle: true,
        subscriptionStartedAt: true,
        nextDueDate: true,
        subscriptionEndsAt: true
      }
    })

    await logger.info(`Found ${usersWithoutNextDueDate.length} users without nextDueDate`)

    for (const user of usersWithoutNextDueDate) {
      results.users_checked++

      try {
        if (!user.subscriptionId) {
          await logger.warn(`User ${user.email} has ACTIVE status but no subscriptionId`)
          continue
        }

        // Buscar assinatura no Asaas
        const asaasSubscription = await asaas.getSubscription(user.subscriptionId)

        if (!asaasSubscription || asaasSubscription.status !== 'ACTIVE') {
          await logger.warn(`Asaas subscription not ACTIVE for user ${user.email}`, {
            userId: user.id,
            asaasStatus: asaasSubscription?.status
          })
          continue
        }

        // Pegar nextDueDate do Asaas
        let nextDueDate: Date | null = null

        if (asaasSubscription.nextDueDate) {
          // Asaas retorna string no formato YYYY-MM-DD
          nextDueDate = new Date(asaasSubscription.nextDueDate + 'T00:00:00.000Z')
        } else {
          // Fallback: calcular baseado no subscriptionStartedAt + billingCycle
          if (user.subscriptionStartedAt) {
            const startDate = new Date(user.subscriptionStartedAt)
            nextDueDate = new Date(startDate)

            if (user.billingCycle === 'YEARLY') {
              nextDueDate.setFullYear(nextDueDate.getFullYear() + 1)
            } else {
              nextDueDate.setMonth(nextDueDate.getMonth() + 1)
            }

            await logger.info(`Calculated nextDueDate from subscriptionStartedAt for ${user.email}`, {
              subscriptionStartedAt: user.subscriptionStartedAt,
              calculatedNextDueDate: nextDueDate
            })
          } else {
            // Último fallback: assumir 30 dias a partir de hoje
            nextDueDate = new Date()
            nextDueDate.setDate(nextDueDate.getDate() + 30)

            await logger.warn(`Using 30-day fallback for ${user.email} (no startDate available)`)
          }
        }

        if (nextDueDate) {
          // Atualizar banco de dados
          // IMPORTANTE: Apenas atualizar nextDueDate
          // subscriptionEndsAt é usado APENAS para cancelamentos
          await prisma.user.update({
            where: { id: user.id },
            data: {
              nextDueDate
              // NÃO atualizar subscriptionEndsAt aqui
            }
          })

          results.users_updated++

          await logger.info(`Updated nextDueDate for user ${user.email}`, {
            userId: user.id,
            nextDueDate: nextDueDate.toISOString(),
            source: asaasSubscription.nextDueDate ? 'asaas' : 'calculated'
          })
        }

      } catch (error) {
        results.errors++
        await logger.error(`Error syncing nextDueDate for user ${user.email}`, error as Error, {
          userId: user.id
        })
      }
    }

    await logger.info('✅ nextDueDate sync job completed', results)

    return NextResponse.json({
      success: true,
      message: 'nextDueDate sync completed',
      results
    })

  } catch (error) {
    await logger.error('❌ nextDueDate sync job failed', error as Error)

    return NextResponse.json(
      { error: 'nextDueDate sync failed', message: (error as Error).message },
      { status: 500 }
    )
  }
}
