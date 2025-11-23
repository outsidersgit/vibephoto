import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const videoId = params.id

    // Buscar vídeo do banco de dados
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
      return new NextResponse('Video not found', { status: 404 })
    }

    // Verificar se o usuário tem permissão
    if (video.userId !== session.user.id) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    // Verificar se o vídeo está disponível
    if (!video.videoUrl || video.status !== 'COMPLETED') {
      return new NextResponse('Video not available', { status: 404 })
    }

    // Extrair range header (para streaming progressivo)
    const range = request.headers.get('range')

    // Fazer fetch do vídeo do CloudFront/S3
    const headers: HeadersInit = {}
    if (range) {
      headers['Range'] = range
    }

    const response = await fetch(video.videoUrl, {
      headers,
      method: 'GET'
    })

    if (!response.ok) {
      console.error(`Failed to fetch video from storage:`, {
        status: response.status,
        statusText: response.statusText,
        videoUrl: video.videoUrl.substring(0, 100)
      })
      return new NextResponse('Failed to fetch video', { status: response.status })
    }

    // Obter o body como stream
    const videoStream = response.body

    if (!videoStream) {
      return new NextResponse('No video stream', { status: 500 })
    }

    // Criar resposta com CORS correto
    const responseHeaders = new Headers()
    
    // CORS headers
    responseHeaders.set('Access-Control-Allow-Origin', '*')
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    responseHeaders.set('Access-Control-Allow-Headers', 'Range, Accept, Content-Type')
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, ETag')
    
    // Content headers
    responseHeaders.set('Content-Type', 'video/mp4')
    responseHeaders.set('Accept-Ranges', 'bytes')
    
    // Copy relevant headers from S3 response
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength)
    }
    
    const contentRange = response.headers.get('content-range')
    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange)
    }
    
    const etag = response.headers.get('etag')
    if (etag) {
      responseHeaders.set('ETag', etag)
    }

    // Cache headers
    responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable')

    // Return stream with correct status code
    const status = range && contentRange ? 206 : 200

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

