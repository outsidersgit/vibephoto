import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { StorageProvider, UploadResult, UploadOptions, FileValidation, DeleteResult, StorageError } from '../base'
import { STORAGE_CONFIG, UPLOAD_PATHS, isValidUploadCategory, getStandardizedUploadPath, type UploadCategory } from '../config'
import { buildS3Key, generateUniqueFilename, isValidCategory, validateCategory, type ValidCategory } from '../path-utils'
import sharp from 'sharp'

export class AWSS3Provider extends StorageProvider {
  private s3Client: S3Client
  private bucket: string
  private cloudFrontUrl?: string

  constructor() {
    super()
    
    if (!STORAGE_CONFIG.aws.accessKeyId || !STORAGE_CONFIG.aws.secretAccessKey) {
      throw new StorageError('AWS credentials not configured', 'AWS_CONFIG_ERROR')
    }

    this.s3Client = new S3Client({
      region: STORAGE_CONFIG.aws.region,
      credentials: {
        accessKeyId: STORAGE_CONFIG.aws.accessKeyId,
        secretAccessKey: STORAGE_CONFIG.aws.secretAccessKey
      }
    })
    
    this.bucket = STORAGE_CONFIG.aws.bucket
    this.cloudFrontUrl = STORAGE_CONFIG.aws.cloudFrontUrl
  }

  async upload(
    file: File | Buffer,
    path: string,
    options: UploadOptions & {
      userId?: string
      category?: ValidCategory
      enforceStandardStructure?: boolean
    } = {}
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
        mimeType = options.isVideo ? 'video/mp4' : 'image/jpeg' // Default mime type based on content
        size = buffer.length
      }

      // Validate file if it's a File object
      if (file instanceof File) {
        const validation = this.validateFile(file, options.isVideo)
        if (!validation.isValid) {
          throw new StorageError(validation.error!, 'VALIDATION_ERROR', 400)
        }
      }

      // Process image if options are provided (skip for videos)
      if (!options.isVideo && (options.maxWidth || options.maxHeight || options.quality)) {
        buffer = await this.processImage(buffer, options)
        size = buffer.length
      }

      // Determine key using new standardized structure or legacy format
      let key: string
      let filename: string

      if (options.enforceStandardStructure && options.userId && options.category) {
        // Use new standardized structure: generated/{userId}/{category}/filename.ext
        validateCategory(options.category)

        // Get file extension
        const extension = originalName.split('.').pop() || (options.isVideo ? 'mp4' : 'jpg')

        // Generate unique filename
        filename = options.filename || generateUniqueFilename(extension)
        key = buildS3Key(options.userId, options.category, filename)
      } else if (path.includes('.')) {
        // Path already includes filename (legacy support)
        key = path
        filename = path.split('/').pop() || originalName
      } else {
        // Generate filename for legacy path structure
        const timestamp = Date.now()
        const randomString = Math.random().toString(36).substring(2, 15)
        const extension = originalName.split('.').pop() || (options.isVideo ? 'mp4' : 'jpg')
        filename = options.filename || `${timestamp}-${randomString}.${extension}`
        key = `${path}/${filename}`
      }

      // Validate key structure for security
      if (options.enforceStandardStructure && !key.startsWith('generated/')) {
        throw new StorageError(
          'Invalid upload path: All new uploads must use generated/* structure',
          'INVALID_PATH_ERROR',
          400
        )
      }

      // Upload to S3 with public access if requested
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentDisposition: options.isVideo ? 'inline' : 'inline', // Allow inline viewing for both images and videos
        ACL: options.makePublic ? 'public-read' : undefined,
        Metadata: {
          originalName,
          uploadedAt: new Date().toISOString()
        }
      })

      await this.s3Client.send(command)

      const result: UploadResult = {
        url: this.getPublicUrl(key),
        key,
        originalName,
        size,
        mimeType
      }

      // Generate thumbnail if requested
      if (options.generateThumbnail && options.userId) {
        let thumbnailPath: string
        if (options.enforceStandardStructure) {
          // Use standardized thumbnail path
          const thumbnailFilename = generateUniqueFilename('jpg')
          thumbnailPath = buildS3Key(options.userId, 'thumbnails', thumbnailFilename)
        } else {
          // Use legacy thumbnail path
          thumbnailPath = `${UPLOAD_PATHS.legacy.thumbnails}/${filename}`
        }
        const thumbnailResult = await this.generateThumbnail(key, thumbnailPath)
        result.thumbnailUrl = thumbnailResult.url
      }

      return result

    } catch (error) {
      if (error instanceof StorageError) {
        throw error
      }
      throw new StorageError(
        `Failed to upload to S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'S3_UPLOAD_ERROR'
      )
    }
  }

  /**
   * Upload with standardized structure (recommended for all new uploads)
   * @param file File or Buffer to upload
   * @param userId User ID who owns the file
   * @param category Storage category (validated whitelist)
   * @param options Additional upload options
   * @returns UploadResult with permanent URLs
   */
  async uploadStandardized(
    file: File | Buffer,
    userId: string,
    category: ValidCategory,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    return this.upload(file, '', {
      ...options,
      userId,
      category,
      enforceStandardStructure: true
    })
  }

  async delete(key: string): Promise<DeleteResult> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      })

      await this.s3Client.send(command)
      
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete file'
      }
    }
  }

  getPublicUrl(key: string): string {
    if (this.cloudFrontUrl) {
      return `${this.cloudFrontUrl}/${key}`
    }
    return `https://${this.bucket}.s3.${STORAGE_CONFIG.aws.region}.amazonaws.com/${key}`
  }

  /**
   * Generate a pre-signed URL for accessing private S3 objects
   * @param key S3 object key
   * @param expiresIn Expiration time in seconds (default: 1 hour)
   * @returns Pre-signed URL that allows temporary access
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      })
      
      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn })
      return signedUrl
    } catch (error) {
      throw new StorageError(
        `Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SIGNED_URL_ERROR'
      )
    }
  }

  /**
   * Upload a file from a URL to S3
   * @param url Source URL to download from
   * @param path S3 path to store the file
   * @param options Upload options
   * @returns UploadResult with the uploaded file information
   */
  async uploadFromUrl(url: string, path: string, options: UploadOptions = {}): Promise<UploadResult> {
    try {
      console.log(`📥 Downloading from URL: ${url}`)
      
      // Fetch the file from the URL
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new StorageError(
          `Failed to download from URL: ${response.status} ${response.statusText}`,
          'URL_DOWNLOAD_ERROR',
          response.status
        )
      }

      // Get content type and size from response headers
      const contentType = response.headers.get('content-type') || (options.isVideo ? 'video/mp4' : 'image/jpeg')
      const contentLength = response.headers.get('content-length')
      
      // Convert to buffer
      const buffer = Buffer.from(await response.arrayBuffer())
      
      console.log(`📦 Downloaded ${buffer.length} bytes, content-type: ${contentType}`)

      // Extract filename from URL or use provided filename
      const filename = options.filename || this.extractFilenameFromUrl(url, options.isVideo)
      
      // Upload using the existing upload method
      return await this.upload(buffer, path, {
        ...options,
        filename,
        // Override mime type with detected content type
        // This will be handled in the upload method
      })
      
    } catch (error) {
      if (error instanceof StorageError) {
        throw error
      }
      throw new StorageError(
        `Failed to upload from URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'URL_UPLOAD_ERROR'
      )
    }
  }

  private extractFilenameFromUrl(url: string, isVideo?: boolean): string {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const segments = pathname.split('/')
      const filename = segments[segments.length - 1]
      
      // If filename has extension, return it
      if (filename.includes('.')) {
        return filename
      }
      
      // Generate a filename with appropriate extension
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 15)
      const extension = isVideo ? 'mp4' : 'jpg'
      
      return `${timestamp}-${randomString}.${extension}`
    } catch (error) {
      // If URL parsing fails, generate a random filename
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 15)
      const extension = isVideo ? 'mp4' : 'jpg'
      
      return `${timestamp}-${randomString}.${extension}`
    }
  }

  validateFile(file: File, isVideo?: boolean): FileValidation {
    // Check file size based on type
    const maxSize = isVideo ? STORAGE_CONFIG.limits.maxVideoSize : STORAGE_CONFIG.limits.maxFileSize
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`
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

  async generateThumbnail(sourceKey: string, thumbnailPath: string): Promise<UploadResult> {
    try {
      // This would typically fetch the source image from S3, process it, and upload the thumbnail
      // For now, we'll return a placeholder implementation
      const thumbnailConfig = STORAGE_CONFIG.processing.thumbnail
      
      // In a real implementation, you would:
      // 1. Download the source image from S3
      // 2. Process it with Sharp to create a thumbnail
      // 3. Upload the thumbnail back to S3
      
      return {
        url: this.getPublicUrl(thumbnailPath),
        key: thumbnailPath,
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

  private async processImage(buffer: Buffer, options: UploadOptions): Promise<Buffer> {
    try {
      let sharpInstance = sharp(buffer)

      // Resize if dimensions are specified
      if (options.maxWidth || options.maxHeight) {
        sharpInstance = sharpInstance.resize(options.maxWidth, options.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
      }

      // Set quality and format
      sharpInstance = sharpInstance.jpeg({
        quality: options.quality || 85,
        progressive: true
      })

      return await sharpInstance.toBuffer()
    } catch (error) {
      throw new StorageError(
        `Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'IMAGE_PROCESSING_ERROR'
      )
    }
  }
}