import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Cron job para limpar checkouts expirados
 * Roda a cada hora para marcar checkouts pendentes como EXPIRED
 *
 * Vercel Cron: adicionar em vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-checkouts",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */
export async function GET() {
  try {
    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)

    // Buscar checkouts PENDING com mais de 2 horas
    const expiredCheckouts = await prisma.creditPurchase.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: twoHoursAgo }
      },
      select: {
        id: true,
        userId: true,
        packageName: true,
        createdAt: true
      }
    })

    if (expiredCheckouts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired checkouts found',
        count: 0
      })
    }

    // Marcar como EXPIRED
    const result = await prisma.creditPurchase.updateMany({
      where: {
        id: { in: expiredCheckouts.map(c => c.id) }
      },
      data: {
        status: 'EXPIRED'
      }
    })

    console.log(`🧹 Cleaned up ${result.count} expired checkouts`)

    return NextResponse.json({
      success: true,
      message: `Marked ${result.count} checkouts as expired`,
      count: result.count,
      checkouts: expiredCheckouts.map(c => ({
        id: c.id,
        userId: c.userId,
        packageName: c.packageName,
        age: Math.floor((now.getTime() - c.createdAt.getTime()) / (60 * 60 * 1000))
      }))
    })

  } catch (error) {
    console.error('Error cleaning up checkouts:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
