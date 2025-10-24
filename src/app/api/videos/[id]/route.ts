import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { revalidateGalleryTab } from '@/lib/cache/gallery-cache'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuthAPI()
    const userId = session.user.id
    const videoId = params.id

    console.log('🗑️ DELETE Video API called:', { videoId, userId })

    // Verify video exists and belongs to user
    const video = await prisma.videoGeneration.findFirst({
      where: {
        id: videoId,
        userId: userId
      }
    })

    if (!video) {
      return NextResponse.json(
        { error: 'Vídeo não encontrado ou você não tem permissão para deletá-lo' },
        { status: 404 }
      )
    }

    // Delete the video from database
    await prisma.videoGeneration.delete({
      where: {
        id: videoId
      }
    })

    console.log('✅ Video deleted successfully:', videoId)

    // Invalidar cache da galeria de vídeos
    revalidateGalleryTab(userId, 'videos')

    return NextResponse.json({
      success: true,
      message: 'Vídeo deletado com sucesso'
    })

  } catch (error) {
    console.error('❌ Error deleting video:', error)

    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuthAPI()
    const userId = session.user.id
    const videoId = params.id

    // Get video details
    const video = await prisma.videoGeneration.findFirst({
      where: {
        id: videoId,
        userId: userId
      },
      include: {
        sourceGeneration: {
          select: {
            id: true,
            prompt: true,
            imageUrls: true
          }
        }
      }
    })

    if (!video) {
      return NextResponse.json(
        { error: 'Vídeo não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(video)

  } catch (error) {
    console.error('❌ Error getting video:', error)

    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}