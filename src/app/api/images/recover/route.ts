import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { processAndStoreReplicateImages } from '@/lib/services/auto-image-storage'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { generationId } = await request.json()
    
    if (!generationId) {
      return NextResponse.json({ error: 'generationId is required' }, { status: 400 })
    }

    // Find the generation
    const generation = await prisma.generation.findFirst({
      where: {
        id: generationId,
        userId: session.user.id // Ensure user owns this generation
      }
    })

    if (!generation) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 })
    }

    // Check if the current URLs are temporary and expired
    const imageUrls = generation.imageUrls as string[]
    if (!imageUrls || imageUrls.length === 0) {
      return NextResponse.json({ error: 'No images to recover' }, { status: 400 })
    }

    // Check if any URLs are temporary Replicate URLs
    const temporaryUrls = imageUrls.filter(url => 
      url.includes('replicate.delivery') || url.includes('pbxt.replicate.delivery')
    )

    if (temporaryUrls.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Images are already permanently stored',
        imageUrls 
      })
    }

    console.log(`🔄 Recovering ${temporaryUrls.length} expired images for generation ${generationId}`)

    try {
      // Try to re-download and store the temporary URLs
      const storageResults = await processAndStoreReplicateImages(
        temporaryUrls,
        generationId
      )

      if (storageResults.length > 0) {
        const permanentUrls = storageResults.map(r => r.url)
        
        // Update the generation with permanent URLs
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            imageUrls: permanentUrls,
            thumbnailUrls: permanentUrls, // Use same URLs for thumbnails
            metadata: {
              ...generation.metadata as any,
              recoveredAt: new Date().toISOString(),
              originalExpiredUrls: temporaryUrls
            }
          }
        })

        console.log(`✅ Successfully recovered ${permanentUrls.length} images`)
        
        return NextResponse.json({
          success: true,
          message: `Successfully recovered ${permanentUrls.length} images`,
          imageUrls: permanentUrls,
          recovered: true
        })
      } else {
        throw new Error('Failed to store recovered images')
      }
    } catch (storageError) {
      console.error(`❌ Failed to recover images:`, storageError)
      
      // Check if the temporary URLs are still accessible
      const accessibilityCheck = await Promise.all(
        temporaryUrls.map(async (url) => {
          try {
            const response = await fetch(url, { method: 'HEAD', timeout: 10000 })
            return { url, accessible: response.ok }
          } catch {
            return { url, accessible: false }
          }
        })
      )

      const accessibleUrls = accessibilityCheck.filter(check => check.accessible)
      
      if (accessibleUrls.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Images have expired and are no longer accessible',
          canRecover: false
        }, { status: 410 }) // 410 Gone
      } else {
        return NextResponse.json({
          success: false,
          error: `Recovery failed: ${storageError instanceof Error ? storageError.message : 'Unknown error'}`,
          canRecover: true,
          accessibleCount: accessibleUrls.length
        }, { status: 500 })
      }
    }

  } catch (error) {
    console.error('❌ Image recovery error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    endpoint: 'Image Recovery API',
    description: 'Recover expired temporary image URLs by re-downloading and storing permanently',
    methods: ['POST'],
    parameters: {
      generationId: 'String - ID of the generation to recover images for'
    },
    responses: {
      success: 'Images successfully recovered and stored permanently',
      expired: 'Images have expired and are no longer accessible (410 Gone)',
      error: 'Recovery failed but images may still be accessible'
    }
  })
}