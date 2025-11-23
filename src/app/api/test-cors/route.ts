import { NextRequest, NextResponse } from 'next/server'

/**
 * Endpoint para testar headers CORS do CloudFront/S3
 * Acesse: /api/test-cors?url=https://cloudfront-url/video.mp4
 */
export async function GET(request: NextRequest) {
  const videoUrl = request.nextUrl.searchParams.get('url')
  
  if (!videoUrl) {
    return NextResponse.json({ 
      error: 'Provide ?url=YOUR_VIDEO_URL parameter' 
    }, { status: 400 })
  }

  try {
    console.log('🧪 [CORS_TEST] Testing URL:', videoUrl)

    // Test HEAD request (lighter than GET)
    const response = await fetch(videoUrl, {
      method: 'HEAD',
      headers: {
        'Origin': 'https://vibephoto.app',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Range'
      }
    })

    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })

    const corsHeaders = {
      'access-control-allow-origin': headers['access-control-allow-origin'] || '❌ MISSING',
      'access-control-allow-methods': headers['access-control-allow-methods'] || '❌ MISSING',
      'access-control-allow-headers': headers['access-control-allow-headers'] || '❌ MISSING',
      'access-control-expose-headers': headers['access-control-expose-headers'] || '❌ MISSING',
      'accept-ranges': headers['accept-ranges'] || '❌ MISSING',
      'content-type': headers['content-type'] || '❌ MISSING'
    }

    const diagnosis = {
      url: videoUrl,
      status: response.status,
      statusText: response.statusText,
      corsHeaders,
      allHeaders: headers,
      issues: [] as string[],
      recommendation: ''
    }

    // Diagnose issues
    if (!corsHeaders['access-control-allow-origin'] || corsHeaders['access-control-allow-origin'] === '❌ MISSING') {
      diagnosis.issues.push('❌ Missing Access-Control-Allow-Origin header')
    }

    if (!corsHeaders['access-control-expose-headers'] || corsHeaders['access-control-expose-headers'] === '❌ MISSING') {
      diagnosis.issues.push('❌ Missing Access-Control-Expose-Headers (needed for Content-Range)')
    }

    if (!corsHeaders['accept-ranges'] || corsHeaders['accept-ranges'] === '❌ MISSING') {
      diagnosis.issues.push('⚠️ Missing Accept-Ranges header (video streaming may not work)')
    }

    if (diagnosis.issues.length === 0) {
      diagnosis.recommendation = '✅ CORS headers look good! The issue might be elsewhere.'
    } else {
      diagnosis.recommendation = '❌ CORS is not configured correctly. Follow the instructions below.'
    }

    return NextResponse.json(diagnosis, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to test URL',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

