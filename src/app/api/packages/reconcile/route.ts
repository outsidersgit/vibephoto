import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { reconcileAllStuckPackages, reconcileUserPackageStatus } from '@/lib/services/package-reconciliation'

/**
 * API endpoint to reconcile all stuck packages
 * This can be called manually or via cron job to clean up stuck packages
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow admins or system calls
    const isAdmin = (session.user as any).role === 'ADMIN'
    const isInternalRequest = request.headers.get('X-Internal-Request') === 'true'

    if (!isAdmin && !isInternalRequest) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userPackageId } = await request.json().catch(() => ({}))
    
    if (userPackageId) {
      // Reconcile specific package
      const result = await reconcileUserPackageStatus(userPackageId)
      return NextResponse.json({
        success: result.success,
        updated: result.updated,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
        stats: result.stats,
        error: result.error
      })
    } else {
      // Reconcile all stuck packages
      const result = await reconcileAllStuckPackages()
      return NextResponse.json({
        success: true,
        total: result.total,
        reconciled: result.reconciled,
        results: result.results
      })
    }
  } catch (error) {
    console.error('❌ Error reconciling packages:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * GET endpoint to check package reconciliation status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userPackageId = searchParams.get('userPackageId')

    if (userPackageId) {
      const result = await reconcileUserPackageStatus(userPackageId)
      return NextResponse.json({
        success: result.success,
        updated: result.updated,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
        stats: result.stats,
        error: result.error
      })
    } else {
      return NextResponse.json({
        error: 'userPackageId parameter is required'
      }, { status: 400 })
    }
  } catch (error) {
    console.error('❌ Error checking package status:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

