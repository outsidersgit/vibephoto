import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * CRON Job: Expirar créditos de planos anuais
 *
 * Execução recomendada: Diariamente
 * Vercel Cron: 0 4 * * * (4 AM todos os dias)
 *
 * Função: Zera os créditos de planos YEARLY que ultrapassaram 1 ano
 * desde a última renovação. Créditos não utilizados NÃO acumulam.
 */
export async function GET(request: NextRequest) {
  try {
    // Validação de autorização do CRON
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔄 Starting yearly credits expiration job...')

    const now = new Date()

    // Busca usuários com planos YEARLY cujos créditos expiraram
    const expiredUsers = await prisma.user.findMany({
      where: {
        billingCycle: 'YEARLY',
        subscriptionStatus: 'ACTIVE',
        creditsExpiresAt: { lt: now }, // Créditos expiraram
        creditsLimit: { gt: 0 } // Ainda tem créditos no sistema
      },
      select: {
        id: true,
        email: true,
        plan: true,
        creditsLimit: true,
        creditsUsed: true,
        creditsExpiresAt: true,
        lastCreditRenewalAt: true
      }
    })

    console.log(`📦 Found ${expiredUsers.length} users with expired yearly credits`)

    const results = []

    for (const user of expiredUsers) {
      const remainingCredits = user.creditsLimit - user.creditsUsed

      // Zera os créditos (não acumulam)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          creditsUsed: 0,
          creditsLimit: 0, // Zera até próximo pagamento
          creditsExpiresAt: null
        }
      })

      // Registra log de expiração
      await prisma.usageLog.create({
        data: {
          userId: user.id,
          action: 'YEARLY_CREDITS_EXPIRED',
          creditsUsed: 0,
          details: {
            plan: user.plan,
            creditsExpired: remainingCredits,
            totalCredits: user.creditsLimit,
            usedCredits: user.creditsUsed,
            expiresAt: user.creditsExpiresAt?.toISOString(),
            message: 'Créditos anuais expirados - não acumulam para o próximo ciclo'
          }
        }
      })

      results.push({
        userId: user.id,
        email: user.email,
        plan: user.plan,
        creditsExpired: remainingCredits,
        totalCredits: user.creditsLimit
      })

      console.log(`⏰ Expired yearly credits for user ${user.email}: ${remainingCredits} credits lost`)
    }

    console.log(`✅ Yearly credits expiration job completed: ${results.length} users processed`)

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      totalExpired: results.length,
      users: results
    })

  } catch (error: any) {
    console.error('❌ Error in yearly credits expiration job:', error)

    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
