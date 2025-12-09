import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function ensureAdmin() {
  const session = await getServerSession(authOptions)
  const role = String(((session?.user as any)?.role) || '').toUpperCase()
  if (!session || role !== 'ADMIN') return null
  return session
}

export async function GET() {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const influencers = await prisma.influencer.findMany({
      select: {
        id: true,
        couponCode: true,
        asaasWalletId: true,
        commissionPercentage: true,
        commissionFixedValue: true,
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ influencers })
  } catch (error: any) {
    console.error('❌ [ADMIN_INFLUENCERS] Error fetching influencers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
