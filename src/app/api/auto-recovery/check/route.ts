import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { checkAndRecoverUserImages } from '@/lib/services/auto-recovery-service'

/**
 * Endpoint para verificação e recuperação automática de imagens
 * Usado pelo hook useAutoSync para recovery periódico
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    console.log(`🚨 Auto-recovery check triggered for user ${userId}`)

    const result = await checkAndRecoverUserImages(userId)

    return NextResponse.json({
      success: result.success,
      recoveredCount: result.recoveredCount,
      failedCount: result.failedCount,
      totalProcessed: result.totalProcessed,
      errors: result.errors,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Auto-recovery check error:', error)
    return NextResponse.json(
      { error: 'Auto-recovery check failed' },
      { status: 500 }
    )
  }
}