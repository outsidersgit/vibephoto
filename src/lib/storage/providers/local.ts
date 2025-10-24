import fs from 'fs/promises'
import path from 'path'
import { StorageProvider, UploadResult, UploadOptions, FileValidation, DeleteResult, StorageError } from '../base'
import { STORAGE_CONFIG } from '../config'
import sharp from 'sharp'

export class LocalStorageProvider extends StorageProvider {
  private uploadDir: string

  constructor() {
    super()
    this.uploadDir = path.join(process.cwd(), 'public', 'uploads')
    this.ensureUploadDirExists()
  }

  private async ensureUploadDirExists() {
    try {
      await fs.access(this.uploadDir)
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true })
    }
  }

  async upload(
    file: File | Buffer,
    uploadPath: string,
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
        mimeType = options.isVideo ? 'video/mp4' : 'image/jpeg'
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

      // Generate unique filename
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 15)
      const extension = originalName.split('.').pop()
      const filename = options.filename || `${timestamp}-${randomString}.${extension}`

      // Create directory path
      const dirPath = path.join(this.uploadDir, uploadPath)
      await fs.mkdir(dirPath, { recursive: true })

      // Full file path
      const filePath = path.join(dirPath, filename)
      const key = path.join(uploadPath, filename).replace(/\\/g, '/')

      // Write file
      await fs.writeFile(filePath, buffer)

      const result: UploadResult = {
        url: this.getPublicUrl(key),
        key,
        originalName,
        size,
        mimeType
      }

      // Generate thumbnail if requested
      if (options.generateThumbnail) {
        const thumbnailPath = path.join('thumbnails', filename)
        const thumbnailResult = await this.generateThumbnail(key, thumbnailPath)
        result.thumbnailUrl = thumbnailResult.url
      }

      return result

    } catch (error) {
      if (error instanceof StorageError) {
        throw error
      }
      throw new StorageError(
        `Failed to upload locally: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LOCAL_UPLOAD_ERROR'
      )
    }
  }

  async delete(key: string): Promise<DeleteResult> {
    try {
      const filePath = path.join(this.uploadDir, key)
      await fs.unlink(filePath)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete file'
      }
    }
  }

  getPublicUrl(key: string): string {
    // Return URL relative to public directory
    return `/uploads/${key}`
  }

  /**
   * Generate a signed URL for the local file
   * Since local files are served via public URLs, we just return the public URL
   * @param key File key
   * @param expiresIn Not used for local storage (files are public)
   * @returns Public URL for the file
   */
  async getSignedUrl(key: string, expiresIn?: number): Promise<string> {
    // For local storage, files are already public, so we just return the public URL
    return this.getPublicUrl(key)
  }

  /**
   * Upload a file from a URL to local storage
   * @param url Source URL to download from
   * @param path Local path to store the file
   * @param options Upload options
   * @returns UploadResult with the uploaded file information
   */
  async uploadFromUrl(url: string, uploadPath: string, options: UploadOptions = {}): Promise<UploadResult> {
    try {
      console.log(`📥 Downloading from URL for local storage: ${url}`)
      
      // Fetch the file from the URL
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new StorageError(
          `Failed to download from URL: ${response.status} ${response.statusText}`,
          'URL_DOWNLOAD_ERROR',
          response.status
        )
      }

      // Get content type from response headers
      const contentType = response.headers.get('content-type') || (options.isVideo ? 'video/mp4' : 'image/jpeg')
      
      // Convert to buffer
      const buffer = Buffer.from(await response.arrayBuffer())
      
      console.log(`📦 Downloaded ${buffer.length} bytes for local storage, content-type: ${contentType}`)

      // Extract filename from URL or use provided filename
      const filename = options.filename || this.extractFilenameFromUrl(url, options.isVideo)
      
      // Upload using the existing upload method
      return await this.upload(buffer, uploadPath, {
        ...options,
        filename
      })
      
    } catch (error) {
      if (error instanceof StorageError) {
        throw error
      }
      throw new StorageError(
        `Failed to upload from URL to local storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      const sourcePath = path.join(this.uploadDir, sourceKey)
      const thumbnailDir = path.join(this.uploadDir, path.dirname(thumbnailPath))
      const thumbnailFilePath = path.join(this.uploadDir, thumbnailPath)

      // Ensure thumbnail directory exists
      await fs.mkdir(thumbnailDir, { recursive: true })

      // Generate thumbnail using Sharp
      const thumbnailConfig = STORAGE_CONFIG.processing.thumbnail
      await sharp(sourcePath)
        .resize(thumbnailConfig.width, thumbnailConfig.height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({
          quality: thumbnailConfig.quality,
          progressive: true
        })
        .toFile(thumbnailFilePath)

      const stats = await fs.stat(thumbnailFilePath)

      return {
        url: this.getPublicUrl(thumbnailPath),
        key: thumbnailPath,
        originalName: 'thumbnail.jpg',
        size: stats.size,
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