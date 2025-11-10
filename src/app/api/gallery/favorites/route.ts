import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { toggleGenerationFavoriteImage } from '@/lib/db/generations'
import { revalidateUserGallery } from '@/lib/cache/gallery-cache'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { generationId, imageUrl, favorite } = await request.json()

    if (!generationId || !imageUrl) {
      return NextResponse.json(
        { success: false, error: 'generationId e imageUrl são obrigatórios.' },
        { status: 400 }
      )
    }

    const favoriteImages = await toggleGenerationFavoriteImage(
      session.user.id,
      generationId,
      imageUrl,
      favorite
    )

    revalidateUserGallery(session.user.id)

    return NextResponse.json({
      success: true,
      data: {
        favoriteImages
      }
    })
  } catch (error: any) {
    console.error('Erro ao atualizar favoritos da galeria:', error)

    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    const status = message.includes('access denied') ? 403 : 500

    return NextResponse.json(
      {
        success: false,
        error: status === 403 ? 'Acesso negado' : 'Não foi possível atualizar o favorito. Tente novamente.'
      },
      { status }
    )
  }
}
