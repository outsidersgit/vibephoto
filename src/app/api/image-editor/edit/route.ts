import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { imageEditor } from '@/lib/ai/image-editor'
import { AIError } from '@/lib/ai/base'
import { createEditHistory } from '@/lib/db/edit-history'
import { recordImageEditCost } from '@/lib/services/credit-transaction-service'
import { prisma } from '@/lib/db'

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
    const image = formData.get('image') as File | null
    const prompt = formData.get('prompt') as string
    const aspectRatio = formData.get('aspectRatio') as string | null

    // Validate inputs
    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Image is optional - if not provided, generate from scratch
    if (image) {
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
    }

    console.log(`🎨 Image edit/generation request from ${session.user.email}:`, {
      hasImage: !!image,
      filename: image?.name || 'none',
      size: image?.size || 0,
      type: image?.type || 'none',
      prompt: prompt.substring(0, 100) + '...'
    })

    // Process image edit or generation from scratch
    const validAspectRatios = ['1:1', '4:3', '3:4', '9:16', '16:9'] as const
    const aspectRatioValue = aspectRatio && validAspectRatios.includes(aspectRatio as any) 
      ? (aspectRatio as typeof validAspectRatios[number])
      : undefined
    
    let result
    if (image) {
      // Edit existing image
      result = await imageEditor.editImageWithPrompt(image, prompt, aspectRatioValue)
    } else {
      // Generate from scratch
      result = await imageEditor.generateImageFromPrompt(prompt, aspectRatioValue)
    }

    // Save to edit history database
    let editHistoryEntry = null
    try {
      // Get original image URL from form data or create a placeholder
      const originalImageUrl = image 
        ? (formData.get('originalUrl') as string || `data:${image.type};base64,original`)
        : 'generated-from-scratch'

      editHistoryEntry = await createEditHistory({
        userId: session.user.id,
        originalImageUrl: originalImageUrl,
        editedImageUrl: result.resultImage!,
        thumbnailUrl: result.resultImage, // Use the same image as thumbnail
        operation: image ? 'nano_banana_edit' : 'nano_banana_generate',
        prompt: prompt,
        metadata: {
          ...result.metadata,
          originalFileName: image?.name || 'generated',
          fileSize: image?.size || 0,
          fileType: image?.type || 'image/png',
          processingTime: result.metadata?.processingTime,
          replicateId: result.id,
          generatedFromScratch: !image
        }
      })

      console.log('✅ Edit history saved:', editHistoryEntry.id)
    } catch (dbError) {
      console.error('❌ Failed to save edit history:', dbError)
      // Don't fail the whole request if DB save fails
    }

    // Debit credits and register transaction for image edit
    try {
      const creditsUsed = 15 // Image edit cost

      await prisma.user.update({
        where: { id: session.user.id },
        data: { creditsUsed: { increment: creditsUsed } }
      })

      await recordImageEditCost(
        session.user.id,
        editHistoryEntry?.id || result.id || 'unknown',
        creditsUsed,
        {
          operation: 'nano_banana_edit',
          prompt: prompt.substring(0, 100)
        }
      )

      console.log(`✅ Debited ${creditsUsed} credits for image edit`)
    } catch (error) {
      console.error(`❌ Failed to debit credits for image edit:`, error)
      // Don't fail the whole request if credit deduction fails
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        status: result.status,
        resultImage: result.resultImage,
        metadata: result.metadata,
        editHistoryId: editHistoryEntry?.id
      }
    })

  } catch (error) {
    console.error('❌ Image edit API error:', error)

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
    endpoint: 'Image Edit API',
    description: 'Edit images using AI with text prompts',
    methods: ['POST'],
    parameters: {
      image: 'File - Image file to edit (max 10MB)',
      prompt: 'String - Text description of desired edit'
    },
    supportedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  })
}