import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { STORAGE_CONFIG } from '../storage/config'
import { StorageError } from '../storage/base'
import fetch from 'node-fetch'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'

interface ImageDownloadResult {
  buffer: Buffer
  contentType: string
  contentLength: number
  originalUrl: string
}

interface StorageUploadResult {
  url: string
  key: string
  originalUrl: string
  thumbnailUrl?: string
  thumbnailKey?: string
}

export class AutoImageStorageService {
  private s3Client: S3Client
  private bucket: string
  private region: string

  constructor() {
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
    this.region = STORAGE_CONFIG.aws.region
  }

  /**
   * Process Replicate image URLs by downloading and uploading to S3
   * @param urls Array of Replicate image URLs
   * @param generationId Generation ID for organization
   * @param userId User ID for proper path organization
   * @returns Array of storage results with s3 keys
   */
  async processReplicateImages(urls: string[], generationId: string, userId: string): Promise<StorageUploadResult[]> {
    if (!urls || urls.length === 0) {
      return []
    }

    console.log(`📥 Processing ${urls.length} Replicate images for generation ${generationId}`)
    
    const results: StorageUploadResult[] = []
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      try {
        console.log(`📥 Downloading image ${i + 1}/${urls.length}: ${url.substring(0, 100)}...`)
        
        // Download image from Replicate
        const downloadResult = await this.downloadImage(url)
        
        // Generate consistent filename using standard pattern: generated/{userId}/{predictionId}/{index}.{ext}
        const fileExtension = this.extractFileExtension(url, downloadResult.contentType)
        const key = `generated/${userId}/${generationId}/${i}.${fileExtension}`
        
        // Upload to S3 as private object
        const uploadResult = await this.uploadToS3(
          downloadResult.buffer,
          key,
          downloadResult.contentType,
          {
            originalUrl: url,
            generationId,
            userId,
            downloadedAt: new Date().toISOString()
          }
        )

        // Generate thumbnail for images
        let thumbnailResult = null
        if (downloadResult.contentType.startsWith('image/')) {
          console.log(`🖼️ Generating thumbnail for image ${i + 1}/${urls.length}`)
          thumbnailResult = await this.generateThumbnail(
            downloadResult.buffer,
            key,
            generationId,
            userId,
            i
          )
        }

        const publicUrl = this.getPublicUrl(key)

        results.push({
          url: publicUrl, // Full S3 URL
          key,
          originalUrl: url,
          thumbnailUrl: thumbnailResult?.url,
          thumbnailKey: thumbnailResult?.key
        })

        console.log(`✅ Image ${i + 1}/${urls.length} processed successfully`)
        console.log(`🔗 Generated URL: ${publicUrl}`)
        console.log(`🗂️ S3 Key: ${key}`)
        
      } catch (error) {
        console.error(`❌ Failed to process image ${i + 1}:`, error)
        // Log error but continue with other images
        throw new StorageError(
          `Failed to process image ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'IMAGE_PROCESSING_ERROR'
        )
      }
    }
    
    console.log(`✅ Successfully processed ${results.length}/${urls.length} images`)
    return results
  }

  /**
   * Download image from URL with proper error handling
   */
  private async downloadImage(url: string): Promise<ImageDownloadResult> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        timeout: 30000, // 30 second timeout
        headers: {
          'User-Agent': 'VibePhoto-ImageProcessor/1.0'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const buffer = await response.buffer()
      const contentType = response.headers.get('content-type') || 'image/jpeg'
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10)

      // Validate it's an image or video
      if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
        throw new Error(`Invalid content type: ${contentType}. Expected image/* or video/*`)
      }

      // Validate file size
      if (contentLength > 50 * 1024 * 1024) { // 50MB limit
        throw new Error(`File too large: ${contentLength} bytes`)
      }

      if (buffer.length === 0) {
        throw new Error('Empty response body')
      }

      return {
        buffer,
        contentType,
        contentLength: buffer.length,
        originalUrl: url
      }

    } catch (error) {
      throw new StorageError(
        `Failed to download image from ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DOWNLOAD_ERROR'
      )
    }
  }

  /**
   * Upload buffer to S3 with proper permissions
   */
  private async uploadToS3(
    buffer: Buffer,
    key: string,
    contentType: string,
    metadata: Record<string, string>
  ): Promise<string> {
    try {
      // Check if file already exists
      try {
        await this.s3Client.send(new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key
        }))
        
        // File exists, return s3 key
        console.log(`📄 File already exists in S3: ${key}`)
        return key
      } catch (error) {
        // File doesn't exist, proceed with upload
      }

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ContentDisposition: 'inline', // Allow inline viewing
        // No ACL specified - objects inherit bucket policy (public for generated/* and training/*)
        Metadata: metadata,
        CacheControl: 'max-age=31536000', // 1 year cache
        ServerSideEncryption: 'AES256'
      })

      await this.s3Client.send(command)

      console.log(`📤 Uploaded to S3: ${key}`)

      // Return the s3 key - will be converted to URL by caller
      return key

    } catch (error) {
      throw new StorageError(
        `Failed to upload to S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'S3_UPLOAD_ERROR'
      )
    }
  }

  /**
   * Get public URL for S3 object
   */
  private getPublicUrl(key: string): string {
    // Use CloudFront URL if configured
    if (STORAGE_CONFIG.aws.cloudFrontUrl) {
      return `${STORAGE_CONFIG.aws.cloudFrontUrl}/${key}`
    }
    
    // Standard S3 URL
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`
  }

  /**
   * Extract file extension from URL or content type
   */
  private extractFileExtension(url: string, contentType: string): string {
    // Try to get extension from URL first
    const urlMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)
    if (urlMatch) {
      return urlMatch[1].toLowerCase()
    }

    // Fallback to content type
    switch (contentType.toLowerCase()) {
      case 'image/jpeg':
      case 'image/jpg':
        return 'jpg'
      case 'image/png':
        return 'png'
      case 'image/webp':
        return 'webp'
      case 'image/gif':
        return 'gif'
      case 'video/mp4':
        return 'mp4'
      case 'video/webm':
        return 'webm'
      case 'video/avi':
        return 'avi'
      case 'video/mov':
      case 'video/quicktime':
        return 'mov'
      default:
        // Default based on content type category
        return contentType.startsWith('video/') ? 'mp4' : 'jpg'
    }
  }

  /**
   * Validate that uploaded images are accessible
   */
  async validateStoredImages(urls: string[]): Promise<{ valid: string[], invalid: string[] }> {
    const valid: string[] = []
    const invalid: string[] = []

    for (const url of urls) {
      try {
        const response = await fetch(url, { method: 'HEAD', timeout: 10000 })
        if (response.ok) {
          valid.push(url)
        } else {
          invalid.push(url)
        }
      } catch (error) {
        invalid.push(url)
      }
    }

    return { valid, invalid }
  }

  /**
   * Generate thumbnail from image buffer
   */
  private async generateThumbnail(
    imageBuffer: Buffer,
    originalKey: string,
    generationId: string,
    userId: string,
    index: number
  ): Promise<{ url: string, key: string } | null> {
    try {
      const thumbnailConfig = STORAGE_CONFIG.processing.thumbnail

      // Generate thumbnail using Sharp
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(thumbnailConfig.width, thumbnailConfig.height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({
          quality: thumbnailConfig.quality,
          progressive: true
        })
        .toBuffer()

      // Generate thumbnail key
      const fileExtension = this.extractFileExtension(originalKey, 'image/jpeg')
      const thumbnailKey = `generated/${userId}/${generationId}/thumb_${index}.${fileExtension}`

      // Upload thumbnail to S3
      const uploadResult = await this.uploadToS3(
        thumbnailBuffer,
        thumbnailKey,
        'image/jpeg',
        {
          originalKey,
          generationId,
          userId,
          type: 'thumbnail',
          thumbnailGeneratedAt: new Date().toISOString()
        }
      )

      return {
        url: this.getPublicUrl(thumbnailKey),
        key: thumbnailKey
      }

    } catch (error) {
      console.error(`❌ Failed to generate thumbnail for ${originalKey}:`, error)
      return null
    }
  }

  /**
   * Clean up old temporary files (if needed)
   */
  async cleanupOldFiles(olderThanDays: number = 30): Promise<number> {
    // This would implement S3 lifecycle policy or manual cleanup
    // For now, we'll rely on S3 lifecycle policies configured on the bucket
    console.log(`🧹 Cleanup would remove files older than ${olderThanDays} days`)
    return 0
  }
}

// Singleton instance
let autoImageStorageInstance: AutoImageStorageService | null = null

export function getAutoImageStorage(): AutoImageStorageService {
  if (!autoImageStorageInstance) {
    autoImageStorageInstance = new AutoImageStorageService()
  }
  return autoImageStorageInstance
}

// Utility function for direct usage
export async function processAndStoreReplicateImages(
  urls: string[],
  generationId: string,
  userId: string
): Promise<StorageUploadResult[]> {
  const storage = getAutoImageStorage()
  return await storage.processReplicateImages(urls, generationId, userId)
}