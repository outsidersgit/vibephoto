/**
 * API TEMPORÁRIA para teste - sem cache
 * Verificar se o problema é cache do Next.js
 */

import { NextResponse } from 'next/server'
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

    // SEM CACHE - buscar direto do banco
    const balance = await CreditPackageService.getUserCreditBalance(session.user.id)

    return NextResponse.json({
      success: true,
      balance,
      debug: {
        userId: session.user.id,
        timestamp: new Date().toISOString(),
        note: 'Esta é uma versão SEM CACHE para debug'
      }
    })

  } catch (error: any) {
    console.error('Error fetching credit balance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch credit balance' },
      { status: 500 }
    )
  }
}

// Desabilitar cache explicitamente
export const dynamic = 'force-dynamic'
export const revalidate = 0
