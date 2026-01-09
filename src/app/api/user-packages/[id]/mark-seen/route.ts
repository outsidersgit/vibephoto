import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuthAPI()
    const { id: userPackageId } = await params

    // Verificar que o pacote pertence ao usuário
    const userPackage = await prisma.userPackage.findUnique({
      where: { id: userPackageId },
      select: { userId: true, status: true }
    })

    if (!userPackage) {
      return NextResponse.json(
        { error: 'Package not found' },
        { status: 404 }
      )
    }

    if (userPackage.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Marcar como visto apenas se estiver COMPLETED
    if (userPackage.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Can only mark completed packages as seen' },
        { status: 400 }
      )
    }

    // Atualizar successSeen
    await prisma.userPackage.update({
      where: { id: userPackageId },
      data: { successSeen: true }
    })

    console.log(`✅ [MARK_SEEN] Package ${userPackageId} marked as seen by user ${session.user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Package marked as seen'
    })

  } catch (error) {
    console.error('[MARK_SEEN] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
