import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Admin: Trigger manual sync of nextDueDate for all active subscriptions
 * POST /api/admin/sync-subscriptions
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // Verify admin access
    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      )
    }

    console.log(`🔄 [ADMIN] Manual subscription sync triggered by ${session.user.email}`)

    // Call the CRON endpoint internally
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const cronSecret = process.env.CRON_SECRET

    const response = await fetch(`${baseUrl}/api/cron/sync-next-due-dates`, {
      method: 'GET',
      headers: {
        'Authorization': cronSecret ? `Bearer ${cronSecret}` : '',
      }
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Sync failed')
    }

    console.log(`✅ [ADMIN] Sync completed:`, result.results)

    return NextResponse.json({
      success: true,
      message: 'Sincronização concluída com sucesso',
      ...result
    })

  } catch (error: any) {
    console.error('❌ [ADMIN] Sync failed:', error)
    return NextResponse.json(
      { error: 'Erro ao sincronizar', message: error.message },
      { status: 500 }
    )
  }
}
