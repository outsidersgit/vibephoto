import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { imageEditor } from '@/lib/ai/image-editor'
import { AIError } from '@/lib/ai/base'
import { createEditHistory } from '@/lib/db/edit-history'
import { prisma } from '@/lib/db'
import { downloadAndStoreImages } from '@/lib/storage/utils'
import { processAndStoreReplicateImages } from '@/lib/services/auto-image-storage'
import { CreditManager } from '@/lib/credits/manager'
import { getImageEditCost, EditorResolution } from '@/lib/credits/pricing'
import { Plan } from '@prisma/client'

// Vercel timeout: 60s for webhook initialization (actual processing happens via webhook)
export const maxDuration = 60

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

    // Parse form data first to get resolution
    const formData = await request.formData()
    const image = formData.get('image') as File | null
    const imageUrl = formData.get('imageUrl') as string | null
    const multipleImages = formData.get('multipleImages') === 'true'
    const prompt = formData.get('prompt') as string
    const aspectRatio = formData.get('aspectRatio') as string | null
    const resolutionParam = formData.get('resolution') as string | null
    const resolution: EditorResolution = resolutionParam === '4k' ? '4k' : 'standard'

    // Collect images from Files OR URLs
    const images: File[] = []

    if (multipleImages) {
      // Check if we have imageCount (URL mode)
      const imageCount = parseInt(formData.get('imageCount') as string || '0', 10)

      if (imageCount > 0) {
        // URL mode: fetch images from R2
        console.log(`📸 Multiple images mode (URLs): ${imageCount} images`)
        for (let imageIndex = 0; imageIndex < imageCount; imageIndex++) {
          const url = formData.get(`imageUrl${imageIndex}`) as string | null
          if (url) {
            // Fetch image from URL and convert to File
            const response = await fetch(url)
            const blob = await response.blob()
            const file = new File([blob], `image${imageIndex}.${blob.type.split('/')[1]}`, { type: blob.type })
            images.push(file)
          }
        }
      } else {
        // File mode: collect File objects
        let imageIndex = 0
        while (true) {
          const img = formData.get(`image${imageIndex}`) as File | null
          if (!img) break
          images.push(img)
          imageIndex++
        }
        console.log(`📸 Multiple images mode (Files): ${images.length} images received`)
      }
    } else if (imageUrl) {
      // Single image from URL
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const file = new File([blob], `image.${blob.type.split('/')[1]}`, { type: blob.type })
      images.push(file)
    } else if (image) {
      // Single image from File
      images.push(image)
    }

    const userPlan = ((session.user as any)?.plan || 'STARTER') as Plan
    const creditsNeeded = getImageEditCost(1, resolution) // Custo baseado na resolução
    const affordability = await CreditManager.canUserAfford(session.user.id, creditsNeeded, userPlan)
    if (!affordability.canAfford) {
      return NextResponse.json(
        { error: affordability.reason || `Créditos insuficientes. Necessário: ${creditsNeeded}` },
        { status: 402 }
      )
    }

    // Validate inputs
    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Validate all images (if any)
    for (const img of images) {
      // Validate file type and size
      if (!imageEditor.isValidImageFile(img)) {
        return NextResponse.json(
          { error: 'Invalid image format. Supported formats: JPEG, PNG, WebP, GIF' },
          { status: 400 }
        )
      }

      if (img.size > imageEditor.getMaxFileSize()) {
        return NextResponse.json(
          { error: 'Image file too large. Maximum size: 10MB' },
          { status: 400 }
        )
      }
    }

    console.log(`🎨 Image edit/generation request from ${session.user.email}:`, {
      imageCount: images.length,
      multipleImages,
      filenames: images.map(img => img.name),
      sizes: images.map(img => img.size),
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
    const baseUrl = process.env.NEXTAUTH_URL?.trim()
    const webhookUrl = baseUrl && baseUrl.startsWith('https://')
      ? `${baseUrl}/api/webhooks/replicate?type=edit&userId=${encodeURIComponent(session.user.id)}`
      : undefined

    console.log('🔧 [IMAGE_EDITOR_API] Webhook configuration:', {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      baseUrlTrimmed: baseUrl,
      isHttps: baseUrl?.startsWith('https://'),
      webhookUrl: webhookUrl,
      webhookEnabled: !!webhookUrl,
      userId: session.user.id,
      userIdEncoded: encodeURIComponent(session.user.id)
    })
    
    // Convert resolution to Nano Banana format ('2K' or '4K')
    const nanoBananaResolution = resolution === '4k' ? '4K' : '2K'

    let result
    if (images.length > 1) {
      // Multiple images - use edit with multiple images (Nano Banana Pro feature)
      result = await imageEditor.editWithMultipleImages(images, prompt, aspectRatioValue, webhookUrl, nanoBananaResolution)
    } else if (images.length === 1) {
      // Single image - edit existing image
      result = await imageEditor.editImageWithPrompt(images[0], prompt, aspectRatioValue, webhookUrl, nanoBananaResolution)
    } else {
      // No images - generate from scratch
      result = await imageEditor.generateImageFromPrompt(prompt, aspectRatioValue, webhookUrl, nanoBananaResolution)
    }

    // If webhook is enabled, result might not have resultImage yet (async processing)
    // Create edit_history record with PROCESSING status so webhook can update it
    if (webhookUrl && result.status === 'processing' && !result.resultImage) {
      console.log('📡 Editor using async webhook processing, creating edit_history record:', result.id)
      
      // Get original image URL from form data or create a placeholder
      const originalImageUrl = images.length > 0
        ? (formData.get('originalUrl') as string || `data:${images[0].type};base64,original`)
        : 'generated-from-scratch'

      // Create edit_history with PROCESSING status - webhook will update when complete
      const editHistoryEntry = await createEditHistory({
        userId: session.user.id,
        originalImageUrl: originalImageUrl,
        editedImageUrl: '', // Will be updated by webhook
        thumbnailUrl: '', // Will be updated by webhook
        operation: images.length > 0 ? 'nano_banana_edit' : 'nano_banana_generate',
        prompt: prompt,
        metadata: {
          replicateId: result.id,
          status: 'PROCESSING',
          generatedFromScratch: images.length === 0,
          webhookEnabled: true,
          async: true
        }
      })
      
      console.log('✅ Edit history created for async processing:', editHistoryEntry.id)

      // Also create a placeholder generation for gallery preview
      const placeholderGeneration = await prisma.generation.create({
        data: {
          userId: session.user.id,
          modelId: null,
          prompt: images.length > 0 ? `[EDITOR] ${prompt}` : `[GERADO] ${prompt}`,
          status: 'PROCESSING',
          imageUrls: [],
          thumbnailUrls: [],
          aspectRatio: aspectRatioValue || '1:1',
          resolution: '1024x1024',
          estimatedCost: creditsNeeded,
          operationType: 'edit',
          aiProvider: 'nano-banana',
          metadata: {
            source: images.length > 0 ? 'editor' : 'editor_generate',
            editHistoryId: editHistoryEntry.id,
            replicateId: result.id,
            generatedFromScratch: images.length === 0,
            processingStartedAt: new Date().toISOString(),
            webhookEnabled: true
          }
        }
      })

      console.log('✅ Placeholder generation created for gallery preview:', placeholderGeneration.id)

      const charge = await CreditManager.deductCredits(
        session.user.id,
        creditsNeeded,
        'Edição de imagem',
        {
          type: 'IMAGE_EDIT',
          editId: editHistoryEntry.id,
          prompt
        }
      )

      if (!charge.success) {
        await prisma.editHistory.delete({ where: { id: editHistoryEntry.id } })
        return NextResponse.json({ error: charge.error || 'Créditos insuficientes' }, { status: 402 })
      }

      await prisma.usageLog.create({
        data: {
          userId: session.user.id,
          action: 'image_edit',
          details: {
            editId: editHistoryEntry.id,
            operation: image ? 'nano_banana_edit' : 'nano_banana_generate',
            prompt: prompt.substring(0, 200)
          },
          creditsUsed: creditsNeeded
        }
      })
 
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
      const firstImage = images.length > 0 ? images[0] : null
      const originalImageUrl = firstImage
        ? (formData.get('originalUrl') as string || `data:${firstImage.type};base64,original`)
        : 'generated-from-scratch'

      editHistoryEntry = await createEditHistory({
        userId: session.user.id,
        originalImageUrl: originalImageUrl,
        editedImageUrl: permanentImageUrl, // Use permanent S3 URL
        thumbnailUrl: permanentThumbnailUrl, // Use permanent S3 URL
        operation: firstImage ? 'nano_banana_edit' : 'nano_banana_generate',
        prompt: prompt,
        metadata: {
          ...result.metadata,
          originalFileName: firstImage?.name || 'generated',
          fileSize: firstImage?.size || 0,
          fileType: firstImage?.type || 'image/png',
          processingTime: result.metadata?.processingTime,
          replicateId: result.id,
          generatedFromScratch: images.length === 0,
          permanentUrl: permanentImageUrl,
          temporaryUrl: result.resultImage // Keep original for reference
        }
      })

      console.log('✅ Edit history saved:', editHistoryEntry.id)
    } catch (dbError) {
      console.error('❌ Failed to save edit history:', dbError)
      // Don't fail the whole request if DB save fails
    }

    const charge = await CreditManager.deductCredits(
      session.user.id,
      creditsNeeded,
      'Edição de imagem',
      {
        type: 'IMAGE_EDIT',
        editId: editHistoryEntry?.id || result.id || 'unknown',
        prompt
      }
    )

    if (!charge.success) {
      console.error('❌ Failed to debit credits for image edit:', charge.error)
      if (editHistoryEntry?.id) {
        await prisma.editHistory.delete({ where: { id: editHistoryEntry.id } })
      }
      return NextResponse.json(
        { error: charge.error || 'Falha ao debitar créditos' },
        { status: 402 }
      )
    }

    await prisma.usageLog.create({
      data: {
        userId: session.user.id,
        action: 'image_edit',
        details: {
          editId: editHistoryEntry?.id || result.id || 'unknown',
          operation: image ? 'nano_banana_edit' : 'nano_banana_generate',
          prompt: prompt.substring(0, 200)
        },
        creditsUsed: creditsNeeded
      }
    })

    // Create generation record for gallery (synchronous mode - no webhook used)
    let generationRecord = null
    try {
      if (result.resultImage) {
        const generationMetadata = {
          source: images.length > 0 ? 'editor' : 'editor_generate',
          editHistoryId: editHistoryEntry?.id,
          replicateId: result.id,
          generatedFromScratch: images.length === 0,
          temporaryUrl: result.resultImage,
          permanentUrl: permanentImageUrl,
          cost: creditsNeeded,
          originalImageUrl: images.length > 0 ? 'uploaded-image' : 'generated-from-scratch',
          processingCompletedAt: new Date().toISOString()
        }

        // Create new generation record for gallery
        generationRecord = await prisma.generation.create({
          data: {
            userId: session.user.id,
            modelId: null,
            prompt: images.length > 0 ? `[EDITOR] ${prompt}` : `[GERADO] ${prompt}`,
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
            storageProvider: 'aws',
            storageContext: 'edited',
            operationType: 'edit',
            aiProvider: 'nano-banana',
            estimatedCost: creditsNeeded,
            metadata: generationMetadata,
            completedAt: new Date()
          },
          include: {
            model: {
              select: { id: true, name: true, class: true }
            }
          }
        })

        console.log('✅ Generation record created for gallery with permanent S3 URL:', generationRecord.id)
      }
    } catch (galleryError) {
      console.error('❌ Failed to create generation in gallery:', galleryError)
      // Don't fail the whole request if gallery creation fails
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