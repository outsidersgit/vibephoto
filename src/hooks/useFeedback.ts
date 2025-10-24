import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface FeedbackState {
  shouldShow: boolean
  reason?: string
  loading: boolean
  error?: string
}

interface SubmitFeedbackParams {
  generationId: string
  rating: number
  comment?: string
}

/**
 * Hook to manage feedback submission and modal visibility
 */
export function useFeedback(generationId?: string) {
  const { data: session } = useSession()
  const [state, setState] = useState<FeedbackState>({
    shouldShow: false,
    loading: false
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  /**
   * Check if feedback modal should be shown for a generation
   */
  const checkShouldShow = useCallback(async (genId: string) => {
    if (!session?.user) {
      setState({ shouldShow: false, loading: false })
      return
    }

    setState(prev => ({ ...prev, loading: true }))

    try {
      const response = await fetch(
        `/api/feedback?action=shouldShow&generationId=${genId}`
      )

      if (!response.ok) {
        throw new Error('Failed to check feedback status')
      }

      const result = await response.json()

      setState({
        shouldShow: result.data.shouldShow,
        reason: result.data.reason,
        loading: false
      })
    } catch (error) {
      console.error('Error checking feedback status:', error)
      setState({
        shouldShow: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [session])

  /**
   * Check if feedback exists for a generation
   */
  const checkHasFeedback = useCallback(async (genId: string): Promise<boolean> => {
    try {
      const response = await fetch(
        `/api/feedback?action=check&generationId=${genId}`
      )

      if (!response.ok) return false

      const result = await response.json()
      return result.data.hasFeedback
    } catch (error) {
      console.error('Error checking if feedback exists:', error)
      return false
    }
  }, [])

  /**
   * Submit feedback
   */
  const submitFeedback = useCallback(async ({
    generationId: genId,
    rating,
    comment
  }: SubmitFeedbackParams) => {
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          generationId: genId,
          rating,
          comment: comment?.trim() || undefined
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit feedback')
      }

      // Update state to hide modal
      setState(prev => ({ ...prev, shouldShow: false }))

      return { success: true, data: result.data }
    } catch (error) {
      console.error('Error submitting feedback:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit feedback'
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  /**
   * Get user's feedback history
   */
  const getFeedbackHistory = useCallback(async (limit = 10) => {
    try {
      const response = await fetch(`/api/feedback?limit=${limit}`)

      if (!response.ok) {
        throw new Error('Failed to fetch feedback history')
      }

      const result = await response.json()
      return result.data
    } catch (error) {
      console.error('Error fetching feedback history:', error)
      return []
    }
  }, [])

  /**
   * Manually dismiss the feedback modal
   */
  const dismissModal = useCallback(() => {
    setState(prev => ({ ...prev, shouldShow: false }))

    // Store dismissal in localStorage to prevent showing again too soon
    if (generationId) {
      const dismissals = JSON.parse(
        localStorage.getItem('feedback_dismissals') || '{}'
      )
      dismissals[generationId] = Date.now()
      localStorage.setItem('feedback_dismissals', JSON.stringify(dismissals))
    }
  }, [generationId])

  /**
   * Check localStorage for recent dismissals
   */
  const wasRecentlyDismissed = useCallback((genId: string): boolean => {
    try {
      const dismissals = JSON.parse(
        localStorage.getItem('feedback_dismissals') || '{}'
      )
      const dismissedAt = dismissals[genId]

      if (!dismissedAt) return false

      // Consider dismissed if less than 24 hours ago
      const hoursSinceDismissal = (Date.now() - dismissedAt) / (1000 * 60 * 60)
      return hoursSinceDismissal < 24
    } catch {
      return false
    }
  }, [])

  // Auto-check when generationId changes
  useEffect(() => {
    if (generationId && session?.user) {
      // Check if recently dismissed
      if (wasRecentlyDismissed(generationId)) {
        setState({ shouldShow: false, loading: false })
        return
      }

      checkShouldShow(generationId)
    }
  }, [generationId, session, checkShouldShow, wasRecentlyDismissed])

  return {
    shouldShow: state.shouldShow,
    reason: state.reason,
    loading: state.loading,
    error: state.error,
    isSubmitting,
    submitFeedback,
    checkShouldShow,
    checkHasFeedback,
    getFeedbackHistory,
    dismissModal
  }
}
