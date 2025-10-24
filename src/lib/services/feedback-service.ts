import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface FeedbackData {
  userId: string
  generationId: string
  rating: number
  comment?: string
}

export interface FeedbackAnalytics {
  averageRating: number
  totalFeedbacks: number
  ratingDistribution: { rating: number; count: number }[]
  recentFeedbacks: {
    id: string
    rating: number
    comment: string | null
    createdAt: Date
    user: {
      name: string | null
      email: string
    }
    generation: {
      id: string
      prompt: string
    }
  }[]
}

/**
 * Check if user should see feedback modal for a generation
 * Returns true if:
 * - User hasn't given feedback in last 3 generations, OR
 * - Generation is a retry/edit (same prompt/model in last hour), OR
 * - Generation uses a new model (not used in last 10 generations)
 */
export async function shouldShowFeedbackModal(
  userId: string,
  generationId: string
): Promise<{ shouldShow: boolean; reason?: string }> {
  try {
    // Check if feedback already exists for this generation
    const existingFeedback = await prisma.feedback.findUnique({
      where: { generationId }
    })

    if (existingFeedback) {
      return { shouldShow: false, reason: 'already_submitted' }
    }

    // Get the current generation details
    const currentGeneration = await prisma.generation.findUnique({
      where: { id: generationId },
      select: {
        id: true,
        prompt: true,
        modelId: true,
        createdAt: true
      }
    })

    if (!currentGeneration) {
      return { shouldShow: false, reason: 'generation_not_found' }
    }

    // Get user's last 10 generations
    const recentGenerations = await prisma.generation.findMany({
      where: {
        userId,
        id: { not: generationId }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        feedback: {
          select: { id: true }
        }
      }
    })

    // Count generations without feedback in last 3
    const last3Generations = recentGenerations.slice(0, 3)
    const feedbackCount = last3Generations.filter(g => g.feedback).length

    // RULE 1: Show if no feedback in last 3 generations
    if (feedbackCount === 0 && last3Generations.length >= 3) {
      return { shouldShow: true, reason: 'no_recent_feedback' }
    }

    // RULE 2: Check if it's a retry (same prompt in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const isRetry = recentGenerations.some(
      g =>
        g.prompt === currentGeneration.prompt &&
        g.createdAt > oneHourAgo
    )

    if (isRetry) {
      return { shouldShow: true, reason: 'retry_generation' }
    }

    // RULE 3: Check if using a new model
    const modelUsedBefore = recentGenerations.some(
      g => g.modelId === currentGeneration.modelId
    )

    if (!modelUsedBefore) {
      return { shouldShow: true, reason: 'new_model' }
    }

    // Don't show modal by default
    return { shouldShow: false, reason: 'default' }
  } catch (error) {
    console.error('Error checking if feedback modal should show:', error)
    return { shouldShow: false, reason: 'error' }
  }
}

/**
 * Create a new feedback entry
 */
export async function createFeedback(data: FeedbackData) {
  // Validate rating
  if (data.rating < 1 || data.rating > 5) {
    throw new Error('Rating must be between 1 and 5')
  }

  // Check if feedback already exists
  const existingFeedback = await prisma.feedback.findUnique({
    where: { generationId: data.generationId }
  })

  if (existingFeedback) {
    throw new Error('Feedback already exists for this generation')
  }

  // Verify the generation belongs to the user
  const generation = await prisma.generation.findUnique({
    where: { id: data.generationId },
    select: { userId: true }
  })

  if (!generation) {
    throw new Error('Generation not found')
  }

  if (generation.userId !== data.userId) {
    throw new Error('Unauthorized: Generation does not belong to user')
  }

  // Create feedback
  const feedback = await prisma.feedback.create({
    data: {
      userId: data.userId,
      generationId: data.generationId,
      rating: data.rating,
      comment: data.comment?.trim() || null
    },
    include: {
      user: {
        select: {
          name: true,
          email: true
        }
      },
      generation: {
        select: {
          prompt: true
        }
      }
    }
  })

  // If rating is low (< 3), trigger webhook/notification in the future
  if (feedback.rating < 3) {
    console.log(`⚠️ Low rating feedback received: ${feedback.rating}/5 from ${feedback.user.email}`)
    // TODO: Trigger webhook for low ratings
    // await triggerLowRatingWebhook(feedback)
  }

  return feedback
}

/**
 * Get user's feedback history
 */
export async function getUserFeedbacks(userId: string, limit = 10) {
  return prisma.feedback.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      generation: {
        select: {
          id: true,
          prompt: true,
          imageUrls: true,
          createdAt: true
        }
      }
    }
  })
}

/**
 * Get feedback analytics for admin dashboard
 */
export async function getFeedbackAnalytics(
  limit = 20
): Promise<FeedbackAnalytics> {
  // Get all feedbacks for statistics
  const allFeedbacks = await prisma.feedback.findMany({
    select: { rating: true }
  })

  // Calculate average rating
  const totalFeedbacks = allFeedbacks.length
  const averageRating =
    totalFeedbacks > 0
      ? allFeedbacks.reduce((sum, f) => sum + f.rating, 0) / totalFeedbacks
      : 0

  // Calculate rating distribution
  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  allFeedbacks.forEach(f => {
    ratingCounts[f.rating as keyof typeof ratingCounts]++
  })

  const ratingDistribution = Object.entries(ratingCounts).map(
    ([rating, count]) => ({
      rating: parseInt(rating),
      count
    })
  )

  // Get recent feedbacks with details
  const recentFeedbacks = await prisma.feedback.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: {
        select: {
          name: true,
          email: true
        }
      },
      generation: {
        select: {
          id: true,
          prompt: true
        }
      }
    }
  })

  return {
    averageRating: Math.round(averageRating * 10) / 10,
    totalFeedbacks,
    ratingDistribution,
    recentFeedbacks
  }
}

/**
 * Check if generation has feedback
 */
export async function hasFeedback(generationId: string): Promise<boolean> {
  const feedback = await prisma.feedback.findUnique({
    where: { generationId },
    select: { id: true }
  })

  return !!feedback
}

/**
 * Delete feedback (admin only)
 */
export async function deleteFeedback(feedbackId: string) {
  return prisma.feedback.delete({
    where: { id: feedbackId }
  })
}
