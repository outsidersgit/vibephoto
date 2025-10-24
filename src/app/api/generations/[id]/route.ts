import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getGenerationById, updateGenerationStatus } from '@/lib/db/generations'
import { validateImageUrl } from '@/lib/storage/utils'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const generation = await getGenerationById(id, session.user.id)
    
    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      )
    }

    // Validate image URLs before returning
    const validImageUrls: string[] = []
    const validThumbnailUrls: string[] = []

    if (generation.imageUrls && Array.isArray(generation.imageUrls)) {
      for (let i = 0; i < generation.imageUrls.length; i++) {
        const imageUrl = generation.imageUrls[i]
        const thumbnailUrl = generation.thumbnailUrls?.[i] || imageUrl

        // Quick validation (timeout after 5 seconds)
        const imageValid = await validateImageUrl(imageUrl)
        if (imageValid) {
          validImageUrls.push(imageUrl)
          validThumbnailUrls.push(thumbnailUrl)
        }
      }
      
      // If some URLs are expired, log it
      if (validImageUrls.length < generation.imageUrls.length) {
        console.warn(`Some image URLs expired for generation ${id}: ${generation.imageUrls.length} -> ${validImageUrls.length}`)
      }
    }

    return NextResponse.json({ 
      ...generation,
      imageUrls: validImageUrls,
      thumbnailUrls: validThumbnailUrls
    })

  } catch (error: any) {
    console.error('Error fetching generation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch generation' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { status, imageUrls, thumbnailUrls, errorMessage, processingTime } = body

    const { id } = await params
    
    // Verify user owns the generation
    const existingGeneration = await getGenerationById(id, session.user.id)
    if (!existingGeneration) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      )
    }

    const updatedGeneration = await updateGenerationStatus(
      id,
      status,
      imageUrls,
      thumbnailUrls,
      errorMessage,
      processingTime
    )

    return NextResponse.json({ 
      success: true,
      generation: updatedGeneration 
    })

  } catch (error: any) {
    console.error('Error updating generation:', error)
    return NextResponse.json(
      { error: 'Failed to update generation' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { action } = await request.json()
    const { id } = await params

    if (action !== 'refresh') {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    const generation = await prisma.generation.findFirst({
      where: {
        id,
        userId: session.user.id
      },
      include: {
        model: {
          select: { id: true, name: true, class: true }
        }
      }
    })

    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      )
    }

    // Validate and refresh URLs
    const validImageUrls: string[] = []
    const validThumbnailUrls: string[] = []

    if (generation.imageUrls && Array.isArray(generation.imageUrls)) {
      for (let i = 0; i < generation.imageUrls.length; i++) {
        const imageUrl = generation.imageUrls[i]
        const thumbnailUrl = generation.thumbnailUrls?.[i] || imageUrl

        const imageValid = await validateImageUrl(imageUrl)
        if (imageValid) {
          validImageUrls.push(imageUrl)
          validThumbnailUrls.push(thumbnailUrl)
        } else {
          // Try cache-busting
          const refreshedUrl = `${imageUrl}?t=${Date.now()}`
          const refreshedValid = await validateImageUrl(refreshedUrl)
          if (refreshedValid) {
            validImageUrls.push(refreshedUrl)
            validThumbnailUrls.push(refreshedUrl)
          }
        }
      }
    }

    // Update generation with validated URLs
    const updatedGeneration = await prisma.generation.update({
      where: { id },
      data: {
        imageUrls: validImageUrls,
        thumbnailUrls: validThumbnailUrls
      },
      include: {
        model: {
          select: { id: true, name: true, class: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      generation: updatedGeneration,
      urlsRefreshed: validImageUrls.length,
      totalUrls: generation.imageUrls?.length || 0
    })

  } catch (error: any) {
    console.error('Error refreshing generation URLs:', error)
    return NextResponse.json(
      { error: 'Failed to refresh generation URLs' },
      { status: 500 }
    )
  }
}