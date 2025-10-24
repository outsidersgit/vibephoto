import { NextRequest, NextResponse } from 'next/server'
import { getStorageProvider } from '@/lib/storage'
import { downloadAndStoreImages, validateImageUrl } from '@/lib/storage/utils'

export async function GET(request: NextRequest) {
  try {
    const storage = getStorageProvider()
    
    // Test basic storage configuration
    const healthCheck = {
      provider: process.env.STORAGE_PROVIDER || 'local',
      aws: {
        configured: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
        bucket: process.env.AWS_S3_BUCKET,
        region: process.env.AWS_REGION
      },
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      storage: healthCheck,
      message: 'Storage health check completed'
    })

  } catch (error) {
    console.error('Storage health check failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, testImageUrl, generationId, userId } = await request.json()

    if (action === 'test-download') {
      if (!testImageUrl) {
        return NextResponse.json({ error: 'testImageUrl required' }, { status: 400 })
      }

      // Test downloading and storing a single image
      const result = await downloadAndStoreImages(
        [testImageUrl],
        generationId || 'test-generation',
        userId || 'test-user'
      )

      return NextResponse.json({
        success: result.success,
        error: result.error,
        permanentUrls: result.permanentUrls,
        thumbnailUrls: result.thumbnailUrls,
        timestamp: new Date().toISOString()
      })
    }

    if (action === 'validate-url') {
      if (!testImageUrl) {
        return NextResponse.json({ error: 'testImageUrl required' }, { status: 400 })
      }

      const isValid = await validateImageUrl(testImageUrl)
      return NextResponse.json({
        url: testImageUrl,
        valid: isValid,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Storage test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}