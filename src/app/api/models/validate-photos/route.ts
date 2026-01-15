import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { imageQualityAnalyzer } from '@/lib/ai/image-quality-analyzer'
import { ImageQualityAnalysisOptions } from '@/types/image-quality'

/**
 * POST /api/models/validate-photos
 * Validate photo quality for AI model training
 *
 * Analyzes photos for:
 * - Technical quality (sharpness, lighting, resolution)
 * - Composition (framing, background, distance)
 * - Fine-tuning readiness (no hats, sunglasses, other people, etc)
 *
 * Returns detailed feedback and recommendations for each photo
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log(`🔍 Photo validation request from user ${session.user.email}`)

    const contentType = request.headers.get('content-type') || ''
    let photoType: string
    let modelClass: string | null = null
    const photos: Array<{ data: string; filename: string }> = []

    // Support both FormData (legacy) and JSON (new URL-based approach)
    if (contentType.includes('application/json')) {
      // New approach: JSON with image URLs
      const body = await request.json()

      photoType = body.photoType
      modelClass = body.modelClass || null
      const imageUrls = body.imageUrls as string[]

      if (!photoType || !['face', 'half_body', 'full_body'].includes(photoType)) {
        return NextResponse.json(
          { error: 'Invalid photoType. Must be: face, half_body, or full_body' },
          { status: 400 }
        )
      }

      if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
        return NextResponse.json(
          { error: 'No imageUrls provided. Send array of image URLs.' },
          { status: 400 }
        )
      }

      console.log(`☁️ Downloading ${imageUrls.length} images from R2...`)

      // Download images from URLs
      for (let i = 0; i < imageUrls.length; i++) {
        const url = imageUrls[i]
        try {
          const response = await fetch(url)
          if (!response.ok) {
            throw new Error(`Failed to fetch image from ${url}`)
          }

          const arrayBuffer = await response.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const base64 = buffer.toString('base64')
          const mimeType = response.headers.get('content-type') || 'image/jpeg'
          const dataUrl = `data:${mimeType};base64,${base64}`

          photos.push({
            data: dataUrl,
            filename: `image_${i}.jpg`
          })
        } catch (error) {
          console.error(`❌ Failed to download image ${i + 1}:`, error)
          throw new Error(`Failed to download image ${i + 1} from URL`)
        }
      }
    } else {
      // Legacy approach: FormData with files
      const formData = await request.formData()

      photoType = formData.get('photoType') as string
      modelClass = formData.get('modelClass') as string | null

      if (!photoType || !['face', 'half_body', 'full_body'].includes(photoType)) {
        return NextResponse.json(
          { error: 'Invalid photoType. Must be: face, half_body, or full_body' },
          { status: 400 }
        )
      }

      // Extract all photo files
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('photo_') && value instanceof File) {
          const file = value as File

          // Convert to base64
          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const base64 = buffer.toString('base64')
          const mimeType = file.type || 'image/jpeg'
          const dataUrl = `data:${mimeType};base64,${base64}`

          photos.push({
            data: dataUrl,
            filename: file.name
          })
        }
      }

      if (photos.length === 0) {
        return NextResponse.json(
          { error: 'No photos provided. Send photos as form data with keys like photo_0, photo_1, etc.' },
          { status: 400 }
        )
      }
    }

    console.log(`📸 Validating ${photos.length} photos (type: ${photoType})`)

    // Prepare analysis options
    const options: ImageQualityAnalysisOptions = {
      photoType: photoType as 'face' | 'half_body' | 'full_body',
      modelClass: modelClass as any,
      includeDetails: true
    }

    // Analyze photos
    const result = await imageQualityAnalyzer.analyzeImages(photos, options)

    console.log(`✅ Validation complete - Average score: ${result.summary.averageScore.toFixed(1)}`)

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('❌ Photo validation error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to validate photos',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/models/validate-photos
 * Returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/models/validate-photos',
    method: 'POST',
    description: 'Validate photo quality for AI model training',
    authentication: 'Required',
    requestFormat: 'multipart/form-data',
    parameters: {
      photoType: {
        type: 'string',
        required: true,
        options: ['face', 'half_body', 'full_body'],
        description: 'Type of photos being validated'
      },
      modelClass: {
        type: 'string',
        required: false,
        options: ['MAN', 'WOMAN', 'BOY', 'GIRL', 'ANIMAL'],
        description: 'Model class for context-specific analysis'
      },
      'photo_0, photo_1, ...': {
        type: 'File',
        required: true,
        description: 'Photos to validate (send as form data with sequential keys)'
      }
    },
    response: {
      results: 'Array of ImageQualityAnalysisResult',
      summary: {
        total: 'number',
        perfect: 'number (90-100)',
        excellent: 'number (70-89)',
        acceptable: 'number (50-69)',
        poor: 'number (0-49)',
        averageScore: 'number',
        recommendedCount: 'number (score >= 70)',
        acceptableCount: 'number (score >= 50)'
      },
      overallRecommendation: 'string'
    },
    qualityScoring: {
      perfect: '90-100 - ⭐ Perfeita para fine-tuning',
      excellent: '70-89 - ✅ Excelente',
      acceptable: '50-69 - ⚠️ Aceitável com ressalvas',
      poor: '0-49 - ❌ Não recomendada'
    },
    criticalIssues: [
      'hat_or_cap - Boné ou chapéu cobrindo a cabeça',
      'sunglasses - Óculos escuros',
      'face_covered - Rosto coberto (máscara, cachecol, mão)',
      'multiple_people - Várias pessoas na foto',
      'making_faces - Fazendo careta ou língua para fora',
      'eyes_closed - Olhos fechados',
      'heavy_filters - Filtros pesados (Instagram, Snapchat)',
      'extreme_angle - Ângulo muito extremo'
    ],
    bestPractices: {
      ideal: 'Pessoa sozinha, rosto descoberto, sem acessórios que cubram características faciais, expressão natural, boa iluminação, sem filtros',
      avoid: 'Bonés, chapéus, óculos escuros, outras pessoas, caretas, olhos fechados, filtros, ângulos extremos'
    }
  })
}
