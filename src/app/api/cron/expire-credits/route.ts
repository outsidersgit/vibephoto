import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
      const remainingCredits = pkg.creditAmount - pkg.usedCredits

      // Marca pacote como expirado
      await prisma.creditPurchase.update({
        where: { id: pkg.id },
        data: { isExpired: true }
      })

      // Remove créditos restantes do balance do usuário
      if (remainingCredits > 0) {
        await prisma.user.update({
          where: { id: pkg.userId },
          data: {
            creditsBalance: { decrement: remainingCredits }
          }
        })
      }

      // Registra transação de expiração
      await prisma.creditTransaction.create({
        data: {
          userId: pkg.userId,
          type: 'EXPIRED',
          source: 'EXPIRATION',
          amount: -remainingCredits,
          description: `Expiração do pacote: ${pkg.packageName}`,
          creditPurchaseId: pkg.id,
          balanceAfter: 0 // Will be calculated properly in production
        }
      })

      // Log no sistema
      await prisma.usageLog.create({
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
