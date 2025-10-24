import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { ContentModerator } from '@/lib/security/content-moderator'
import { RateLimiter } from '@/lib/security/rate-limiter'

// Content moderation API endpoint
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id
    const userPlan = session.user.plan || 'FREE'
    const body = await request.json()
    const { content, type = 'prompt', imageUrl } = body

    if (!content && !imageUrl) {
      return NextResponse.json(
        { error: 'Content or image URL required' },
        { status: 400 }
      )
    }

    // Check rate limits for content moderation
    const limit = await RateLimiter.checkLimit(userId, 'api', userPlan)
    if (!limit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: limit.retryAfter 
        },
        { status: 429 }
      )
    }

    let moderationResult

    if (type === 'image' && imageUrl) {
      // Moderate image content
      moderationResult = await ContentModerator.moderateImage(imageUrl, userId)
    } else if (content) {
      // Moderate text content
      moderationResult = await ContentModerator.moderateContent(content, userId)
    } else {
      return NextResponse.json(
        { error: 'Invalid moderation type' },
        { status: 400 }
      )
    }

    // Record the API call
    await RateLimiter.recordAttempt(userId, 'api', {
      action: 'content_moderation',
      type,
      allowed: moderationResult.isAllowed
    })

    return NextResponse.json({
      success: true,
      data: moderationResult
    })

  } catch (error) {
    console.error('Content moderation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get user's moderation history
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'user-violations':
        const violations = await ContentModerator.getViolationStats(userId)
        return NextResponse.json({
          success: true,
          data: violations
        })

      case 'user-status':
        const status = await ContentModerator.checkUserStatus(userId)
        return NextResponse.json({
          success: true,
          data: status
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Moderation history error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}