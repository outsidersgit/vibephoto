/**
 * API para consultar saldo de créditos do usuário
 * GET - Retorna saldo detalhado (assinatura + comprados)
 * 
 * Performance: Cache de 60s para reduzir latência no modal de pacotes
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CreditPackageService } from '@/lib/services/credit-package-service'
import { unstable_cache } from 'next/cache'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Cache por 60 segundos para reduzir delay no modal (Sprint 1 - Performance)
    const getCachedBalance = unstable_cache(
      async (userId: string) => {
        return await CreditPackageService.getUserCreditBalance(userId)
      },
      [`user-credits-${session.user.id}`],
      {
        revalidate: 60, // 60 segundos
        tags: [`user-${session.user.id}-credits`]
      }
    )

    const balance = await getCachedBalance(session.user.id)

    return NextResponse.json({
      success: true,
      balance
    })

  } catch (error: any) {
    console.error('Error fetching credit balance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch credit balance' },
      { status: 500 }
    )
  }
}