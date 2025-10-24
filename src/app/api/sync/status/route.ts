import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Endpoint para verificar status de sincronização
 * Usado pelo polling de fallback quando WebSocket não funciona
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    // Contar jobs pendentes do usuário
    const [pendingGenerations, pendingUpscales, pendingModels] = await Promise.all([
      // Gerações normais pendentes
      prisma.generation.count({
        where: {
          userId,
          status: 'PROCESSING',
          prompt: { not: { startsWith: '[UPSCALED]' } }
        }
      }),
      
      // Upscales pendentes
      prisma.generation.count({
        where: {
          userId,
          status: 'PROCESSING',
          prompt: { startsWith: '[UPSCALED]' }
        }
      }),
      
      // Modelos em treinamento
      prisma.aIModel.count({
        where: {
          userId,
          status: 'TRAINING'
        }
      })
    ])

    const totalPendingJobs = pendingGenerations + pendingUpscales + pendingModels

    // Últimas atividades do usuário
    const recentGenerations = await prisma.generation.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        completedAt: true,
        createdAt: true,
        prompt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    })

    const recentModels = await prisma.aIModel.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        trainedAt: true,
        createdAt: true,
        name: true
      },
      orderBy: { createdAt: 'desc' },
      take: 3
    })

    // Estatísticas de sync
    const lastActivity = recentGenerations[0]?.completedAt || recentModels[0]?.trainedAt || null

    return NextResponse.json({
      pendingJobs: totalPendingJobs,
      breakdown: {
        pendingGenerations,
        pendingUpscales,
        pendingModels
      },
      recentActivity: {
        generations: recentGenerations.map(gen => ({
          id: gen.id,
          status: gen.status,
          type: gen.prompt?.startsWith('[UPSCALED]') ? 'upscale' : 'generation',
          completedAt: gen.completedAt,
          ageMinutes: gen.completedAt 
            ? Math.round((Date.now() - new Date(gen.completedAt).getTime()) / 60000)
            : Math.round((Date.now() - new Date(gen.createdAt).getTime()) / 60000)
        })),
        models: recentModels.map(model => ({
          id: model.id,
          name: model.name,
          status: model.status,
          trainedAt: model.trainedAt,
          ageMinutes: model.trainedAt
            ? Math.round((Date.now() - new Date(model.trainedAt).getTime()) / 60000)
            : Math.round((Date.now() - new Date(model.createdAt).getTime()) / 60000)
        }))
      },
      lastActivity,
      syncInfo: {
        webhookConfigured: !!process.env.REPLICATE_WEBHOOK_SECRET,
        realtimeEnabled: true,
        pollingFallback: true
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Sync status check error:', error)
    return NextResponse.json(
      { error: 'Failed to check sync status' },
      { status: 500 }
    )
  }
}