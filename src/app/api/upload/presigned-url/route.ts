import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { STORAGE_CONFIG } from '@/lib/storage/config'
import { generateUniqueFilename } from '@/lib/storage/path-utils'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { filename, contentType, category = 'edited' } = body

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: 'Missing filename or contentType' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const uniqueFilename = generateUniqueFilename(filename)

    // Build S3 key with standardized structure
    const key = `generated/${session.user.id}/${category}/${uniqueFilename}`

    // Create S3 client
    const s3Client = new S3Client({
      region: STORAGE_CONFIG.aws.region,
      credentials: {
        accessKeyId: STORAGE_CONFIG.aws.accessKeyId!,
        secretAccessKey: STORAGE_CONFIG.aws.secretAccessKey!
      }
    })

    // Generate presigned URL for PUT operation
    const command = new PutObjectCommand({
      Bucket: STORAGE_CONFIG.aws.bucket,
      Key: key,
      ContentType: contentType
    })

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600 // 1 hour
    })

    // Generate public URL
    const publicUrl = STORAGE_CONFIG.aws.cloudFrontUrl
      ? `${STORAGE_CONFIG.aws.cloudFrontUrl}/${key}`
      : `https://${STORAGE_CONFIG.aws.bucket}.s3.${STORAGE_CONFIG.aws.region}.amazonaws.com/${key}`

    return NextResponse.json({
      success: true,
      data: {
        presignedUrl,
        publicUrl,
        key,
        expiresIn: 3600
      }
    })

  } catch (error) {
    console.error('Presigned URL generation error:', error)

    return NextResponse.json(
      {
        error: 'Failed to generate presigned URL',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
