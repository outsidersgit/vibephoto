import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { TopazUpscaler } from '@/lib/ai/upscale/topaz-upscaler'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: jobId } = await params
    const userId = session.user.id

    // Find the generation record
    const generation = await prisma.generation.findFirst({
      where: {
        jobId,
        userId
      }
    })

    if (!generation) {
      return NextResponse.json(
        { error: 'Upscale job not found' },
        { status: 404 }
      )
    }

    // If already completed in our DB, return the results
    if (generation.status === 'COMPLETED') {
      return NextResponse.json({
        status: 'succeeded',
        progress: 100,
        resultImages: generation.imageUrls || [],
        downloadUrl: generation.imageUrls?.[0],
        thumbnailUrls: generation.thumbnailUrls || []
      })
    }

    if (generation.status === 'FAILED') {
      return NextResponse.json({
        status: 'failed',
        progress: 0,
        error: generation.errorMessage || 'Upscale failed'
      })
    }

    // Check status from Replicate
    try {
      const upscaler = new TopazUpscaler()
      const replicateStatus = await upscaler.getUpscaleStatus(jobId)

      // Map Replicate status to our status format
      const status = replicateStatus.status
      let progress = replicateStatus.progress || 0

      if (status === 'starting') {
        progress = 10
      } else if (status === 'processing') {
        progress = Math.max(progress, 30)
      } else if (status === 'succeeded') {
        progress = 100
      }

      return NextResponse.json({
        status: replicateStatus.status,
        progress,
        resultImages: replicateStatus.result || [],
        downloadUrl: replicateStatus.result?.[0],
        error: replicateStatus.error,
        estimatedTime: generation.processingTime || 60000 // Default to 60 seconds
      })

    } catch (replicateError) {
      console.error('Error checking Replicate status:', replicateError)
      
      // Fallback to database status
      return NextResponse.json({
        status: generation.status.toLowerCase(),
        progress: generation.status === 'PROCESSING' ? 50 : 0,
        error: generation.errorMessage,
        estimatedTime: generation.processingTime || 60000
      })
    }

  } catch (error) {
    console.error('Upscale status check error:', error)
    return NextResponse.json(
      { error: 'Failed to check upscale status' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: jobId } = await params
    const userId = session.user.id

    // Find the generation record
    const generation = await prisma.generation.findFirst({
      where: {
        jobId,
        userId
      }
    })

    if (!generation) {
      return NextResponse.json(
        { error: 'Upscale job not found' },
        { status: 404 }
      )
    }

    // Cancel the job at Replicate
    try {
      const upscaler = new TopazUpscaler()
      await upscaler.cancelUpscale(jobId)
    } catch (cancelError) {
      console.error('Error cancelling Replicate job:', cancelError)
      // Continue with local cancellation even if Replicate fails
    }

    // Update local status
    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: 'FAILED',
        errorMessage: 'Cancelled by user',
        completedAt: new Date()
      }
    })

    // TODO: Refund credits
    // This should be handled by the existing refundGenerationCredits function

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Upscale cancellation error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel upscale' },
      { status: 500 }
    )
  }
}