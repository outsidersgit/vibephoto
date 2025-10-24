import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEditHistoryByUserId, searchEditHistory, deleteEditHistory } from '@/lib/db/edit-history'
import { revalidateGalleryTab } from '@/lib/cache/gallery-cache'

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
    const operation = searchParams.get('operation')

    let result

    if (search) {
      result = await searchEditHistory(userId, search, page, limit)
    } else {
      const filters = operation ? { operation } : undefined
      result = await getEditHistoryByUserId(userId, page, limit, filters)
    }

    return NextResponse.json({
      success: true,
      data: result.editHistory.map(item => ({
        id: item.id,
        imageUrl: item.editedImageUrl,
        thumbnailUrl: item.thumbnailUrl || item.editedImageUrl,
        prompt: item.prompt,
        operation: item.operation,
        originalImageUrl: item.originalImageUrl,
        createdAt: item.createdAt,
        metadata: item.metadata
      })),
      pagination: result.pagination,
      totalCount: result.totalCount
    })

  } catch (error) {
    console.error('❌ Error fetching edited images:', error)
    return NextResponse.json(
      { error: 'Failed to fetch edited images' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Invalid request: ids array required' }, { status: 400 })
    }

    const deletedIds: string[] = []
    const errors: { id: string; error: string }[] = []

    for (const id of ids) {
      try {
        await deleteEditHistory(id, userId)
        deletedIds.push(id)
      } catch (error) {
        console.error(`❌ Error deleting edit history ${id}:`, error)
        errors.push({ id, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // Invalidar cache da galeria após exclusão
    if (deletedIds.length > 0) {
      revalidateGalleryTab(userId, 'edited')
    }

    return NextResponse.json({
      success: true,
      deletedIds,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully deleted ${deletedIds.length} of ${ids.length} items`
    })

  } catch (error) {
    console.error('❌ Error in bulk delete:', error)
    return NextResponse.json(
      { error: 'Failed to delete edit history items' },
      { status: 500 }
    )
  }
}