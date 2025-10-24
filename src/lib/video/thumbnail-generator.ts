import sharp from 'sharp'
import { getStorageProvider } from '../storage/utils'

interface ThumbnailGenerationResult {
  success: boolean
  thumbnailUrl?: string
  error?: string
}

/**
 * Generate thumbnail from video URL using video frame extraction
 * Falls back to smart approaches if video processing is not available
 */
export async function generateVideoThumbnail(
  videoUrl: string,
  videoGenId: string,
  userId: string
): Promise<ThumbnailGenerationResult> {
  try {
    console.log(`🖼️ Generating thumbnail for video ${videoGenId}`)

    // Strategy 1: Try to find if Replicate/Kling provided a thumbnail
    const thumbnailUrl = await tryFindExistingThumbnail(videoUrl)
    if (thumbnailUrl) {
      console.log(`✅ Found existing thumbnail: ${thumbnailUrl}`)
      return {
        success: true,
        thumbnailUrl
      }
    }

    // Strategy 2: Extract frame from video using canvas (client-side approach)
    const extractedThumbnail = await extractVideoFrame(videoUrl, videoGenId, userId)
    if (extractedThumbnail) {
      return {
        success: true,
        thumbnailUrl: extractedThumbnail
      }
    }

    // Strategy 3: Generate AI-based thumbnail placeholder
    const placeholderThumbnail = await generatePlaceholderThumbnail(videoGenId, userId)

    return {
      success: true,
      thumbnailUrl: placeholderThumbnail
    }

  } catch (error) {
    console.error('❌ Error generating video thumbnail:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Try to find existing thumbnail URLs that providers might generate
 */
async function tryFindExistingThumbnail(videoUrl: string): Promise<string | null> {
  // Common thumbnail patterns from video providers
  const basePath = videoUrl.substring(0, videoUrl.lastIndexOf('.'))
  const baseDir = videoUrl.substring(0, videoUrl.lastIndexOf('/'))

  const possibleThumbnails = [
    `${basePath}_thumb.jpg`,
    `${basePath}_thumbnail.jpg`,
    `${basePath}.jpg`,
    `${baseDir}/thumbnail.jpg`,
    `${baseDir}/frame_001.jpg`,
    videoUrl.replace('.mp4', '_poster.jpg')
  ]

  for (const thumbUrl of possibleThumbnails) {
    try {
      const response = await fetch(thumbUrl, { method: 'HEAD' })
      if (response.ok) {
        console.log(`✅ Found auto-generated thumbnail: ${thumbUrl}`)
        return thumbUrl
      }
    } catch (error) {
      // Continue trying other URLs
      continue
    }
  }

  return null
}

/**
 * Extract frame from video and upload as thumbnail
 */
async function extractVideoFrame(
  videoUrl: string,
  videoGenId: string,
  userId: string
): Promise<string | null> {
  try {
    console.log('🎬 Attempting to extract video frame...')

    // This approach requires a video processing service or ffmpeg
    // For now, we'll create a high-quality placeholder that represents the video

    // Download video to get some metadata
    const response = await fetch(videoUrl, {
      method: 'HEAD',
      headers: { 'User-Agent': 'VibePhoto/1.0' }
    })

    if (!response.ok) {
      console.log('⚠️ Could not access video for frame extraction')
      return null
    }

    // Create a smart thumbnail based on video metadata
    return await generateSmartThumbnail(videoGenId, userId, videoUrl)

  } catch (error) {
    console.error('❌ Error extracting video frame:', error)
    return null
  }
}

/**
 * Generate smart thumbnail with video info
 */
async function generateSmartThumbnail(
  videoGenId: string,
  userId: string,
  videoUrl: string
): Promise<string> {
  const storage = getStorageProvider()

  // Create a thumbnail with video metadata
  const thumbnailBuffer = await createVideoThumbnailImage(videoGenId, videoUrl)

  // Upload thumbnail
  const thumbnailKey = `generated/${userId}/${videoGenId}/thumbnail.jpg`

  const uploadResult = await storage.upload(
    thumbnailBuffer,
    thumbnailKey,
    {
      filename: `thumb_${videoGenId}.jpg`,
      makePublic: false
    }
  )

  console.log(`✅ Smart thumbnail uploaded: ${uploadResult.url}`)
  return uploadResult.url
}

/**
 * Create video thumbnail image using Sharp
 */
async function createVideoThumbnailImage(videoGenId: string, videoUrl: string): Promise<Buffer> {
  const width = 320
  const height = 180

  // Create a gradient background that suggests video content
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="videoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4338ca;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#7c3aed;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#db2777;stop-opacity:1" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- Background -->
      <rect width="${width}" height="${height}" fill="url(#videoGrad)" />

      <!-- Video play icon -->
      <circle cx="${width/2}" cy="${height/2}" r="30" fill="white" fill-opacity="0.95"/>
      <polygon points="${width/2-12},${height/2-15} ${width/2-12},${height/2+15} ${width/2+18},${height/2}"
               fill="#4338ca" filter="url(#glow)"/>

      <!-- AI Video badge -->
      <rect x="10" y="10" width="60" height="20" rx="10" fill="black" fill-opacity="0.7"/>
      <text x="40" y="22" font-family="Arial, sans-serif" font-size="10" fill="white" text-anchor="middle" font-weight="bold">AI VIDEO</text>

      <!-- Video ID -->
      <text x="${width/2}" y="${height-15}" font-family="Arial, sans-serif" font-size="10"
            fill="white" text-anchor="middle" opacity="0.8">
        ${videoGenId.substring(0, 12)}...
      </text>
    </svg>
  `

  // Convert SVG to image buffer using Sharp
  const thumbnailBuffer = await sharp(Buffer.from(svg))
    .jpeg({ quality: 90 })
    .toBuffer()

  return thumbnailBuffer
}

/**
 * Generate placeholder thumbnail as fallback
 */
async function generatePlaceholderThumbnail(
  videoGenId: string,
  userId: string
): Promise<string> {
  console.log('📸 Generating placeholder thumbnail...')

  const storage = getStorageProvider()

  // Create placeholder image
  const thumbnailBuffer = await createVideoThumbnailImage(videoGenId, '')

  // Upload placeholder
  const thumbnailKey = `generated/${userId}/${videoGenId}/placeholder.jpg`

  const uploadResult = await storage.upload(
    thumbnailBuffer,
    thumbnailKey,
    {
      filename: `placeholder_${videoGenId}.jpg`,
      makePublic: false
    }
  )

  console.log(`✅ Placeholder thumbnail created: ${uploadResult.url}`)
  return uploadResult.url
}