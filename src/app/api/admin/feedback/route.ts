import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'
import { getFeedbackAnalytics } from '@/lib/services/feedback-service'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/feedback
 * Get feedback analytics (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthAPI()

    // Check if user has ADMIN role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true }
    })

    if (!user || user.role !== 'ADMIN') {
      console.log('❌ Access denied: User is not an admin', {
        userId: session.user.id,
        email: session.user.email,
        role: user?.role
      })

      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    const analytics = await getFeedbackAnalytics(limit)

    return NextResponse.json({
      success: true,
      data: analytics
    })
  } catch (error) {
    console.error('❌ Admin feedback analytics error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    })

    return NextResponse.json(
      {
        error: 'Failed to fetch feedback analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
