import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing S3 upload functionality...')

    // Check environment variables
    const s3Config = {
      AWS_REGION: process.env.AWS_REGION,
      AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? '✅ SET' : '❌ NOT SET',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? '✅ SET' : '❌ NOT SET',
      STORAGE_PROVIDER: process.env.STORAGE_PROVIDER
    }

    console.log('S3 Config:', s3Config)

    // Test S3 connection by trying to upload a test file
    const { downloadAndStoreImages } = await import('@/lib/storage/utils')

    // Use a small test image URL from Astria
    const testImageUrl = 'https://mp.astria.ai/rxhduxk6yrsv268uslr5iw4qqdjc'
    const testGenerationId = 'test-' + Date.now()
    const testUserId = 'test-user'

    console.log('📤 Attempting test upload to S3...')

    const result = await downloadAndStoreImages(
      [testImageUrl],
      testGenerationId,
      testUserId
    )

    console.log('✅ Upload test completed:', result)

    return NextResponse.json({
      success: true,
      config: s3Config,
      uploadTest: result,
      diagnosis: {
        configOK: s3Config.AWS_ACCESS_KEY_ID === '✅ SET' && s3Config.AWS_SECRET_ACCESS_KEY === '✅ SET',
        uploadWorking: result.success,
        error: result.error || null
      }
    })
  } catch (error) {
    console.error('❌ S3 test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 })
  }
}
