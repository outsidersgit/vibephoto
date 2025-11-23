import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { extractFirstFrame } from '@/lib/video/extract-frame'
import { VideoStatus } from '@prisma/client'

/**
 * API Route para reprocessar thumbnails de vídeo
 * 
 * Uso:
 * GET /api/admin/reprocess-thumbnails?dry-run=true
 * GET /api/admin/reprocess-thumbnails?limit=10
 * GET /api/admin/reprocess-thumbnails (executa realmente)
 * 
 * Requer autenticação de admin
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const session = await requireAuth()
    
    // CRITICAL: Verificar se é admin
    // Adicione verificação de role de admin aqui conforme seu sistema
    // Exemplo: if (session.user.role !== 'ADMIN') { return NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }
    
    const { searchParams } = new URL(request.url)
    const dryRun = searchParams.get('dry-run') === 'true'
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined
    const force = searchParams.get('force') === 'true'
    const minSizeKB = searchParams.get('min-size') ? parseInt(searchParams.get('min-size')!, 10) : 200

    console.log('🎬 [REPROCESS_API] Starting thumbnail reprocessing', {
      dryRun,
      limit,
      force,
      minSizeKB,
      userId: session.user.id
    })

    // Buscar vídeos
    const videos = await prisma.videoGeneration.findMany({
      where: {
        status: VideoStatus.COMPLETED,
        thumbnailUrl: { not: null },
        videoUrl: { not: null }
      },
      select: {
        id: true,
        userId: true,
        thumbnailUrl: true,
        videoUrl: true,
        createdAt: true,
        metadata: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    console.log(`📹 [REPROCESS_API] Found ${videos.length} videos with thumbnails`)

    const results = {
      total: videos.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      totalSizeBefore: 0,
      totalSizeAfter: 0,
      videos: [] as any[]
    }

    // Processar cada vídeo
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i]
      const videoResult: any = {
        id: video.id,
        index: i + 1,
        total: videos.length,
        thumbnailUrl: video.thumbnailUrl
      }

      try {
        if (!video.thumbnailUrl || !video.videoUrl) {
          videoResult.status = 'skipped'
          videoResult.reason = 'missing URLs'
          results.skipped++
          results.videos.push(videoResult)
          continue
        }

        // Verificar tamanho atual da thumbnail
        const currentSize = await getThumbnailSize(video.thumbnailUrl)
        if (currentSize === null) {
          videoResult.status = 'skipped'
          videoResult.reason = 'could not determine size'
          results.skipped++
          results.videos.push(videoResult)
          continue
        }

        const currentSizeKB = Math.round(currentSize / 1024)
        videoResult.currentSizeKB = currentSizeKB
        results.totalSizeBefore += currentSize

        // Pular se já otimizado (a menos que force mode)
        if (!force && currentSize < minSizeKB * 1024) {
          videoResult.status = 'skipped'
          videoResult.reason = `already optimized (< ${minSizeKB} KB)`
          results.skipped++
          results.totalSizeAfter += currentSize
          results.videos.push(videoResult)
          continue
        }

        if (dryRun) {
          videoResult.status = 'would-process'
          videoResult.estimatedSizeKB = 50
          results.processed++
          results.totalSizeAfter += 50 * 1024
          results.videos.push(videoResult)
          continue
        }

        // Reprocessar thumbnail
        console.log(`🎨 [REPROCESS_API] Processing video ${i + 1}/${videos.length}: ${video.id}`)
        
        const result = await extractFirstFrame(
          video.videoUrl,
          video.id,
          video.userId
        )

        if (!result.success || !result.thumbnailUrl) {
          videoResult.status = 'failed'
          videoResult.error = result.error
          results.failed++
          results.totalSizeAfter += currentSize
          results.videos.push(videoResult)
          continue
        }

        // Verificar novo tamanho
        const newSize = await getThumbnailSize(result.thumbnailUrl)
        const newSizeKB = newSize ? Math.round(newSize / 1024) : null
        const savings = newSize ? Math.round(((currentSize - newSize) / currentSize) * 100) : 0

        videoResult.status = 'processed'
        videoResult.newSizeKB = newSizeKB
        videoResult.savingsPercent = savings
        videoResult.newThumbnailUrl = result.thumbnailUrl
        results.totalSizeAfter += newSize || currentSize

        // Atualizar banco de dados
        await prisma.videoGeneration.update({
          where: { id: video.id },
          data: {
            thumbnailUrl: result.thumbnailUrl,
            metadata: {
              ...(video.metadata as any || {}),
              thumbnailOptimized: true,
              thumbnailOptimizedAt: new Date().toISOString(),
              thumbnailSizeBefore: currentSize,
              thumbnailSizeAfter: newSize
            }
          }
        })

        results.processed++
        results.videos.push(videoResult)

        console.log(`✅ [REPROCESS_API] Video ${video.id} processed: ${currentSizeKB} KB → ${newSizeKB} KB (${savings}% reduction)`)

        // Rate limiting - wait 500ms between videos
        if (i < videos.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }

      } catch (error) {
        console.error(`❌ [REPROCESS_API] Error processing video ${video.id}:`, error)
        videoResult.status = 'failed'
        videoResult.error = error instanceof Error ? error.message : 'Unknown error'
        results.failed++
        results.totalSizeAfter += results.totalSizeBefore // Keep old size
        results.videos.push(videoResult)
      }
    }

    // Calcular economia
    const totalSavedBytes = results.totalSizeBefore - results.totalSizeAfter
    const totalSavedMB = Math.round(totalSavedBytes / 1024 / 1024)
    const savingsPercent = results.totalSizeBefore > 0 
      ? Math.round((totalSavedBytes / results.totalSizeBefore) * 100)
      : 0

    const summary = {
      ...results,
      totalSizeBeforeMB: Math.round(results.totalSizeBefore / 1024 / 1024),
      totalSizeAfterMB: Math.round(results.totalSizeAfter / 1024 / 1024),
      totalSavedMB,
      savingsPercent,
      dryRun
    }

    console.log('📊 [REPROCESS_API] Summary:', summary)

    return NextResponse.json({
      success: true,
      summary,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [REPROCESS_API] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

async function getThumbnailSize(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    const contentLength = response.headers.get('content-length')
    return contentLength ? parseInt(contentLength, 10) : null
  } catch (error) {
    console.error(`❌ Failed to get thumbnail size for ${url}:`, error)
    return null
  }
}

