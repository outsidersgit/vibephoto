import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userPackages = await prisma.userPackage.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        package: {
          select: {
            id: true,
            name: true,
            category: true,
            previewUrls: true
          }
        }
      }
    })

    return NextResponse.json({
      userPackages: userPackages.map((pkg) => ({
        id: pkg.id,
        packageId: pkg.packageId,
        packageName: pkg.package?.name,
        category: pkg.package?.category,
        status: pkg.status,
        totalImages: pkg.totalImages,
        generatedImages: pkg.generatedImages,
        failedImages: pkg.failedImages,
        previewUrls: pkg.package?.previewUrls || [],
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt
      }))
    })
  } catch (error) {
    console.error('Failed to load user packages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

