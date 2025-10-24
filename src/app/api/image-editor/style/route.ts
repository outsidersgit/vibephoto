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
    const stylePrompt = formData.get('stylePrompt') as string

    // Validate inputs
    if (!image) {
      return NextResponse.json(
        { error: 'Image file is required' },
        { status: 400 }
      )
    }

    if (!stylePrompt) {
      return NextResponse.json(
        { error: 'Style prompt is required' },
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

    console.log(`🎨 Style transfer request from ${session.user.email}:`, {
      filename: image.name,
      size: image.size,
      type: image.type,
      style: stylePrompt.substring(0, 100) + '...'
    })

    // Process style transfer
    const result = await imageEditor.transferImageStyle(image, stylePrompt)

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
    console.error('❌ Style transfer API error:', error)

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
    endpoint: 'Style Transfer API',
    description: 'Apply style transfer to images using AI',
    methods: ['POST'],
    parameters: {
      image: 'File - Base image file (max 10MB)',
      stylePrompt: 'String - Description of desired style'
    },
    supportedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  })
}