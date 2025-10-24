import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/monitoring/logger'

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Get user data before deletion for logging
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        subscriptionStatus: true,
        subscriptionId: true,
        plan: true,
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Log account deletion attempt
    logger.info('Account deletion requested', {
      userId,
      email: user.email,
      hadActiveSubscription: user.subscriptionStatus === 'ACTIVE',
      plan: user.plan,
    })

    // Note: We don't cancel the subscription automatically
    // The user keeps their subscription active until the end of the paid period
    // This ensures they get what they paid for

    // Delete user account and all related data (cascade delete via Prisma schema)
    await prisma.user.delete({
      where: { id: userId }
    })

    logger.info('Account deleted successfully', {
      userId,
      email: user.email,
    })

    const hasActiveSubscription = user.subscriptionStatus === 'ACTIVE'
    const message = hasActiveSubscription
      ? 'Sua conta foi excluída com sucesso. Caso você ainda tenha uma assinatura ativa, ela continuará válida até o fim do período já pago. Nenhuma cobrança adicional será gerada após esse período.'
      : 'Sua conta foi excluída com sucesso.'

    return NextResponse.json({
      success: true,
      message,
      hadActiveSubscription: hasActiveSubscription
    })

  } catch (error) {
    console.error('Error deleting account:', error)
    logger.error('Account deletion failed', { error })

    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}
