import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const generationId = url.searchParams.get('id')

    if (!generationId) {
      return NextResponse.json({ error: 'Generation ID required' }, { status: 400 })
    }

    // Get generation data without authentication for debugging
    const generation = await prisma.generation.findUnique({
      where: { id: generationId }
    })

    if (!generation) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 })
    }

    // Check if it would appear in gallery queries
    const userId = generation.userId

    // Test gallery query for generated tab (non-package, completed)
    const galleryGeneratedCount = await prisma.generation.count({
      where: {
        userId,
        status: 'COMPLETED',
        packageId: null
      }
    })

    // Test gallery query for all completed
    const allCompletedCount = await prisma.generation.count({
      where: {
        userId,
        status: 'COMPLETED'
      }
    })

    // Check if this specific generation would be returned in gallery
    const wouldAppearInGallery = await prisma.generation.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        packageId: null
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    const isInTop20 = wouldAppearInGallery.some(g => g.id === generationId)
    const positionInGallery = wouldAppearInGallery.findIndex(g => g.id === generationId) + 1

    return NextResponse.json({
      generation: {
        id: generation.id,
        userId: generation.userId,
        status: generation.status,
        prompt: generation.prompt,
        imageUrls: generation.imageUrls,
        thumbnailUrls: generation.thumbnailUrls,
        packageId: generation.packageId,
        operationType: generation.operationType,
        storageContext: generation.storageContext,
        createdAt: generation.createdAt,
        completedAt: generation.completedAt
      },
      galleryVisibility: {
        meetsBasicCriteria: generation.status === 'COMPLETED' &&
                           generation.imageUrls &&
                           generation.imageUrls.length > 0,
        isPackageGeneration: generation.packageId !== null,
        shouldAppearInGeneratedTab: generation.status === 'COMPLETED' &&
                                  generation.packageId === null &&
                                  generation.imageUrls &&
                                  generation.imageUrls.length > 0,
        isInTop20Results: isInTop20,
        positionInGallery: positionInGallery || 'Not in top 20',
        totalUserGeneratedCompleted: galleryGeneratedCount,
        totalUserCompleted: allCompletedCount
      },
      debug: {
        timestamp: new Date().toISOString(),
        databaseConnection: 'OK'
      }
    })

  } catch (error) {
    console.error('Debug check generation error:', error)
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}