import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { downloadAndStoreImages } from '@/lib/storage/utils'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Debug: Manual Astria processing triggered')

    const generationId = 'cmfpl14nh0001qjrkatjwygx8'
    const astriaImageUrl = 'https://mp.astria.ai/ppt55zowtbzd9yck5gqhtye6jump'

    // Get the generation
    const generation = await prisma.generation.findUnique({
      where: { id: generationId }
    })

    if (!generation) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 })
    }

    console.log('📝 Found generation:', {
      id: generation.id,
      status: generation.status,
      jobId: generation.jobId,
      currentImages: generation.imageUrls?.length || 0,
      userId: generation.userId
    })

    // Test downloading and storing the image
    console.log('⬇️ Starting image download and S3 upload...')

    const storageResult = await downloadAndStoreImages(
      [astriaImageUrl],
      generation.id,
      generation.userId
    )

    if (storageResult.success && storageResult.permanentUrls && storageResult.permanentUrls.length > 0) {
      console.log('✅ S3 upload successful, updating database...')

      // Update generation with permanent URLs
      const updatedGeneration = await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'COMPLETED',
          imageUrls: storageResult.permanentUrls,
          thumbnailUrls: storageResult.thumbnailUrls || storageResult.permanentUrls,
          completedAt: new Date()
        }
      })

      console.log('✅ Database updated successfully!')

      return NextResponse.json({
        success: true,
        message: 'Astria image processed successfully',
        generation: {
          id: updatedGeneration.id,
          status: updatedGeneration.status,
          imageUrls: updatedGeneration.imageUrls,
          thumbnailUrls: updatedGeneration.thumbnailUrls
        }
      })
    } else {
      console.log('❌ S3 upload failed:', storageResult.error)
      return NextResponse.json({
        success: false,
        error: 'S3 upload failed',
        details: storageResult.error
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Debug processing error:', error)
    return NextResponse.json({
      success: false,
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}