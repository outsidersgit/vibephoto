import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { renewMonthlyCredits } from '@/lib/db/subscriptions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/credits/cron/execute
 * Executa manualmente o job de renovação mensal
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()

    console.log(`🔄 [Manual Cron] Admin ${admin.email} triggered manual credit renewal`)

    const result = await renewMonthlyCredits()

    console.log(`✅ [Manual Cron] Completed:`, result)

    return NextResponse.json({
      success: true,
      data: {
        executed: true,
        summary: {
          totalProcessed: result.totalProcessed,
          renewed: result.totalRenewed,
          skipped: result.totalSkipped
        },
        details: {
          renewedUserIds: result.renewedUserIds,
          skippedUsers: result.skippedUsers
        },
        executedBy: {
          adminId: admin.id,
          adminEmail: admin.email,
          timestamp: new Date().toISOString()
        }
      }
    })
  } catch (error) {
    console.error('❌ [POST /api/admin/credits/cron/execute] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}
