import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getAIProvider } from '@/lib/ai'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Get the model
    const model = await prisma.aIModel.findUnique({
      where: { 
        id,
        userId: session.user.id 
      }
    })

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found or access denied' },
        { status: 404 }
      )
    }

    // Only sync models that are in training status
    if (model.status !== 'TRAINING') {
      return NextResponse.json({
        success: false,
        message: 'Model is not in training status',
        currentStatus: model.status
      })
    }

    // Get training ID from model config
    const trainingConfig = model.trainingConfig as any
    const trainingId = trainingConfig?.trainingId

    if (!trainingId) {
      return NextResponse.json({
        success: false,
        error: 'No training ID found in model config'
      }, { status: 400 })
    }

    console.log('🔄 Manually checking training status for:', trainingId)

    // Get AI provider and check training status
    const aiProvider = getAIProvider()
    const trainingStatus = await aiProvider.getTrainingStatus(trainingId)

    console.log('📊 Training status from Replicate:', trainingStatus.status)

    // Update model based on current status
    const updateData: any = {
      updatedAt: new Date()
    }

    switch (trainingStatus.status) {
      case 'succeeded':
        updateData.status = 'READY'
        updateData.trainedAt = new Date()
        updateData.progress = 100
        
        if (trainingStatus.model?.url) {
          // For FLUX models, the model URL is the version string we need for generation
          const modelUrl = typeof trainingStatus.model.url === 'string' 
            ? trainingStatus.model.url 
            : (trainingStatus.model.url as any)?.version || (trainingStatus.model.url as any)?.weights
            
          updateData.modelUrl = modelUrl
          console.log('✅ Model URL updated from sync:', modelUrl)
        }
        
        // Update training config with completion info
        updateData.trainingConfig = {
          ...trainingConfig,
          trainingCompleted: true,
          fluxModel: true,
          completedAt: new Date().toISOString(),
          syncedAt: new Date().toISOString()
        }
        
        break

      case 'failed':
        updateData.status = 'ERROR'
        updateData.trainedAt = new Date()
        updateData.progress = 0
        
        if (trainingStatus.error) {
          updateData.errorMessage = trainingStatus.error
        }
        
        break

      case 'processing':
        updateData.status = 'TRAINING'
        // Could update progress if available
        break

      default:
        console.log('📝 No status update needed, current status:', trainingStatus.status)
    }

    // Update the model
    const updatedModel = await prisma.aIModel.update({
      where: { id: model.id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: {
        modelId: model.id,
        previousStatus: model.status,
        currentStatus: updatedModel.status,
        replicateStatus: trainingStatus.status,
        modelUrl: updatedModel.modelUrl,
        progress: updatedModel.progress,
        syncedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Model status sync error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to sync model status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}