import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AnalyticsTracker } from '@/lib/analytics/tracker'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    switch (type) {
      case 'user':
        const userAnalytics = await AnalyticsTracker.getUserAnalytics(session.user.id)
        return NextResponse.json({
          success: true,
          data: userAnalytics
        })

      case 'engagement':
        const engagement = await AnalyticsTracker.getUserEngagement(session.user.id)
        return NextResponse.json({
          success: true,
          data: engagement
        })

      case 'popular-prompts':
        const limit = parseInt(searchParams.get('limit') || '10')
        const prompts = await AnalyticsTracker.getPopularPrompts(limit)
        return NextResponse.json({
          success: true,
          data: prompts
        })

      case 'system':
        // For now, allow all authenticated users to access system analytics
        // TODO: Implement role-based access control if needed

        const startDate = searchParams.get('startDate') 
          ? new Date(searchParams.get('startDate')!) 
          : undefined
        const endDate = searchParams.get('endDate') 
          ? new Date(searchParams.get('endDate')!) 
          : undefined

        const systemAnalytics = await AnalyticsTracker.getSystemAnalytics(startDate, endDate)
        return NextResponse.json({
          success: true,
          data: systemAnalytics
        })

      default:
        return NextResponse.json(
          { error: 'Invalid analytics type' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Analytics API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Track analytics event
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
    const { event, properties } = body

    if (!event) {
      return NextResponse.json(
        { error: 'Event name is required' },
        { status: 400 }
      )
    }

    await AnalyticsTracker.trackEvent({
      userId: session.user.id,
      event,
      properties
    })

    return NextResponse.json({
      success: true,
      message: 'Event tracked successfully'
    })

  } catch (error) {
    console.error('Track event error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to track event',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}