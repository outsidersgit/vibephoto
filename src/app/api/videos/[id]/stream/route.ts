import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Proxy para streaming de vídeos com CORS correto
 * Solução temporária até configurar CORS no CloudFront/S3
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const videoId = params.id

    // Buscar vídeo do banco de dados
    // NOTA: Não verificamos autenticação aqui pois <video> tags não enviam cookies consistentemente
    // Os vídeos já têm URLs únicas e difíceis de adivinhar (IDs aleatórios)
    const video = await prisma.videoGeneration.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        userId: true,
        videoUrl: true,
        status: true
      }
    })

    if (!video) {
      console.error(`[VIDEO_STREAM] Video not found: ${videoId}`)
      return new NextResponse('Video not found', { status: 404 })
    }

    console.log(`[VIDEO_STREAM] Proxying video ${videoId} for user ${video.userId}`)

    // Verificar se o vídeo está disponível
    if (!video.videoUrl || video.status !== 'COMPLETED') {
      console.error(`[VIDEO_STREAM] Video not available:`, {
        hasUrl: !!video.videoUrl,
        status: video.status
      })
      return new NextResponse('Video not available', { status: 404 })
    }

    // Extrair range header (para streaming progressivo)
    const range = request.headers.get('range')
    console.log(`[VIDEO_STREAM] Range request:`, range || 'full video')

    // Fazer fetch do vídeo do CloudFront/S3
    const headers: HeadersInit = {
      'Accept': 'video/mp4, video/*'
    }
    if (range) {
      headers['Range'] = range
    }

    console.log(`[VIDEO_STREAM] Fetching from:`, video.videoUrl.substring(0, 100))
    
    const response = await fetch(video.videoUrl, {
      headers,
      method: 'GET',
      // Não seguir redirects automaticamente
      redirect: 'follow'
    })

    if (!response.ok) {
      console.error(`[VIDEO_STREAM] Failed to fetch video from storage:`, {
        status: response.status,
        statusText: response.statusText,
        videoUrl: video.videoUrl.substring(0, 100)
      })
      return new NextResponse('Failed to fetch video', { status: response.status })
    }

    console.log(`[VIDEO_STREAM] Fetched successfully, content-type:`, response.headers.get('content-type'))

    // Obter o body como stream
    const videoStream = response.body

    if (!videoStream) {
      console.error('[VIDEO_STREAM] No video stream in response')
      return new NextResponse('No video stream', { status: 500 })
    }

    // Criar resposta com CORS correto
    const responseHeaders = new Headers()
    
    // CORS headers - CRÍTICO para <video> tags
    responseHeaders.set('Access-Control-Allow-Origin', '*')
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    responseHeaders.set('Access-Control-Allow-Headers', 'Range, Accept, Content-Type, Accept-Encoding')
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type, ETag')
    
    // Content headers - usar do S3 se disponível
    const contentType = response.headers.get('content-type') || 'video/mp4'
    responseHeaders.set('Content-Type', contentType)
    responseHeaders.set('Accept-Ranges', 'bytes')
    
    // Copy relevant headers from S3 response
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength)
      console.log('[VIDEO_STREAM] Content-Length:', contentLength)
    }
    
    const contentRange = response.headers.get('content-range')
    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange)
      console.log('[VIDEO_STREAM] Content-Range:', contentRange)
    }
    
    const etag = response.headers.get('etag')
    if (etag) {
      responseHeaders.set('ETag', etag)
    }

    // Cache headers
    responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable')

    // Return stream with correct status code
    const status = range && contentRange ? 206 : 200
    
    console.log(`[VIDEO_STREAM] Returning stream with status ${status}`)

    return new NextResponse(videoStream, {
      status,
      headers: responseHeaders
    })

  } catch (error) {
    console.error('Error in video stream proxy:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Accept, Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  })
}

