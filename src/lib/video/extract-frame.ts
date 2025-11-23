import { getStorageProvider } from '../storage/utils'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface FrameExtractionResult {
  success: boolean
  thumbnailUrl?: string
  error?: string
}

/**
 * Extract first frame from video URL and upload as thumbnail
 * This is a server-side solution that works in most Node.js environments
 */
export async function extractFirstFrame(
  videoUrl: string,
  videoGenId: string,
  userId: string
): Promise<FrameExtractionResult> {
  let tempVideoPath: string | null = null
  let tempFramePath: string | null = null

  try {
    console.log(`🎬 [FRAME_EXTRACT] Starting frame extraction for video ${videoGenId}`)

    // Step 1: Download video to temporary file
    console.log(`📥 [FRAME_EXTRACT] Downloading video from ${videoUrl.substring(0, 100)}...`)
    tempVideoPath = await downloadVideoToTemp(videoUrl, videoGenId)
    console.log(`✅ [FRAME_EXTRACT] Video downloaded to ${tempVideoPath}`)

    // Step 2: Extract first frame using FFmpeg (if available)
    console.log(`🎞️ [FRAME_EXTRACT] Extracting first frame...`)
    tempFramePath = await extractFrameWithFFmpeg(tempVideoPath, videoGenId)
    
    if (!tempFramePath) {
      throw new Error('Could not extract frame - FFmpeg not available or extraction failed')
    }

    console.log(`✅ [FRAME_EXTRACT] Frame extracted to ${tempFramePath}`)

    // Step 3: Compress and optimize frame before upload
    console.log(`🗜️ [FRAME_EXTRACT] Compressing thumbnail...`)
    const frameBuffer = await fs.readFile(tempFramePath)
    
    // 🚀 OTIMIZAÇÃO: Comprimir thumbnail para ~50-100 KB
    const sharp = require('sharp')
    const optimizedThumbnail = await sharp(frameBuffer)
      .resize(640, 360, {
        fit: 'cover',
        position: 'center',
        withoutEnlargement: true
      })
      .jpeg({
        quality: 75,
        progressive: true,
        mozjpeg: true
      })
      .toBuffer()

    const compressionRatio = ((1 - (optimizedThumbnail.length / frameBuffer.length)) * 100).toFixed(1)
    console.log(`✅ [FRAME_EXTRACT] Thumbnail compressed: ${(frameBuffer.length / 1024).toFixed(0)} KB → ${(optimizedThumbnail.length / 1024).toFixed(0)} KB (${compressionRatio}% reduction)`)
    
    // Step 4: Upload optimized frame to storage
    console.log(`☁️ [FRAME_EXTRACT] Uploading thumbnail to storage...`)
    const storage = getStorageProvider()

    let uploadResult
    if (storage.uploadStandardized) {
      uploadResult = await storage.uploadStandardized(
        optimizedThumbnail,
        userId,
        'videos',
        {
          filename: `${videoGenId}_thumbnail.jpg`,
          makePublic: true,
          isVideo: false
        }
      )
    } else {
      const thumbnailKey = `generated/${userId}/videos/${videoGenId}_thumbnail.jpg`
      uploadResult = await storage.upload(
        optimizedThumbnail,
        thumbnailKey,
        {
          filename: `${videoGenId}_thumbnail.jpg`,
          makePublic: true
        }
      )
    }

    console.log(`✅ [FRAME_EXTRACT] Thumbnail uploaded: ${uploadResult.url}`)

    return {
      success: true,
      thumbnailUrl: uploadResult.url
    }

  } catch (error) {
    console.error('❌ [FRAME_EXTRACT] Error extracting frame:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  } finally {
    // Cleanup temporary files
    try {
      if (tempVideoPath) {
        await fs.unlink(tempVideoPath)
        console.log(`🗑️ [FRAME_EXTRACT] Cleaned up video: ${tempVideoPath}`)
      }
      if (tempFramePath) {
        await fs.unlink(tempFramePath)
        console.log(`🗑️ [FRAME_EXTRACT] Cleaned up frame: ${tempFramePath}`)
      }
    } catch (cleanupError) {
      console.warn('⚠️ [FRAME_EXTRACT] Error cleaning up temporary files:', cleanupError)
    }
  }
}

/**
 * Download video to temporary file
 */
async function downloadVideoToTemp(videoUrl: string, videoGenId: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minute timeout

  try {
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'VibePhoto/1.0'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`)
    }

    const videoBuffer = Buffer.from(await response.arrayBuffer())
    
    // Save to temporary file
    const tempDir = os.tmpdir()
    const tempVideoPath = path.join(tempDir, `video_${videoGenId}_${Date.now()}.mp4`)
    await fs.writeFile(tempVideoPath, videoBuffer)

    return tempVideoPath

  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Extract frame using FFmpeg
 */
async function extractFrameWithFFmpeg(videoPath: string, videoGenId: string): Promise<string | null> {
  try {
    // Check if FFmpeg is available
    try {
      await execAsync('ffmpeg -version')
    } catch {
      console.warn('⚠️ [FRAME_EXTRACT] FFmpeg not available in this environment')
      return null
    }

    const tempDir = os.tmpdir()
    const framePath = path.join(tempDir, `frame_${videoGenId}_${Date.now()}.jpg`)

    // Extract first frame at 0.1 seconds (skip black frames at start)
    // -ss 0.1: seek to 0.1 seconds
    // -i: input file
    // -vframes 1: extract only 1 frame
    // -q:v 2: high quality (2 is very high, scale is 2-31)
    const command = `ffmpeg -ss 0.1 -i "${videoPath}" -vframes 1 -q:v 2 "${framePath}"`
    
    console.log(`🎬 [FRAME_EXTRACT] Running FFmpeg command: ${command}`)
    await execAsync(command)

    // Verify file was created
    try {
      await fs.access(framePath)
      return framePath
    } catch {
      console.error('❌ [FRAME_EXTRACT] Frame file was not created')
      return null
    }

  } catch (error) {
    console.error('❌ [FRAME_EXTRACT] FFmpeg extraction failed:', error)
    return null
  }
}

