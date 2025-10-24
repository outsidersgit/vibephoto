import { StorageProvider } from './base'
import { AWSS3Provider } from './providers/aws-s3'
import { LocalStorageProvider } from './providers/local'
import { STORAGE_CONFIG, UPLOAD_PATHS } from './config'
import { buildS3Key, generateUniqueFilename, type ValidCategory } from './path-utils'

let storageProvider: StorageProvider | null = null

export function getStorageProvider(): StorageProvider {
  if (!storageProvider) {
    switch (STORAGE_CONFIG.provider) {
      case 'aws':
        storageProvider = new AWSS3Provider()
        break
      case 'local':
        storageProvider = new LocalStorageProvider()
        break
      default:
        // Fallback to local provider for development
        storageProvider = new LocalStorageProvider()
    }
  }
  return storageProvider
}
import { UploadResult } from './base'
import sharp from 'sharp'

interface DownloadResult {
  success: boolean
  error?: string
  permanentUrls?: string[]
  thumbnailUrls?: string[]
}

/**
 * Download images from temporary URLs and store them permanently using SAME PATTERN AS TRAINING
 * @param temporaryUrls Array of temporary image URLs from AI provider
 * @param generationId Unique generation ID
 * @param userId User ID who owns the images
 * @param context Storage context - deprecated, now uses standardized structure
 */
export async function downloadAndStoreImages(
  temporaryUrls: string[],
  generationId: string,
  userId: string,
  context: string = 'generated' // Deprecated parameter, maintained for backward compatibility
): Promise<DownloadResult> {
  try {
    const storage = getStorageProvider()
    const permanentUrls: string[] = []
    const thumbnailUrls: string[] = []

    console.log(`📥 [STORAGE_SIMPLE] Using TRAINING pattern for ${temporaryUrls.length} images, generation ${generationId}`)

    for (let i = 0; i < temporaryUrls.length; i++) {
      const tempUrl = temporaryUrls[i]

      try {
        console.log(`⬇️ [STORAGE_SIMPLE] Processing image ${i + 1}/${temporaryUrls.length}: ${tempUrl.substring(0, 80)}...`)

        // Robust download with multiple retries for Astria URLs
        let response: Response | null = null
        let downloadAttempt = 0
        const maxDownloadAttempts = 5

        while (downloadAttempt < maxDownloadAttempts && !response) {
          try {
            downloadAttempt++
            const timeoutMs = Math.min(60000 + (downloadAttempt * 30000), 300000) // 60s, 90s, 120s, 150s, 180s max

            console.log(`🔄 [STORAGE_DOWNLOAD] Attempt ${downloadAttempt}/${maxDownloadAttempts} with ${timeoutMs/1000}s timeout`)

            // Download image with progressive timeout and Astria authentication
            const headers: Record<string, string> = {
              'User-Agent': 'VibePhoto/1.0',
              'Accept': 'image/*',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }

            // 🔑 CRITICAL: Add Astria authentication for protected URLs
            if (tempUrl.includes('astria.ai') && process.env.ASTRIA_API_KEY) {
              headers['Authorization'] = `Bearer ${process.env.ASTRIA_API_KEY}`
              console.log(`🔐 [STORAGE_DOWNLOAD] Using Astria authentication for ${tempUrl.substring(0, 80)}...`)
            }

            response = await fetch(tempUrl, {
              headers,
              signal: AbortSignal.timeout(timeoutMs)
            })

            if (!response.ok) {
              console.warn(`⚠️ [STORAGE_DOWNLOAD] HTTP ${response.status} on attempt ${downloadAttempt}: ${response.statusText}`)
              if (response.status === 404) {
                throw new Error(`Image not found (404): ${tempUrl}`)
              }
              if (downloadAttempt === maxDownloadAttempts) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
              }
              response = null // Reset to retry
              await new Promise(resolve => setTimeout(resolve, 5000 * downloadAttempt)) // Progressive delay
            } else {
              console.log(`✅ [STORAGE_DOWNLOAD] Successfully downloaded on attempt ${downloadAttempt}`)
            }
          } catch (downloadError) {
            console.error(`❌ [STORAGE_DOWNLOAD] Attempt ${downloadAttempt} failed:`, downloadError)
            if (downloadAttempt === maxDownloadAttempts) {
              throw downloadError
            }
            // Wait before retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, 10000 * downloadAttempt))
          }
        }

        if (!response) {
          throw new Error(`Failed to download after ${maxDownloadAttempts} attempts`)
        }

        const imageBuffer = Buffer.from(await response.arrayBuffer())
        const contentType = response.headers.get('content-type') || 'image/png'
        const fileExtension = detectFileExtension(contentType)

        // Create File object from buffer (same way training works)
        const filename = `generated_${i + 1}.${fileExtension}`
        const imageBlob = new Blob([imageBuffer], { type: contentType })
        const imageFile = new File([imageBlob], filename, { type: contentType })

        // Use EXACT same pattern as training - simple path structure
        const imagePath = `generated/${userId}/${generationId}/${filename}`

        console.log(`☁️ [STORAGE_SIMPLE] Uploading with training pattern: ${imagePath}`)

        // Upload using EXACT same method as training
        const uploadResult = await storage.upload(imageFile, imagePath, {
          folder: `generated/${userId}`,
          makePublic: true, // Same as training
          quality: 90
        })

        permanentUrls.push(uploadResult.url)
        console.log(`✅ [STORAGE_SIMPLE] Image uploaded successfully: ${uploadResult.url}`)

        // Generate thumbnail using same approach
        const thumbnailBuffer = await generateThumbnailBuffer(imageBuffer)
        const thumbnailBlob = new Blob([thumbnailBuffer], { type: 'image/png' })
        const thumbnailFile = new File([thumbnailBlob], `thumb_${filename}`, { type: 'image/png' })
        const thumbnailPath = `generated/${userId}/${generationId}/thumb_${filename}`

        const thumbnailUpload = await storage.upload(thumbnailFile, thumbnailPath, {
          folder: `generated/${userId}`,
          makePublic: true,
          quality: 90
        })

        thumbnailUrls.push(thumbnailUpload.url)
        console.log(`✅ [STORAGE_SIMPLE] Thumbnail uploaded: ${thumbnailUpload.url}`)

        // Add progressive delay between uploads to avoid S3 rate limits
        if (i < temporaryUrls.length - 1) {
          const delayMs = Math.min(3000 + (i * 1000), 8000) // 3s, 4s, 5s, up to 8s max
          console.log(`⏱️ [STORAGE_SIMPLE] Waiting ${delayMs/1000}s before next upload to avoid rate limits...`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }

      } catch (error) {
        console.error(`❌ [STORAGE_SIMPLE] Failed to process image ${i + 1}:`, error)
        // Continue with other images
        continue
      }
    }

    if (permanentUrls.length === 0) {
      console.error(`❌ [STORAGE_SIMPLE] Failed to store any images`)
      return {
        success: false,
        error: 'Failed to download and store any images using training pattern'
      }
    }

    console.log(`🎉 [STORAGE_SIMPLE] SUCCESS! Stored ${permanentUrls.length}/${temporaryUrls.length} images using training pattern`)

    return {
      success: true,
      permanentUrls,
      thumbnailUrls
    }
    
  } catch (error) {
    console.error('❌ Error in downloadAndStoreImages:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Generate thumbnail buffer from image buffer
 */
export async function generateThumbnailBuffer(
  imageBuffer: Buffer,
  maxWidth: number = 300,
  maxHeight: number = 300,
  quality: number = 90
): Promise<Buffer> {
  try {
    return await sharp(imageBuffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({ quality })
      .toBuffer()
  } catch (error) {
    console.error('Error generating thumbnail:', error)
    // Fallback: return original image buffer
    return imageBuffer
  }
}

/**
 * Download a single image and return as buffer
 */
export async function downloadImageBuffer(url: string): Promise<Buffer> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

  // Prepare headers with Astria authentication if needed
  const headers: Record<string, string> = {
    'User-Agent': 'VibePhoto/1.0',
  }

  // 🔑 Add Astria authentication for protected URLs
  if (url.includes('astria.ai') && process.env.ASTRIA_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.ASTRIA_API_KEY}`
  }

  const response = await fetch(url, {
    headers,
    signal: controller.signal
  })
  
  clearTimeout(timeoutId)
  
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`)
  }
  
  return Buffer.from(await response.arrayBuffer())
}

/**
 * Clean up temporary files (for local storage provider)
 */
export async function cleanupTemporaryFiles(keys: string[]): Promise<void> {
  const storage = getStorageProvider()
  
  for (const key of keys) {
    try {
      await storage.delete(key)
      console.log(`🗑️ Cleaned up temporary file: ${key}`)
    } catch (error) {
      console.warn(`⚠️ Failed to cleanup file ${key}:`, error)
    }
  }
}

/**
 * Validate image URL is accessible
 */
export async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    return response.ok
  } catch (error) {
    console.warn(`Failed to validate image URL ${url}:`, error)
    return false
  }
}

/**
 * Download video from URL and store permanently using standardized structure
 */
export async function downloadAndStoreVideo(
  videoUrl: string,
  videoGenId: string,
  userId: string
): Promise<{ success: boolean; error?: string; videoUrl?: string; thumbnailUrl?: string }> {
  try {
    const storage = getStorageProvider()

    console.log(`📥 Starting download of video for generation ${videoGenId}`)

    // Download the video with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minute timeout for videos

    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'VibePhoto/1.0',
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`)
    }

    const videoBuffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'video/mp4'

    // Ensure we're working with a video content type
    if (!contentType.startsWith('video/')) {
      console.warn(`Unexpected content type for video: ${contentType}, forcing to video/mp4`)
    }

    // Use new standardized structure: generated/{userId}/videos/uniqueFilename.mp4
    const videoFilename = `${videoGenId}_${generateUniqueFilename('mp4')}`
    const videoKey = buildS3Key(userId, 'videos', videoFilename)

    // Upload video using standardized method
    console.log(`☁️ Uploading video to ${videoKey}`)
    let uploadResult: UploadResult

    if (storage instanceof AWSS3Provider) {
      // Use new standardized upload method
      uploadResult = await storage.uploadStandardized(
        videoBuffer,
        userId,
        'videos',
        {
          filename: videoFilename,
          makePublic: true, // Videos are public as per S3 policy
          isVideo: true
        }
      )
    } else {
      // Fallback for other providers
      uploadResult = await storage.upload(
        videoBuffer,
        videoKey,
        {
          filename: videoFilename,
          makePublic: true,
          isVideo: true
        }
      )
    }

    console.log(`✅ Video uploaded successfully: ${uploadResult.url}`)

    return {
      success: true,
      videoUrl: uploadResult.url
    }

  } catch (error) {
    console.error('❌ Error in downloadAndStoreVideo:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Generate video filename for storage
 */
export function generateVideoFilename(videoGenId: string, extension: string = 'mp4'): string {
  const timestamp = Date.now()
  return `video_${videoGenId}_${timestamp}.${extension}`
}

/**
 * Validate video URL is accessible
 */
export async function validateVideoUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    // Prepare headers with Astria authentication if needed
    const headers: Record<string, string> = {}

    // 🔑 Add Astria authentication for protected URLs
    if (url.includes('astria.ai') && process.env.ASTRIA_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.ASTRIA_API_KEY}`
    }

    const response = await fetch(url, {
      method: 'HEAD',
      headers,
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    return response.ok
  } catch (error) {
    console.warn(`Failed to validate video URL ${url}:`, error)
    return false
  }
}

/**
 * Detect file extension from content type
 */
function detectFileExtension(contentType: string): string {
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
    default:
      return 'jpg' // default fallback
  }
}