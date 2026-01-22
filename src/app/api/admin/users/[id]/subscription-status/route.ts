import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Admin: Update user subscription status
 * PUT /api/admin/users/[id]/subscription-status
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    // Verify admin access
    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      )
    }

    const { subscriptionStatus } = await request.json()

    // Validate status (aceita NULL também)
    const validStatuses = ['ACTIVE', 'CANCELLED', 'EXPIRED', 'OVERDUE', 'PENDING', null]
    if (subscriptionStatus !== null && !validStatuses.includes(subscriptionStatus)) {
      return NextResponse.json(
        { error: `Status inválido. Use: ${validStatuses.filter(s => s !== null).join(', ')} ou NULL` },
        { status: 400 }
      )
    }

    // Update user subscription status
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: { subscriptionStatus },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionStatus: true,
        plan: true,
        subscriptionEndsAt: true,
        nextDueDate: true
      }
    })

    console.log(`✅ [ADMIN] Updated subscription status for user ${updatedUser.email}:`, {
      userId: updatedUser.id,
      newStatus: subscriptionStatus,
      updatedBy: session.user.email
    })

    return NextResponse.json({
      success: true,
      user: updatedUser
    })
  } catch (error: any) {
    console.error('❌ [ADMIN] Error updating subscription status:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar status', message: error.message },
      { status: 500 }
    )
  }
}
