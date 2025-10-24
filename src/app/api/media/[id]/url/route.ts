import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStorageProvider } from '@/lib/storage/utils'
import { parseStorageKey, isConsistentKey, convertLegacyKey, buildKey } from '@/lib/storage/path-utils'
import { getSignedUrlS3 } from '@/lib/storage/s3-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check for session or simple internal auth for gallery API calls
    const session = await getServerSession(authOptions)
    const authHeader = request.headers.get('Authorization')
    const internalAuth = authHeader?.startsWith('Bearer ') && authHeader.split(' ')[1]

    if (!session?.user && !internalAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session?.user?.id || internalAuth

    const mediaId = params.id
    
    // First, try to find as a generation
    let mediaItem = await prisma.generation.findUnique({
      where: { id: mediaId },
      select: {
        id: true,
        userId: true,
        imageUrls: true,
        thumbnailUrls: true,
        status: true,
        metadata: true // Include metadata to access s3_keys
      }
    })

    let isVideo = false
    
    // If not found, try as video generation
    if (!mediaItem) {
      const videoItem = await prisma.videoGeneration.findUnique({
        where: { id: mediaId },
        select: {
          id: true,
          userId: true,
          videoUrl: true,
          thumbnailUrl: true,
          status: true,
          metadata: true // Include metadata to access s3_key
        }
      })
      
      if (videoItem) {
        // Map video structure to media structure
        mediaItem = {
          id: videoItem.id,
          userId: videoItem.userId,
          imageUrls: videoItem.videoUrl ? [videoItem.videoUrl] : [],
          thumbnailUrls: videoItem.thumbnailUrl ? [videoItem.thumbnailUrl] : [],
          status: videoItem.status,
          metadata: videoItem.metadata
        }
        isVideo = true
      }
    }

    if (!mediaItem) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 })
    }

    // Check if user owns this media
    if (mediaItem.userId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if media is ready
    if (mediaItem.status !== 'COMPLETED') {
      return NextResponse.json({ 
        error: 'Media not ready',
        status: mediaItem.status 
      }, { status: 422 })
    }

    // Generate signed URLs from s3_keys stored in metadata
    try {
      const storage = getStorageProvider()
      let signedUrls: string[] = []
      let thumbnailUrls: string[] = []

      // Check for s3_keys in metadata
      const metadata = mediaItem.metadata as any

      if (isVideo && metadata?.s3Key) {
        // Handle single video file
        const signedUrl = await storage.getSignedUrl(metadata.s3Key, 3600) // 1 hour expiry
        signedUrls = [signedUrl]

        // Generate thumbnail signed URL if available
        const thumbnailKey = metadata.s3Key.replace('.mp4', '_thumb.jpg')
        try {
          const thumbnailSignedUrl = await storage.getSignedUrl(thumbnailKey, 3600)
          thumbnailUrls = [thumbnailSignedUrl]
        } catch {
          // Thumbnail might not exist, try poster from images folder
          const posterKey = `generated/${userId}/${mediaItem.id}/poster.jpg`
          try {
            const posterSignedUrl = await storage.getSignedUrl(posterKey, 3600)
            thumbnailUrls = [posterSignedUrl]
          } catch {
            // No thumbnail available - this is expected for many videos
            console.log(`No thumbnail found for video ${mediaItem.id}`)
          }
        }

      } else if (!isVideo && metadata?.s3Keys && Array.isArray(metadata.s3Keys)) {
        // Handle multiple image files
        for (const s3Key of metadata.s3Keys) {
          try {
            const signedUrl = await storage.getSignedUrl(s3Key, 3600) // 1 hour expiry
            signedUrls.push(signedUrl)

            // Generate thumbnail signed URL
            const thumbnailKey = s3Key.replace(/\.([^.]+)$/, '_thumb.$1')
            try {
              const thumbnailSignedUrl = await storage.getSignedUrl(thumbnailKey, 3600)
              thumbnailUrls.push(thumbnailSignedUrl)
            } catch {
              // Use main image as thumbnail fallback
              thumbnailUrls.push(signedUrl)
            }
          } catch (error) {
            console.warn(`Failed to generate signed URL for s3Key ${s3Key}:`, error)
          }
        }
      }

      // If we successfully generated signed URLs, return them
      if (signedUrls.length > 0) {
        return NextResponse.json({
          id: mediaItem.id,
          urls: signedUrls,
          thumbnailUrls: thumbnailUrls.length > 0 ? thumbnailUrls : signedUrls,
          isVideo,
          source: 'signed_urls',
          storageProvider: metadata?.storageProvider || 'aws'
        })
      }

    } catch (error) {
      console.error('Failed to generate signed URLs:', error)
    }

    // Fallback: check for temporary URLs in metadata or direct URLs
    const metadata = mediaItem.metadata as any

    // Check for temporary URLs first (from storage failures)
    if (metadata?.temporaryUrls && Array.isArray(metadata.temporaryUrls)) {
      return NextResponse.json({
        id: mediaItem.id,
        urls: metadata.temporaryUrls,
        thumbnailUrls: metadata.temporaryUrls,
        isVideo,
        source: 'temporary_urls',
        warning: 'These URLs may expire soon due to storage error'
      })
    }

    if (isVideo && metadata?.temporaryVideoUrl) {
      return NextResponse.json({
        id: mediaItem.id,
        urls: [metadata.temporaryVideoUrl],
        thumbnailUrls: [],
        isVideo,
        source: 'temporary_url',
        warning: 'This URL may expire soon due to storage error'
      })
    }

    // Final fallback: return stored URLs directly (legacy support)
    if (mediaItem.imageUrls && mediaItem.imageUrls.length > 0) {
      return NextResponse.json({
        id: mediaItem.id,
        urls: mediaItem.imageUrls,
        thumbnailUrls: mediaItem.thumbnailUrls || mediaItem.imageUrls,
        isVideo,
        source: 'legacy_urls',
        storageProvider: 'legacy'
      })
    }

    // No URLs available
    return NextResponse.json({ 
      error: 'No media URLs available',
      id: mediaItem.id,
      status: mediaItem.status
    }, { status: 404 })

  } catch (error) {
    console.error('Media URL API error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve media URL' },
      { status: 500 }
    )
  }
}

// OPTIONS for CORS preflight if needed
export async function OPTIONS() {
  return NextResponse.json({}, { 
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}