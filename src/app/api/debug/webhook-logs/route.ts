import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const generationId = searchParams.get('generationId')
    const jobId = searchParams.get('jobId')

    let generation

    if (generationId) {
      generation = await prisma.generation.findUnique({
        where: { id: generationId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      })
    } else if (jobId) {
      generation = await prisma.generation.findFirst({
        where: { jobId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      })
    }

    if (!generation) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 })
    }

    // Check if images are from S3 or Astria
    const imageAnalysis = generation.imageUrls?.map((url: string) => {
      const isS3 = url.includes('s3.amazonaws.com') || url.includes('ensaio-fotos')
      const isAstria = url.includes('astria')

      return {
        url,
        source: isS3 ? 'S3' : isAstria ? 'Astria' : 'Unknown',
        status: isS3 ? '✅ Permanent' : '⚠️ Temporary'
      }
    }) || []

    // Check storage configuration
    const storageConfig = {
      AWS_REGION: process.env.AWS_REGION || 'NOT SET',
      AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || 'NOT SET',
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? '✅ SET' : '❌ NOT SET',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? '✅ SET' : '❌ NOT SET',
      STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'NOT SET'
    }

    // Check webhook configuration
    const webhookConfig = {
      ASTRIA_WEBHOOK_URL: process.env.ASTRIA_WEBHOOK_URL || 'NOT SET',
      ASTRIA_WEBHOOK_SECRET: process.env.ASTRIA_WEBHOOK_SECRET ? '✅ SET' : '❌ NOT SET',
      NODE_ENV: process.env.NODE_ENV,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET'
    }

    return NextResponse.json({
      generation: {
        id: generation.id,
        jobId: generation.jobId,
        status: generation.status,
        createdAt: generation.createdAt,
        completedAt: generation.completedAt,
        creditsUsed: generation.creditsUsed,
        errorMessage: generation.errorMessage,
        user: generation.user
      },
      images: {
        count: generation.imageUrls?.length || 0,
        urls: imageAnalysis,
        allInS3: imageAnalysis.every(img => img.source === 'S3'),
        hasAstriaUrls: imageAnalysis.some(img => img.source === 'Astria')
      },
      diagnosis: {
        storageIssue: imageAnalysis.some(img => img.source === 'Astria'),
        webhookConfigured: webhookConfig.ASTRIA_WEBHOOK_URL !== 'NOT SET',
        s3Configured: storageConfig.AWS_ACCESS_KEY_ID === '✅ SET' && storageConfig.AWS_SECRET_ACCESS_KEY === '✅ SET'
      },
      config: {
        storage: storageConfig,
        webhook: webhookConfig
      }
    })
  } catch (error) {
    console.error('Error checking webhook logs:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
