import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Endpoint para verificar manualmente o status de uma geração
 * Útil para gerações que ficaram presas em PROCESSING
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const generationId = id

    // Buscar a geração
    const generation = await prisma.generation.findFirst({
      where: {
        id: generationId,
        userId: session.user.id
      }
    })

    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      )
    }

    const now = new Date()
    const created = new Date(generation.createdAt)
    const minutesAgo = Math.round((now - created) / (1000 * 60))

    // Se a geração está em PROCESSING há mais de 10 minutos, marcar como timeout
    if (generation.status === 'PROCESSING' && minutesAgo > 10) {
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          status: 'FAILED',
          errorMessage: 'Generation timeout - no response received after 10+ minutes. This may be a temporary issue with the AI provider. Please try generating again.',
          completedAt: new Date(),
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        action: 'timeout',
        message: 'Generation marked as failed due to timeout',
        newStatus: 'FAILED'
      })
    }

    // Se já está completa, apenas retornar status atual
    return NextResponse.json({
      success: true,
      action: 'no_change',
      message: 'Generation status is current',
      status: generation.status,
      minutesAgo
    })

  } catch (error) {
    console.error('Error checking generation status:', error)
    return NextResponse.json(
      { error: 'Failed to check generation status' },
      { status: 500 }
    )
  }
}