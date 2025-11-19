import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { diagnoseVideoFlow } from '@/lib/debug/video-flow-debugger'

interface RouteParams {
  params: {
    id: string
  }
}

/**
 * GET /api/video/diagnose/[id]
 * Diagnóstico completo do fluxo de vídeo para identificar onde está quebrando
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Autenticar usuário
    const session = await requireAuth()
    const userId = session.user.id
    const videoId = params.id

    console.log(`🔍 Executando diagnóstico completo para vídeo ${videoId} (usuário ${userId})`)

    // Executar diagnóstico
    const diagnostic = await diagnoseVideoFlow(videoId)

    // Verificar se o vídeo pertence ao usuário
    if (diagnostic.overallStatus !== 'BROKEN' && diagnostic.stages.length > 0) {
      const firstStage = diagnostic.stages[0]
      if (firstStage.status === 'OK' && firstStage.data?.createdAt) {
        // Verificar ownership (seria melhor fazer isso no diagnóstico, mas por enquanto assim)
        const { prisma } = await import('@/lib/db')
        const video = await prisma.videoGeneration.findUnique({
          where: { id: videoId },
          select: { userId: true }
        })

        if (video && video.userId !== userId) {
          return NextResponse.json(
            { error: 'Access denied' },
            { status: 403 }
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      diagnostic,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Erro ao executar diagnóstico:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to diagnose video flow',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

