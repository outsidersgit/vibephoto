/**
 * API para invalidar cache de créditos manualmente
 * POST /api/credits/invalidate-cache
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { revalidateTag } from 'next/cache'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Invalidar cache do usuário
    revalidateTag(`user-${session.user.id}-credits`)

    return NextResponse.json({
      success: true,
      message: 'Cache invalidado com sucesso',
      userId: session.user.id,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Error invalidating cache:', error)
    return NextResponse.json(
      { error: 'Failed to invalidate cache' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
