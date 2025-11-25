'use client'

import { useState } from 'react'
import { X, Star, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useFeedback } from '@/hooks/useFeedback'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  generationId: string
  generationPrompt?: string
  onSuccess?: () => void
}

export function FeedbackModal({
  isOpen,
  onClose,
  generationId,
  generationPrompt,
  onSuccess
}: FeedbackModalProps) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const { submitFeedback, isSubmitting } = useFeedback()

  const handleSubmit = async () => {
    if (rating === 0) return

    const result = await submitFeedback({
      generationId,
      rating,
      comment
    })

    if (result.success) {
      setSubmitted(true)
      onSuccess?.()

      // Close modal after showing success message
      setTimeout(() => {
        onClose()
        // Reset state
        setTimeout(() => {
          setRating(0)
          setComment('')
          setSubmitted(false)
        }, 300)
      }, 2000)
    }
  }

  const handleSkip = () => {
    onClose()
    // Reset state
    setTimeout(() => {
      setRating(0)
      setComment('')
    }, 300)
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm"
        onClick={handleSkip}
      />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div className="relative w-full max-w-md bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden animate-in fade-in zoom-in duration-200 pointer-events-auto">
          {/* Close button */}
          <button
            onClick={handleSkip}
            disabled={isSubmitting}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-700/50 transition-colors disabled:opacity-50 z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>

          {/* Content */}
          <div className="p-6 sm:p-8">
            {submitted ? (
              // Success state
              <div className="text-center py-8 animate-in fade-in zoom-in duration-300">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Obrigado pelo feedback!
                </h3>
                <p className="text-slate-400">
                  Sua opinião nos ajuda a melhorar continuamente.
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Como foi sua experiência?
                  </h2>
                  <p className="text-slate-400 text-sm">
                    Avalie a qualidade da imagem gerada
                  </p>
                  {generationPrompt && (
                    <p className="mt-3 text-xs text-slate-500 italic truncate">
                      "{generationPrompt}"
                    </p>
                  )}
                </div>

                {/* Star rating */}
                <div className="flex justify-center gap-2 mb-6">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isActive = star <= (hoveredRating || rating)
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        disabled={isSubmitting}
                        className="group p-1 transition-transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={`Rate ${star} stars`}
                      >
                        <Star
                          className={`w-10 h-10 sm:w-12 sm:h-12 transition-all ${
                            isActive
                              ? 'fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]'
                              : 'text-slate-600 group-hover:text-slate-500'
                          }`}
                        />
                      </button>
                    )
                  })}
                </div>

                {/* Rating labels */}
                {rating > 0 && (
                  <div className="text-center mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
                    <p className="text-sm font-medium text-slate-300">
                      {rating === 1 && '😞 Muito ruim'}
                      {rating === 2 && '😕 Ruim'}
                      {rating === 3 && '😐 Regular'}
                      {rating === 4 && '😊 Bom'}
                      {rating === 5 && '🤩 Excelente'}
                    </p>
                  </div>
                )}

                {/* Comment textarea (optional) */}
                <div className="mb-6">
                  <label htmlFor="comment" className="block text-sm font-medium text-slate-300 mb-2">
                    Comentário (opcional)
                  </label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Conte-nos mais sobre sua experiência..."
                    maxLength={1000}
                    rows={3}
                    disabled={isSubmitting}
                    className="w-full bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 resize-none"
                  />
                  <p className="mt-1 text-xs text-slate-500 text-right">
                    {comment.length}/1000
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSkip}
                    disabled={isSubmitting}
                    className="flex-1 bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
                  >
                    Agora não
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={rating === 0 || isSubmitting}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Enviar
                      </>
                    )}
                  </Button>
                </div>

                {/* Privacy note */}
                <p className="mt-4 text-xs text-slate-500 text-center">
                  Seu feedback é anônimo e nos ajuda a melhorar o serviço
                </p>
              </>
            )}
          </div>

          {/* Decorative gradient */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
        </div>
      </div>
    </>
  )
}
