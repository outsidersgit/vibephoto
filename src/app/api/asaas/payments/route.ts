import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { asaas } from '@/lib/payments/asaas'
import { prisma } from '@/lib/prisma'

/**
 * List all payments for the authenticated user
 * GET /api/asaas/payments?status=PENDING&limit=20&offset=0
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Get user's Asaas customer ID
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { asaasCustomerId: true }
    })

    if (!user?.asaasCustomerId) {
      return NextResponse.json({
        error: 'Cliente Asaas não encontrado',
        message: 'Complete seu cadastro antes de acessar pagamentos'
      }, { status: 404 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Build filters
    const filters: any = {
      customer: user.asaasCustomerId,
      limit,
      offset
    }

    if (status) filters.status = status
    if (dateFrom) filters.dateFrom = dateFrom
    if (dateTo) filters.dateTo = dateTo

    // Get payments from Asaas
    const payments = await asaas.getPayments(filters)

    return NextResponse.json({
      success: true,
      data: payments.data || [],
      hasMore: payments.hasMore || false,
      totalCount: payments.totalCount || payments.data?.length || 0,
      limit,
      offset
    })

  } catch (error: any) {
    console.error('❌ Erro ao listar pagamentos:', error)
    return NextResponse.json({
      error: 'Falha ao listar pagamentos',
      message: error.message
    }, { status: 500 })
  }
}