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

    // Fetch credit transactions with pagination
    const [transactions, totalRecords] = await Promise.all([
      prisma.creditTransaction.findMany({
        where: {
          userId: session.user.id
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          source: true,
          amount: true,
          description: true,
          referenceId: true,
          balanceAfter: true,
          createdAt: true,
          metadata: true
        }
      }),
      prisma.creditTransaction.count({
        where: {
          userId: session.user.id
        }
      })
    ])

    const totalPages = Math.ceil(totalRecords / limit)

    return NextResponse.json({
      success: true,
      transactions,
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
    console.error('Error fetching credit transactions:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar transações de crédito' },
      { status: 500 }
    )
  }
}
