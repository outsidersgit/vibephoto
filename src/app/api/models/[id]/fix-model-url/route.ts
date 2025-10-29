import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Endpoint para corrigir modelUrl de modelos READY que não têm modelUrl
 * Copia trainingJobId para modelUrl se necessário
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

    // Se o modelo está READY mas não tem modelUrl, usar trainingJobId
    if (model.status === 'READY' && !model.modelUrl && model.trainingJobId) {
      const updatedModel = await prisma.aIModel.update({
        where: { id: modelId },
        data: {
          modelUrl: model.trainingJobId
        }
      })

      console.log(`✅ Fixed modelUrl for model ${modelId}: ${model.trainingJobId}`)

      return NextResponse.json({
        success: true,
        message: 'Model URL fixed successfully',
        modelId: modelId,
        previousModelUrl: model.modelUrl,
        newModelUrl: updatedModel.modelUrl,
        source: 'trainingJobId'
      })
    }

    return NextResponse.json({
      success: false,
      message: 'Model URL fix not needed',
      modelId: modelId,
      status: model.status,
      hasModelUrl: !!model.modelUrl,
      hasTrainingJobId: !!model.trainingJobId
    })

  } catch (error) {
    console.error('❌ Error fixing model URL:', error)
    return NextResponse.json(
      {
        error: 'Failed to fix model URL',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

