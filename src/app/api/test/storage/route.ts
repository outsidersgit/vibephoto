import { NextRequest, NextResponse } from 'next/server'
import { downloadAndStoreImages, validateImageUrl } from '@/lib/storage/utils'
import { getStorageProvider } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    const { action, testUrls, generationId, userId } = await request.json()
    
    // Test image URLs (can be used for testing)
    const defaultTestUrls = [
      'https://replicate.delivery/pbxt/example1.png',
      'https://replicate.delivery/pbxt/example2.png'
    ]
    
    const urlsToTest = testUrls || defaultTestUrls
    const testGenerationId = generationId || 'test-generation-123'
    const testUserId = userId || 'test-user-123'
    
    switch (action) {
      case 'validate-urls':
        console.log('🔍 Testing URL validation...')
        const validationResults = []
        
        for (const url of urlsToTest) {
          const isValid = await validateImageUrl(url)
          validationResults.push({ url, isValid })
          console.log(`${isValid ? '✅' : '❌'} ${url}`)
        }
        
        return NextResponse.json({
          success: true,
          action: 'validate-urls',
          results: validationResults
        })
        
      case 'test-storage-provider':
        console.log('🏪 Testing storage provider configuration...')
        const storage = getStorageProvider()
        
        return NextResponse.json({
          success: true,
          action: 'test-storage-provider',
          providerType: storage.constructor.name,
          config: {
            // Don't expose sensitive data in production
            provider: process.env.STORAGE_PROVIDER || 'local',
            hasAwsConfig: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
            hasCloudinaryConfig: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)
          }
        })
        
      case 'test-download-store':
        console.log('📥 Testing full download and store process...')
        
        // Only test with actual URLs that exist
        const testImageUrls = [
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop',
          'https://images.unsplash.com/photo-1494790108755-2616b95a25c5?w=300&h=300&fit=crop'
        ]
        
        const result = await downloadAndStoreImages(
          testImageUrls,
          testGenerationId,
          testUserId
        )
        
        return NextResponse.json({
          success: result.success,
          action: 'test-download-store',
          result,
          testedUrls: testImageUrls
        })
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: validate-urls, test-storage-provider, or test-download-store'
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Storage test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const info = searchParams.get('info')
  
  if (info === 'storage') {
    return NextResponse.json({
      success: true,
      storageConfig: {
        provider: process.env.STORAGE_PROVIDER || 'local',
        hasAwsConfig: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
        hasCloudinaryConfig: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY),
        awsRegion: process.env.AWS_REGION,
        awsBucket: process.env.AWS_S3_BUCKET,
        cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME
      }
    })
  }
  
  return NextResponse.json({
    success: true,
    message: 'Storage test endpoint',
    availableActions: [
      'POST /api/test/storage with action: validate-urls',
      'POST /api/test/storage with action: test-storage-provider', 
      'POST /api/test/storage with action: test-download-store',
      'GET /api/test/storage?info=storage'
    ]
  })
}