import { NextRequest, NextResponse } from 'next/server'
import { renewMonthlyCredits } from '@/lib/db/subscriptions'

/**
 * CRON Job: Renovar créditos mensais
 *
 * Execução recomendada: Diariamente
 * Vercel Cron: 0 2 * * * (2 AM todos os dias)
 *
 * Função: Renova os créditos para usuários com planos MONTHLY que já
 * completaram 1 mês desde a última renovação.
 *
 * Regras:
 * - Apenas planos MONTHLY (YEARLY recebe tudo de uma vez no pagamento)
 * - Renova no mesmo dia do mês em que a assinatura começou
 * - Reseta creditsUsed para 0
 * - Créditos não utilizados NÃO acumulam
 */
export async function GET(request: NextRequest) {
  try {
    // Validação de autorização do CRON
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔄 Starting monthly credit renewal job...')

    const result = await renewMonthlyCredits()

    console.log(`✅ Monthly credit renewal completed:`)
    console.log(`   - Users processed: ${result.totalProcessed}`)
    console.log(`   - Credits renewed: ${result.totalRenewed}`)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result
    })

  } catch (error: any) {
    console.error('❌ Error in monthly credit renewal job:', error)

    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
