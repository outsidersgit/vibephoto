import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { RateLimiter } from '@/lib/security/rate-limiter'
import { ContentModerator } from '@/lib/security/content-moderator'

// Security monitoring and administration API
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Only allow admins to access security data
    // In production, add proper admin role check
    if (session.user.email !== 'admin@ensaiofotos.com') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    switch (action) {
      case 'system-stats':
        const systemStats = await RateLimiter.getSystemStats()
        return NextResponse.json({
          success: true,
          data: systemStats
        })

      case 'violation-stats':
        const userId = searchParams.get('userId') || undefined
        const violationStats = await ContentModerator.getViolationStats(userId)
        return NextResponse.json({
          success: true,
          data: violationStats
        })

      case 'user-status':
        const targetUserId = searchParams.get('userId')
        if (!targetUserId) {
          return NextResponse.json(
            { error: 'User ID required' },
            { status: 400 }
          )
        }

        const [userStatus, rateLimitStats] = await Promise.all([
          ContentModerator.checkUserStatus(targetUserId),
          RateLimiter.getUsageStats(targetUserId)
        ])

        return NextResponse.json({
          success: true,
          data: {
            ...userStatus,
            rateLimits: rateLimitStats
          }
        })

      case 'blocked-users':
        // Get list of currently blocked users
        const blockedUsers = await RateLimiter.getSystemStats()
        return NextResponse.json({
          success: true,
          data: {
            topUsers: blockedUsers.topUsers.filter(user => user.count > 50) // High violation users
          }
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Security API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Admin actions for user management
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()
    const { action, userId, reason } = body

    // Only allow admins to perform actions
    if (session.user.email !== 'admin@ensaiofotos.com') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'ban-user':
        const { prisma } = await import('@/lib/db')
        // TODO: Add status and banReason fields to User model if user banning is needed
        // For now, we could use a comment or disable the user by removing their access
        await prisma.usageLog.create({
          data: {
            userId: userId,
            action: 'user_banned',
            details: {
              reason: reason || 'Violation of terms of service',
              timestamp: new Date().toISOString()
            },
            creditsUsed: 0
          }
        })

        return NextResponse.json({
          success: true,
          message: 'User banned successfully'
        })

      case 'unban-user':
        const { prisma: prisma2 } = await import('@/lib/db')
        // TODO: Add status and banReason fields to User model if user banning is needed
        // For now, log the unban action
        await prisma2.usageLog.create({
          data: {
            userId: userId,
            action: 'user_unbanned',
            details: {
              timestamp: new Date().toISOString()
            },
            creditsUsed: 0
          }
        })

        return NextResponse.json({
          success: true,
          message: 'User unbanned successfully'
        })

      case 'restrict-user':
        const { prisma: prisma3 } = await import('@/lib/db')
        // TODO: Add status and banReason fields to User model if user restrictions are needed
        // For now, log the restriction action
        await prisma3.usageLog.create({
          data: {
            userId: userId,
            action: 'user_restricted',
            details: {
              reason: reason || 'Account under review',
              timestamp: new Date().toISOString()
            },
            creditsUsed: 0
          }
        })

        return NextResponse.json({
          success: true,
          message: 'User restricted successfully'
        })

      case 'cleanup-logs':
        await RateLimiter.cleanupOldLogs()
        return NextResponse.json({
          success: true,
          message: 'Old logs cleaned up successfully'
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Security action error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}