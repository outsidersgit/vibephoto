import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAIProvider } from '@/lib/ai'
import { updateModelStatus } from '@/lib/db/models'
import { broadcastModelStatusChange } from '@/lib/services/realtime-service'

/**
 * Endpoint para verificar e atualizar manualmente o status de um modelo
 * Útil para debugging e recuperação de modelos travados
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const modelId = params.id

    // Buscar modelo
    const model = await prisma.aIModel.findUnique({
      where: { id: modelId }
    })

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      )
    }

    // Verificar se o usuário é dono
    if (model.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Se não tem trainingJobId, não podemos verificar
    if (!model.trainingJobId) {
      return NextResponse.json({
        error: 'Model has no training job ID',
        modelId: model.id,
        status: model.status
      }, { status: 400 })
    }

    console.log(`🔍 Checking Astria status for model ${modelId}, tune ${model.trainingJobId}`)

    // Buscar status na Astria
    const aiProvider = getAIProvider()
    const trainingStatus = await aiProvider.getTrainingStatus(model.trainingJobId)

    console.log(`📊 Astria status for tune ${model.trainingJobId}:`, trainingStatus.status)

    // Mapear status
    let newStatus: 'TRAINING' | 'READY' | 'ERROR'
    let progress = model.progress || 0

    if (trainingStatus.status === 'succeeded' || trainingStatus.status === 'trained') {
      newStatus = 'READY'
      progress = 100
    } else if (trainingStatus.status === 'failed') {
      newStatus = 'ERROR'
      progress = 0
    } else {
      newStatus = 'TRAINING'
      progress = Math.min(progress + 10, 95) // Incrementar progresso se ainda em treino
    }

    // Atualizar se mudou
    if (model.status !== newStatus) {
      await prisma.aIModel.update({
        where: { id: modelId },
        data: {
          status: newStatus,
          progress,
          modelUrl: newStatus === 'READY' ? model.trainingJobId : model.modelUrl,
          trainedAt: newStatus === 'READY' ? new Date() : model.trainedAt,
          errorMessage: newStatus === 'ERROR' ? trainingStatus.error || 'Training failed' : undefined
        }
      })

      // Emitir SSE
      await broadcastModelStatusChange(modelId, session.user.id, newStatus, {
        progress,
        modelUrl: newStatus === 'READY' ? model.trainingJobId : model.modelUrl
      })

      console.log(`✅ Model ${modelId} status updated: ${model.status} → ${newStatus}`)
    } else {
      // Mesmo status, mas atualizar progresso se aplicável
      if (newStatus === 'TRAINING' && progress > model.progress) {
        await prisma.aIModel.update({
          where: { id: modelId },
          data: { progress }
        })
        await broadcastModelStatusChange(modelId, session.user.id, newStatus, {
          progress,
          modelUrl: model.modelUrl
        })
      }
    }

    return NextResponse.json({
      success: true,
      modelId: modelId,
      previousStatus: model.status,
      currentStatus: newStatus,
      astriaStatus: trainingStatus.status,
      progress,
      updated: model.status !== newStatus || progress > model.progress
    })

  } catch (error) {
    console.error('❌ Error checking model status:', error)
    return NextResponse.json(
      {
        error: 'Failed to check model status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

