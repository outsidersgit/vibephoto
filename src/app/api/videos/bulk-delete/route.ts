import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { revalidateGalleryTab } from '@/lib/cache/gallery-cache'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthAPI()
    const userId = session.user.id

    const { videoIds } = await request.json()

    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'Lista de IDs de vídeos é obrigatória' },
        { status: 400 }
      )
    }

    console.log('🗑️ Bulk DELETE Videos API called:', {
      videoIds: videoIds.length,
      userId
    })

    // Verify videos exist and belong to user
    const videos = await prisma.videoGeneration.findMany({
      where: {
        id: { in: videoIds },
        userId: userId
      },
      select: { id: true }
    })

    if (videos.length !== videoIds.length) {
      return NextResponse.json(
        { error: 'Alguns vídeos não foram encontrados ou você não tem permissão para deletá-los' },
        { status: 404 }
      )
    }

    // Delete videos from database
    const deleteResult = await prisma.videoGeneration.deleteMany({
      where: {
        id: { in: videoIds },
        userId: userId
      }
    })

    console.log('✅ Videos deleted successfully:', {
      requested: videoIds.length,
      deleted: deleteResult.count
    })

    // Invalidar cache da galeria de vídeos
    if (deleteResult.count > 0) {
      revalidateGalleryTab(userId, 'videos')
    }

    return NextResponse.json({
      success: true,
      message: `${deleteResult.count} vídeo(s) deletado(s) com sucesso`,
      deletedCount: deleteResult.count,
      deletedIds: videoIds
    })

  } catch (error) {
    console.error('❌ Error bulk deleting videos:', error)

    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}