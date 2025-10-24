import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { S3Client, PutObjectAclCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
})

/**
 * Fix S3 permissions for existing images to make them publicly accessible
 */
export async function POST(request: NextRequest) {
  console.log('🔧 S3 permissions fix endpoint called')
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const bucket = process.env.AWS_S3_BUCKET || 'ensaio-fotos-prod'
    
    // Find generations with S3 URLs that need permission fixing
    const generationsWithS3 = await prisma.generation.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        AND: [
          { imageUrls: { not: null } },
          { imageUrls: { path: ['0'], string_contains: 'amazonaws.com' } }
        ]
      },
      select: {
        id: true,
        imageUrls: true,
        thumbnailUrls: true,
        prompt: true
      },
      take: 20
    })

    console.log(`🔍 Found ${generationsWithS3.length} generations with S3 URLs`)

    const results = []
    let fixedCount = 0
    let errorCount = 0

    for (const generation of generationsWithS3) {
      try {
        const urls = [...(generation.imageUrls || []), ...(generation.thumbnailUrls || [])]
        
        for (const url of urls) {
          if (url.includes('amazonaws.com')) {
            // Extract the S3 key from the URL
            const urlParts = url.split('amazonaws.com/')
            if (urlParts.length > 1) {
              const key = urlParts[1]
              
              console.log(`🔧 Fixing permissions for: ${key}`)
              
              try {
                const command = new PutObjectAclCommand({
                  Bucket: bucket,
                  Key: key,
                  ACL: 'public-read'
                })
                
                await s3Client.send(command)
                fixedCount++
                console.log(`✅ Fixed permissions for: ${key}`)
              } catch (aclError) {
                console.error(`❌ Failed to fix ACL for ${key}:`, aclError)
                errorCount++
              }
            }
          }
        }

        results.push({
          generationId: generation.id,
          status: 'processed',
          imageCount: generation.imageUrls?.length || 0,
          thumbnailCount: generation.thumbnailUrls?.length || 0
        })

      } catch (error) {
        console.error(`❌ Error processing generation ${generation.id}:`, error)
        results.push({
          generationId: generation.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        errorCount++
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log(`📊 S3 permissions fix completed: ${fixedCount} fixed, ${errorCount} errors`)

    return NextResponse.json({
      success: true,
      totalGenerations: generationsWithS3.length,
      fixedCount,
      errorCount,
      results,
      message: fixedCount > 0 ? `Fixed permissions for ${fixedCount} images` : 'No permissions needed fixing'
    })

  } catch (error) {
    console.error('❌ S3 permissions fix error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Count S3 URLs
    const s3Count = await prisma.generation.count({
      where: {
        userId,
        status: 'COMPLETED',
        AND: [
          { imageUrls: { not: null } },
          { imageUrls: { path: ['0'], string_contains: 'amazonaws.com' } }
        ]
      }
    })

    // Count Replicate URLs (expired)  
    const replicateCount = await prisma.generation.count({
      where: {
        userId,
        status: 'COMPLETED',
        AND: [
          { imageUrls: { not: null } },
          { imageUrls: { path: ['0'], string_contains: 'replicate.delivery' } }
        ]
      }
    })

    return NextResponse.json({
      s3Count,
      replicateCount,
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION,
      hasCredentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
    })

  } catch (error) {
    console.error('❌ S3 permissions status error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}