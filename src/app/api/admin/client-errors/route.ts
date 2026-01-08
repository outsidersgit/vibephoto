import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * API para buscar logs de erros do client-side
 * GET /api/admin/client-errors?limit=50&browser=Safari&device=iPhone
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação e permissões de admin
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const browser = url.searchParams.get('browser')
    const device = url.searchParams.get('device')
    const errorType = url.searchParams.get('errorType')
    const userId = url.searchParams.get('userId')
    const hours = parseInt(url.searchParams.get('hours') || '24', 10)

    // Construir where clause
    const where: any = {
      action: 'CLIENT_ERROR',
      createdAt: {
        gte: new Date(Date.now() - hours * 60 * 60 * 1000)
      }
    }

    if (browser) {
      where.details = {
        path: ['browser'],
        equals: browser
      }
    }

    if (userId) {
      where.userId = userId
    }

    // Buscar logs
    const logs = await prisma.systemLog.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      take: Math.min(limit, 200), // Máximo 200
      select: {
        id: true,
        userId: true,
        action: true,
        status: true,
        details: true,
        ipAddress: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true
          }
        }
      }
    })

    // Filtrar por device e errorType (não tem query direta em JSON no Prisma)
    let filteredLogs = logs

    if (device || errorType) {
      filteredLogs = logs.filter(log => {
        const details = log.details as any

        if (device && details.device !== device) return false
        if (errorType && details.errorType !== errorType) return false

        return true
      })
    }

    // Estatísticas
    const stats = {
      total: filteredLogs.length,
      byBrowser: {} as Record<string, number>,
      byDevice: {} as Record<string, number>,
      byErrorType: {} as Record<string, number>,
    }

    filteredLogs.forEach(log => {
      const details = log.details as any

      // Browser
      const browser = details.browser || 'unknown'
      stats.byBrowser[browser] = (stats.byBrowser[browser] || 0) + 1

      // Device
      const device = details.device || 'unknown'
      stats.byDevice[device] = (stats.byDevice[device] || 0) + 1

      // Error Type
      const errorType = details.errorType || 'UnknownError'
      stats.byErrorType[errorType] = (stats.byErrorType[errorType] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      logs: filteredLogs.slice(0, limit),
      stats,
      filters: {
        limit,
        browser,
        device,
        errorType,
        userId,
        hours
      }
    })

  } catch (error) {
    console.error('❌ [ADMIN_CLIENT_ERRORS] Error fetching logs:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
