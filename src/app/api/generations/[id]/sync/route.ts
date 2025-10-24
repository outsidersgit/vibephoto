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

    // Get the generation
    const generation = await prisma.generation.findUnique({
      where: { 
        id,
        userId: session.user.id 
      },
      include: {
        model: true
      }
    })

    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found or access denied' },
        { status: 404 }
      )
    }

    if (!generation.jobId) {
      return NextResponse.json(
        { error: 'Generation has no job ID' },
        { status: 400 }
      )
    }

    console.log('🔄 Manually checking generation status for:', generation.jobId)

    // Get AI provider and check status
    const aiProvider = getAIProvider()
    
    // Check if the AI provider has a method to get prediction status
    if (typeof aiProvider.getPredictionStatus === 'function') {
      const status = await aiProvider.getPredictionStatus(generation.jobId)
      
      console.log('📊 Generation status from provider:', status.status)
      
      // Update generation based on status
      const updateData: any = {
        updatedAt: new Date()
      }

      switch (status.status) {
        case 'succeeded':
          updateData.status = 'COMPLETED'
          updateData.completedAt = new Date()
          
          if (status.output) {
            let imageUrls: string[] = []
            
            if (Array.isArray(status.output)) {
              imageUrls = status.output
            } else if (typeof status.output === 'string') {
              imageUrls = [status.output]
            }
            
            updateData.imageUrls = imageUrls
            updateData.thumbnailUrls = imageUrls // Same as originals for now
            
            console.log(`✅ Generation completed with ${imageUrls.length} images`)
          }
          
          // Calculate processing time
          if (generation.createdAt) {
            const processingTime = Math.round((new Date().getTime() - new Date(generation.createdAt).getTime()) / 1000)
            updateData.processingTime = processingTime
            console.log(`⏱️ Processing time: ${processingTime} seconds`)
          }
          
          break

        case 'failed':
        case 'canceled':
          updateData.status = 'FAILED'
          updateData.completedAt = new Date()
          
          if (status.error) {
            updateData.errorMessage = status.error
          }
          
          break

        case 'starting':
        case 'processing':
          updateData.status = 'PROCESSING'
          break

        default:
          console.log('📝 No status update needed, current status:', status.status)
      }

      // Update the generation
      const updatedGeneration = await prisma.generation.update({
        where: { id: generation.id },
        data: updateData
      })

      return NextResponse.json({
        success: true,
        data: {
          generationId: generation.id,
          previousStatus: generation.status,
          currentStatus: updatedGeneration.status,
          providerStatus: status.status,
          imageUrls: updatedGeneration.imageUrls,
          syncedAt: new Date().toISOString()
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'AI provider does not support status checking'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Generation status sync error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to sync generation status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}