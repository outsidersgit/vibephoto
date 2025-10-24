import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CreditManager } from '@/lib/credits/manager'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'balance':
        const credits = await CreditManager.getUserCredits(session.user.id)
        return NextResponse.json({
          success: true,
          data: { credits }
        })

      case 'usage':
        const usage = await CreditManager.getUserUsage(session.user.id)
        return NextResponse.json({
          success: true,
          data: usage
        })

      case 'storage':
        const storage = await CreditManager.getUserStorageUsage(session.user.id)
        return NextResponse.json({
          success: true,
          data: storage
        })

      case 'transactions':
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = parseInt(searchParams.get('offset') || '0')

        const transactions = await prisma.usageLog.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            action: true,
            creditsUsed: true,
            details: true,
            createdAt: true
          }
        })

        const total = await prisma.usageLog.count({
          where: { userId: session.user.id }
        })

        return NextResponse.json({
          success: true,
          data: {
            transactions,
            total,
            hasMore: offset + limit < total
          }
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Credits API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch credit information',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Add credits (admin or purchase)
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { amount, reason, type } = body

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    // For now, only allow certain types of credit additions
    const allowedTypes = ['purchase', 'bonus', 'refund', 'admin']
    if (!allowedTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid credit type' },
        { status: 400 }
      )
    }

    // Add credits
    const success = await CreditManager.addCredits(
      session.user.id,
      amount,
      reason || `Credits added: ${type}`
    )

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to add credits' },
        { status: 500 }
      )
    }

    // Get updated balance
    const newBalance = await CreditManager.getUserCredits(session.user.id)

    return NextResponse.json({
      success: true,
      data: {
        amount,
        newBalance,
        message: `${amount} credits added successfully`
      }
    })

  } catch (error) {
    console.error('Add credits error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to add credits',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}