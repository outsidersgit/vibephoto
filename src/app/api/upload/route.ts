import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getStorageProvider, STORAGE_CONFIG, isValidUploadCategory, type UploadCategory } from '@/lib/storage'
import { AWSS3Provider } from '@/lib/storage/providers/aws-s3'
import { getCategoryForMediaType, type ValidCategory } from '@/lib/storage/path-utils'
import { z } from 'zod'

const uploadSchema = z.object({
  type: z.enum(['face', 'body', 'generated', 'images', 'videos', 'edited', 'upscaled']),
  category: z.enum(['images', 'videos', 'edited', 'upscaled', 'thumbnails']).optional(),
  modelId: z.string().optional(),
  generateThumbnail: z.boolean().optional().default(false),
  useStandardizedStructure: z.boolean().optional().default(true) // Default to new structure
})

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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string
    const category = formData.get('category') as string | null
    const modelId = formData.get('modelId') as string | null
    const generateThumbnail = formData.get('generateThumbnail') === 'true'
    const useStandardizedStructure = formData.get('useStandardizedStructure') !== 'false' // Default true

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate input
    const validationResult = uploadSchema.safeParse({
      type,
      category: category || undefined,
      modelId: modelId || undefined,
      generateThumbnail,
      useStandardizedStructure
    })

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const {
      type: uploadType,
      category: uploadCategory,
      generateThumbnail: shouldGenerateThumbnail,
      useStandardizedStructure: shouldUseStandardStructure
    } = validationResult.data

    // Get storage provider
    const storage = getStorageProvider()

    // Validate file
    const validation = storage.validateFile(file)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Determine category and upload configuration
    let finalCategory: ValidCategory
    let processingOptions: any = {
      generateThumbnail: shouldGenerateThumbnail
    }

    if (shouldUseStandardStructure) {
      // Use new standardized structure
      if (uploadCategory) {
        // Explicit category provided
        finalCategory = uploadCategory as ValidCategory
      } else {
        // Derive category from type
        const mediaType = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE'

        switch (uploadType) {
          case 'generated':
          case 'images':
            finalCategory = 'images'
            processingOptions = { ...processingOptions, ...STORAGE_CONFIG.processing.generated }
            break
          case 'videos':
            finalCategory = 'videos'
            break
          case 'edited':
            finalCategory = 'edited'
            processingOptions = { ...processingOptions, ...STORAGE_CONFIG.processing.generated }
            break
          case 'upscaled':
            finalCategory = 'upscaled'
            processingOptions = { ...processingOptions, ...STORAGE_CONFIG.processing.generated }
            break
          case 'face':
            finalCategory = 'images'
            processingOptions = { ...processingOptions, ...STORAGE_CONFIG.processing.face }
            break
          case 'body':
            finalCategory = 'images'
            processingOptions = { ...processingOptions, ...STORAGE_CONFIG.processing.body }
            break
          default:
            return NextResponse.json(
              { error: 'Invalid upload type for standardized structure' },
              { status: 400 }
            )
        }
      }

      // Use standardized upload method
      let result: any
      if (storage instanceof AWSS3Provider) {
        result = await storage.uploadStandardized(
          file,
          session.user.id,
          finalCategory,
          {
            ...processingOptions,
            makePublic: true, // Files in generated/* are public per S3 policy
            isVideo: file.type.startsWith('video/')
          }
        )
      } else {
        // Fallback for other providers - construct path manually
        const uploadPath = `generated/${session.user.id}/${finalCategory}`
        result = await storage.upload(file, uploadPath, {
          ...processingOptions,
          makePublic: true
        })
      }

      return NextResponse.json({
        success: true,
        data: {
          url: result.url,
          key: result.key,
          thumbnailUrl: result.thumbnailUrl,
          originalName: result.originalName,
          size: result.size,
          mimeType: result.mimeType,
          category: finalCategory,
          structure: 'standardized'
        }
      })

    } else {
      // Legacy upload path (for backward compatibility)
      let uploadPath: string

      switch (uploadType) {
        case 'face':
          uploadPath = `${session.user.id}/training/face`
          processingOptions = { ...processingOptions, ...STORAGE_CONFIG.processing.face }
          break
        case 'body':
          uploadPath = `${session.user.id}/training/body`
          processingOptions = { ...processingOptions, ...STORAGE_CONFIG.processing.body }
          break
        case 'generated':
          uploadPath = `${session.user.id}/generated`
          processingOptions = { ...processingOptions, ...STORAGE_CONFIG.processing.generated }
          break
        default:
          return NextResponse.json(
            { error: 'Invalid upload type for legacy structure' },
            { status: 400 }
          )
      }

      // Upload using legacy method
      const result = await storage.upload(file, uploadPath, processingOptions)

      return NextResponse.json({
        success: true,
        data: {
          url: result.url,
          key: result.key,
          thumbnailUrl: result.thumbnailUrl,
          originalName: result.originalName,
          size: result.size,
          mimeType: result.mimeType,
          structure: 'legacy'
        }
      })
    }


  } catch (error) {
    console.error('Upload error:', error)
    
    return NextResponse.json(
      { 
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Handle file deletion
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json(
        { error: 'File key is required' },
        { status: 400 }
      )
    }

    // Verify the file belongs to the user (basic security check)
    if (!key.startsWith(session.user.id)) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this file' },
        { status: 403 }
      )
    }

    // Get storage provider and delete file
    const storage = getStorageProvider()
    const result = await storage.delete(key)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to delete file', message: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    })

  } catch (error) {
    console.error('Delete error:', error)
    
    return NextResponse.json(
      { 
        error: 'Delete failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}