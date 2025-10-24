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
    
    // Get all image files
    const images: File[] = []
    let i = 0
    while (true) {
      const image = formData.get(`image${i}`) as File
      if (!image) break
      images.push(image)
      i++
    }

    // Also check for 'images' field (array)
    const imagesArray = formData.getAll('images') as File[]
    if (imagesArray.length > 0) {
      images.push(...imagesArray)
    }

    // Validate inputs
    if (images.length === 0) {
      return NextResponse.json(
        { error: 'At least one image file is required' },
        { status: 400 }
      )
    }

    if (images.length > 5) {
      return NextResponse.json(
        { error: 'Maximum 5 images can be combined at once' },
        { status: 400 }
      )
    }

    if (!prompt) {
      return NextResponse.json(
        { error: 'Combination prompt is required' },
        { status: 400 }
      )
    }

    // Validate all files
    for (const image of images) {
      if (!imageEditor.isValidImageFile(image)) {
        return NextResponse.json(
          { error: `Invalid image format for file ${image.name}. Supported formats: JPEG, PNG, WebP, GIF` },
          { status: 400 }
        )
      }

      if (image.size > imageEditor.getMaxFileSize()) {
        return NextResponse.json(
          { error: `Image file ${image.name} too large. Maximum size: 10MB` },
          { status: 400 }
        )
      }
    }

    console.log(`🎨 Combine images request from ${session.user.email}:`, {
      imageCount: images.length,
      filenames: images.map(img => img.name),
      totalSize: images.reduce((sum, img) => sum + img.size, 0),
      prompt: prompt.substring(0, 100) + '...'
    })

    // Process image combination
    const result = await imageEditor.combineImages(images, prompt)

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        status: result.status,
        resultImage: result.resultImage,
        metadata: result.metadata
      }
    })

  } catch (error) {
    console.error('❌ Combine images API error:', error)

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
    endpoint: 'Combine Images API',
    description: 'Combine multiple images using AI',
    methods: ['POST'],
    parameters: {
      images: 'File[] - Array of image files to combine (max 5, each max 10MB)',
      prompt: 'String - Description of how to combine the images'
    },
    note: 'Images can be sent as image0, image1, etc. or as an array named "images"',
    supportedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  })
}