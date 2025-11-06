import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Endpoint para verificar o status de uma geração
 * GET: Retorna status atual (usado por polling)
 * POST: Verifica e corrige gerações presas (usado manualmente)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const generationId = id

    // Buscar a geração com todos os dados necessários
    const generation = await prisma.generation.findFirst({
      where: {
        id: generationId,
        userId: session.user.id
      },
      include: {
        model: {
          select: {
            id: true,
            name: true,
            class: true
          }
        }
      }
    })

    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      )
    }

    // Extract temporary URLs from metadata if available (for modal display)
    const metadata = generation.metadata as any || {}
    const temporaryUrls = metadata.temporaryUrls || metadata.originalUrls || []
    
    // Retornar dados completos para polling
    return NextResponse.json({
      id: generation.id,
      status: generation.status,
      imageUrls: generation.imageUrls || [], // Permanent URLs for gallery
      thumbnailUrls: generation.thumbnailUrls || [],
      temporaryUrls: temporaryUrls, // Temporary URLs for immediate modal display
      processingTime: generation.processingTime,
      errorMessage: generation.errorMessage,
      completedAt: generation.completedAt,
      createdAt: generation.createdAt,
      prompt: generation.prompt,
      modelId: generation.modelId,
      model: generation.model
    })
  } catch (error) {
    console.error('Error fetching generation status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch generation status' },
      { status: 500 }
    )
  }
}

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