/**
 * FFmpeg frame extractor - loaded dynamically to avoid build issues
 * This file is only imported at runtime, never during build
 */

import ffmpeg from 'fluent-ffmpeg'
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getStorageProvider } from '../storage/utils'

/**
 * Extract a frame from video using ffmpeg
 */
export async function extractFrameFromVideo(
  videoUrl: string,
  videoGenId: string,
  userId: string
): Promise<string | null> {
  try {
    console.log('🎬 Extracting video frame using ffmpeg...')

    // Set ffmpeg path
    ffmpeg.setFfmpegPath(ffmpegPath)

    // Download video to temporary file
    const videoResponse = await fetch(videoUrl, {
      headers: { 'User-Agent': 'VibePhoto/1.0' }
    })

    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`)
    }

    // Create temporary files
    const tempDir = os.tmpdir()
    const tempVideoPath = path.join(tempDir, `video_${videoGenId}_${Date.now()}.mp4`)
    const tempThumbnailPath = path.join(tempDir, `thumb_${videoGenId}_${Date.now()}.jpg`)

    try {
      // Download video to temp file
      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer())
      await fs.promises.writeFile(tempVideoPath, videoBuffer)

      // Extract frame at 1 second
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tempVideoPath)
          .screenshots({
            timestamps: ['00:00:01'],
            filename: path.basename(tempThumbnailPath),
            folder: path.dirname(tempThumbnailPath),
            size: '640x360'
          })
          .on('end', () => {
            console.log('✅ Frame extracted successfully')
            resolve()
          })
          .on('error', (err: any) => {
            console.error('❌ FFmpeg error:', err)
            reject(err)
          })
      })

      // Read extracted thumbnail
      const thumbnailBuffer = await fs.promises.readFile(tempThumbnailPath)

      // Upload thumbnail
      const storage = getStorageProvider()
      const thumbnailKey = `generated/${userId}/videos/${videoGenId}_thumbnail.jpg`

      let uploadResult
      if (storage.uploadStandardized) {
        uploadResult = await storage.uploadStandardized(
          thumbnailBuffer,
          userId,
          'videos',
          {
            filename: `${videoGenId}_thumbnail.jpg`,
            makePublic: true,
            isVideo: false
          }
        )
      } else {
        uploadResult = await storage.upload(
          thumbnailBuffer,
          thumbnailKey,
          {
            filename: `thumb_${videoGenId}.jpg`,
            makePublic: true
          }
        )
      }

      console.log(`✅ Video frame extracted and uploaded: ${uploadResult.url}`)
      return uploadResult.url

    } finally {
      // Clean up temporary files
      try {
        await fs.promises.unlink(tempVideoPath).catch(() => {})
        await fs.promises.unlink(tempThumbnailPath).catch(() => {})
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup temp files:', cleanupError)
      }
    }

  } catch (error) {
    console.error('❌ Error extracting video frame:', error)
    throw error
  }
}

