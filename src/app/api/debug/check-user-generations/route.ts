import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 })
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        credits: true,
        creditsUsed: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get recent generations
    const generations = await prisma.generation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        prompt: true,
        status: true,
        imageUrls: true,
        createdAt: true,
        completedAt: true,
        externalId: true,
        errorMessage: true,
        creditsUsed: true
      }
    })

    // Analyze issues
    const issues = generations.map(gen => {
      const problems = []

      if (gen.status === 'COMPLETED' && (!gen.imageUrls || gen.imageUrls.length === 0)) {
        problems.push('❌ Status COMPLETED but no imageUrls')
      }

      if (gen.imageUrls && gen.imageUrls.length > 0) {
        const hasAstriaUrls = gen.imageUrls.some((url: string) => url.includes('astria'))
        const hasS3Urls = gen.imageUrls.some((url: string) => url.includes('s3.amazonaws.com') || url.includes('ensaio-fotos'))

        if (hasAstriaUrls && !hasS3Urls) {
          problems.push('⚠️ Using Astria URLs (not stored in S3)')
        }

        if (hasS3Urls) {
          problems.push('✅ Using S3 URLs')
        }
      }

      if (gen.creditsUsed && gen.creditsUsed > 0 && (!gen.imageUrls || gen.imageUrls.length === 0)) {
        problems.push('🔴 CRITICAL: Credits charged but no images saved!')
      }

      return {
        id: gen.id,
        externalId: gen.externalId,
        status: gen.status,
        createdAt: gen.createdAt,
        completedAt: gen.completedAt,
        imageCount: gen.imageUrls?.length || 0,
        creditsUsed: gen.creditsUsed,
        imageUrls: gen.imageUrls,
        problems
      }
    })

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        credits: user.credits,
        creditsUsed: user.creditsUsed
      },
      totalGenerations: generations.length,
      generations: issues,
      summary: {
        withProblems: issues.filter(g => g.problems.length > 0).length,
        critical: issues.filter(g => g.problems.some(p => p.includes('CRITICAL'))).length,
        usingAstriaUrls: issues.filter(g => g.problems.some(p => p.includes('Astria URLs'))).length,
        usingS3: issues.filter(g => g.problems.some(p => p.includes('S3 URLs'))).length
      }
    })
  } catch (error) {
    console.error('Error checking generations:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
