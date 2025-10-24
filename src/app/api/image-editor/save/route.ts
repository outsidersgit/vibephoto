import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { downloadImageBuffer, generateThumbnailBuffer } from '@/lib/storage/utils'
import { getStorageProvider } from '@/lib/storage'
import { canUserUseCredits, updateUserCredits } from '@/lib/db/users'
import { createEditHistory } from '@/lib/db/edit-history'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Image editor save endpoint called')
    
    const session = await getServerSession(authOptions)
    console.log('👤 Session:', session ? 'authenticated' : 'not authenticated')
    
    if (!session?.user?.id) {
      console.log('❌ No session or user ID found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const { imageUrl, operation, prompt, originalImageUrl } = body
    
    console.log('📝 Request body:', { 
      imageUrl: imageUrl ? imageUrl.substring(0, 50) + '...' : null, 
      operation, 
      prompt: prompt ? prompt.substring(0, 50) + '...' : null,
      originalImageUrl: originalImageUrl ? originalImageUrl.substring(0, 50) + '...' : null
    })

    if (!imageUrl || !operation || !prompt) {
      console.log('❌ Missing required fields')
      return NextResponse.json({ 
        error: 'Missing required fields: imageUrl, operation, prompt' 
      }, { status: 400 })
    }

    // Check if user has enough credits
    const canUseCredits = await canUserUseCredits(userId, 1)
    if (!canUseCredits) {
      return NextResponse.json({ 
        error: 'Insufficient credits' 
      }, { status: 402 })
    }

    // Download the edited image
    console.log(`📥 Downloading edited image from: ${imageUrl}`)
    let imageBuffer
    try {
      imageBuffer = await downloadImageBuffer(imageUrl)
      console.log(`✅ Image downloaded successfully, size: ${imageBuffer.length} bytes`)
    } catch (downloadError) {
      console.error('❌ Failed to download image:', downloadError)
      throw new Error(`Failed to download image: ${downloadError}`)
    }
    
    // Generate storage paths - using the same structure as generated images
    const timestamp = Date.now()
    const editId = `edit_${timestamp}_${Math.random().toString(36).substr(2, 9)}`
    const imageKey = `generated/${userId}/edited/${editId}/image_${timestamp}.png`
    const thumbnailKey = `generated/${userId}/edited/${editId}/thumb_${timestamp}.png`
    
    // Upload to storage
    const storage = getStorageProvider()
    
    console.log(`☁️ Uploading edited image to ${imageKey}`)
    let uploadResult
    try {
      uploadResult = await storage.upload(
        imageBuffer,
        imageKey,
        {
          filename: `edited_${operation}_${timestamp}.png`,
          makePublic: true
        }
      )
      console.log(`✅ Image uploaded successfully: ${uploadResult.url}`)
    } catch (uploadError) {
      console.error('❌ Failed to upload image:', uploadError)
      throw new Error(`Failed to upload image: ${uploadError}`)
    }

    // Generate and upload thumbnail
    console.log(`🖼️ Generating thumbnail`)
    let thumbnailBuffer, thumbnailUpload
    try {
      thumbnailBuffer = await generateThumbnailBuffer(imageBuffer)
      thumbnailUpload = await storage.upload(
        thumbnailBuffer,
        thumbnailKey,
        {
          filename: `thumb_${operation}_${timestamp}.png`,
          makePublic: true
        }
      )
      console.log(`✅ Thumbnail uploaded successfully: ${thumbnailUpload.url}`)
    } catch (thumbnailError) {
      console.error('❌ Failed to generate/upload thumbnail:', thumbnailError)
      throw new Error(`Failed to generate thumbnail: ${thumbnailError}`)
    }

    // Save to edit_history table (correct table for edited images)
    console.log('💾 Saving to edit_history database table')
    const editedImage = await createEditHistory({
      userId,
      originalImageUrl: originalImageUrl || 'unknown',
      editedImageUrl: uploadResult.url,
      thumbnailUrl: thumbnailUpload.url,
      operation,
      prompt,
      metadata: {
        editId,
        timestamp: Date.now(),
        editedAt: new Date().toISOString(),
        imageSize: imageBuffer.length,
        operation: operation
      }
    })

    // Deduct credits
    await updateUserCredits(userId, 1)

    console.log(`✅ Edited image saved successfully with ID: ${editedImage.id}`)

    return NextResponse.json({
      success: true,
      editHistory: editedImage,
      imageUrl: uploadResult.url,
      thumbnailUrl: thumbnailUpload.url
    })

  } catch (error) {
    console.error('❌ Error saving edited image:', error)
    
    // More detailed error reporting
    let errorMessage = 'Failed to save edited image'
    if (error instanceof Error) {
      errorMessage = error.message
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      })
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}