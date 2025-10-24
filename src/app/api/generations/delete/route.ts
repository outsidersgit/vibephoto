import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { deleteGeneration } from '@/lib/db/generations'
import { revalidateUserGallery } from '@/lib/cache/gallery-cache'

/**
 * DELETE /api/generations/delete
 * Delete a generation (requires generationId in body)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const session = await requireAuth()
    const userId = session.user.id

    // Parse request body
    const body = await request.json()
    const generationId = body.generationId

    if (!generationId) {
      return NextResponse.json(
        { error: 'Generation ID is required' },
        { status: 400 }
      )
    }

    console.log(`🗑️ Deleting generation ${generationId} for user ${userId}`)

    // Delete generation (includes ownership check)
    await deleteGeneration(generationId, userId)

    console.log(`✅ Generation ${generationId} deleted successfully`)

    // Invalidar cache da galeria
    revalidateUserGallery(userId)

    return NextResponse.json({
      success: true,
      message: 'Generation deleted successfully',
      generationId
    })

  } catch (error: any) {
    console.error('Error deleting generation:', error)

    // Handle specific Prisma errors
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Generation not found or access denied' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete generation' },
      { status: 500 }
    )
  }
}