import { NextRequest, NextResponse } from 'next/server'
import { getAutoImageStorage, processAndStoreReplicateImages } from '@/lib/services/auto-image-storage'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    // Verify this is an internal request or has proper authorization
    const headersList = headers()
    const authorization = headersList.get('authorization')
    const internalToken = process.env.INTERNAL_API_TOKEN
    
    if (internalToken && authorization !== `Bearer ${internalToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { urls, generationId, modelId, userId } = await req.json()

    // Validate required fields
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'URLs array is required and cannot be empty' },
        { status: 400 }
      )
    }

    if (!generationId) {
      return NextResponse.json(
        { error: 'Generation ID is required' },
        { status: 400 }
      )
    }

    console.log(`🚀 Auto-storage request for generation ${generationId}:`, {
      urlCount: urls.length,
      userId,
      modelId
    })

    // Process images and upload to S3
    const results = await processAndStoreReplicateImages(urls, generationId)

    // Update database with new permanent URLs if generation exists
    if (results.length > 0) {
      try {
        const permanentUrls = results.map(r => r.url)
        
        // Update generation record with permanent URLs
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            urls: permanentUrls,
            // Keep original Replicate URLs as backup
            metadata: {
              originalUrls: urls,
              s3Keys: results.map(r => r.key),
              processedAt: new Date().toISOString()
            }
          }
        })

        console.log(`✅ Updated generation ${generationId} with ${permanentUrls.length} permanent URLs`)
      } catch (dbError) {
        console.error('❌ Failed to update database:', dbError)
        // Don't fail the entire request if DB update fails
      }
    }

    // Validate stored images
    const storage = getAutoImageStorage()
    const validation = await storage.validateStoredImages(results.map(r => r.url))

    return NextResponse.json({
      success: true,
      processed: results.length,
      results: results.map(r => ({
        url: r.url,
        key: r.key,
        originalUrl: r.originalUrl
      })),
      validation: {
        valid: validation.valid.length,
        invalid: validation.invalid.length
      },
      message: `Successfully processed ${results.length} images`
    })

  } catch (error) {
    console.error('❌ Auto-storage API error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to process images'
    }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const generationId = searchParams.get('generationId')

    if (!generationId) {
      return NextResponse.json(
        { error: 'Generation ID is required' },
        { status: 400 }
      )
    }

    // Get generation data
    const generation = await prisma.generation.findUnique({
      where: { id: generationId },
      select: {
        id: true,
        urls: true,
        metadata: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      )
    }

    // Check if images are stored and accessible
    if (generation.urls && generation.urls.length > 0) {
      const storage = getAutoImageStorage()
      const validation = await storage.validateStoredImages(generation.urls)
      
      return NextResponse.json({
        generationId: generation.id,
        status: generation.status,
        urls: generation.urls,
        urlCount: generation.urls.length,
        metadata: generation.metadata,
        validation: {
          valid: validation.valid.length,
          invalid: validation.invalid.length,
          validUrls: validation.valid,
          invalidUrls: validation.invalid
        },
        createdAt: generation.createdAt,
        updatedAt: generation.updatedAt
      })
    }

    return NextResponse.json({
      generationId: generation.id,
      status: generation.status,
      urls: [],
      message: 'No stored URLs found'
    })

  } catch (error) {
    console.error('❌ Auto-storage GET error:', error)
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to retrieve generation data'
    }, { status: 500 })
  }
}