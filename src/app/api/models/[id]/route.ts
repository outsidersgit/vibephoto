import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getModelById, deleteModel, updateModelStatus } from '@/lib/db/models'
import { AstriaProvider } from '@/lib/ai/providers/astria'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const model = await getModelById(id, session.user.id)
    
    if (!model) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ model })

  } catch (error: any) {
    console.error('Error fetching model:', error)
    return NextResponse.json(
      { error: 'Failed to fetch model' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { status, progress, errorMessage } = body

    const { id } = await params
    
    // Verify user owns the model
    const existingModel = await getModelById(id, session.user.id)
    if (!existingModel) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      )
    }

    const updatedModel = await updateModelStatus(
      id,
      status,
      progress,
      errorMessage
    )

    return NextResponse.json({ 
      success: true,
      model: updatedModel 
    })

  } catch (error: any) {
    console.error('Error updating model:', error)
    return NextResponse.json(
      { error: 'Failed to update model' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    
    // Verify user owns the model before deleting
    const existingModel = await getModelById(id, session.user.id)
    if (!existingModel) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      )
    }

    if (existingModel.aiProvider === 'astria' && existingModel.trainingJobId) {
      try {
        const astria = new AstriaProvider()
        await astria.deleteTune(existingModel.trainingJobId)
      } catch (error) {
        console.error(`⚠️ Failed to delete Astria tune for model ${id}:`, error)
        // Continue with local deletion to avoid blocking user flow
      }
    }

    await deleteModel(id, session.user.id)

    return NextResponse.json({ 
      success: true,
      message: 'Model deleted successfully' 
    })

  } catch (error: any) {
    console.error('Error deleting model:', error)
    return NextResponse.json(
      { error: 'Failed to delete model' },
      { status: 500 }
    )
  }
}