import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { imageEditor } from '@/lib/ai/image-editor'
import { AIError } from '@/lib/ai/base'
import { createEditHistory } from '@/lib/db/edit-history'
import { recordImageEditCost } from '@/lib/services/credit-transaction-service'
import { prisma } from '@/lib/db'
import { downloadAndStoreImages } from '@/lib/storage/utils'
import { processAndStoreReplicateImages } from '@/lib/services/auto-image-storage'

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
    
    // Create a temporary edit history record to track the async operation
    // We'll use this ID in the webhook URL
    const tempEditId = `temp_edit_${Date.now()}_${session.user.id}`
    
    // Configure webhook URL for async processing (production only)
    // Pass the prediction ID as 'id' parameter - webhook will use jobId to find the edit_history
    const webhookUrl = process.env.NEXTAUTH_URL?.startsWith('https://')
      ? `${process.env.NEXTAUTH_URL}/api/webhooks/replicate?type=edit&userId=${session.user.id}`
      : undefined

    console.log('🔧 [IMAGE_EDITOR_API] Webhook configuration:', {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      isHttps: process.env.NEXTAUTH_URL?.startsWith('https://'),
      webhookUrl: webhookUrl,
      webhookEnabled: !!webhookUrl,
      userId: session.user.id
    })
    
    let result
    if (image) {
      // Edit existing image
      result = await imageEditor.editImageWithPrompt(image, prompt, aspectRatioValue, webhookUrl)
    } else {
      // Generate from scratch
      result = await imageEditor.generateImageFromPrompt(prompt, aspectRatioValue, webhookUrl)
    }

    // If webhook is enabled, result might not have resultImage yet (async processing)
    // Create edit_history record with PROCESSING status so webhook can update it
    if (webhookUrl && result.status === 'processing' && !result.resultImage) {
      console.log('📡 Editor using async webhook processing, creating edit_history record:', result.id)
      
      // Get original image URL from form data or create a placeholder
      const originalImageUrl = image 
        ? (formData.get('originalUrl') as string || `data:${image.type};base64,original`)
        : 'generated-from-scratch'
      
      // Create edit_history with PROCESSING status - webhook will update when complete
      const editHistoryEntry = await createEditHistory({
        userId: session.user.id,
        originalImageUrl: originalImageUrl,
        editedImageUrl: '', // Will be updated by webhook
        thumbnailUrl: '', // Will be updated by webhook
        operation: image ? 'nano_banana_edit' : 'nano_banana_generate',
        prompt: prompt,
        metadata: {
          replicateId: result.id,
          status: 'PROCESSING',
          generatedFromScratch: !image,
          webhookEnabled: true,
          async: true
        }
      })
      
      console.log('✅ Edit history created for async processing:', editHistoryEntry.id)
      
      return NextResponse.json({
        success: true,
        data: {
          id: result.id,
          status: result.status,
          async: true,
          editHistoryId: editHistoryEntry.id,
          message: 'Processing started, webhook will handle completion'
        },
        predictionId: result.id,
        temporaryUrl: undefined // No URL yet - webhook will provide
      })
    }

    // 🔑 CRITICAL: Upload image to S3 for permanent storage (Replicate URLs expire in 1 hour)
    let permanentImageUrl = result.resultImage
    let permanentThumbnailUrl = result.resultImage
    
    if (result.resultImage) {
      try {
        console.log('📥 Uploading editor image to S3 for permanent storage...')
        const generationId = `editor_${Date.now()}_${session.user.id}`
        
        // Try auto-storage service first (more reliable)
        try {
          const autoStorageResults = await processAndStoreReplicateImages(
            [result.resultImage],
            generationId,
            session.user.id
          )
          
          if (autoStorageResults && autoStorageResults.length > 0) {
            permanentImageUrl = autoStorageResults[0].url
            permanentThumbnailUrl = autoStorageResults[0].thumbnailUrl || autoStorageResults[0].url
            console.log('✅ Image uploaded to S3 via auto-storage:', permanentImageUrl)
          } else {
            throw new Error('Auto-storage returned no results')
          }
        } catch (autoStorageError) {
          console.warn('⚠️ Auto-storage failed, falling back to legacy storage:', autoStorageError)
          
          // Fallback to legacy storage
          const storageResult = await downloadAndStoreImages(
            [result.resultImage],
            generationId,
            session.user.id,
            'editor'
          )
          
          if (storageResult.success && storageResult.permanentUrls && storageResult.permanentUrls.length > 0) {
            permanentImageUrl = storageResult.permanentUrls[0]
            permanentThumbnailUrl = storageResult.thumbnailUrls?.[0] || storageResult.permanentUrls[0]
            console.log('✅ Image uploaded to S3 via legacy storage:', permanentImageUrl)
          } else {
            console.error('❌ Storage failed, keeping Replicate URL (will expire):', storageResult.error)
            // Keep original URL if storage fails - user will see warning
          }
        }
      } catch (storageError) {
        console.error('❌ Failed to upload image to S3:', storageError)
        // Continue with Replicate URL - don't fail the request
      }
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
        editedImageUrl: permanentImageUrl, // Use permanent S3 URL
        thumbnailUrl: permanentThumbnailUrl, // Use permanent S3 URL
        operation: image ? 'nano_banana_edit' : 'nano_banana_generate',
        prompt: prompt,
        metadata: {
          ...result.metadata,
          originalFileName: image?.name || 'generated',
          fileSize: image?.size || 0,
          fileType: image?.type || 'image/png',
          processingTime: result.metadata?.processingTime,
          replicateId: result.id,
          generatedFromScratch: !image,
          permanentUrl: permanentImageUrl,
          temporaryUrl: result.resultImage // Keep original for reference
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
          operation: image ? 'nano_banana_edit' : 'nano_banana_generate',
          prompt: prompt.substring(0, 100)
        }
      )

      console.log(`✅ Debited ${creditsUsed} credits for image edit`)
    } catch (error) {
      console.error(`❌ Failed to debit credits for image edit:`, error)
      // Don't fail the whole request if credit deduction fails
    }

    // Save to gallery automatically (create Generation record)
    let generationRecord = null
    try {
      if (result.resultImage) {
        // Get or create a default model for editor images
        const defaultModel = await prisma.aIModel.findFirst({
          where: { 
            userId: session.user.id,
            name: { contains: 'Editor', mode: 'insensitive' }
          }
        }) || await prisma.aIModel.findFirst({
          where: { userId: session.user.id }
        })

        if (defaultModel) {
          generationRecord = await prisma.generation.create({
            data: {
              userId: session.user.id,
              modelId: defaultModel.id,
              prompt: image ? `[EDITOR] ${prompt}` : `[GERADO] ${prompt}`,
              status: 'COMPLETED',
              imageUrls: [permanentImageUrl], // Use permanent S3 URL
              thumbnailUrls: [permanentThumbnailUrl], // Use permanent S3 URL
              aspectRatio: aspectRatioValue || '1:1',
              resolution: aspectRatioValue ? 
                (aspectRatioValue === '1:1' ? '1024x1024' :
                 aspectRatioValue === '4:3' ? '1024x768' :
                 aspectRatioValue === '3:4' ? '768x1024' :
                 aspectRatioValue === '9:16' ? '720x1280' :
                 aspectRatioValue === '16:9' ? '1280x720' : '1024x1024') : '1024x1024',
              estimatedCost: 15,
              aiProvider: 'nano-banana',
              storageProvider: 'aws',
              metadata: {
                source: image ? 'editor' : 'editor_generate',
                editHistoryId: editHistoryEntry?.id,
                replicateId: result.id,
                generatedFromScratch: !image,
                temporaryUrl: result.resultImage // Keep original for reference
              }
            },
            include: {
              model: {
                select: { id: true, name: true, class: true }
              }
            }
          })

          console.log('✅ Generation record saved to gallery with permanent S3 URL:', generationRecord.id)
        } else {
          console.warn('⚠️ No model found to associate with editor generation')
        }
      }
    } catch (galleryError) {
      console.error('❌ Failed to save generation to gallery:', galleryError)
      // Don't fail the whole request if gallery save fails
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        status: result.status,
        resultImage: permanentImageUrl, // Permanent S3 URL for gallery
        temporaryUrl: result.resultImage, // Temporary Replicate URL for immediate modal display
        metadata: result.metadata,
        editHistoryId: editHistoryEntry?.id,
        generationId: generationRecord?.id
      },
      resultUrl: permanentImageUrl, // Permanent S3 URL for gallery
      temporaryUrl: result.resultImage // Temporary Replicate URL for immediate modal display
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