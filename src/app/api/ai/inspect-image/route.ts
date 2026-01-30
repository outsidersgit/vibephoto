import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Proxy endpoint for Astria /images/inspect API
 * Inspects an image to extract characteristics for model training
 *
 * POST /api/ai/inspect-image
 * Body: { imageUrl: string, className: string }
 *
 * Returns: Astria inspection response with characteristics
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { imageUrl, className } = body

    if (!imageUrl || !className) {
      return NextResponse.json(
        { error: 'Missing required fields: imageUrl and className' },
        { status: 400 }
      )
    }

    // Validate className
    const validClasses = ['man', 'woman', 'boy', 'girl', 'baby', 'cat', 'dog']
    if (!validClasses.includes(className.toLowerCase())) {
      return NextResponse.json(
        { error: `Invalid className. Must be one of: ${validClasses.join(', ')}` },
        { status: 400 }
      )
    }

    const apiKey = process.env.ASTRIA_API_KEY
    if (!apiKey) {
      console.error('❌ ASTRIA_API_KEY not configured')
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      )
    }

    console.log(`🔍 [INSPECT] Inspecting image: ${imageUrl.substring(0, 80)}... (class: ${className})`)

    // Call Astria /images/inspect API with file_url
    const formData = new FormData()
    formData.append('file_url', imageUrl)
    formData.append('name', className.toLowerCase())

    const astriaResponse = await fetch('https://api.astria.ai/images/inspect', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    })

    if (!astriaResponse.ok) {
      const errorText = await astriaResponse.text()
      console.error(`❌ [INSPECT] Astria API error (${astriaResponse.status}):`, errorText)

      return NextResponse.json(
        {
          error: 'Failed to inspect image',
          details: errorText,
          status: astriaResponse.status
        },
        { status: astriaResponse.status }
      )
    }

    const inspectionResult = await astriaResponse.json()

    console.log(`✅ [INSPECT] Inspection complete:`, {
      imageUrl: imageUrl.substring(0, 60),
      className,
      hasName: !!inspectionResult.name,
      hasAge: !!inspectionResult.age,
      hasEthnicity: !!inspectionResult.ethnicity,
      qualityFlags: {
        blurry: inspectionResult.blurry,
        low_quality: inspectionResult.low_quality,
        multiple_people: inspectionResult.includes_multiple_people
      }
    })

    return NextResponse.json({
      success: true,
      data: inspectionResult
    })

  } catch (error) {
    console.error('❌ [INSPECT] Error inspecting image:', error)

    return NextResponse.json(
      {
        error: 'Failed to inspect image',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
