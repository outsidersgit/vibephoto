import { AWSS3Provider } from './providers/aws-s3'
import { buildKey, buildThumbnailKey, buildPosterKey, MediaType } from './path-utils'
import sharp from 'sharp'

export interface S3UploadResult {
  success: boolean
  error?: string
  url?: string
  key?: string
  bucket?: string
  mimeType?: string
  sizeBytes?: number
  width?: number
  height?: number
  durationSec?: number
}

export interface S3Config {
  provider: string
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
}

/**
 * Validate S3 environment configuration
 * @returns Validation result with config or error
 */
export function validateS3Config(): { valid: boolean; config?: S3Config; error?: string } {
  const provider = process.env.STORAGE_PROVIDER
  const bucket = process.env.AWS_S3_BUCKET || process.env.MEDIA_BUCKET
  const region = process.env.AWS_REGION
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

  if (provider !== 'aws' && provider !== 's3') {
    return { valid: false, error: 'STORAGE_PROVIDER must be "aws" or "s3"' }
  }

  if (!bucket) {
    return { valid: false, error: 'AWS_S3_BUCKET or MEDIA_BUCKET environment variable is required' }
  }

  if (!region) {
    return { valid: false, error: 'AWS_REGION environment variable is required' }
  }

  if (!accessKeyId) {
    return { valid: false, error: 'AWS_ACCESS_KEY_ID environment variable is required' }
  }

  if (!secretAccessKey) {
    return { valid: false, error: 'AWS_SECRET_ACCESS_KEY environment variable is required' }
  }

  return {
    valid: true,
    config: {
      provider,
      bucket,
      region,
      accessKeyId,
      secretAccessKey
    }
  }
}

/**
 * Upload file from URL to S3 with consistent key
 * @param fileUrl Source URL to download from
 * @param bucket S3 bucket name
 * @param key S3 key/path to store file
 * @param contentType Optional content type override
 * @returns Upload result with metadata
 */
export async function uploadFromUrlToS3(
  fileUrl: string,
  bucket: string,
  key: string,
  contentType?: string
): Promise<S3UploadResult> {
  try {
    console.log(`📥 S3 Helper: Uploading from ${fileUrl} to s3://${bucket}/${key}`)
    
    // Validate S3 configuration
    const configValidation = validateS3Config()
    if (!configValidation.valid) {
      return {
        success: false,
        error: `S3 Configuration Error: ${configValidation.error}`
      }
    }

    // Create S3 provider instance
    const s3Provider = new AWSS3Provider()

    // Use the uploadFromUrl method from S3Provider
    const uploadResult = await s3Provider.uploadFromUrl(fileUrl, key, {
      makePublic: false, // Keep private, use signed URLs
      isVideo: contentType?.startsWith('video/') || key.includes('.mp4')
    })

    // Determine file metadata
    let width: number | undefined
    let height: number | undefined
    let durationSec: number | undefined

    // For images, get dimensions
    if (contentType?.startsWith('image/') || (!contentType && !key.includes('.mp4'))) {
      try {
        // Download a small portion to get metadata without full download
        const response = await fetch(fileUrl, { 
          method: 'HEAD' 
        })
        
        if (response.ok) {
          // For now, we'll get dimensions later or use a separate metadata extraction
          // This is a placeholder - in production you might want to download and analyze
        }
      } catch (error) {
        console.warn('Could not extract image metadata:', error)
      }
    }

    return {
      success: true,
      url: uploadResult.url,
      key: uploadResult.key,
      bucket,
      mimeType: uploadResult.mimeType,
      sizeBytes: uploadResult.size,
      width,
      height,
      durationSec
    }

  } catch (error) {
    console.error('❌ S3 Helper Upload Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error'
    }
  }
}

/**
 * Generate signed URL for S3 object
 * @param bucket S3 bucket name  
 * @param key S3 object key
 * @param expiresIn Expiration time in seconds (default: 10 minutes)
 * @returns Signed URL or error
 */
export async function getSignedUrlS3(
  bucket: string,
  key: string,
  expiresIn: number = 600
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    console.log(`🔗 S3 Helper: Generating signed URL for s3://${bucket}/${key}`)
    
    // Validate S3 configuration
    const configValidation = validateS3Config()
    if (!configValidation.valid) {
      return {
        success: false,
        error: `S3 Configuration Error: ${configValidation.error}`
      }
    }

    // Create S3 provider instance
    const s3Provider = new AWSS3Provider()

    // Generate signed URL
    const signedUrl = await s3Provider.getSignedUrl(key, expiresIn)

    return {
      success: true,
      url: signedUrl
    }

  } catch (error) {
    console.error('❌ S3 Helper Signed URL Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate signed URL'
    }
  }
}

/**
 * Upload media file and generate thumbnail (if image)
 * @param fileUrl Source file URL
 * @param type Media type (image/video)
 * @param userId User ID
 * @param mediaId Media ID (generation ID, etc.)
 * @param bucket S3 bucket
 * @returns Upload results for main file and thumbnail
 */
export async function uploadMediaWithThumbnail(
  fileUrl: string,
  type: MediaType,
  userId: string,
  mediaId: string,
  bucket: string
): Promise<{
  main: S3UploadResult
  thumbnail?: S3UploadResult
}> {
  try {
    // Determine file extension from URL or content type
    let ext = 'jpg' // Default
    try {
      const url = new URL(fileUrl)
      const pathname = url.pathname
      const urlExt = pathname.split('.').pop()?.toLowerCase()
      if (urlExt && ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm'].includes(urlExt)) {
        ext = urlExt
      }
    } catch {
      ext = type === 'VIDEO' ? 'mp4' : 'jpg'
    }

    // Build consistent storage key
    const mainKey = buildKey(type, userId, mediaId, ext)
    
    console.log(`🎬 S3 Helper: Uploading ${type} with key ${mainKey}`)

    // Upload main file
    const mainResult = await uploadFromUrlToS3(fileUrl, bucket, mainKey)
    
    if (!mainResult.success) {
      return { main: mainResult }
    }

    // Generate thumbnail for images or poster for videos
    let thumbnailResult: S3UploadResult | undefined

    if (type === 'IMAGE') {
      // For images, create thumbnail
      const thumbnailKey = buildThumbnailKey(mainKey)
      
      try {
        // Download image and create thumbnail
        const response = await fetch(fileUrl)
        if (response.ok) {
          const imageBuffer = Buffer.from(await response.arrayBuffer())
          const thumbnailBuffer = await generateThumbnail(imageBuffer)
          
          // Upload thumbnail using buffer
          const s3Provider = new AWSS3Provider()
          const thumbnailUpload = await s3Provider.upload(thumbnailBuffer, thumbnailKey, {
            filename: `thumb_${mediaId}.jpg`,
            makePublic: false
          })

          thumbnailResult = {
            success: true,
            url: thumbnailUpload.url,
            key: thumbnailUpload.key,
            bucket,
            mimeType: thumbnailUpload.mimeType,
            sizeBytes: thumbnailUpload.size
          }
        }
      } catch (error) {
        console.warn('Failed to generate thumbnail:', error)
        // Continue without thumbnail - not critical
      }
    } else if (type === 'VIDEO') {
      // For videos, create poster/thumbnail
      const posterKey = buildPosterKey(mainKey)
      
      // Note: Video thumbnail generation would require ffmpeg or similar
      // For now, we'll skip video thumbnails and implement later if needed
      console.log(`📹 Video poster generation not implemented yet for ${posterKey}`)
    }

    return {
      main: mainResult,
      thumbnail: thumbnailResult
    }

  } catch (error) {
    console.error('❌ S3 Helper Media Upload Error:', error)
    return {
      main: {
        success: false,
        error: error instanceof Error ? error.message : 'Media upload failed'
      }
    }
  }
}

/**
 * Generate thumbnail buffer from image buffer
 */
async function generateThumbnail(
  imageBuffer: Buffer,
  maxWidth: number = 300,
  maxHeight: number = 300
): Promise<Buffer> {
  try {
    return await sharp(imageBuffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toBuffer()
  } catch (error) {
    console.error('Thumbnail generation error:', error)
    return imageBuffer // Fallback to original
  }
}

/**
 * Check if S3 is properly configured and accessible
 */
export async function testS3Connection(): Promise<{ success: boolean; error?: string }> {
  try {
    const configValidation = validateS3Config()
    if (!configValidation.valid) {
      return { success: false, error: configValidation.error }
    }

    // Test by creating a small test file
    const s3Provider = new AWSS3Provider()
    const testKey = `test/connection-${Date.now()}.txt`
    const testBuffer = Buffer.from('S3 connection test')

    const result = await s3Provider.upload(testBuffer, testKey, {
      filename: 'connection-test.txt',
      makePublic: false
    })

    // Clean up test file
    await s3Provider.delete(result.key)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'S3 connection test failed'
    }
  }
}