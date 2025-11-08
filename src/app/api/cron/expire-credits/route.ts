import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordCreditExpiration } from '@/lib/services/credit-transaction-service'
import { broadcastCreditsUpdate } from '@/lib/services/realtime-service'

/**
 * CRON Job: Expirar pacotes de créditos avulsos
 *
 * Execução recomendada: Diariamente
 * Vercel Cron: 0 3 * * * (3 AM todos os dias)
 *
 * Função: Marca como expirados os pacotes de créditos que ultrapassaram
 * o período de validade de 1 ano
 */
export async function GET(request: NextRequest) {
  try {
    // Validação de autorização do CRON
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔄 Starting credit expiration job...')

    const now = new Date()

    // Busca pacotes que expiraram mas ainda não foram marcados
    const expiredPackages = await prisma.creditPurchase.findMany({
      where: {
        validUntil: { lt: now },
        isExpired: false,
        status: 'CONFIRMED'
      },
      select: {
        id: true,
        userId: true,
        packageName: true,
        creditAmount: true,
        usedCredits: true,
        validUntil: true
      }
    })

    console.log(`📦 Found ${expiredPackages.length} expired packages`)

    // Marca como expirados e atualiza balance do usuário
    const results = []

    for (const pkg of expiredPackages) {
      const remainingCredits = Math.max(0, pkg.creditAmount - pkg.usedCredits)

      const transactionResult = await prisma.$transaction(async (tx) => {
        await tx.creditPurchase.update({
          where: { id: pkg.id },
          data: { isExpired: true }
        })

        let updatedUser = null
        if (remainingCredits > 0) {
          updatedUser = await tx.user.update({
            where: { id: pkg.userId },
            data: {
              creditsBalance: { decrement: remainingCredits }
            },
            select: {
              creditsUsed: true,
              creditsLimit: true,
              creditsBalance: true
            }
          })

          await recordCreditExpiration(
            pkg.userId,
            remainingCredits,
            pkg.id,
            {
              reason: 'Pacote de créditos expirado',
              packageName: pkg.packageName
            },
            tx
          )
        } else {
          updatedUser = await tx.user.findUnique({
            where: { id: pkg.userId },
            select: {
              creditsUsed: true,
              creditsLimit: true,
              creditsBalance: true
            }
          })
        }

        await tx.usageLog.create({
          data: {
            userId: pkg.userId,
            action: 'CREDITS_EXPIRED',
            creditsUsed: 0,
            details: {
              packageId: pkg.id,
              packageName: pkg.packageName,
              creditsExpired: remainingCredits,
              totalCredits: pkg.creditAmount,
              usedCredits: pkg.usedCredits,
              validUntil: pkg.validUntil.toISOString()
            }
          }
        })

        return updatedUser
      })

      if (transactionResult) {
        await broadcastCreditsUpdate(
          pkg.userId,
          transactionResult.creditsUsed,
          transactionResult.creditsLimit,
          'CREDITS_EXPIRED',
          transactionResult.creditsBalance
        )
      }

      results.push({
        packageId: pkg.id,
        userId: pkg.userId,
        packageName: pkg.packageName,
        creditsExpired: remainingCredits
      })

      console.log(`⏰ Expired package ${pkg.id}: ${remainingCredits} credits removed`)
    }

    console.log(`✅ Credit expiration job completed: ${results.length} packages processed`)

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      totalExpired: results.length,
      packages: results
    })

  } catch (error: any) {
    console.error('❌ Error in credit expiration job:', error)

    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
