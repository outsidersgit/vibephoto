import { useEffect, useMemo, useState } from 'react'
import { Star, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FeedbackBadgeProps {
  visible: boolean
  onClose: () => void
  onSubmit: (args: { rating: number; comment?: string }) => Promise<{ success: boolean }>
  isSubmitting?: boolean
  promptPreview?: string | null
  className?: string
  disableInteractions?: boolean
}

const RATING_LABELS: Record<number, string> = {
  1: 'Muito ruim',
  2: 'Ruim',
  3: 'Regular',
  4: 'Bom',
  5: 'Excelente'
}

export function FeedbackBadge({
  visible,
  onClose,
  onSubmit,
  isSubmitting = false,
  promptPreview,
  className,
  disableInteractions = false
}: FeedbackBadgeProps) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [comment, setComment] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)

  // Reset state whenever badge is reopened
  useEffect(() => {
    if (visible) {
      setRating(0)
      setHoveredRating(0)
      setComment('')
      setExpanded(false)
      setHasInteracted(false)
    }
  }, [visible])

  // Auto close after 5s if there was no interaction
  useEffect(() => {
    if (!visible) return

    const timer = window.setTimeout(() => {
      if (!hasInteracted) {
        onClose()
      }
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [visible, hasInteracted, onClose])

  const displayRating = hoveredRating || rating
  const ratingLabel = displayRating > 0 ? RATING_LABELS[displayRating] : null

  const truncatedPrompt = useMemo(() => {
    if (!promptPreview) return null
    if (promptPreview.length <= 60) return promptPreview
    return `${promptPreview.slice(0, 57)}...`
  }, [promptPreview])

  const handleRatingClick = (value: number) => {
    setHasInteracted(true)
    setRating(value)
    setExpanded(true)
  }

  const handleSkip = () => {
    setHasInteracted(true)
    onClose()
  }

  const handleSubmit = async () => {
    if (rating === 0 || isSubmitting) return
    setHasInteracted(true)
    const result = await onSubmit({ rating, comment: comment.trim() || undefined })
    if (result.success) {
      onClose()
    }
  }

  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-6 right-6 z-[60] transition-all duration-200 ease-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        className
      )}
    >
      <div
        className={cn(
          disableInteractions ? 'pointer-events-none' : 'pointer-events-auto',
          'w-[280px] rounded-2xl border border-white/40 bg-white/95 shadow-xl backdrop-blur-md',
          'ring-1 ring-black/5'
        )}
      >
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden>💬</span>
            <p className="text-sm font-semibold text-gray-900">Curtiu essa geração?</p>
          </div>

          {truncatedPrompt && (
            <p className="mt-1 text-xs text-gray-500 line-clamp-2">{`"${truncatedPrompt}"`}</p>
          )}

          <div className="mt-3 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                onClick={() => handleRatingClick(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="rounded-full p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2"
                aria-label={`Avaliar com ${star} estrela${star > 1 ? 's' : ''}`}
              >
                <Star
                  className={cn(
                    'h-5 w-5 transition-colors',
                    displayRating >= star ? 'fill-yellow-400 text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.45)]' : 'text-gray-300'
                  )}
                />
              </button>
            ))}
          </div>

          {ratingLabel && (
            <p className="mt-2 text-xs font-medium text-gray-600">{ratingLabel}</p>
          )}

          {expanded && (
            <div className="mt-3">
              <label htmlFor="feedback-comment" className="text-xs font-medium text-gray-500">
                Comentário (opcional)
              </label>
              <textarea
                id="feedback-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Conte em poucas palavras o que achou..."
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              />
              <div className="mt-1 text-right text-[10px] text-gray-400">{comment.length}/300</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-2.5">
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs font-medium text-gray-500 transition hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2"
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
            className={cn(
              'inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition',
              'disabled:pointer-events-none disabled:opacity-60 hover:from-blue-500 hover:to-purple-500'
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Enviando
              </>
            ) : (
              'Enviar'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

