import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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
    const type = searchParams.get('type') // 'all', 'subscription', 'credit_purchase'
    const status = searchParams.get('status') // 'PENDING', 'CONFIRMED', etc.
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {
      userId: session.user.id
    }

    if (type && type !== 'all') {
      where.type = type.toUpperCase()
    }

    if (status) {
      where.status = status.toUpperCase()
    }

    // Get payments from database
    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        asaasPaymentId: true,
        type: true,
        status: true,
        billingType: true,
        value: true,
        description: true,
        dueDate: true,
        confirmedDate: true,
        overdueDate: true,
        createdAt: true,
        externalReference: true,
        creditAmount: true,
        installmentCount: true
      }
    })

    // Get total count for pagination
    const total = await prisma.payment.count({ where })

    // Format payments for response
    const formattedPayments = payments.map(payment => ({
      id: payment.id,
      asaasPaymentId: payment.asaasPaymentId,
      type: payment.type,
      status: payment.status,
      billingType: payment.billingType,
      value: payment.value,
      description: payment.description,
      date: payment.confirmedDate || payment.createdAt,
      dueDate: payment.dueDate,
      overdueDate: payment.overdueDate,
      formattedDate: (payment.confirmedDate || payment.createdAt).toLocaleDateString('pt-BR'),
      formattedTime: (payment.confirmedDate || payment.createdAt).toLocaleTimeString('pt-BR'),
      formattedValue: payment.value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }),
      creditAmount: payment.creditAmount,
      installmentCount: payment.installmentCount,
      paymentUrl: payment.status === 'PENDING' && payment.billingType === 'PIX' 
        ? `/api/payments/pix/${payment.asaasPaymentId}/qr` 
        : undefined
    }))

    // Calculate summary statistics
    const summaryStats = await prisma.payment.aggregate({
      where: { userId: session.user.id },
      _sum: {
        value: true,
        creditAmount: true
      },
      _count: {
        id: true
      }
    })

    const confirmedPayments = await prisma.payment.aggregate({
      where: { 
        userId: session.user.id,
        status: 'CONFIRMED'
      },
      _sum: {
        value: true,
        creditAmount: true
      },
      _count: {
        id: true
      }
    })

    const thisMonthPayments = await prisma.payment.aggregate({
      where: {
        userId: session.user.id,
        status: 'CONFIRMED',
        confirmedDate: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      },
      _sum: {
        value: true,
        creditAmount: true
      },
      _count: {
        id: true
      }
    })

    // Get payment method distribution
    const paymentMethods = await prisma.payment.groupBy({
      by: ['billingType'],
      where: { 
        userId: session.user.id,
        status: 'CONFIRMED'
      },
      _count: { billingType: true },
      _sum: { value: true }
    })

    return NextResponse.json({
      payments: formattedPayments,
      
      // Pagination
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit)
      },

      // Summary statistics
      summary: {
        totalPayments: summaryStats._count.id,
        totalValue: summaryStats._sum.value || 0,
        totalCredits: summaryStats._sum.creditAmount || 0,
        
        confirmedPayments: confirmedPayments._count.id,
        confirmedValue: confirmedPayments._sum.value || 0,
        confirmedCredits: confirmedPayments._sum.creditAmount || 0,
        
        thisMonthPayments: thisMonthPayments._count.id,
        thisMonthValue: thisMonthPayments._sum.value || 0,
        thisMonthCredits: thisMonthPayments._sum.creditAmount || 0,

        // Success rate
        successRate: summaryStats._count.id > 0 
          ? Math.round((confirmedPayments._count.id / summaryStats._count.id) * 100) 
          : 0,

        // Payment method distribution
        paymentMethods: paymentMethods.map(method => ({
          type: method.billingType,
          count: method._count.billingType,
          totalValue: method._sum.value || 0,
          percentage: confirmedPayments._count.id > 0 
            ? Math.round((method._count.billingType / confirmedPayments._count.id) * 100)
            : 0
        }))
      },

      // Filters applied
      filters: {
        type: type || 'all',
        status: status || 'all',
        limit,
        offset
      }
    })

  } catch (error: any) {
    console.error('Payment history error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST method to export payment history
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { format = 'csv', dateRange, type, status } = body

    // Build where clause for export
    const where: any = {
      userId: session.user.id
    }

    if (type && type !== 'all') {
      where.type = type.toUpperCase()
    }

    if (status && status !== 'all') {
      where.status = status.toUpperCase()
    }

    if (dateRange) {
      if (dateRange.start) {
        where.createdAt = { ...where.createdAt, gte: new Date(dateRange.start) }
      }
      if (dateRange.end) {
        where.createdAt = { ...where.createdAt, lte: new Date(dateRange.end) }
      }
    }

    // Get all matching payments
    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        asaasPaymentId: true,
        type: true,
        status: true,
        billingType: true,
        value: true,
        description: true,
        dueDate: true,
        confirmedDate: true,
        createdAt: true,
        creditAmount: true,
        installmentCount: true
      }
    })

    if (format === 'csv') {
      // Generate CSV content
      const headers = [
        'Data',
        'Tipo',
        'Status',
        'Forma de Pagamento',
        'Descrição',
        'Valor',
        'Créditos',
        'Parcelas',
        'Data de Confirmação',
        'ID do Pagamento'
      ]

      const csvRows = payments.map(payment => [
        payment.createdAt.toLocaleDateString('pt-BR'),
        payment.type,
        payment.status,
        payment.billingType,
        payment.description,
        payment.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        payment.creditAmount || '',
        payment.installmentCount || '',
        payment.confirmedDate?.toLocaleDateString('pt-BR') || '',
        payment.asaasPaymentId
      ])

      const csvContent = [
        headers.join(','),
        ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="historico-pagamentos-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // JSON format (default)
    return NextResponse.json({
      payments: payments.map(payment => ({
        ...payment,
        formattedDate: payment.createdAt.toLocaleDateString('pt-BR'),
        formattedValue: payment.value.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }),
        confirmedDate: payment.confirmedDate?.toLocaleDateString('pt-BR') || null
      })),
      exportedAt: new Date().toISOString(),
      totalRecords: payments.length
    })

  } catch (error: any) {
    console.error('Payment export error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}