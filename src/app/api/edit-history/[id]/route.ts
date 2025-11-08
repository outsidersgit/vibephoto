import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const editHistory = await prisma.editHistory.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        editedImageUrl: true,
        thumbnailUrl: true,
        metadata: true,
        createdAt: true
      }
    })

    if (!editHistory || editHistory.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      editHistory: {
        id: editHistory.id,
        editedImageUrl: editHistory.editedImageUrl,
        thumbnailUrl: editHistory.thumbnailUrl,
        metadata: editHistory.metadata,
        createdAt: editHistory.createdAt
      }
    })
  } catch (error) {
    console.error('❌ [API] Failed to fetch edit history entry:', error)
    return NextResponse.json({ error: 'Failed to fetch edit history' }, { status: 500 })
  }
}
