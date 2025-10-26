import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getModelCreationCostInfo } from '@/lib/services/model-credit-service'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const costInfo = await getModelCreationCostInfo(session.user.id)

    return NextResponse.json(costInfo)
  } catch (error) {
    console.error('Error fetching model cost info:', error)
    return NextResponse.json(
      { error: 'Failed to fetch model cost info' },
      { status: 500 }
    )
  }
}
