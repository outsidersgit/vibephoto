import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Debug endpoint para verificar estado de um EditHistory específico
 * GET /api/debug/edit-history/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const editHistoryId = params.id

    console.log('🔍 [DEBUG] Buscando EditHistory:', editHistoryId)

    // Buscar por ID direto
    const editHistory = await prisma.editHistory.findUnique({
      where: { id: editHistoryId }
    })

    if (!editHistory) {
      return NextResponse.json({
        found: false,
        message: 'EditHistory não encontrado',
        searchedId: editHistoryId
      }, { status: 404 })
    }

    // Calcular tempo desde criação
    const now = new Date()
    const createdAt = new Date(editHistory.createdAt)
    const minutesSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / 1000 / 60)

    // Verificar se webhook conseguiria encontrar (janela de 10 minutos)
    const wouldBeFoundByWebhook = minutesSinceCreation <= 10

    // Buscar metadata.replicateId
    const metadata = editHistory.metadata as any
    const replicateId = metadata?.replicateId

    // Simular busca do webhook
    let webhookSimulation = null
    if (replicateId) {
      const recentEdits = await prisma.editHistory.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 10 * 60 * 1000)
          }
        },
        select: {
          id: true,
          userId: true,
          createdAt: true,
          metadata: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      })

      const foundByWebhook = recentEdits.find((edit: any) => {
        const m = edit.metadata as any
        return m?.replicateId === replicateId
      })

      webhookSimulation = {
        totalRecentEdits: recentEdits.length,
        foundByWebhook: !!foundByWebhook,
        replicateId
      }
    }

    // Buscar generation associada
    const generation = await prisma.generation.findFirst({
      where: {
        metadata: {
          path: ['editHistoryId'],
          equals: editHistoryId
        }
      },
      select: {
        id: true,
        status: true,
        imageUrls: true,
        thumbnailUrls: true,
        createdAt: true,
        completedAt: true,
        metadata: true
      }
    })

    return NextResponse.json({
      found: true,
      editHistory: {
        id: editHistory.id,
        userId: editHistory.userId,
        operation: editHistory.operation,
        prompt: editHistory.prompt.substring(0, 100) + '...',
        status: editHistory.status,
        createdAt: editHistory.createdAt,
        updatedAt: editHistory.updatedAt,
        jobId: editHistory.jobId,
        originalImageUrl: editHistory.originalImageUrl?.substring(0, 100),
        editedImageUrl: editHistory.editedImageUrl?.substring(0, 100),
        thumbnailUrl: editHistory.thumbnailUrl?.substring(0, 100),
        creditsUsed: editHistory.creditsUsed,
        creditsRefunded: editHistory.creditsRefunded,
        errorMessage: editHistory.errorMessage,
        metadata: editHistory.metadata
      },
      timing: {
        createdAt: editHistory.createdAt,
        updatedAt: editHistory.updatedAt,
        minutesSinceCreation,
        wouldBeFoundByWebhook,
        reason: wouldBeFoundByWebhook
          ? 'Dentro da janela de 10 minutos'
          : `Fora da janela de 10 minutos (${minutesSinceCreation} min)`
      },
      webhookSimulation,
      generation: generation ? {
        id: generation.id,
        status: generation.status,
        imageCount: generation.imageUrls?.length || 0,
        createdAt: generation.createdAt,
        completedAt: generation.completedAt,
        metadata: generation.metadata
      } : null,
      diagnosis: {
        problem: !wouldBeFoundByWebhook,
        description: !wouldBeFoundByWebhook
          ? `Webhook não encontraria este registro porque ele tem ${minutesSinceCreation} minutos (limite: 10 min)`
          : 'Registro está dentro da janela de busca do webhook',
        recommendation: !wouldBeFoundByWebhook
          ? 'Aumentar janela de busca de 10 para 30 minutos em detectJobType()'
          : null
      }
    })

  } catch (error) {
    console.error('❌ [DEBUG] Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
