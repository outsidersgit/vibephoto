import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'
import {
  createFeedback,
  getUserFeedbacks,
  shouldShowFeedbackModal,
  hasFeedback
} from '@/lib/services/feedback-service'
import { z } from 'zod'

// Schema for feedback submission
const feedbackSchema = z.object({
  generationId: z.string().min(1, 'Generation ID is required'),
  rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  comment: z.string().max(1000, 'Comment must be less than 1000 characters').optional()
})

/**
 * POST /api/feedback
 * Create a new feedback entry
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthAPI()
    const userId = session.user.id

    const body = await request.json()
    const validation = feedbackSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { generationId, rating, comment } = validation.data

    // Create feedback
    const feedback = await createFeedback({
      userId,
      generationId,
      rating,
      comment
    })

    console.log(`✅ Feedback created: ${rating}/5 stars for generation ${generationId}`)

    return NextResponse.json({
      success: true,
      data: feedback
    })
  } catch (error) {
    console.error('❌ Feedback submission error:', error)

    const message = error instanceof Error ? error.message : 'Failed to submit feedback'
    const status = message.includes('already exists') ? 409 :
                   message.includes('not found') ? 404 :
                   message.includes('Unauthorized') ? 403 : 500

    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}

/**
 * GET /api/feedback
 * Get user feedbacks or check if should show modal
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthAPI()
    const userId = session.user.id

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const generationId = searchParams.get('generationId')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Check if should show feedback modal for a generation
    if (action === 'shouldShow' && generationId) {
      const result = await shouldShowFeedbackModal(userId, generationId)
      return NextResponse.json({
        success: true,
        data: result
      })
    }

    // Check if feedback exists for a generation
    if (action === 'check' && generationId) {
      const exists = await hasFeedback(generationId)
      return NextResponse.json({
        success: true,
        data: { hasFeedback: exists }
      })
    }

    // Get user's feedback history
    const feedbacks = await getUserFeedbacks(userId, limit)

    return NextResponse.json({
      success: true,
      data: feedbacks
    })
  } catch (error) {
    console.error('❌ Feedback GET error:', error)

    return NextResponse.json(
      { error: 'Failed to fetch feedback data' },
      { status: 500 }
    )
  }
}
