import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAIProvider } from '@/lib/ai'

export async function GET(request: NextRequest) {
  try {
    // Dev only endpoint
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Development only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'PROCESSING'
    const limit = parseInt(searchParams.get('limit') || '10')

    console.log(`🔍 Fetching predictions with status: ${status}`)

    // Get recent generations
    const generations = await prisma.generation.findMany({
      where: {
        status: status as any,
        jobId: { not: null }
      },
      include: {
        user: {
          select: { id: true, email: true }
        },
        model: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    console.log(`📊 Found ${generations.length} generations`)

    // Get real-time status from Replicate for processing ones
    const aiProvider = getAIProvider()
    const results = []

    for (const generation of generations) {
      try {
        if (generation.jobId && (status === 'PROCESSING' || status === 'ALL')) {
          // Get real-time status
          const prediction = await aiProvider.getPredictionStatus(generation.jobId)

          results.push({
            generationId: generation.id,
            jobId: generation.jobId,
            databaseStatus: generation.status,
            replicateStatus: prediction.status,
            hasOutput: !!prediction.output,
            outputType: Array.isArray(prediction.output) ? 'array' : typeof prediction.output,
            outputUrls: Array.isArray(prediction.output) ? prediction.output.length : (prediction.output ? 1 : 0),
            imageUrls: generation.imageUrls ? (generation.imageUrls as any).length : 0,
            createdAt: generation.createdAt,
            model: generation.model.name,
            user: generation.user.email,
            prompt: generation.prompt.substring(0, 100) + '...'
          })
        } else {
          // Just database info
          results.push({
            generationId: generation.id,
            jobId: generation.jobId,
            databaseStatus: generation.status,
            replicateStatus: 'not_checked',
            hasOutput: false,
            outputUrls: 0,
            imageUrls: generation.imageUrls ? (generation.imageUrls as any).length : 0,
            createdAt: generation.createdAt,
            model: generation.model.name,
            user: generation.user.email,
            prompt: generation.prompt.substring(0, 100) + '...'
          })
        }
      } catch (error) {
        console.error(`❌ Error checking prediction ${generation.jobId}:`, error)
        results.push({
          generationId: generation.id,
          jobId: generation.jobId,
          databaseStatus: generation.status,
          replicateStatus: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          imageUrls: generation.imageUrls ? (generation.imageUrls as any).length : 0,
          createdAt: generation.createdAt,
          model: generation.model.name,
          user: generation.user.email,
          prompt: generation.prompt.substring(0, 100) + '...'
        })
      }
    }

    // Summary stats
    const summary = {
      totalFound: results.length,
      byReplicateStatus: {} as Record<string, number>,
      byDatabaseStatus: {} as Record<string, number>,
      withImages: results.filter(r => r.imageUrls > 0).length,
      withoutImages: results.filter(r => r.imageUrls === 0).length,
      withOutput: results.filter(r => r.hasOutput).length,
      withoutOutput: results.filter(r => !r.hasOutput && r.replicateStatus !== 'not_checked').length
    }

    results.forEach(r => {
      summary.byReplicateStatus[r.replicateStatus] = (summary.byReplicateStatus[r.replicateStatus] || 0) + 1
      summary.byDatabaseStatus[r.databaseStatus] = (summary.byDatabaseStatus[r.databaseStatus] || 0) + 1
    })

    console.log(`📈 Summary:`, summary)

    return NextResponse.json({
      success: true,
      summary,
      predictions: results
    })

  } catch (error) {
    console.error('❌ Predictions monitoring error:', error)

    return NextResponse.json({
      error: 'Monitoring failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST to force refresh a specific prediction
export async function POST(request: NextRequest) {
  try {
    // Dev only endpoint
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Development only' }, { status: 403 })
    }

    const { generationId, action } = await request.json()

    if (!generationId) {
      return NextResponse.json({ error: 'Generation ID required' }, { status: 400 })
    }

    const generation = await prisma.generation.findUnique({
      where: { id: generationId },
      include: { user: true }
    })

    if (!generation || !generation.jobId) {
      return NextResponse.json({ error: 'Generation not found or missing jobId' }, { status: 404 })
    }

    const aiProvider = getAIProvider()

    if (action === 'refresh') {
      // Get current status from Replicate
      const prediction = await aiProvider.getPredictionStatus(generation.jobId)

      return NextResponse.json({
        success: true,
        generationId,
        jobId: generation.jobId,
        databaseStatus: generation.status,
        replicateStatus: prediction.status,
        hasOutput: !!prediction.output,
        output: prediction.output,
        error: prediction.error
      })
    } else if (action === 'start_polling') {
      // Manually start polling for this prediction
      try {
        const { startPolling } = await import('@/lib/services/polling-service')
        await startPolling(generation.jobId, generation.id, generation.userId)

        return NextResponse.json({
          success: true,
          message: 'Polling started',
          generationId,
          jobId: generation.jobId
        })
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: 'Failed to start polling',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (error) {
    console.error('❌ Prediction action error:', error)

    return NextResponse.json({
      error: 'Action failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}