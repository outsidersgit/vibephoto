import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand, ListBucketsCommand } from '@aws-sdk/client-s3'

export async function GET(request: NextRequest) {
  try {
    const region = process.env.AWS_REGION
    const bucket = process.env.AWS_S3_BUCKET
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

    console.log('🧪 Testing direct AWS S3 connection...')
    console.log('Region:', region)
    console.log('Bucket:', bucket)
    console.log('Access Key ID:', accessKeyId ? `${accessKeyId.substring(0, 10)}...` : 'NOT SET')

    if (!accessKeyId || !secretAccessKey) {
      return NextResponse.json({
        success: false,
        error: 'AWS credentials not configured',
        config: {
          AWS_REGION: region,
          AWS_S3_BUCKET: bucket,
          AWS_ACCESS_KEY_ID: accessKeyId ? '✅ SET' : '❌ NOT SET',
          AWS_SECRET_ACCESS_KEY: secretAccessKey ? '✅ SET' : '❌ NOT SET'
        }
      })
    }

    // Create S3 client
    const s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    })

    // Test 1: List buckets (tests credentials)
    console.log('📋 Test 1: Listing buckets...')
    let bucketsTest
    try {
      const listCommand = new ListBucketsCommand({})
      const bucketsResponse = await s3Client.send(listCommand)
      bucketsTest = {
        success: true,
        bucketsFound: bucketsResponse.Buckets?.length || 0,
        buckets: bucketsResponse.Buckets?.map(b => b.Name) || []
      }
      console.log('✅ Buckets listed successfully:', bucketsTest.buckets)
    } catch (error) {
      bucketsTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      console.error('❌ Failed to list buckets:', error)
    }

    // Test 2: Upload a small test file
    console.log('📤 Test 2: Uploading test file...')
    let uploadTest
    try {
      const testContent = 'Test file from VibePhoto - ' + new Date().toISOString()
      const testKey = `debug-tests/test-${Date.now()}.txt`

      const putCommand = new PutObjectCommand({
        Bucket: bucket,
        Key: testKey,
        Body: Buffer.from(testContent),
        ContentType: 'text/plain',
        ACL: 'public-read'
      })

      await s3Client.send(putCommand)
      const testUrl = `https://${bucket}.s3.${region}.amazonaws.com/${testKey}`

      uploadTest = {
        success: true,
        testKey,
        testUrl,
        message: 'File uploaded successfully'
      }
      console.log('✅ Test file uploaded:', testUrl)
    } catch (error) {
      uploadTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorStack: error instanceof Error ? error.stack : null
      }
      console.error('❌ Failed to upload test file:', error)
    }

    return NextResponse.json({
      success: true,
      config: {
        region,
        bucket,
        accessKeyIdPrefix: accessKeyId.substring(0, 10) + '...'
      },
      tests: {
        bucketsTest,
        uploadTest
      },
      diagnosis: {
        credentialsValid: bucketsTest.success,
        uploadPermission: uploadTest.success,
        overallStatus: bucketsTest.success && uploadTest.success ? '✅ AWS S3 working' : '❌ AWS S3 has issues'
      }
    })
  } catch (error) {
    console.error('❌ Direct AWS test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorStack: error instanceof Error ? error.stack : null
    }, { status: 500 })
  }
}
