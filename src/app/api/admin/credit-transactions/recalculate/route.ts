'use server'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidateTag } from 'next/cache'

/**
 * POST /api/admin/credit-transactions/recalculate
 * Recalcula retroativamente o campo balanceAfter das transações de créditos,
 * garantindo que cada registro reflita o saldo real após a operação.
 */
export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (admin?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const usersWithTransactions = await prisma.creditTransaction.findMany({
      distinct: ['userId'],
      select: { userId: true }
    })

    let processedUsers = 0
    let processedTransactions = 0

    for (const { userId } of usersWithTransactions) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          creditsLimit: true,
          creditsUsed: true,
          creditsBalance: true
        }
      })

      if (!user) {
        continue
      }

      let runningBalance =
        Math.max(0, (user.creditsLimit || 0) - (user.creditsUsed || 0)) +
        (user.creditsBalance || 0)

      const transactions = await prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, amount: true }
      })

      for (const transaction of transactions) {
        await prisma.creditTransaction.update({
          where: { id: transaction.id },
          data: { balanceAfter: runningBalance }
        })

        runningBalance -= transaction.amount
        processedTransactions += 1
      }

      try {
        revalidateTag(`user-${userId}-credits`)
      } catch (_error) {
        // ignorar falhas de revalidate para não interromper processo
      }

      processedUsers += 1
    }

    return NextResponse.json({
      success: true,
      processedUsers,
      processedTransactions
    })
  } catch (error) {
    console.error('❌ [ADMIN] Erro ao recalcular balances:', error)
    return NextResponse.json(
      { error: 'Falha ao recalcular saldos' },
      { status: 500 }
    )
  }
}

