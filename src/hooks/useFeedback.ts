import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'

type FeedbackEventType = 'generation_completed' | 'download' | 'share' | 'feature_use'

interface FeedbackState {
  shouldShow: boolean
  reason?: string
  loading: boolean
  error?: string
}

interface SubmitFeedbackArgs {
  generationId?: string | null
  rating: number
  comment?: string
}

interface TriggerFeedbackOptions {
  usageCount?: number
  metadata?: Record<string, string>
  skipProbability?: boolean
}

interface UseFeedbackOptions {
  generationId?: string | null
  probability?: number
}

const DISMISSAL_WINDOW_MS = 1000 * 60 * 60 * 24 * 3 // 3 days
const FEEDBACK_DISMISSALS_KEY = 'feedback_dismissals_v2'
const FEEDBACK_USAGE_KEY = 'feedback_usage_counts_v1'
const DEFAULT_PROBABILITY = 0.2

const EVENT_MILESTONES: Record<FeedbackEventType, number[]> = {
  generation_completed: [5, 10, 20, 50, 100],
  download: [3, 7, 15],
  share: [2, 5, 10],
  feature_use: [1, 3, 6]
}

type StoredDismissal = {
  timestamp: number
  lastUsageCount?: number
}

type StoredDismissals = Record<string, StoredDismissal>
type UsageCountMap = Record<FeedbackEventType, number>

const loadFromStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn(`Failed to parse localStorage key ${key}:`, error)
    return fallback
  }
}

const saveToStorage = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`Failed to persist localStorage key ${key}:`, error)
  }
}

export function useFeedback(options: UseFeedbackOptions = {}) {
  const { data: session } = useSession()
  const [state, setState] = useState<FeedbackState>({ shouldShow: false, loading: false })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const dismissalsRef = useRef<StoredDismissals>(loadFromStorage(FEEDBACK_DISMISSALS_KEY, {} as StoredDismissals))
  const usageCountsRef = useRef<UsageCountMap>(loadFromStorage(FEEDBACK_USAGE_KEY, {} as UsageCountMap))
  const lastTriggerRef = useRef<{ eventType: FeedbackEventType | null; usageCount?: number }>({ eventType: null })

  const probability = options.probability ?? DEFAULT_PROBABILITY
  const generationId = options.generationId ?? null

  const persistDismissals = useCallback(() => {
    saveToStorage(FEEDBACK_DISMISSALS_KEY, dismissalsRef.current)
  }, [])

  const persistUsageCounts = useCallback(() => {
    saveToStorage(FEEDBACK_USAGE_KEY, usageCountsRef.current)
  }, [])

  const buildStorageKey = useCallback((eventType: FeedbackEventType) => `event::${eventType}`, [])

  const wasRecentlyDismissed = useCallback(
    (eventType: FeedbackEventType, usageCount?: number): boolean => {
      const key = buildStorageKey(eventType)
      const dismissal = dismissalsRef.current[key]
      if (!dismissal) return false

      const elapsed = Date.now() - dismissal.timestamp
      if (usageCount !== undefined && dismissal.lastUsageCount !== undefined) {
        // Permit showing again if user surpassed previous milestone usage
        if (usageCount > dismissal.lastUsageCount) {
          return false
        }
      }

      return elapsed < DISMISSAL_WINDOW_MS
    },
    [buildStorageKey]
  )

  const recordDismissal = useCallback(
    (eventType: FeedbackEventType | null, usageCount?: number) => {
      if (!eventType) return
      const key = buildStorageKey(eventType)
      dismissalsRef.current[key] = {
        timestamp: Date.now(),
        lastUsageCount: usageCount
      }
      persistDismissals()
    },
    [buildStorageKey, persistDismissals]
  )

  const incrementUsageCount = useCallback(
    (eventType: FeedbackEventType): number => {
      const current = usageCountsRef.current[eventType] ?? 0
      const next = current + 1
      usageCountsRef.current[eventType] = next
      persistUsageCounts()
      return next
    },
    [persistUsageCounts]
  )

  const submitFeedback = useCallback(
    async ({ generationId: overrideId, rating, comment }: SubmitFeedbackArgs) => {
      const targetGenerationId = overrideId ?? generationId
      if (!targetGenerationId) {
        console.warn('Feedback submission skipped: generationId not provided.')
        return { success: false, error: 'Generation ID ausente para feedback.' }
      }

      setIsSubmitting(true)

      try {
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            generationId: targetGenerationId,
            rating,
            comment: comment?.trim() || undefined
          })
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to submit feedback')
        }

        setState(prev => ({ ...prev, shouldShow: false }))
        setIsVisible(false)
        recordDismissal(lastTriggerRef.current.eventType, lastTriggerRef.current.usageCount)

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
    },
    [generationId, recordDismissal]
  )

  const triggerFeedback = useCallback(
    async (eventType: FeedbackEventType, options?: TriggerFeedbackOptions) => {
      if (!session?.user) {
        return false
      }

      const usageCount = options?.usageCount
      if (wasRecentlyDismissed(eventType, usageCount)) {
        return false
      }

      setState(prev => ({ ...prev, loading: true, shouldShow: false }))

      try {
        const params = new URLSearchParams({ action: 'shouldShow', eventType })
        if (typeof usageCount === 'number') {
          params.set('usageCount', String(usageCount))
        }
        if (generationId) {
          params.set('generationId', generationId)
        }
        if (options?.metadata) {
          Object.entries(options.metadata).forEach(([key, value]) => {
            params.set(`meta_${key}`, value)
          })
        }

        const response = await fetch(`/api/feedback?${params.toString()}`)
        if (!response.ok) {
          throw new Error('Failed to evaluate feedback display')
        }

        const result = await response.json()
        const shouldShowFromServer = Boolean(result?.data?.shouldShow)
        const reason = result?.data?.reason
        const probabilityPass = options?.skipProbability ? true : Math.random() < probability
        const canShow = shouldShowFromServer && probabilityPass

        setState({
          shouldShow: shouldShowFromServer,
          reason,
          loading: false,
          error: undefined
        })

        lastTriggerRef.current = { eventType, usageCount }

        if (canShow) {
          setIsVisible(true)
        }

        return canShow
      } catch (error) {
        console.error('Error determining feedback visibility:', error)
        setState({
          shouldShow: false,
          reason: undefined,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        return false
      }
    },
    [generationId, probability, session?.user, wasRecentlyDismissed]
  )

  const triggerEvent = useCallback(
    async (eventType: FeedbackEventType, opts?: Omit<TriggerFeedbackOptions, 'usageCount'>) => {
      const usageCount = incrementUsageCount(eventType)
      return triggerFeedback(eventType, { ...opts, usageCount })
    },
    [incrementUsageCount, triggerFeedback]
  )

  const dismiss = useCallback(() => {
    setIsVisible(false)
    setState(prev => ({ ...prev, shouldShow: false }))
    recordDismissal(lastTriggerRef.current.eventType, lastTriggerRef.current.usageCount)
  }, [recordDismissal])

  const checkHasFeedback = useCallback(async (genId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/feedback?action=check&generationId=${genId}`)
      if (!response.ok) return false

      const result = await response.json()
      return result.data.hasFeedback
    } catch (error) {
      console.error('Error checking if feedback exists:', error)
      return false
    }
  }, [])

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

  useEffect(() => {
    // Refresh cached values in case localStorage changed between mounts
    dismissalsRef.current = loadFromStorage(FEEDBACK_DISMISSALS_KEY, {} as StoredDismissals)
    usageCountsRef.current = loadFromStorage(FEEDBACK_USAGE_KEY, {} as UsageCountMap)
  }, [])

  const api = useMemo(() => ({
    isVisible,
    shouldShow: state.shouldShow,
    loading: state.loading,
    reason: state.reason,
    error: state.error,
    isSubmitting,
    triggerFeedback,
    triggerEvent,
    dismiss,
    submitFeedback,
    checkHasFeedback,
    getFeedbackHistory,
    currentEvent: lastTriggerRef.current.eventType
  }), [
    dismiss,
    getFeedbackHistory,
    isSubmitting,
    isVisible,
    state.error,
    state.loading,
    state.reason,
    state.shouldShow,
    submitFeedback,
    triggerEvent,
    triggerFeedback
  ])

  return api
}

export type { FeedbackEventType, UseFeedbackOptions, TriggerFeedbackOptions, SubmitFeedbackArgs }
