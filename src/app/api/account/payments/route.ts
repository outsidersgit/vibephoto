import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Pagination parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Buscar AMBAS as tabelas: payments E credit_purchases
    const [paymentsFromPaymentsTable, creditPurchases, totalPayments, totalCreditPurchases] = await Promise.all([
      // 1. Tabela payments (assinaturas)
      prisma.payment.findMany({
        where: {
          userId: session.user.id
        },
        select: {
          id: true,
          type: true,
          status: true,
          billingType: true,
          value: true,
          description: true,
          dueDate: true,
          confirmedDate: true,
          createdAt: true,
          planType: true,
          billingCycle: true,
          creditAmount: true,
          asaasPaymentId: true
        }
      }),

      // 2. Tabela credit_purchases (compras de pacotes de créditos)
      prisma.creditPurchase.findMany({
        where: {
          userId: session.user.id
        },
        select: {
          id: true,
          packageName: true,
          creditAmount: true,
          bonusCredits: true,
          value: true,
          status: true,
          purchasedAt: true,
          confirmedAt: true,
          asaasPaymentId: true
        }
      }),

      // 3. Count total payments
      prisma.payment.count({
        where: {
          userId: session.user.id
        }
      }),

      // 4. Count total credit purchases
      prisma.creditPurchase.count({
        where: {
          userId: session.user.id
        }
      })
    ])

    // Unificar as duas listas num formato comum
    const allPayments = [
      // Pagamentos da tabela payments (assinaturas)
      ...paymentsFromPaymentsTable.map(p => ({
        id: p.id,
        type: p.type,
        status: p.status,
        billingType: p.billingType || 'UNDEFINED',
        value: p.value,
        description: p.description,
        dueDate: p.dueDate,
        confirmedDate: p.confirmedDate,
        createdAt: p.createdAt,
        planType: p.planType,
        billingCycle: p.billingCycle,
        creditAmount: p.creditAmount,
        asaasPaymentId: p.asaasPaymentId,
        source: 'payments' as const
      })),

      // Compras de créditos da tabela credit_purchases
      ...creditPurchases.map(cp => ({
        id: cp.id,
        type: 'CREDIT_PURCHASE' as const,
        status: cp.status,
        billingType: 'UNDEFINED' as const, // Não tem billing type na credit_purchases
        value: cp.value,
        description: `${cp.packageName} - ${cp.creditAmount + cp.bonusCredits} créditos`,
        dueDate: cp.purchasedAt, // Usa data de compra como "vencimento"
        confirmedDate: cp.confirmedAt,
        createdAt: cp.purchasedAt,
        planType: null,
        billingCycle: null,
        creditAmount: cp.creditAmount + cp.bonusCredits,
        asaasPaymentId: cp.asaasPaymentId,
        source: 'credit_purchases' as const
      }))
    ]

    // Ordenar por data de criação (mais recente primeiro)
    allPayments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Apply pagination
    const paginatedPayments = allPayments.slice(skip, skip + limit)
    const totalRecords = totalPayments + totalCreditPurchases
    const totalPages = Math.ceil(totalRecords / limit)

    return NextResponse.json({
      success: true,
      payments: paginatedPayments,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords,
        recordsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    })
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar pagamentos' },
      { status: 500 }
    )
  }
}
