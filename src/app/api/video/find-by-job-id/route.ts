import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/video/find-by-job-id?jobId=xxx
 * Encontra o videoId a partir do jobId (Replicate)
 */
export async function GET(request: NextRequest) {
  try {
    // Autenticar usuário
    const session = await requireAuth()
    const userId = session.user.id

    const searchParams = request.nextUrl.searchParams
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID é obrigatório' },
        { status: 400 }
      )
    }

    console.log(`🔍 Buscando vídeo por jobId: ${jobId} (usuário: ${userId})`)

    // Buscar vídeo pelo jobId
    const video = await prisma.videoGeneration.findFirst({
      where: {
        jobId: jobId,
        userId: userId // Garantir que é do usuário autenticado
      },
      select: {
        id: true,
        jobId: true,
        status: true,
        createdAt: true
      }
    })

    if (!video) {
      return NextResponse.json(
        { error: 'Vídeo não encontrado para este Job ID' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      videoId: video.id,
      jobId: video.jobId,
      status: video.status,
      createdAt: video.createdAt
    })

  } catch (error) {
    console.error('❌ Erro ao buscar vídeo por jobId:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to find video by job ID',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

