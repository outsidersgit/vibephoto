import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { VideoStatus, GenerationStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    // Get counts for all tabs in parallel for optimal performance - only completed ones
    const [generatedCount, editedCount, videosCount] = await Promise.all([
      prisma.generation.count({ where: { userId, status: GenerationStatus.COMPLETED } }),
      prisma.editHistory.count({ where: { userId } }), // Edit history entries are always successful
      prisma.videoGeneration.count({ where: { userId, status: VideoStatus.COMPLETED } })
    ])

    return NextResponse.json({
      success: true,
      stats: {
        totalGenerations: generatedCount,
        totalEdited: editedCount,
        totalVideos: videosCount
      }
    })

  } catch (error) {
    console.error('Error fetching gallery stats:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch gallery statistics',
        stats: {
          totalGenerations: 0,
          totalEdited: 0,
          totalVideos: 0
        }
      },
      { status: 500 }
    )
  }
}