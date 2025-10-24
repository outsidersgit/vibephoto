/**
 * API para consultar saldo de créditos do usuário
 * GET - Retorna saldo detalhado (assinatura + comprados)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CreditPackageService } from '@/lib/services/credit-package-service'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const balance = await CreditPackageService.getUserCreditBalance(session.user.id)

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