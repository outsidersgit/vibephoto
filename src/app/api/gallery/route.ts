import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface GalleryItem {
  id: string
  type: 'image' | 'video'
  prompt: string
  status: string
  createdAt: Date
  completedAt: Date | null
  processingTime?: number
  errorMessage?: string
  
  // Media URLs (may be temporary or permanent)
  urls: string[]
  thumbnailUrls: string[]
  
  // Storage metadata
  storageProvider?: string
  publicUrl?: string
  
  // Model information
  model?: {
    id: string
    name: string
  }
  
  // Video-specific fields
  duration?: number
  
  // Processing metadata
  metadata?: any
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') // 'COMPLETED', 'PROCESSING', 'FAILED'
    const type = searchParams.get('type') // 'image', 'video', 'all'
    const modelId = searchParams.get('modelId')
    
    const offset = (page - 1) * limit

    // Build where conditions
    const baseWhere = {
      userId: session.user.id,
      ...(status && { status }),
      ...(modelId && { modelId })
    }

    let galleryItems: GalleryItem[] = []

    // Fetch images if requested
    if (!type || type === 'all' || type === 'image') {
      const generations = await prisma.generation.findMany({
        where: baseWhere,
        include: {
          model: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: offset,
        take: limit
      })

      const imageItems: GalleryItem[] = generations.map(gen => ({
        id: gen.id,
        type: 'image' as const,
        prompt: gen.prompt,
        status: gen.status,
        createdAt: gen.createdAt,
        completedAt: gen.completedAt,
        processingTime: gen.processingTime || undefined,
        errorMessage: gen.errorMessage || undefined,
        urls: gen.imageUrls || [],
        thumbnailUrls: gen.thumbnailUrls || gen.imageUrls || [],
        storageProvider: gen.storageProvider || undefined,
        publicUrl: gen.publicUrl || undefined,
        model: gen.model ? {
          id: gen.model.id,
          name: gen.model.name
        } : undefined,
        metadata: gen.metadata || undefined
      }))

      galleryItems.push(...imageItems)
    }

    // Fetch videos if requested
    if (!type || type === 'all' || type === 'video') {
      const videoGenerations = await prisma.videoGeneration.findMany({
        where: baseWhere,
        include: {
          model: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: offset,
        take: limit
      })

      const videoItems: GalleryItem[] = await Promise.all(
        videoGenerations.map(async (video) => {
          let urls: string[] = []
          let thumbnailUrls: string[] = []

          // HYBRID APPROACH: Try Media API first if s3Key available, fallback to direct URLs
          const metadata = video.metadata as any
          const hasS3Key = metadata?.s3Key && video.status === 'COMPLETED'

          if (hasS3Key) {
            try {
              // Use Media API for signed URLs
              const mediaResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/media/${video.id}/url`, {
                headers: {
                  'Authorization': `Bearer ${session?.user?.id}` // Simple auth for internal calls
                }
              })

              if (mediaResponse.ok) {
                const mediaData = await mediaResponse.json()
                urls = mediaData.urls || []
                thumbnailUrls = mediaData.thumbnailUrls || []
                console.log(`📡 Gallery: Used Media API for video ${video.id}`)
              } else {
                throw new Error(`Media API failed: ${mediaResponse.status}`)
              }
            } catch (error) {
              console.warn(`⚠️ Media API failed for video ${video.id}, falling back to direct URLs:`, error)
              // Fallback to direct URLs
              urls = video.videoUrl ? [video.videoUrl] : []
              thumbnailUrls = video.thumbnailUrl ? [video.thumbnailUrl] : []
            }
          } else {
            // Use direct URLs from database (legacy or temporary)
            urls = video.videoUrl ? [video.videoUrl] : []
            thumbnailUrls = video.thumbnailUrl ? [video.thumbnailUrl] : []
          }

          return {
            id: video.id,
            type: 'video' as const,
            prompt: video.prompt,
            status: video.status,
            createdAt: video.createdAt,
            completedAt: video.completedAt,
            processingTime: video.processingTime || undefined,
            errorMessage: video.errorMessage || undefined,
            urls,
            thumbnailUrls,
            storageProvider: video.storageProvider || metadata?.storageProvider || 'unknown',
            publicUrl: video.publicUrl || undefined,
            duration: video.durationSec || undefined,
            model: video.model ? {
              id: video.model.id,
              name: video.model.name
            } : undefined,
            metadata: video.metadata || undefined
          }
        })
      )

      galleryItems.push(...videoItems)
    }

    // Sort by creation date (newest first)
    galleryItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // If we fetched both types, limit the results
    if (type === 'all' && galleryItems.length > limit) {
      galleryItems = galleryItems.slice(0, limit)
    }

    // Get total counts for pagination
    const [imageCount, videoCount] = await Promise.all([
      (!type || type === 'all' || type === 'image') 
        ? prisma.generation.count({ where: baseWhere })
        : 0,
      (!type || type === 'all' || type === 'video')
        ? prisma.videoGeneration.count({ where: baseWhere })
        : 0
    ])

    const totalCount = type === 'image' ? imageCount : 
                     type === 'video' ? videoCount : 
                     imageCount + videoCount

    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    // Calculate statistics
    const completedItems = galleryItems.filter(item => item.status === 'COMPLETED')
    const processingItems = galleryItems.filter(item => item.status === 'PROCESSING')
    const failedItems = galleryItems.filter(item => item.status === 'FAILED')

    return NextResponse.json({
      items: galleryItems,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage
      },
      statistics: {
        total: galleryItems.length,
        completed: completedItems.length,
        processing: processingItems.length,
        failed: failedItems.length,
        images: galleryItems.filter(item => item.type === 'image').length,
        videos: galleryItems.filter(item => item.type === 'video').length
      },
      filters: {
        status,
        type,
        modelId
      }
    })

  } catch (error) {
    console.error('Gallery API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch gallery items',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST endpoint to create new gallery items (if needed for collections later)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Placeholder for future collection/album creation functionality
    return NextResponse.json(
      { error: 'Collection creation not yet implemented' },
      { status: 501 }
    )

  } catch (error) {
    console.error('Gallery POST API error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}