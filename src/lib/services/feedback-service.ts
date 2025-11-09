import { prisma } from '@/lib/prisma'

export type FeedbackEventType = 'generation_completed' | 'download' | 'share' | 'feature_use'

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

export interface FeedbackTriggerOptions {
  eventType?: FeedbackEventType | null
  usageCount?: number
  generationId?: string | null
  metadata?: Record<string, string>
}

export interface FeedbackTriggerResult {
  shouldShow: boolean
  reason?: string
  milestone?: number | null
  usageCount?: number
}

const FEEDBACK_EVENT_MILESTONES: Record<FeedbackEventType, number[]> = {
  generation_completed: [5, 10, 20, 50, 100],
  download: [3, 7, 15],
  share: [2, 5, 10],
  feature_use: [1, 3, 6]
}

const getNextMilestone = (eventType: FeedbackEventType, usageCount: number) => {
  const milestones = FEEDBACK_EVENT_MILESTONES[eventType]
  return milestones.find(milestone => milestone > usageCount) ?? null
}

const legacyShouldShowFeedbackModal = async (
  userId: string,
  generationId: string
): Promise<FeedbackTriggerResult> => {
  // Legacy behaviour retained for backward compatibility
  try {
    const existingFeedback = await prisma.feedback.findUnique({
      where: { generationId }
    })

    if (existingFeedback) {
      return { shouldShow: false, reason: 'already_submitted' }
    }

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

    const last3Generations = recentGenerations.slice(0, 3)
    const feedbackCount = last3Generations.filter(g => g.feedback).length

    if (feedbackCount === 0 && last3Generations.length >= 3) {
      return { shouldShow: true, reason: 'no_recent_feedback' }
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const isRetry = recentGenerations.some(
      g =>
        g.prompt === currentGeneration.prompt &&
        g.createdAt > oneHourAgo
    )

    if (isRetry) {
      return { shouldShow: true, reason: 'retry_generation' }
    }

    const modelUsedBefore = recentGenerations.some(
      g => g.modelId === currentGeneration.modelId
    )

    if (!modelUsedBefore) {
      return { shouldShow: true, reason: 'new_model' }
    }

    return { shouldShow: false, reason: 'default' }
  } catch (error) {
    console.error('Error checking legacy feedback modal rules:', error)
    return { shouldShow: false, reason: 'error' }
  }
}

/**
 * Evaluate if we should show the feedback badge/modal based on behavioural triggers.
 */
export async function shouldShowFeedbackModal(
  userId: string,
  { eventType, usageCount, generationId, metadata }: FeedbackTriggerOptions
): Promise<FeedbackTriggerResult> {
  if (!eventType) {
    if (!generationId) {
      return { shouldShow: false, reason: 'legacy_generation_missing' }
    }
    return legacyShouldShowFeedbackModal(userId, generationId)
  }

  switch (eventType) {
    case 'generation_completed': {
      const totalCompleted =
        usageCount ?? await prisma.generation.count({
          where: {
            userId,
            status: 'COMPLETED'
          }
        })

      const milestones = FEEDBACK_EVENT_MILESTONES[eventType]
      const hitMilestone = milestones.find(milestone => milestone === totalCompleted)

      if (hitMilestone) {
        return {
          shouldShow: true,
          reason: 'milestone_reached',
          milestone: hitMilestone,
          usageCount: totalCompleted
        }
      }

      return {
        shouldShow: false,
        reason: 'milestone_not_reached',
        milestone: getNextMilestone(eventType, totalCompleted),
        usageCount: totalCompleted
      }
    }

    case 'download':
    case 'share':
    case 'feature_use': {
      if (typeof usageCount !== 'number') {
        return { shouldShow: false, reason: 'usage_count_missing' }
      }

      const milestones = FEEDBACK_EVENT_MILESTONES[eventType]
      const hitMilestone = milestones.find(milestone => milestone === usageCount)

      if (hitMilestone) {
        const detail =
          eventType === 'feature_use' && metadata?.feature
            ? `feature_${metadata.feature}`
            : eventType

        return {
          shouldShow: true,
          reason: `milestone_reached_${detail}`,
          milestone: hitMilestone,
          usageCount
        }
      }

      return {
        shouldShow: false,
        reason: 'milestone_not_reached',
        milestone: getNextMilestone(eventType, usageCount),
        usageCount
      }
    }

    default:
      return { shouldShow: false, reason: 'event_not_supported' }
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
