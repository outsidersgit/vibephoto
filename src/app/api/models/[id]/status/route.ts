import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/models/[id]/status
 *
 * Returns the current status of a model
 * Used for polling fallback when SSE is not working
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const model = await prisma.aIModel.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      },
      select: {
        id: true,
        name: true,
        status: true,
        progress: true,
        errorMessage: true,
        modelUrl: true,
        trainedAt: true,
        updatedAt: true
      }
    })

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      )
    }

    console.log(`📊 [MODEL_STATUS_POLL] Model ${params.id}: ${model.status} (${model.progress}%)`)

    return NextResponse.json({
      success: true,
      model: {
        id: model.id,
        name: model.name,
        status: model.status,
        progress: model.progress,
        errorMessage: model.errorMessage,
        modelUrl: model.modelUrl,
        trainedAt: model.trainedAt,
        updatedAt: model.updatedAt
      }
    })
  } catch (error) {
    console.error('❌ [MODEL_STATUS_POLL] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch model status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
