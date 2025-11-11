import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { fetchGenerationBatch } from '@/lib/db/generations'
import { fetchVideoBatch } from '@/lib/db/videos'
import { VideoStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    const { searchParams } = new URL(request.url)
    const tab = searchParams.get('tab') || 'generated'
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '24', 10), 40)
    const modelId = searchParams.get('model') || undefined
    const searchQuery = searchParams.get('search') || undefined
    const sortBy = (searchParams.get('sort') || 'newest') as 'newest' | 'oldest' | 'model' | 'prompt'

    if (tab === 'videos') {
      const statusParam = searchParams.get('status')
      const quality = searchParams.get('quality')
      const status = statusParam ? (statusParam.toUpperCase() as VideoStatus) : undefined

      const result = await fetchVideoBatch({
        userId,
        limit,
        cursor,
        status,
        quality,
        searchQuery
      })

      return NextResponse.json({
        success: true,
        data: {
          videos: result.items,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
          totalCount: result.totalCount
        }
      })
    }

    const includePackages = searchParams.get('includePackages') === 'true'

    const result = await fetchGenerationBatch({
      userId,
      limit,
      cursor,
      modelId,
      searchQuery,
      sortBy,
      includePackages
    })

    return NextResponse.json({
      success: true,
      data: {
        generations: result.items,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        totalCount: result.totalCount
      }
    })
  } catch (error) {
    console.error('Gallery load-more error:', error)
    return NextResponse.json(
      { success: false, error: 'Falha ao carregar mais itens.' },
      { status: 500 }
    )
  }
}
