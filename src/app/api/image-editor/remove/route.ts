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
    const image = formData.get('image') as File
    const prompt = formData.get('prompt') as string

    // Validate inputs
    if (!image) {
      return NextResponse.json(
        { error: 'Image file is required' },
        { status: 400 }
      )
    }

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Validate file type and size
    if (!imageEditor.isValidImageFile(image)) {
      return NextResponse.json(
        { error: 'Invalid image format. Supported formats: JPEG, PNG, WebP, GIF' },
        { status: 400 }
      )
    }

    if (image.size > imageEditor.getMaxFileSize()) {
      return NextResponse.json(
        { error: 'Image file too large. Maximum size: 10MB' },
        { status: 400 }
      )
    }

    console.log(`🎨 Remove element request from ${session.user.email}:`, {
      filename: image.name,
      size: image.size,
      type: image.type,
      element: prompt.substring(0, 100) + '...'
    })

    // Process remove element
    const result = await imageEditor.removeElementFromImage(image, prompt)

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
    console.error('❌ Remove element API error:', error)

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
    endpoint: 'Remove Element API',
    description: 'Remove elements from images using AI',
    methods: ['POST'],
    parameters: {
      image: 'File - Base image file (max 10MB)',
      prompt: 'String - Description of element to remove'
    },
    supportedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  })
}