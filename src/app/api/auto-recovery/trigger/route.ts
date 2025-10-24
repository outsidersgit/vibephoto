import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { executeAutoRecovery } from '@/lib/services/auto-recovery-service'

/**
 * Endpoint para forçar recuperação automática manual
 * Usado quando usuário quer forçar uma recuperação
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    console.log(`🚨 Manual auto-recovery triggered for user ${userId}`)

    const result = await executeAutoRecovery(userId)

    return NextResponse.json({
      success: result.success,
      message: result.success 
        ? `Recovery completed: ${result.recoveredCount} images recovered`
        : 'Recovery failed or no images to recover',
      recoveredCount: result.recoveredCount,
      failedCount: result.failedCount,
      totalProcessed: result.totalProcessed,
      errors: result.errors,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Manual auto-recovery error:', error)
    return NextResponse.json(
      { error: 'Auto-recovery failed' },
      { status: 500 }
    )
  }
}