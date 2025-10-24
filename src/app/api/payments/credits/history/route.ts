import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { creditService } from '@/lib/services/credit-service'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Verify user authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'all', 'purchases', 'usage'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get user's credit info
    const creditInfo = await creditService.getUserCreditInfo(session.user.id)

    let transactions: any[] = []

    if (type === 'purchases' || type === 'all') {
      // Get credit purchases
      const purchases = await prisma.creditPurchase.findMany({
        where: { userId: session.user.id },
        orderBy: { purchasedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          packageName: true,
          creditAmount: true,
          value: true,
          status: true,
          validUntil: true,
          isExpired: true,
          purchasedAt: true,
          confirmedAt: true
        }
      })

      const purchaseTransactions = purchases.map(purchase => ({
        id: purchase.id,
        type: 'purchase',
        date: purchase.confirmedAt || purchase.purchasedAt,
        amount: purchase.creditAmount,
        balance: null, // We'll calculate this later if needed
        description: purchase.packageName,
        relatedAction: `Compra confirmada - R$ ${purchase.value.toFixed(2)}`,
        status: purchase.status,
        isExpired: purchase.isExpired,
        validUntil: purchase.validUntil,
        value: purchase.value
      }))

      transactions.push(...purchaseTransactions)
    }

    if (type === 'usage' || type === 'all') {
      // Get credit usage
      const usage = await prisma.usageLog.findMany({
        where: { 
          userId: session.user.id,
          creditsUsed: { gt: 0 }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          action: true,
          creditsUsed: true,
          createdAt: true,
          details: true
        }
      })

      const usageTransactions = usage.map(log => ({
        id: log.id,
        type: 'usage',
        date: log.createdAt,
        amount: -log.creditsUsed, // Negative for usage
        balance: null,
        description: getUsageDescription(log.action),
        relatedAction: getUsageDetails(log.details),
        status: 'confirmed',
        action: log.action
      }))

      transactions.push(...usageTransactions)
    }

    if (type === 'all') {
      // Also get bonus credits and other credit events
      const bonusEvents = await prisma.usageLog.findMany({
        where: { 
          userId: session.user.id,
          action: { in: ['CREDITS_BONUS', 'CREDITS_REFUND', 'CREDITS_ADJUSTMENT'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          createdAt: true,
          details: true
        }
      })

      const bonusTransactions = bonusEvents.map(log => ({
        id: log.id,
        type: 'bonus',
        date: log.createdAt,
        amount: extractCreditsFromDetails(log.details),
        balance: null,
        description: getBonusDescription(log.action),
        relatedAction: getBonusDetails(log.details),
        status: 'confirmed',
        action: log.action
      }))

      transactions.push(...bonusTransactions)
    }

    // Sort all transactions by date
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Limit results if needed
    if (type === 'all') {
      transactions = transactions.slice(0, limit)
    }

    // Calculate summary statistics
    const totalPurchased = await prisma.creditPurchase.aggregate({
      where: { 
        userId: session.user.id,
        status: 'CONFIRMED'
      },
      _sum: { creditAmount: true }
    })

    const totalUsed = await prisma.usageLog.aggregate({
      where: { 
        userId: session.user.id,
        creditsUsed: { gt: 0 }
      },
      _sum: { creditsUsed: true }
    })

    const thisMonthUsage = await prisma.usageLog.aggregate({
      where: {
        userId: session.user.id,
        creditsUsed: { gt: 0 },
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      },
      _sum: { creditsUsed: true }
    })

    return NextResponse.json({
      balance: creditInfo.balance,
      limit: creditInfo.limit,
      plan: creditInfo.plan,
      
      // Summary
      summary: {
        totalPurchased: totalPurchased._sum.creditAmount || 0,
        totalUsed: totalUsed._sum.creditsUsed || 0,
        thisMonthUsed: thisMonthUsage._sum.creditsUsed || 0,
        currentBalance: creditInfo.balance,
        usagePercentage: creditInfo.limit > 0 ? Math.round((creditInfo.used / creditInfo.limit) * 100) : 0
      },

      // Transactions
      transactions: transactions.map(t => ({
        ...t,
        date: t.date.toISOString(),
        formattedDate: t.date.toLocaleDateString('pt-BR'),
        formattedTime: t.date.toLocaleTimeString('pt-BR')
      })),

      // Pagination
      pagination: {
        limit,
        offset,
        total: transactions.length,
        hasMore: transactions.length === limit
      }
    })

  } catch (error: any) {
    console.error('Credit history error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

function getUsageDescription(action: string): string {
  switch (action) {
    case 'GENERATION_CREATED':
      return 'Geração de foto'
    case 'MODEL_TRAINING':
      return 'Treinamento de modelo'
    case 'BULK_GENERATION':
      return 'Geração em lote'
    case 'PREMIUM_GENERATION':
      return 'Geração premium'
    default:
      return 'Uso de créditos'
  }
}

function getUsageDetails(details: any): string {
  if (!details) return 'Sem detalhes'
  
  if (details.prompt) {
    return `Prompt: ${details.prompt.substring(0, 50)}...`
  }
  
  if (details.modelName) {
    return `Modelo: ${details.modelName}`
  }
  
  if (details.packageName) {
    return `Pacote: ${details.packageName}`
  }
  
  return 'Créditos utilizados'
}

function getBonusDescription(action: string): string {
  switch (action) {
    case 'CREDITS_BONUS':
      return 'Créditos bônus'
    case 'CREDITS_REFUND':
      return 'Reembolso de créditos'
    case 'CREDITS_ADJUSTMENT':
      return 'Ajuste de créditos'
    default:
      return 'Créditos adicionais'
  }
}

function getBonusDetails(details: any): string {
  if (!details) return 'Créditos adicionais'
  
  if (details.reason) {
    return details.reason
  }
  
  if (details.source) {
    return `Origem: ${details.source}`
  }
  
  return 'Créditos adicionados ao saldo'
}

function extractCreditsFromDetails(details: any): number {
  if (!details) return 0
  
  if (details.creditsAdded) {
    return details.creditsAdded
  }
  
  if (details.amount) {
    return details.amount
  }
  
  return 0
}