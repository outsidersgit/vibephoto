import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email') || 'tainabuenojg@gmail.com'

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get the most recent generation with Astria URLs (failed storage)
    const recentGeneration = await prisma.generation.findFirst({
      where: {
        userId: user.id,
        status: 'COMPLETED',
        errorMessage: {
          contains: 'Storage failed'
        }
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        jobId: true,
        prompt: true,
        status: true,
        imageUrls: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
        processingTime: true
      }
    })

    if (!recentGeneration) {
      return NextResponse.json({
        message: 'No failed generations found with storage errors',
        suggestion: 'Make a new test generation to capture fresh logs'
      })
    }

    // Manual test: try to download and upload one of the Astria URLs
    const testUrl = recentGeneration.imageUrls?.[0] as string | undefined

    if (!testUrl) {
      return NextResponse.json({
        error: 'No image URLs found in generation'
      })
    }

    console.log('🧪 Testing manual download and upload for:', testUrl)

    let downloadTest
    try {
      const downloadResponse = await fetch(testUrl, {
        headers: {
          'User-Agent': 'VibePhoto/1.0',
          'Accept': 'image/*'
        }
      })

      downloadTest = {
        success: downloadResponse.ok,
        status: downloadResponse.status,
        size: downloadResponse.headers.get('content-length')
      }

      if (!downloadResponse.ok) {
        const errorText = await downloadResponse.text()
        downloadTest.error = errorText
      }
    } catch (error) {
      downloadTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Now try the actual storage function
    let storageTest
    try {
      console.log('📤 Testing storage function...')
      const { downloadAndStoreImages } = await import('@/lib/storage/utils')

      const result = await downloadAndStoreImages(
        [testUrl],
        recentGeneration.id,
        user.id
      )

      storageTest = {
        success: result.success,
        permanentUrls: result.permanentUrls,
        thumbnailUrls: result.thumbnailUrls,
        error: result.error
      }
    } catch (error) {
      storageTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorStack: error instanceof Error ? error.stack?.split('\n').slice(0, 10) : null
      }
    }

    return NextResponse.json({
      generation: {
        id: recentGeneration.id,
        jobId: recentGeneration.jobId,
        prompt: recentGeneration.prompt?.substring(0, 100),
        errorMessage: recentGeneration.errorMessage,
        imageUrl: testUrl,
        createdAt: recentGeneration.createdAt,
        processingTime: recentGeneration.processingTime
      },
      tests: {
        download: downloadTest,
        storage: storageTest
      },
      diagnosis: {
        downloadWorks: downloadTest.success,
        storageWorks: storageTest.success,
        issue: !storageTest.success ? storageTest.error : 'Storage working now! 🎉'
      },
      nextSteps: storageTest.success
        ? 'Storage is working now! Make a new generation to test end-to-end.'
        : 'Check the storage error above for the root cause.'
    })
  } catch (error) {
    console.error('❌ Debug test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : null
    }, { status: 500 })
  }
}
