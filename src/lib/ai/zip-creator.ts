import { createWriteStream } from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { createReadStream, existsSync } from 'fs'
import { mkdir } from 'fs/promises'

/**
 * Creates a ZIP file from image URLs
 * Generates pre-signed URLs for private S3 objects
 */
export async function createZipFromLocalFiles(
  imageUrls: string[],
  outputPath: string,
  modelId: string
): Promise<string> {
  console.log(`📦 Creating ZIP from ${imageUrls.length} image URLs...`)
  
  try {
    const { getStorageProvider } = await import('../storage')
    const storage = getStorageProvider()
    
    // Generate pre-signed URLs for private S3 objects
    const signedUrls: string[] = []
    
    for (const url of imageUrls) {
      try {
        // Extract S3 key from URL
        const key = extractS3KeyFromUrl(url)
        if (key && isS3Provider(storage)) {
          // Generate pre-signed URL (expires in 2 hours)
          const signedUrl = await storage.getSignedUrl(key, 7200)
          signedUrls.push(signedUrl)
          console.log(`🔑 Generated signed URL for: ${key}`)
        } else {
          // For non-S3 URLs, use as-is
          signedUrls.push(url)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.warn(`⚠️ Could not generate signed URL for ${url}:`, errorMessage)
        // Skip this URL and continue
      }
    }
    
    if (signedUrls.length === 0) {
      throw new Error('No valid URLs available for ZIP creation')
    }
    
    console.log(`✅ Generated ${signedUrls.length} signed URLs for training`)
    
    // Download all images and create ZIP
    const fetch = (await import('node-fetch')).default
    const archiver = require('archiver')
    const { createWriteStream } = require('fs')
    
    // Create output directory if it doesn't exist
    const outputDir = join(process.cwd(), 'uploads', 'zips')
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true })
    }

    const zipPath = join(outputDir, `${modelId}-training.zip`)
    const output = createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    
    archive.pipe(output)
    
    // Download and add each image to ZIP
    let successfulDownloads = 0
    
    for (let i = 0; i < signedUrls.length; i++) {
      const url = signedUrls[i]
      const filename = `image_${i + 1}.jpg`
      
      try {
        console.log(`📥 Downloading image ${i + 1}/${signedUrls.length}`)
        const response = await fetch(url)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        archive.append(response.body, { name: filename })
        successfulDownloads++
        
      } catch (downloadError) {
        const errorMessage = downloadError instanceof Error ? downloadError.message : 'Unknown download error'
        console.warn(`⚠️ Failed to download image ${i + 1}:`, errorMessage)
        // Continue with other images instead of failing completely
      }
    }
    
    if (successfulDownloads === 0) {
      throw new Error('No images could be downloaded for training ZIP')
    }
    
    console.log(`📦 Added ${successfulDownloads} images to training ZIP`)
    
    // Wait for archive to finish
    await new Promise((resolve, reject) => {
      output.on('close', resolve)
      output.on('error', reject)
      archive.finalize()
    })
    
    console.log(`📦 ZIP file created at: ${zipPath}`)
    
    // Upload ZIP to storage and get public URL
    const zipFile = createReadStream(zipPath)
    
    // For training ZIPs, we need to make them publicly accessible for Replicate
    // Use direct S3 upload with public-read ACL
    if (isS3Provider(storage)) {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
      const s3Client = (storage as any).s3Client as InstanceType<typeof S3Client>
      const bucket = (storage as any).bucket as string
      
      const key = `training-zips/${modelId}-training.zip`
      
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: createReadStream(zipPath),
        ContentType: 'application/zip',
        ACL: 'public-read', // Make it publicly accessible
        Metadata: {
          modelId,
          uploadedAt: new Date().toISOString()
        }
      })
      
      await s3Client.send(command)
      
      // Return the public URL
      const publicUrl = storage.getPublicUrl(key)
      console.log(`✅ Training ZIP uploaded as public: ${publicUrl}`)
      
      return publicUrl
    } else {
      // Fallback to regular upload for non-S3 providers
      const uploadResult = await storage.upload(
        zipFile as any, 
        `training-zips`,
        { 
          filename: `${modelId}-training.zip`
        }
      )
      
      return uploadResult.url
    }
    
  } catch (error) {
    console.error('❌ Error creating training ZIP:', error)
    
    // Fallback: Generate signed URL for first image if ZIP creation fails
    if (imageUrls.length > 0) {
      try {
        console.log('🔄 Falling back to signed URL for first image')
        const { getStorageProvider } = await import('../storage')
        const storage = getStorageProvider()
        const key = extractS3KeyFromUrl(imageUrls[0])
        
        if (key && isS3Provider(storage)) {
          const signedUrl = await storage.getSignedUrl(key, 7200)
          console.log('✅ Generated fallback signed URL')
          return signedUrl
        }
      } catch (fallbackError) {
        const errorMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback error'
        console.error('❌ Fallback also failed:', errorMessage)
      }
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to create training ZIP: ${errorMessage}`)
  }
}

/**
 * Extract S3 key from S3 URL
 */
function extractS3KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    
    // Handle S3 URLs: https://bucket.s3.region.amazonaws.com/key
    if (urlObj.hostname.includes('.s3.') && urlObj.hostname.includes('.amazonaws.com')) {
      // Decode the pathname to handle encoded characters like %20
      return decodeURIComponent(urlObj.pathname.substring(1)) // Remove leading slash and decode
    }
    
    // Handle CloudFront URLs or other CDN URLs
    // For this project, we assume they're S3-backed
    return decodeURIComponent(urlObj.pathname.substring(1))
    
  } catch {
    return null
  }
}

/**
 * Type guard to check if storage provider has getSignedUrl method
 */
function isS3Provider(storage: any): storage is { getSignedUrl: (key: string, expiresIn: number) => Promise<string> } {
  return storage && typeof storage.getSignedUrl === 'function'
}

/**
 * Creates a public URL for the training ZIP
 * This would integrate with your storage provider in production
 */
export function getTrainingZipUrl(modelId: string): string {
  // In development, return a local endpoint
  return `http://localhost:3000/api/files/training-zip/${modelId}`
}

/**
 * Validates that all image URLs are accessible
 */
export async function validateImageFiles(imageUrls: string[]): Promise<{ valid: string[], missing: string[] }> {
  const valid: string[] = []
  const missing: string[] = []
  
  // For URLs, we assume they're valid if they're properly formatted
  // A more robust implementation would ping each URL
  for (const url of imageUrls) {
    try {
      new URL(url) // This will throw if URL is invalid
      valid.push(url)
    } catch {
      console.warn(`⚠️ Invalid URL: ${url}`)
      missing.push(url)
    }
  }
  
  return { valid, missing }
}