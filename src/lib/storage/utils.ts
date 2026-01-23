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
  context: string = 'generated', // Deprecated parameter, maintained for backward compatibility
  isUpscale: boolean = false // Flag to indicate upscale images (allows larger file size)
): Promise<DownloadResult> {
  try {
    // 🔑 CRITICAL: Check if storage provider is properly initialized
    let storage: StorageProvider
    try {
      storage = getStorageProvider()
      console.log(`📥 [STORAGE_SIMPLE] Storage provider initialized: ${STORAGE_CONFIG.provider}`)
    } catch (providerError) {
      console.error('❌ [STORAGE_SIMPLE] Failed to initialize storage provider:', providerError)
      return {
        success: false,
        error: `Storage provider initialization failed: ${providerError instanceof Error ? providerError.message : 'Unknown error'}`
      }
    }
    
    const permanentUrls: string[] = []
    const thumbnailUrls: string[] = []

    console.log(`📥 [STORAGE_SIMPLE] Using TRAINING pattern for ${temporaryUrls.length} images, generation ${generationId}`)

    const errors: string[] = []

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
          quality: 87, // 🎯 OPTIMIZED: Reduced from 90 to 87 (imperceptible difference, ~15-20% smaller files)
          isUpscale // Pass isUpscale flag to allow larger file sizes (50MB)
        })

        if (!uploadResult || !uploadResult.url) {
          throw new Error(`Upload failed: No URL returned from storage provider`)
        }

        if (!uploadResult || !uploadResult.url) {
          throw new Error(`Upload failed: No URL returned from storage provider for image ${i + 1}`)
        }

        if (!uploadResult.url.startsWith('http')) {
          throw new Error(`Upload failed: Invalid URL format returned: ${uploadResult.url}`)
        }

        permanentUrls.push(uploadResult.url)
        console.log(`✅ [STORAGE_SIMPLE] Image ${i + 1} uploaded successfully: ${uploadResult.url.substring(0, 100)}...`)

        // 🔒 CRITICAL: Generate thumbnail with retry logic to ensure it's always saved
        // Thumbnails are essential for gallery performance - MUST be generated for every image
        let thumbnailUrl: string | null = null
        let thumbnailAttempt = 0
        const maxThumbnailAttempts = 5 // Increased from 3 to 5 for better reliability
        
        while (thumbnailAttempt < maxThumbnailAttempts && !thumbnailUrl) {
          try {
            thumbnailAttempt++
            console.log(`🖼️ [STORAGE_SIMPLE] Generating thumbnail ${i + 1} (attempt ${thumbnailAttempt}/${maxThumbnailAttempts})`)
            
            // Generate thumbnail buffer from the downloaded image
            const thumbnailBuffer = await generateThumbnailBuffer(imageBuffer, 300, 300, 80)
            
            if (!thumbnailBuffer || thumbnailBuffer.length === 0) {
              throw new Error('Thumbnail buffer generation returned empty buffer')
            }
            
            const thumbnailBlob = new Blob([thumbnailBuffer], { type: 'image/jpeg' })
            const thumbnailFile = new File([thumbnailBlob], `thumb_${filename}`, { type: 'image/jpeg' })
            const thumbnailPath = `generated/${userId}/${generationId}/thumb_${filename}`

            console.log(`☁️ [STORAGE_SIMPLE] Uploading thumbnail ${i + 1} to: ${thumbnailPath}`)
            
            const thumbnailUpload = await storage.upload(thumbnailFile, thumbnailPath, {
              folder: `generated/${userId}`,
              makePublic: true,
              quality: 80 // 🎯 OPTIMIZED: Thumbnails use lower quality (80) since they're small previews
            })

            if (thumbnailUpload && thumbnailUpload.url) {
              thumbnailUrl = thumbnailUpload.url
              thumbnailUrls.push(thumbnailUrl)
              console.log(`✅ [STORAGE_SIMPLE] Thumbnail ${i + 1} uploaded successfully: ${thumbnailUrl.substring(0, 100)}...`)
              console.log(`📊 [STORAGE_SIMPLE] Thumbnail size: ${(thumbnailBuffer.length / 1024).toFixed(2)}KB`)
            } else {
              throw new Error(`Thumbnail upload returned no URL. Upload result: ${JSON.stringify(thumbnailUpload)}`)
            }
          } catch (thumbnailError) {
            console.error(`❌ [STORAGE_SIMPLE] Thumbnail upload attempt ${thumbnailAttempt} failed for image ${i + 1}:`, thumbnailError)
            if (thumbnailAttempt < maxThumbnailAttempts) {
              // Wait before retry with exponential backoff
              const delayMs = 2000 * Math.pow(2, thumbnailAttempt - 1) // 2s, 4s, 8s, 16s, 32s
              console.log(`⏱️ [STORAGE_SIMPLE] Waiting ${delayMs/1000}s before retry...`)
              await new Promise(resolve => setTimeout(resolve, delayMs))
            } else {
              console.error(`❌ [STORAGE_SIMPLE] CRITICAL: Failed to upload thumbnail after ${maxThumbnailAttempts} attempts for image ${i + 1}`)
              console.error(`❌ [STORAGE_SIMPLE] This will cause performance issues in gallery - thumbnails are essential!`)
              // Don't fail the entire process, but log as critical error
            }
          }
        }
        
        // 🔒 CRITICAL: If thumbnail upload failed after all retries, this is a critical issue
        if (!thumbnailUrl) {
          console.error(`❌ [STORAGE_SIMPLE] CRITICAL: Thumbnail upload failed for image ${i + 1} after ${maxThumbnailAttempts} attempts.`)
          console.error(`❌ [STORAGE_SIMPLE] Gallery will use full image (performance impact). Check storage provider configuration.`)
          // Continue processing other images, but log as error
        }

        // Add progressive delay between uploads to avoid S3 rate limits
        if (i < temporaryUrls.length - 1) {
          const delayMs = Math.min(3000 + (i * 1000), 8000) // 3s, 4s, 5s, up to 8s max
          console.log(`⏱️ [STORAGE_SIMPLE] Waiting ${delayMs/1000}s before next upload to avoid rate limits...`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
        console.error(`❌ [STORAGE_SIMPLE] Failed to process image ${i + 1}:`, error)
        console.error(`❌ [STORAGE_SIMPLE] Error stack:`, error instanceof Error ? error.stack : 'No stack')
        errors.push(`Image ${i + 1}: ${errorMsg}`)
        // Continue with other images
        continue
      }
    }

    if (permanentUrls.length === 0) {
      const detailedError = errors.length > 0
        ? `Failed to store images. Errors: ${errors.join('; ')}`
        : 'Failed to download and store any images using training pattern'

      console.error(`❌ [STORAGE_SIMPLE] Failed to store any images. Collected errors:`, errors)
      console.error(`❌ [STORAGE_SIMPLE] Generation ID: ${generationId}, User ID: ${userId}`)
      console.error(`❌ [STORAGE_SIMPLE] Temporary URLs attempted:`, temporaryUrls.map(url => url.substring(0, 100) + '...'))
      return {
        success: false,
        error: detailedError
      }
    }

    console.log(`🎉 [STORAGE_SIMPLE] SUCCESS! Stored ${permanentUrls.length}/${temporaryUrls.length} images using training pattern`)
    console.log(`📊 [STORAGE_SIMPLE] Permanent URLs:`, permanentUrls.map(url => url.substring(0, 100) + '...'))
    console.log(`🖼️ [STORAGE_SIMPLE] Thumbnail URLs: ${thumbnailUrls.length}/${permanentUrls.length} thumbnails generated`)

    // 🔒 CRITICAL: Verify thumbnail count matches image count
    if (thumbnailUrls.length !== permanentUrls.length) {
      console.error(`❌ [STORAGE_SIMPLE] CRITICAL: Thumbnail count mismatch!`)
      console.error(`❌ [STORAGE_SIMPLE] Expected ${permanentUrls.length} thumbnails, got ${thumbnailUrls.length}`)
      console.error(`❌ [STORAGE_SIMPLE] Missing thumbnails will cause performance issues in gallery`)
    } else {
      console.log(`✅ [STORAGE_SIMPLE] All ${thumbnailUrls.length} thumbnails generated successfully`)
    }

    // 🔒 CRITICAL: Ensure thumbnailUrls array is always returned (even if empty)
    // This allows the webhook to detect when thumbnails are missing and generate them
    return {
      success: true,
      permanentUrls,
      thumbnailUrls: thumbnailUrls.length > 0 ? thumbnailUrls : [] // Always return array (empty if no thumbnails)
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
 * 🎯 OPTIMIZED: Uses JPEG instead of PNG for better compression and smaller file size
 */
export async function generateThumbnailBuffer(
  imageBuffer: Buffer,
  maxWidth: number = 300,
  maxHeight: number = 300,
  quality: number = 80 // Default 80 for thumbnails (smaller file size)
): Promise<Buffer> {
  try {
    return await sharp(imageBuffer)
      .resize(maxWidth, maxHeight, {
        fit: 'cover', // Use 'cover' instead of 'inside' for consistent thumbnail sizes
        position: 'center', // Center crop for better thumbnails
        withoutEnlargement: true
      })
      .jpeg({ 
        quality,
        progressive: true,
        mozjpeg: true // Better compression
      })
      .toBuffer()
  } catch (error) {
    console.error('❌ Error generating thumbnail:', error)
    // Fallback: try to resize original buffer as JPEG
    try {
      return await sharp(imageBuffer)
        .resize(maxWidth, maxHeight, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 70 }) // Lower quality as last resort
        .toBuffer()
    } catch (fallbackError) {
      console.error('❌ Fallback thumbnail generation also failed:', fallbackError)
      // Last resort: return original buffer (not ideal, but better than failing)
      return imageBuffer
    }
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
): Promise<{ 
  success: boolean
  error?: string
  videoUrl?: string
  thumbnailUrl?: string
  storageKey?: string
  sizeBytes?: number
  mimeType?: string
}> {
  try {
    const storage = getStorageProvider()

    console.log(`📥 [DOWNLOAD_VIDEO] Starting download for generation ${videoGenId}`)
    console.log(`📥 [DOWNLOAD_VIDEO] Video URL: ${videoUrl.substring(0, 100)}...`)

    // Download the video with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minute timeout for videos

    let response
    try {
      response = await fetch(videoUrl, {
        headers: {
          'User-Agent': 'VibePhoto/1.0',
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)
    } catch (fetchError) {
      clearTimeout(timeoutId)
      const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError)
      console.error(`❌ [DOWNLOAD_VIDEO] Fetch failed: ${errorMsg}`)
      throw new Error(`Failed to fetch video: ${errorMsg}`)
    }

    if (!response.ok) {
      const errorMsg = `HTTP ${response.status}: ${response.statusText}`
      console.error(`❌ [DOWNLOAD_VIDEO] Download failed: ${errorMsg}`)
      throw new Error(`Failed to download video: ${errorMsg}`)
    }

    console.log(`✅ [DOWNLOAD_VIDEO] Download successful (${response.status}), content-type: ${response.headers.get('content-type')}`)

    let videoBuffer
    try {
      videoBuffer = Buffer.from(await response.arrayBuffer())
      console.log(`✅ [DOWNLOAD_VIDEO] Buffer created, size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`)
    } catch (bufferError) {
      const errorMsg = bufferError instanceof Error ? bufferError.message : String(bufferError)
      console.error(`❌ [DOWNLOAD_VIDEO] Failed to create buffer: ${errorMsg}`)
      throw new Error(`Failed to process video data: ${errorMsg}`)
    }

    const contentType = response.headers.get('content-type') || 'video/mp4'

    // Ensure we're working with a video content type
    if (!contentType.startsWith('video/')) {
      console.warn(`⚠️ [DOWNLOAD_VIDEO] Unexpected content type: ${contentType}, forcing to video/mp4`)
    }

    // Use new standardized structure: generated/{userId}/videos/uniqueFilename.mp4
    const videoFilename = `${videoGenId}_${generateUniqueFilename('mp4')}`
    const videoKey = buildS3Key(userId, 'videos', videoFilename)

    // Upload video using standardized method
    console.log(`☁️ [UPLOAD_VIDEO] Uploading to ${videoKey}`)
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

    if (!uploadResult || !uploadResult.url) {
      throw new Error('Upload failed: No URL returned from storage provider')
    }

    console.log(`✅ [UPLOAD_VIDEO] Video uploaded successfully: ${uploadResult.url.substring(0, 100)}...`)

    return {
      success: true,
      videoUrl: uploadResult.url,
      storageKey: uploadResult.key,
      sizeBytes: videoBuffer.length,
      mimeType: contentType
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('❌ [DOWNLOAD_AND_STORE_VIDEO] Critical error:', errorMsg)
    console.error('❌ [DOWNLOAD_AND_STORE_VIDEO] Error details:', {
      videoUrl: videoUrl?.substring(0, 100) + '...',
      videoGenId,
      userId,
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined
    })
    
    return {
      success: false,
      error: errorMsg
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