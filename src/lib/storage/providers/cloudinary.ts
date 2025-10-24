import { v2 as cloudinary } from 'cloudinary'
import { StorageProvider, UploadResult, UploadOptions, FileValidation, DeleteResult, StorageError } from '../base'
import { STORAGE_CONFIG } from '../config'

export class CloudinaryProvider extends StorageProvider {
  constructor() {
    super()
    
    if (!STORAGE_CONFIG.cloudinary.cloudName || !STORAGE_CONFIG.cloudinary.apiKey) {
      throw new StorageError('Cloudinary credentials not configured', 'CLOUDINARY_CONFIG_ERROR')
    }

    cloudinary.config({
      cloud_name: STORAGE_CONFIG.cloudinary.cloudName,
      api_key: STORAGE_CONFIG.cloudinary.apiKey,
      api_secret: STORAGE_CONFIG.cloudinary.apiSecret,
      secure: true
    })
  }

  async upload(
    file: File | Buffer,
    path: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      let buffer: Buffer
      let originalName: string
      let mimeType: string
      let size: number

      if (file instanceof File) {
        buffer = Buffer.from(await file.arrayBuffer())
        originalName = file.name
        mimeType = file.type
        size = file.size
      } else {
        buffer = file
        originalName = options.filename || 'uploaded-file'
        mimeType = 'image/jpeg'
        size = buffer.length
      }

      // Validate file if it's a File object
      if (file instanceof File) {
        const validation = this.validateFile(file)
        if (!validation.isValid) {
          throw new StorageError(validation.error!, 'VALIDATION_ERROR', 400)
        }
      }

      // Generate unique public_id
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 15)
      const nameWithoutExt = originalName.split('.')[0]
      const publicId = options.filename 
        ? `${STORAGE_CONFIG.cloudinary.folder}/${path}/${options.filename}`
        : `${STORAGE_CONFIG.cloudinary.folder}/${path}/${nameWithoutExt}-${timestamp}-${randomString}`

      // Prepare upload options
      const uploadOptions: any = {
        public_id: publicId,
        resource_type: 'image',
        format: 'jpg',
        quality: options.quality || 'auto:good',
        fetch_format: 'auto'
      }

      // Add transformation options
      if (options.maxWidth || options.maxHeight) {
        uploadOptions.transformation = {
          width: options.maxWidth,
          height: options.maxHeight,
          crop: 'limit',
          quality: options.quality || 'auto:good',
          fetch_format: 'auto'
        }
      }

      // Convert buffer to base64 for Cloudinary upload
      const base64String = `data:${mimeType};base64,${buffer.toString('base64')}`

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(base64String, uploadOptions)

      const uploadResult: UploadResult = {
        url: result.secure_url,
        key: result.public_id,
        publicId: result.public_id,
        originalName,
        size,
        mimeType
      }

      // Generate thumbnail if requested
      if (options.generateThumbnail) {
        const thumbnailUrl = cloudinary.url(result.public_id, {
          width: 300,
          height: 300,
          crop: 'fill',
          quality: 'auto:good',
          fetch_format: 'auto'
        })
        uploadResult.thumbnailUrl = thumbnailUrl
      }

      return uploadResult

    } catch (error) {
      if (error instanceof StorageError) {
        throw error
      }
      throw new StorageError(
        `Failed to upload to Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CLOUDINARY_UPLOAD_ERROR'
      )
    }
  }

  async delete(publicId: string): Promise<DeleteResult> {
    try {
      const result = await cloudinary.uploader.destroy(publicId)
      
      return {
        success: result.result === 'ok',
        error: result.result !== 'ok' ? 'Failed to delete from Cloudinary' : undefined
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete file'
      }
    }
  }

  getPublicUrl(publicId: string): string {
    return cloudinary.url(publicId, {
      secure: true,
      quality: 'auto:good',
      fetch_format: 'auto'
    })
  }

  validateFile(file: File): FileValidation {
    // Check file size
    if (file.size > STORAGE_CONFIG.limits.maxFileSize) {
      return {
        isValid: false,
        error: `File size exceeds maximum allowed size of ${STORAGE_CONFIG.limits.maxFileSize / 1024 / 1024}MB`
      }
    }

    // Check mime type
    if (!STORAGE_CONFIG.limits.allowedMimeTypes.includes(file.type)) {
      return {
        isValid: false,
        error: `File type ${file.type} is not allowed. Allowed types: ${STORAGE_CONFIG.limits.allowedMimeTypes.join(', ')}`
      }
    }

    // Check file extension
    const extension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!STORAGE_CONFIG.limits.allowedExtensions.includes(extension)) {
      return {
        isValid: false,
        error: `File extension ${extension} is not allowed. Allowed extensions: ${STORAGE_CONFIG.limits.allowedExtensions.join(', ')}`
      }
    }

    return { isValid: true }
  }

  async generateThumbnail(sourcePublicId: string, thumbnailPath: string): Promise<UploadResult> {
    try {
      // Generate thumbnail URL using Cloudinary transformations
      const thumbnailUrl = cloudinary.url(sourcePublicId, {
        width: 300,
        height: 300,
        crop: 'fill',
        quality: 'auto:good',
        fetch_format: 'auto'
      })

      return {
        url: thumbnailUrl,
        key: sourcePublicId,
        publicId: sourcePublicId,
        originalName: 'thumbnail.jpg',
        size: 0,
        mimeType: 'image/jpeg'
      }
    } catch (error) {
      throw new StorageError(
        `Failed to generate thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'THUMBNAIL_ERROR'
      )
    }
  }
}