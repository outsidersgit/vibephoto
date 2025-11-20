import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * 🔍 Endpoint de diagnóstico para callbacks do Astria
 * 
 * Permite verificar:
 * - Status de gerações recentes
 * - Se o webhook foi processado
 * - IDs extraídos das URLs do Astria
 * - Problemas comuns
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id
    
    const { searchParams } = new URL(request.url)
    const generationId = searchParams.get('generationId')
    const jobId = searchParams.get('jobId')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    // Se fornecido generationId ou jobId, retornar diagnóstico específico
    if (generationId || jobId) {
      const generation = await prisma.generation.findFirst({
        where: {
          OR: [
            generationId ? { id: generationId } : {},
            jobId ? { jobId: jobId } : {}
          ],
          userId // Garantir que o usuário é o dono
        },
        select: {
          id: true,
          jobId: true,
          status: true,
          imageUrls: true,
          metadata: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true
        }
      })
      
      if (!generation) {
        return NextResponse.json({
          error: 'Generation not found',
          generationId,
          jobId
        }, { status: 404 })
      }
      
      const metadata = generation.metadata as any || {}
      
      // Diagnóstico detalhado
      const diagnostic = {
        generation: {
          id: generation.id,
          jobId: generation.jobId,
          status: generation.status,
          hasImages: Array.isArray(generation.imageUrls) && generation.imageUrls.length > 0,
          imageCount: Array.isArray(generation.imageUrls) ? generation.imageUrls.length : 0,
          errorMessage: generation.errorMessage,
          createdAt: generation.createdAt,
          updatedAt: generation.updatedAt,
          completedAt: generation.completedAt
        },
        webhook: {
          processed: metadata.webhookProcessed === true,
          processedVia: metadata.processedVia,
          processedAt: metadata.processedAt,
          stored: metadata.stored === true,
          storedAt: metadata.storedAt
        },
        astria: {
          tuneId: metadata.tune_id,
          promptId: metadata.prompt_id,
          astriaUrl: metadata.astriaUrl,
          hasTuneId: !!metadata.tune_id,
          hasPromptId: !!metadata.prompt_id
        },
        issues: [] as string[],
        recommendations: [] as string[]
      }
      
      // Detectar problemas
      if (generation.status === 'PROCESSING' && !metadata.webhookProcessed) {
        diagnostic.issues.push('Generation is PROCESSING but webhook was not processed')
        diagnostic.recommendations.push('Check if Astria called the callback. Look for logs with WEBHOOK_ASTRIA')
      }
      
      if (generation.status === 'COMPLETED' && !metadata.stored) {
        diagnostic.issues.push('Generation is COMPLETED but images were not stored')
        diagnostic.recommendations.push('Check storage logs. Images may be using temporary URLs')
      }
      
      if (!metadata.tune_id && !metadata.prompt_id) {
        diagnostic.issues.push('No tune_id or prompt_id found in metadata')
        diagnostic.recommendations.push('Check if Astria URL was extracted correctly from webhook payload')
      }
      
      if (!generation.jobId) {
        diagnostic.issues.push('No jobId found in generation')
        diagnostic.recommendations.push('Generation may not have been created correctly')
      }
      
      return NextResponse.json({
        success: true,
        diagnostic,
        timestamp: new Date().toISOString()
      })
    }
    
    // Retornar lista de gerações recentes
    const recentGenerations = await prisma.generation.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24h
        }
      },
      select: {
        id: true,
        jobId: true,
        status: true,
        imageUrls: true,
        metadata: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })
    
    const generationsWithDiagnostic = recentGenerations.map(gen => {
      const metadata = gen.metadata as any || {}
      return {
        id: gen.id,
        jobId: gen.jobId,
        status: gen.status,
        hasImages: Array.isArray(gen.imageUrls) && gen.imageUrls.length > 0,
        webhookProcessed: metadata.webhookProcessed === true,
        stored: metadata.stored === true,
        tuneId: metadata.tune_id,
        promptId: metadata.prompt_id,
        createdAt: gen.createdAt,
        updatedAt: gen.updatedAt
      }
    })
    
    return NextResponse.json({
      success: true,
      generations: generationsWithDiagnostic,
      count: generationsWithDiagnostic.length,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Error in Astria webhook diagnostic:', error)
    return NextResponse.json(
      {
        error: 'Failed to get diagnostic',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

