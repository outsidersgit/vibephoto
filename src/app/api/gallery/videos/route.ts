import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getVideoGenerationsByUserId, searchVideoGenerations } from '@/lib/db/videos'
import { VideoQuality } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')
    const quality = searchParams.get('quality') as VideoQuality | undefined

    let result

    if (search) {
      result = await searchVideoGenerations(userId, search, page, limit)
    } else {
      result = await getVideoGenerationsByUserId(userId, page, limit, undefined, quality)
    }

    return NextResponse.json({
      success: true,
      data: result.videos.map(video => ({
        id: video.id,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        prompt: video.prompt,
        negativePrompt: video.negativePrompt,
        status: video.status,
        progress: video.progress,
        quality: video.quality,
        duration: video.duration,
        aspectRatio: video.aspectRatio,
        sourceImageUrl: video.sourceImageUrl,
        sourceGeneration: video.sourceGeneration,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
        processingStartedAt: video.processingStartedAt,
        processingCompletedAt: video.processingCompletedAt,
        estimatedTimeRemaining: video.estimatedTimeRemaining,
        creditsUsed: video.creditsUsed,
        fileSize: video.fileSize,
        metadata: video.metadata
      })),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.totalCount,
        pages: result.totalPages
      },
      totalCount: result.totalCount
    })

  } catch (error) {
    console.error('❌ Error fetching videos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    )
  }
}