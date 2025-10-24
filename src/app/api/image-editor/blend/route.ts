import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { imageEditor } from '@/lib/ai/image-editor'
import { AIError } from '@/lib/ai/base'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const prompt = formData.get('prompt') as string

    // Extract multiple images
    const images: File[] = []
    let imageIndex = 0
    while (true) {
      const image = formData.get(`image${imageIndex}`) as File
      if (!image) break
      images.push(image)
      imageIndex++
    }

    // Validate inputs
    if (images.length === 0) {
      return NextResponse.json(
        { error: 'At least one image file is required' },
        { status: 400 }
      )
    }

    if (images.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 images are required for blending' },
        { status: 400 }
      )
    }

    if (images.length > 3) {
      return NextResponse.json(
        { error: 'Máximo 3 imagens podem ser mescladas' },
        { status: 400 }
      )
    }

    if (!prompt) {
      return NextResponse.json(
        { error: 'Blend prompt is required' },
        { status: 400 }
      )
    }

    // Validate all images
    for (const [index, image] of images.entries()) {
      if (!imageEditor.isValidImageFile(image)) {
        return NextResponse.json(
          { error: `Invalid image format for image ${index + 1}. Supported formats: JPEG, PNG, WebP, GIF` },
          { status: 400 }
        )
      }

      if (image.size > imageEditor.getMaxFileSize()) {
        return NextResponse.json(
          { error: `Image ${index + 1} file too large. Maximum size: 10MB` },
          { status: 400 }
        )
      }
    }

    console.log(`✨ Blend request from ${session.user.email}:`, {
      imageCount: images.length,
      filenames: images.map(img => img.name),
      sizes: images.map(img => img.size),
      types: images.map(img => img.type),
      prompt: prompt.substring(0, 100) + '...'
    })

    // Process image blend using AI
    const result = await imageEditor.blendImages(images, prompt)

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        status: result.status,
        resultImage: result.resultImage,
        metadata: {
          ...result.metadata,
          blendType: 'advanced',
          imageCount: images.length
        }
      }
    })

  } catch (error) {
    console.error('❌ Blend API error:', error)

    if (error instanceof AIError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'VibePhoto Blend API',
    description: 'Mesclagem avançada de imagens com inteligência artificial',
    methods: ['POST'],
    parameters: {
      'image0': 'File - First image file to blend (max 10MB)',
      'image1': 'File - Second image file to blend (max 10MB)', 
      'image2': 'File - Optional third image file to blend (max 10MB)',
      prompt: 'String - Text description of desired blend'
    },
    features: [
      'Advanced AI-powered image blending',
      'Seamless texture and color merging', 
      'Character consistency preservation',
      'Natural lighting and shadow blending',
      'Support for 2-3 images maximum'
    ],
    supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
    maxImages: 3,
    maxFileSize: '10MB'
  })
}